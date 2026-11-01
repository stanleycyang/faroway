import { requestsMiddayRest, proposeRestDayTiming } from "./schedule-timing";
import { mealBoundaryAnchors, type VisitSlots } from "./meal-boundaries";
import { matchesSuggestedHighlight } from "./highlight-match";
import { suppliedDistanceKm } from "./supplied-distance";
import {
  familyActivityReviewReason,
  activityMobilityReviewReason,
} from "./party-suitability";
import type {
  ActivityResult,
  DiningResult,
  SearchPlan,
  SuggestedDay,
} from "./types";

const SLOTS = ["morning", "afternoon", "evening"] as const;
const MEALS = ["breakfast", "lunch", "dinner"] as const;
const BEAM_WIDTH = 32;
const INVENTORY_LIMIT = 24;

interface Selection {
  activity: ActivityResult;
  day: number;
  slot: number;
}
interface State {
  selected: Selection[];
  used: Set<string>;
  score: number;
}

/** Caller-supplied evidence to avoid a visit; it never certifies other dates as open. */
export interface ScheduleExclusion {
  activityId: string;
  date: string;
  reason: string;
  sourceUrl: string;
  observedAt: string;
}

export interface CompiledSchedule {
  days: SuggestedDay[];
  unselectedActivityIds: string[];
  unfulfilledHighlights: string[];
  deferredLongVisits: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    dailyBudgetMinutes: number;
    matchedHighlights: string[];
  }>;
  reviewRequiredActivities: Array<{ id: string; reason: string }>;
  issues: string[];
  timingProposals: ReturnType<typeof proposeRestDayTiming>[];
  /** A feasible allocation is not evidence that venues are open or suitable. */
  verified: false;
}

/**
 * Experimental allocation over supplied inventory. No model, provider or database
 * calls. Bounded beam search balances day coverage, supplied preference scores and
 * geographic proximity. This is a heuristic, not a globally optimal route solver.
 */
