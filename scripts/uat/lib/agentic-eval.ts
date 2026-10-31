import { inclusiveDays, type UatBrief } from "./briefs";

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
  metrics: {
    days: number;
    activities: number;
    meals: number;
    uniqueRestaurants: number;
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
  const plan = object(output("orchestrator"));
  const dates = object(plan.dates);
  if (dates.start !== brief.startDate || dates.end !== brief.endDate)
    fail("orchestrator_dates_changed");
  for (const field of ["travelers", "adults", "children"] as const)
    if (plan[field] !== brief[field]) fail(`orchestrator_${field}_changed`);
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
  let activityCount = 0;
  let mealCount = 0;
  for (const [index, rawDay] of days.entries()) {
    const day = object(rawDay);
    const mapped = object(mappedDays[index]);
    if (day.dayNumber !== index + 1) fail(`day_${index + 1}:number`);
    if (!day.title || !day.summary)
      fail(`day_${index + 1}:missing_description`);
    let count = 0;
    let meals = 0;
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
      count += items.length;
      const meal = object(slot.meal);
      const mappedMeals = array(mappedSlot.meals);
      if (slot.meal) {
        if (!diningIds.has(meal.id))
          fail(`unknown_restaurant:${String(meal.id)}`);
        if (mappedMeals.length !== 1 || object(mappedMeals[0]).id !== meal.id)
          fail(`day_${index + 1}:${slotName}:mapped_meal_identity`);
        restaurants.add(meal.id);
        meals += 1;
      } else if (mappedMeals.length)
        fail(`day_${index + 1}:${slotName}:invented_mapped_meal`);
    }
    if (!count) fail(`day_${index + 1}:no_activities`);
    if (!meals) fail(`day_${index + 1}:no_meals`);
    if (day.transport && index !== 0)
      fail(`day_${index + 1}:repeated_outbound_transport`);
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
    metrics: {
      days: days.length,
      activities: activityCount,
      meals: mealCount,
      uniqueRestaurants: restaurants.size,
      fallbackSteps,
      serialAgentMs: trace.steps.reduce((n, s) => n + s.latencyMs, 0),
    },
  };
}
