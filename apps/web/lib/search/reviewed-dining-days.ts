import type { DiningResult, SearchPlan } from "./types";

export interface ReviewedDiningDays {
  destination: string;
  names: string[];
  addresses: string[];
  closedWeekdays: number[];
  sourceUrl: string;
  observedAt: string;
  reviewAfter: string;
}
const normalize = (value: string) =>
  value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

/** Negative recurring-hours evidence. Exact venue and address only; neither
 * absent evidence nor another weekday establishes opening or suitability. */
export function reviewedDiningDayExclusions(
  plan: Pick<SearchPlan, "destination" | "dates">,
  meals: readonly DiningResult[],
  records: readonly ReviewedDiningDays[],
  asOf = new Date().toISOString().slice(0, 10),
) {
  if (![asOf, plan.dates.start, plan.dates.end].every(validDate))
    throw new Error("Valid review and trip dates required");
  const start = Date.parse(plan.dates.start);
  const count = (Date.parse(plan.dates.end) - start) / 86400000 + 1;
  if (count < 1 || count > 31) throw new Error("Invalid trip duration");
  const evidence = records.filter((record) => {
    try {
      const url = new URL(record.sourceUrl);
      return (
        normalize(record.destination) === normalize(plan.destination) &&
        validDate(record.observedAt) &&
        validDate(record.reviewAfter) &&
        record.observedAt <= asOf &&
        asOf <= record.reviewAfter &&
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        record.closedWeekdays.every(
          (day) => Number.isInteger(day) && day >= 0 && day <= 6,
        )
      );
    } catch {
      return false;
    }
  });
  return meals.flatMap((meal) =>
    evidence.flatMap((record) => {
      if (
        !record.names.some(
          (name) => normalize(name) === normalize(meal.name),
        ) ||
        !record.addresses.some(
          (address) => normalize(address) === normalize(meal.location.address),
        )
      )
        return [];
      return Array.from(
        { length: count },
        (_, index) => new Date(start + index * 86400000),
      )
        .filter((date) => record.closedWeekdays.includes(date.getUTCDay()))
        .map((date) => ({
          diningId: meal.id,
          date: date.toISOString().slice(0, 10),
          sourceUrl: record.sourceUrl,
          observedAt: record.observedAt,
        }));
    }),
  );
}
