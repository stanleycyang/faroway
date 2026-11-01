import {
  evaluateDayAvailability,
  validateDayAvailability,
} from "./day-availability";
import { readDayTiming } from "../../../packages/types/src/day-timing";
import { suppliedDistanceKm } from "./route-eval";
import { inclusiveDays, assertValidBriefParty, type UatBrief } from "./briefs";

/** Agent outputs, not fabricated reference answers or externally verified facts. */
export interface AgenticTrace {
  version: 1;
  runId: string;
  configId: string;
  brief: UatBrief;
  source: { commit: string; dirty: boolean; filesSha256: string };
  startedAt: string;
  settings: Record<string, string>;
  steps: Array<{
    step: string;
    output: unknown;
    latencyMs: number;
    usage: unknown;
    fallbacks: Array<{ reason: string; outcome: string }>;
  }>;
  mappedItinerary?: unknown;
}

export interface AgenticEvaluation {
  rubric: "agentic-contracts-v1";
  contractPass: boolean;
  failures: string[];
  warnings: string[];
  unknowns: string[];
  timing: {
    representation: "day_parts_only" | "day_parts_with_proposed_times";
    feasibility: "unverified";
    /** A mention can be positive or negative; this does not infer a request. */
    restInstructionPresent: boolean;
    days: Array<{ date: string; activityMinutes: number }>;
    missingEvidence: string[];
  };
  metrics: {
    days: number;
    activities: number;
    meals: number;
    uniqueRestaurants: number;
    unassignedMealSlots: number;
    fallbackSteps: number;
    serialAgentMs: number;
  };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
function strings(value: unknown): string[] {
  return array(value).filter((v): v is string => typeof v === "string");
}
const slots = ["morning", "afternoon", "evening"] as const;
const steps = ["orchestrator", "hotels", "activities", "dining", "aggregator"];

/** Deterministic integrity checks. Passing is NOT a judgment of traveler usefulness. */
export function evaluateAgenticTrace(trace: AgenticTrace): AgenticEvaluation {
  if (trace.version !== 1 || !Array.isArray(trace.steps))
    throw new Error("Unsupported or malformed trace");
  const failures: string[] = [];
  const warnings: string[] = [];
  const fail = (message: string) => {
    failures.push(message);
  };
  const output = (step: string) =>
    trace.steps.find((s) => s.step === step)?.output;
  if (trace.steps.map((s) => s.step).join() !== steps.join())
    fail("incomplete_or_invalid_step_sequence");
  const fallbackSteps = trace.steps.filter(
    (s) => s.fallbacks.length > 0,
  ).length;
  if (fallbackSteps) fail("fallback_used");
  const { brief } = trace;
  assertValidBriefParty(brief);
  const explicitMinuteLimit = brief.expectedMaxActivityMinutesPerDay;
  if (
    explicitMinuteLimit !== undefined &&
    (!Number.isInteger(explicitMinuteLimit) ||
      explicitMinuteLimit < 0 ||
      explicitMinuteLimit > 1440)
  )
    throw new Error("Invalid reference daily activity limit");
  const start = Date.parse(brief.startDate + "T00:00:00Z");
  const end = Date.parse(brief.endDate + "T00:00:00Z");
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start ||
    end - start > 30 * 86400000 ||
    new Date(start).toISOString().slice(0, 10) !== brief.startDate ||
    new Date(end).toISOString().slice(0, 10) !== brief.endDate
  )
    throw new Error(
      "Evaluation brief requires valid dates spanning at most 31 days",
    );
  const expectedDates = inclusiveDays(brief.startDate, brief.endDate);
  validateDayAvailability(brief.expectedDayAvailability ?? [], expectedDates);
  const plan = object(output("orchestrator"));
  const dates = object(plan.dates);
  if (dates.start !== brief.startDate || dates.end !== brief.endDate)
    fail("orchestrator_dates_changed");
  for (const field of ["travelers", "adults", "children"] as const)
    if (plan[field] !== brief[field]) fail(`orchestrator_${field}_changed`);
  if (brief.roomCount !== undefined && plan.roomCount !== brief.roomCount)
    fail("orchestrator_room_count_changed");
  if (
    brief.childAges !== undefined &&
    JSON.stringify(plan.childAges) !== JSON.stringify(brief.childAges)
  )
    fail("orchestrator_child_ages_changed");
  const interests = strings(object(plan.activityCriteria).interests);
  if (brief.interests.some((i) => !interests.includes(i)))
    fail("interests_lost");
  if (brief.mobilityNeeds && plan.mobilityNeeds !== brief.mobilityNeeds)
    fail("mobility_needs_lost");
  const diet = strings(object(plan.diningCriteria).dietaryNeeds);
  if (brief.dietaryRestrictions?.some((d) => !diet.includes(d)))
    fail("dietary_restrictions_lost");
  if (brief.requirements) {
    const actual = object(plan.requirements);
    for (const field of [
      "allergies",
      "dietaryPreferences",
      "accessibility",
    ] as const)
      if (
        brief.requirements[field].some(
          (v) => !strings(actual[field]).includes(v),
        )
      )
        fail(`requirements_${field}_lost`);
    if (
      brief.requirements.mobilityNotes &&
      actual.mobilityNotes !== brief.requirements.mobilityNotes
    )
      fail("requirements_mobility_notes_lost");
  }
  const activities = array(output("activities"));
  const dining = array(output("dining"));
  const activityIds = new Set(activities.map((a) => object(a).id));
  const diningIds = new Set(dining.map((a) => object(a).id));
  if (!activities.length) fail("empty_activity_inventory");
  if (!dining.length) fail("empty_dining_inventory");
  if (activityIds.size !== activities.length || activityIds.has(undefined))
    fail("invalid_activity_inventory_ids");
  if (diningIds.size !== dining.length || diningIds.has(undefined))
    fail("invalid_dining_inventory_ids");
  const days = array(object(output("aggregator")).days);
  const mappedDays = array(object(trace.mappedItinerary).days);
  if (days.map((d) => object(d).date).join() !== expectedDates.join())
    fail("day_coverage");
  if (mappedDays.map((d) => object(d).date).join() !== expectedDates.join())
    fail("mapped_day_coverage");
  const usedActivities = new Set<unknown>();
  const restaurants = new Set<unknown>();
  const timingDays: AgenticEvaluation["timing"]["days"] = [];
  let activityCount = 0;
  let mealCount = 0;
  for (const [index, rawDay] of days.entries()) {
    const day = object(rawDay);
    const mapped = object(mappedDays[index]);
    const availability = brief.expectedDayAvailability?.find(
      (item) => item.date === day.date,
    );
    if (availability) {
      const result = evaluateDayAvailability(day, availability);
      result.violations.forEach((finding) =>
        fail(`day_${index + 1}:${finding}`),
      );
      result.unknowns.forEach((finding) =>
        warnings.push(`day_${index + 1}:${finding}`),
      );
    }
    if (
      day.timingProposal !== undefined ||
      mapped.timingProposal !== undefined
    ) {
      const timing = readDayTiming(day);
      if (!timing) fail(`day_${index + 1}:invalid_timing_proposal`);
      else if (!timing.fitsPolicy)
        fail(`day_${index + 1}:midday_rest_timing_conflict`);
      if (
        !readDayTiming(mapped) ||
        JSON.stringify(day.timingProposal) !==
          JSON.stringify(mapped.timingProposal)
      )
        fail(`day_${index + 1}:mapped_timing_changed`);
    }
    if (day.dayNumber !== index + 1) fail(`day_${index + 1}:number`);
    if (!day.title || !day.summary)
      fail(`day_${index + 1}:missing_description`);
    let count = 0;
    let meals = 0;
    let dayMinutes = 0;
    for (const slotName of slots) {
      const slot = object(day[slotName]);
      const items = array(slot.activities);
      const mappedSlot = object(mapped[slotName]);
      if (
        items.map((a) => object(a).id).join() !==
        array(mappedSlot.activities)
          .map((a) => object(a).id)
          .join()
      )
        fail(`day_${index + 1}:${slotName}:mapped_activity_identity`);
      let minutes = 0;
      for (const raw of items) {
        const a = object(raw);
        if (!activityIds.has(a.id)) fail(`unknown_activity:${String(a.id)}`);
        if (usedActivities.has(a.id))
          fail(`duplicate_activity:${String(a.id)}`);
        usedActivities.add(a.id);
        // Generated names/descriptions cannot establish an event's actual dates,
        // venue or tickets. Keep this evidence gap visible even without an
        // explicit uncertainty label; this is a warning, not proof of absence.
        if (
          typeof a.name === "string" &&
          /\b(?:concert|performance|festival|exhibition)\b/i.test(
            a.name.replace(
              /\bexhibition\s+(?:building|hall|centre|center)\b/gi,
              "",
            ),
          )
        )
          warnings.push(
            `event_date_and_venue_evidence_required:${String(a.id)}`,
          );
        // The trace has no dated special-admission evidence. These explicit
        // claims cannot be accepted merely because they fit an evening slot.
        // Keep this check independent of the runtime candidate filter.
        if (
          typeof a.name === "string" &&
          /\b(?:late[-\s]+(?:view(?:ing)?s?|openings?)|after[-\s]+hours?\s+(?:admission|access|visit|viewing|opening|tour)s?)\b/i.test(
            a.name.normalize("NFKC"),
          )
        )
          fail(`unverified_special_opening:${String(a.id)}`);
        if (a.bestTimeOfDay !== "any" && a.bestTimeOfDay !== slotName)
          fail(`wrong_time_of_day:${String(a.id)}`);
        if (
          typeof a.duration !== "number" ||
          !Number.isInteger(a.duration) ||
          a.duration <= 0
        )
          fail(`invalid_duration:${String(a.id)}`);
        else minutes += a.duration;
      }
      if (minutes > 240)
        warnings.push(
          `day_${index + 1}:${slotName}:over_four_hours_before_meals_and_transfers`,
        );
      dayMinutes += minutes;
      count += items.length;
      const meal = object(slot.meal);
      const mappedMeals = array(mappedSlot.meals);
      if (slot.meal) {
        if (!diningIds.has(meal.id))
          fail(`unknown_restaurant:${String(meal.id)}`);
        if (mappedMeals.length !== 1 || object(mappedMeals[0]).id !== meal.id)
          fail(`day_${index + 1}:${slotName}:mapped_meal_identity`);
        const expectedMeal = {
          morning: "breakfast",
          afternoon: "lunch",
          evening: "dinner",
        }[slotName];
        if (!strings(meal.mealTypes).includes(expectedMeal))
          fail(`day_${index + 1}:${slotName}:incompatible_meal_type`);
        // A meal named in an activity is a review signal, not proof that food
        // is included. Preserve both options until inclusion is verified.
        if (
          items.some((item) =>
            new RegExp(`\\b${expectedMeal}\\b`, "i").test(
              String(object(item).name ?? ""),
            ),
          )
        )
          warnings.push(
            `day_${index + 1}:${slotName}:possible_duplicate_${expectedMeal}_activity_and_restaurant`,
          );
        // An empty activity slot still needs a meal near the day's other stops.
        const anchors = items.length
          ? items
          : slots.flatMap((name) => array(object(day[name]).activities));
        const distances = anchors.map((item) =>
          suppliedDistanceKm(object(item).location, meal.location),
        );
        if (
          distances.length &&
          distances.every((distance) => distance != null && distance > 3)
        )
          warnings.push(
            `day_${index + 1}:${slotName}:meal_over_3km_from_${items.length ? "all" : "day"}_activities_on_unverified_coordinates`,
          );
        restaurants.add(meal.id);
        meals += 1;
      } else if (mappedMeals.length)
        fail(`day_${index + 1}:${slotName}:invented_mapped_meal`);
    }
    if (explicitMinuteLimit !== undefined && dayMinutes > explicitMinuteLimit)
      fail(`day_${index + 1}:exceeds_explicit_activity_minutes`);
    const pace = object(plan.activityCriteria).pacePreference;
    const dayLimit =
      pace === "relaxed"
        ? { count: 2, minutes: 240 }
        : pace === "packed"
          ? { count: 5, minutes: 600 }
          : { count: 4, minutes: 420 };
    if (count > dayLimit.count || dayMinutes > dayLimit.minutes)
      warnings.push(
        `day_${index + 1}:exceeds_${String(pace ?? "moderate")}_pace_budget`,
      );
    if (!count && !availability?.allowEmptyDay)
      fail(`day_${index + 1}:no_activities`);
    if (!meals && !availability?.allowEmptyDay)
      fail(`day_${index + 1}:no_meals`);
    if (day.transport && index !== 0)
      fail(`day_${index + 1}:repeated_outbound_transport`);
    timingDays.push({ date: String(day.date), activityMinutes: dayMinutes });
    activityCount += count;
    mealCount += meals;
  }
  if (mealCount > 3 && restaurants.size < Math.ceil(mealCount / 2))
    warnings.push("low_restaurant_variety");
  return {
    rubric: "agentic-contracts-v1",
    contractPass: failures.length === 0,
    failures,
    warnings,
    unknowns: [
      "Venue existence, opening hours and route feasibility require independent evidence.",
      "Dietary and accessibility suitability are not established by generated descriptions.",
      "Traveler usefulness requires separate review; contract pass is not quality acceptance.",
      "Serial agent duration is not app latency or time to first useful content.",
    ],
    timing: {
      representation: days.some(
        (day) => object(day).timingProposal !== undefined,
      )
        ? "day_parts_with_proposed_times"
        : "day_parts_only",
      feasibility: "unverified",
      restInstructionPresent: /\b(?:rests?|breaks?|naps?)\b/i.test(
        `${brief.mobilityNeeds ?? ""} ${brief.requirements?.mobilityNotes ?? ""}`,
      ),
      days: timingDays,
      missingEvidence: [
        "Visit start/end times and operating windows",
        "Meal durations and reservation times",
        "Travel durations between stops and any hotel return",
        "Explicit rest intervals and their fit with traveler instructions",
      ],
    },
    metrics: {
      days: days.length,
      activities: activityCount,
      meals: mealCount,
      uniqueRestaurants: restaurants.size,
      unassignedMealSlots: days.length * 3 - mealCount,
      fallbackSteps,
      serialAgentMs: trace.steps.reduce((n, s) => n + s.latencyMs, 0),
    },
  };
}