export function compileSchedule(
  plan: SearchPlan,
  inventory: ActivityResult[],
  dining: DiningResult[],
  exclusions: readonly ScheduleExclusion[] = [],
): CompiledSchedule {
  const start = Date.parse(`${plan.dates.start}T00:00:00Z`);
  const end = Date.parse(`${plan.dates.end}T00:00:00Z`);
  const daysCount = (end - start) / 86400000 + 1;
  if (
    !Number.isInteger(daysCount) ||
    daysCount < 1 ||
    daysCount > 31 ||
    new Date(start).toISOString().slice(0, 10) !== plan.dates.start ||
    new Date(end).toISOString().slice(0, 10) !== plan.dates.end
  )
    throw new Error(
      "Schedule compiler requires valid dates spanning at most 31 days",
    );
  const pace = plan.activityCriteria.pacePreference;
  const limits =
    pace === "relaxed"
      ? { count: 2, minutes: 240, slot: 180, target: 2 }
      : pace === "packed"
        ? { count: 5, minutes: 600, slot: 240, target: 4 }
        : { count: 4, minutes: 420, slot: 210, target: 3 };
  const issues: string[] = [];
  const excluded = new Set(
    exclusions.map((item) => `${item.date}:${item.activityId}`),
  );
  for (const item of exclusions) {
    if (!inventory.some((activity) => activity.id === item.activityId))
      issues.push(`constraint_activity_not_found:${item.activityId}`);
  }
  const ids = new Set<string>();
  const reviewRequiredActivities: CompiledSchedule["reviewRequiredActivities"] =
    [];
  const candidates = inventory
    .filter((activity) => {
      if (
        !activity.id ||
        ids.has(activity.id) ||
        !Number.isInteger(activity.duration) ||
        activity.duration < 1 ||
        activity.duration > limits.minutes ||
        ![...SLOTS, "any"].includes(activity.bestTimeOfDay)
      ) {
        issues.push(`excluded_invalid_or_infeasible_activity:${activity.id}`);
        return false;
      }
      ids.add(activity.id);
      const familyReview =
        (plan.children ?? 0) > 0
          ? familyActivityReviewReason(activity.name)
          : null;
      if (familyReview) {
        reviewRequiredActivities.push({
          id: activity.id,
          reason: familyReview,
        });
        issues.push(`family_suitability_review_required:${activity.id}`);
        return false;
      }
      const mobilityReview = activityMobilityReviewReason(
        plan,
        activity.description,
      );
      if (mobilityReview) {
        reviewRequiredActivities.push({
          id: activity.id,
          reason: mobilityReview,
        });
        issues.push(`mobility_suitability_review_required:${activity.id}`);
        return false;
      }
      return true;
    })
    .sort((a, b) => preference(b) - preference(a) || a.id.localeCompare(b.id));
  if (candidates.length > INVENTORY_LIMIT)
    issues.push("inventory_search_limit");
  const activities = candidates.slice(0, INVENTORY_LIMIT);
  const highlights = [...new Set(plan.activityCriteria.mustSee ?? [])];
  const matches = new Map(
    activities.map((activity) => [
      activity.id,
      highlights.filter((highlight) =>
        matchesSuggestedHighlight(activity.name, highlight),
      ),
    ]),
  );
  // A count reservation alone cannot protect a visit that is uniquely available
  // on a later date. Bipartite matching checks one-visit-per-day feasibility.
  const coverageCache = new Map<string, boolean>();
  const canCoverDays = (
    firstDay: number,
    used: ReadonlySet<string>,
  ): boolean => {
    if (activities.length - used.size < daysCount - firstDay) return false;
    const key = JSON.stringify([firstDay, [...used].sort()]);
    const cached = coverageCache.get(key);
    if (cached != null) return cached;
    const assigned = new Map<string, number>();
    const assign = (day: number, visited: Set<string>): boolean => {
      const date = new Date(start + day * 86400000).toISOString().slice(0, 10);
      for (const activity of activities) {
        if (
          used.has(activity.id) ||
          visited.has(activity.id) ||
          excluded.has(`${date}:${activity.id}`)
        )
          continue;
        visited.add(activity.id);
        const previousDay = assigned.get(activity.id);
        if (previousDay == null || assign(previousDay, visited)) {
          assigned.set(activity.id, day);
          return true;
        }
      }
      return false;
    };
    let possible = true;
    for (let day = firstDay; day < daysCount; day++) {
      if (!assign(day, new Set())) {
        possible = false;
        break;
      }
    }
    coverageCache.set(key, possible);
    return possible;
  };
  const protectCoverage = exclusions.length > 0 && canCoverDays(0, new Set());
  let beam: State[] = [{ selected: [], used: new Set(), score: 0 }];
  for (let day = 0; day < daysCount; day++) {
    for (let slot = 0; slot < SLOTS.length; slot++) {
      const expanded: State[] = [];
      for (const state of beam) {
        expanded.push(state); // Empty slots are intentional breathing room.
        const today = state.selected.filter((s) => s.day === day);
        const usedMinutes = today.reduce(
          (sum, s) => sum + s.activity.duration,
          0,
        );
        const remainingDays = daysCount - day - 1;
        // Reserve enough unused visits to cover later days when supply permits.
        const countLimit = Math.min(
          limits.count,
          Math.max(
            1,
            activities.length - state.used.size - remainingDays + today.length,
          ),
        );
        const date = new Date(start + day * 86400000)
          .toISOString()
          .slice(0, 10);
        const eligible = activities.filter(
          (a) =>
            !state.used.has(a.id) &&
            !excluded.has(`${date}:${a.id}`) &&
            (a.bestTimeOfDay === "any" || a.bestTimeOfDay === SLOTS[slot]),
        );
        const choices = eligible.map((a) => [a]);
        if (pace !== "relaxed") {
          for (let i = 0; i < eligible.length; i++) {
            for (let j = i + 1; j < eligible.length; j++)
              choices.push([eligible[i], eligible[j]]);
          }
        }
        for (const choice of choices) {
          const minutes = choice.reduce((sum, a) => sum + a.duration, 0);
          if (
            today.length + choice.length > countLimit ||
            usedMinutes + minutes > limits.minutes ||
            (choice.length > 1 && minutes > limits.slot)
          )
            continue;
          const used = new Set([...state.used, ...choice.map((a) => a.id)]);
          if (protectCoverage && !canCoverDays(day + 1, used)) continue;
          let score = state.score;
          const coveredHighlights = new Set(
            state.selected.flatMap((s) => matches.get(s.activity.id) ?? []),
          );
          let previous = today.at(-1)?.activity;
          for (const [index, activity] of choice.entries()) {
            for (const highlight of matches.get(activity.id) ?? []) {
              if (!coveredHighlights.has(highlight)) {
                score += 75;
                coveredHighlights.add(highlight);
              }
            }
            const count = today.length + index;
            score +=
              (count === 0 ? 1000 : count < limits.target ? 30 : -10) +
              preference(activity) / 10;
            if (previous) {
              const distance = suppliedDistanceKm(
                previous.location,
                activity.location,
              );
              score -= distance == null ? 8 : Math.min(40, distance * 2);
            }
            previous = activity;
          }
          expanded.push({
            selected: [
              ...state.selected,
              ...choice.map((activity) => ({ activity, day, slot })),
            ],
            used,
            score,
          });
        }
      }
      // Stable tie ordering makes replays reproducible on identical inventory.
      const ranked = expanded.sort((a, b) => b.score - a.score);
      if (slot === SLOTS.length - 1) beam = ranked.slice(0, BEAM_WIDTH);
      else {
        // Preserve partially empty days until later slots are considered. Otherwise
        // early short visits crowd long evening highlights out of the search beam.
        const perCount = Math.max(
          1,
          Math.floor(BEAM_WIDTH / (limits.count + 1)),
        );
        const counts = new Map<number, number>();
        beam = ranked.filter((state) => {
          const count = state.selected.filter((s) => s.day === day).length;
          const kept = counts.get(count) ?? 0;
          if (kept >= perCount) return false;
          counts.set(count, kept + 1);
          return true;
        });
      }
    }
  }
  const best = beam[0];
  const selectedHighlights = new Set(
    best.selected.flatMap((s) => matches.get(s.activity.id) ?? []),
  );
  const unfulfilledHighlights = highlights.filter(
    (highlight) => !selectedHighlights.has(highlight),
  );
  for (const highlight of unfulfilledHighlights)
    issues.push(`suggested_highlight_not_scheduled:${highlight}`);
  const deferredLongVisits = inventory
    .filter(
      (activity, index) =>
        activity.id &&
        inventory.findIndex((a) => a.id === activity.id) === index &&
        Number.isInteger(activity.duration) &&
        activity.duration > limits.minutes &&
        activity.duration <= 1440 &&
        !activityMobilityReviewReason(plan, activity.description) &&
        [...SLOTS, "any"].includes(activity.bestTimeOfDay) &&
        !(
          (plan.children ?? 0) > 0 && familyActivityReviewReason(activity.name)
        ),
    )
    .map((activity) => ({
      id: activity.id,
      name: activity.name,
      durationMinutes: activity.duration,
      dailyBudgetMinutes: limits.minutes,
      matchedHighlights: unfulfilledHighlights.filter((highlight) =>
        matchesSuggestedHighlight(activity.name, highlight),
      ),
    }));
  const usedMeals = new Set<string>();
  const days: SuggestedDay[] = Array.from({ length: daysCount }, (_, day) => {
    const selected = best.selected.filter((s) => s.day === day);
    const tips = [
      "Planning draft: confirm opening hours, availability, travel times and suitability before booking.",
      "Leave the unscheduled time for meals, travel and rest.",
    ];
    if (day === 0) {
      for (const review of reviewRequiredActivities
        .filter((item) => item.reason === "supplied_access_conflict")
        .slice(0, 3)) {
        const name = inventory.find(
          (activity) => activity.id === review.id,
        )?.name;
        tips.push(
          `Not scheduled: ${name}. Its supplied description reports an access obstacle that conflicts with your request. Confirm an accessible route before adding it.`,
        );
      }
      for (const highlight of unfulfilledHighlights.slice(0, 3)) {
        const longVisit = deferredLongVisits.find((visit) =>
          visit.matchedHighlights.includes(highlight),
        );
        if (
          longVisit &&
          !activities.some((activity) =>
            matchesSuggestedHighlight(activity.name, highlight),
          )
        ) {
          const duration = (minutes: number) =>
            `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ""}`;
          tips.push(
            `Suggested highlight not included: ${highlight}. The supplied option, ${longVisit.name}, is estimated at ${duration(longVisit.durationMinutes)}, above this draft's ${duration(longVisit.dailyBudgetMinutes)} daily activity limit. Look for a shorter alternative or review the pace before adding it.`,
          );
        } else
          tips.push(
            `Suggested highlight not matched by name: ${highlight}. It may be absent or listed under a different title; check the selected visits before adding or replacing anything. Availability has not been verified.`,
          );
      }
      if (unfulfilledHighlights.length > 3)
        tips.push(
          `${unfulfilledHighlights.length - 3} other suggested highlights are also not matched by name. Review the remaining choices before finalizing this draft.`,
        );
    }
    if (!selected.length) {
      issues.push(`day_${day + 1}:activity_supply_gap`);
      tips.push(
        "No suitable unused visits fit this day; local suggestions are still needed.",
      );
    }
    if (selected.some((s) => s.activity.duration > limits.slot))
      tips.push(
        "A long visit occupies its own slot; confirm its timing before adding other plans.",
      );
    if (plan.requirements?.allergies.length)
      tips.push(
        "Contact each restaurant directly about your allergies and cross-contact precautions. No venue's allergy handling has been verified.",
      );
    const visitSlots = Object.fromEntries(
      SLOTS.map((name, slot) => [
        name,
        {
          activities: selected
            .filter((s) => s.slot === slot)
            .map((s) => s.activity),
        },
      ]),
    ) as VisitSlots;
    const slots = SLOTS.map((name, slot) => {
      const stops = visitSlots[name].activities;
      const anchors = mealBoundaryAnchors(visitSlots, name);
      if (anchors.length === 2) {
        const separation = suppliedDistanceKm(
          anchors[0].location,
          anchors[1].location,
        );
        if (separation != null && separation > 6) {
          issues.push(`day_${day + 1}:${MEALS[slot]}:separated_visit_anchors`);
          tips.push(
            `The visits around ${MEALS[slot]} are far apart on the supplied locations. Plan the transfer and choose which area to eat in, or move a visit; a restaurant change alone cannot make both legs short. Routes and locations need confirmation.`,
          );
        }
      }
      const choices = dining.filter((meal) =>
        meal.mealTypes.includes(MEALS[slot]),
      );
      const ranked = choices
        .map((meal) => {
          const distances = anchors.map((a) =>
            suppliedDistanceKm(a.location, meal.location),
          );
          const known = distances.length && distances.every((d) => d != null);
          const distance = known ? Math.max(...(distances as number[])) : null;
          const totalDistance = known
            ? (distances as number[]).reduce((sum, value) => sum + value, 0)
            : null;
          return {
            meal,
            distance,
            score:
              (totalDistance == null ? 10 : totalDistance) +
              (usedMeals.has(meal.id) ? 3 : 0),
          };
        })
        .sort((a, b) => {
          const group = (distance: number | null) =>
            distance == null ? 2 : distance <= 3 ? 0 : 1;
          return (
            group(a.distance) - group(b.distance) ||
            a.score - b.score ||
            a.meal.id.localeCompare(b.meal.id)
          );
        });
      const chosen = ranked[0];
      if (chosen) {
        const mealExperiences = stops.filter((activity) =>
          new RegExp(`\\b${MEALS[slot]}\\b`, "i").test(activity.name),
        );
        if (mealExperiences.length) {
          issues.push(`day_${day + 1}:${MEALS[slot]}:possible_meal_overlap`);
          tips.push(
            `${mealExperiences.map((activity) => activity.name).join("; ")} may already cover ${MEALS[slot]}. Check the exact experience and meal inclusions before arranging a separate meal at ${chosen.meal.name}; inclusion has not been verified.`,
          );
        }
      }
      if (!chosen) {
        issues.push(`day_${day + 1}:${MEALS[slot]}:meal_supply_gap`);
        tips.push(
          `No ${MEALS[slot]} suggestion is available; find a suitable local option.`,
        );
      } else {
        usedMeals.add(chosen.meal.id);
        if (chosen.distance == null)
          issues.push(`day_${day + 1}:${MEALS[slot]}:route_unknown`);
        else if (chosen.distance > 3) {
          issues.push(`day_${day + 1}:${MEALS[slot]}:distant_meal`);
          tips.push(
            `${chosen.meal.name} may need a separate journey. Check the route or choose a closer option; supplied locations are unverified.`,
          );
        }
      }
      return { activities: stops, meal: chosen?.meal };
    });
    return {
      dayNumber: day + 1,
      date: new Date(start + day * 86400000).toISOString().slice(0, 10),
      title: `Day ${day + 1} in ${plan.destination}`,
      summary: selected.length
        ? `Suggested visits: ${selected.map((s) => s.activity.name).join("; ")}. Keep the remaining time flexible.`
        : "This day needs additional local suggestions.",
      morning: slots[0],
      afternoon: slots[1],
      evening: slots[2],
      tips,
    };
  });
  const timingProposals = requestsMiddayRest(plan)
    ? days.map(proposeRestDayTiming)
    : [];
  for (const proposal of timingProposals) {
    const day = days.find((item) => item.date === proposal.date)!;
    day.timingProposal = {
      policy: proposal.policy,
      basis: proposal.basis,
      fitsPolicy: proposal.fitsPolicy,
      verified: false,
      events: proposal.events,
      conflict: proposal.conflict,
    };
    day.tips.unshift(...proposal.tips);
    if (!proposal.fitsPolicy)
      issues.push(`day_${day.dayNumber}:midday_rest_timing_conflict`);
  }
  return {
    days,
    timingProposals,
    unselectedActivityIds: inventory
      .filter((a) => !best.used.has(a.id))
      .map((a) => a.id),
    unfulfilledHighlights,
    deferredLongVisits,
    reviewRequiredActivities,
    issues,
    verified: false,
  };
}

function preference(activity: ActivityResult): number {
  return Number.isFinite(activity.vibeScore)
    ? Math.max(0, Math.min(100, activity.vibeScore))
    : 0;
}
