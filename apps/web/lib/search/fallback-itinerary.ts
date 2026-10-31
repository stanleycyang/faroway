import { suppliedDistanceKm } from "./supplied-distance";
import type {
  SearchPlan,
  HotelResult,
  ActivityResult,
  DiningResult,
  TransportResult,
  SuggestedDay,
} from "./types";

/**
 * Create a simple fallback itinerary when AI generation fails
 */
export function createFallbackItinerary(
  plan: SearchPlan,
  hotels: HotelResult[],
  activities: ActivityResult[],
  dining: DiningResult[],
  transport: TransportResult[] = [],
): { days: SuggestedDay[]; topHotel: HotelResult | null } {
  const { dates } = plan;
  const startDate = new Date(dates.start);
  const numDays = dates.nights + 1;

  const topHotel = hotels[0] || null;
  const days: SuggestedDay[] = [];
  // Flexible activities belong to multiple candidate lists, but should only
  // be scheduled once across the entire trip.
  const usedActivityIds = new Set<string>();
  const pace = plan.activityCriteria.pacePreference;
  const limits =
    pace === "relaxed"
      ? { count: 2, dailyMinutes: 240, slotMinutes: 120 }
      : pace === "packed"
        ? { count: 5, dailyMinutes: 600, slotMinutes: 240 }
        : { count: 4, dailyMinutes: 420, slotMinutes: 210 };
  let dayCount = 0;
  let dayMinutes = 0;
  let dayTarget = limits.count;
  const takeActivities = (candidates: ActivityResult[], limit: number) => {
    const selected: ActivityResult[] = [];
    let slotMinutes = 0;
    for (const activity of candidates) {
      if (
        usedActivityIds.has(activity.id) ||
        !Number.isInteger(activity.duration) ||
        activity.duration <= 0
      )
        continue;
      if (
        dayCount >= dayTarget ||
        dayMinutes + activity.duration > limits.dailyMinutes
      )
        continue;
      // A long visit can occupy a slot alone, but never overflow the day budget.
      if (
        selected.length &&
        slotMinutes + activity.duration > limits.slotMinutes
      )
        continue;
      usedActivityIds.add(activity.id);
      selected.push(activity);
      slotMinutes += activity.duration;
      dayMinutes += activity.duration;
      dayCount++;
      if (selected.length === limit || slotMinutes >= limits.slotMinutes) break;
    }
    return selected;
  };

  // Sort activities by best time
  const morningActivities = activities.filter(
    (a) => a.bestTimeOfDay === "morning" || a.bestTimeOfDay === "any",
  );
  const afternoonActivities = activities.filter(
    (a) => a.bestTimeOfDay === "afternoon" || a.bestTimeOfDay === "any",
  );
  const eveningActivities = activities.filter(
    (a) => a.bestTimeOfDay === "evening" || a.bestTimeOfDay === "any",
  );

  // Sort dining by meal type
  const breakfastSpots = dining.filter((d) =>
    d.mealTypes.includes("breakfast"),
  );
  const lunchSpots = dining.filter((d) => d.mealTypes.includes("lunch"));
  const dinnerSpots = dining.filter((d) => d.mealTypes.includes("dinner"));

  const usedRestaurants = new Set<string>();
  const selectMeal = (
    candidates: DiningResult[],
    stops: ActivityResult[],
    dayIndex: number,
    tips: string[],
  ) => {
    if (!candidates.length) return undefined;
    const ranked = candidates
      .map((meal) => {
        const distances = stops.map((stop) =>
          suppliedDistanceKm(stop.location, meal.location),
        );
        const distance =
          distances.length && distances.every((d) => d != null)
            ? Math.min(...(distances as number[]))
            : null;
        return { meal, distance };
      })
      .filter((item) => item.distance != null);
    const nearby = ranked.filter((item) => item.distance! <= 3);
    let meal: DiningResult;
    if (nearby.length) {
      nearby.sort(
        (a, b) =>
          Number(usedRestaurants.has(a.meal.id)) -
            Number(usedRestaurants.has(b.meal.id)) || a.distance! - b.distance!,
      );
      meal = nearby[0].meal;
    } else if (ranked.length) {
      ranked.sort((a, b) => a.distance! - b.distance!);
      meal = ranked[0].meal;
      tips.push(
        `${meal.name} may require a separate journey from these activities. Check the route or find a closer local option; supplied locations are unverified.`,
      );
    } else meal = candidates[dayIndex % candidates.length];
    usedRestaurants.add(meal.id);
    return meal;
  };

  // These are alternative outbound offers, not outbound/return legs.
  const outboundFlight = transport[0];

  for (let i = 0; i < numDays; i++) {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + i);

    const dayTransport = i === 0 ? outboundFlight : undefined;

    dayCount = 0;
    dayMinutes = 0;
    const remaining = new Set(
      activities
        .filter(
          (a) =>
            !usedActivityIds.has(a.id) &&
            Number.isInteger(a.duration) &&
            a.duration > 0 &&
            a.duration <= limits.dailyMinutes,
        )
        .map((a) => a.id),
    ).size;
    dayTarget = Math.min(limits.count, Math.ceil(remaining / (numDays - i)));
    const morning = takeActivities(
      morningActivities,
      pace === "relaxed" ? 1 : 2,
    );
    const afternoon = takeActivities(
      afternoonActivities,
      pace === "relaxed" ? 1 : 2,
    );
    const evening = takeActivities(eveningActivities, 1);
    const selected = [...morning, ...afternoon, ...evening];
    const tips = [
      "Backup draft: opening hours, travel times, availability and suitability still need checking.",
      "Leave time between visits for meals, travel and rest.",
    ];
    if (selected.some((a) => a.duration > limits.slotMinutes))
      tips.push(
        "A longer visit occupies its own time slot; confirm its timing before making other plans.",
      );
    if (!selected.length)
      tips.push(
        "No suitable unused activities fit this day. Choose local options after checking your requirements.",
      );
    if (pace === "relaxed")
      tips.push(
        "Keep the unscheduled time for seated breaks and a flexible pace; confirm step-free access where needed.",
      );
    days.push({
      dayNumber: i + 1,
      date: date.toISOString().split("T")[0],
      title: `Day ${i + 1} in ${plan.destination}`,
      summary: selected.length
        ? `Backup draft: ${selected.map((a) => a.name).join("; ")}. Leave the remaining time flexible.`
        : `Backup draft: this day needs local activity suggestions.`,
      hotel: topHotel || undefined,
      morning: {
        activities: morning,
        meal: selectMeal(breakfastSpots, morning, i, tips),
      },
      afternoon: {
        activities: afternoon,
        meal: selectMeal(lunchSpots, afternoon, i, tips),
      },
      evening: {
        activities: evening,
        meal: selectMeal(dinnerSpots, evening, i, tips),
      },
      transport: dayTransport,
      estimatedCost: undefined,
      currency: undefined,
      tips,
    });
  }

  return { days, topHotel };
}
