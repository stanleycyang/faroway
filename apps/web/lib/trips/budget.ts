import { flightQuoteIsCurrent } from "@faroway/constants";
import type { TripDay } from "@faroway/types";

export type BudgetCategory =
  | "accommodation"
  | "activities"
  | "dining"
  | "transport";
export interface CurrencyBudget {
  currency: string;
  accommodation: number;
  activities: number;
  dining: number;
  transport: number;
  total: number;
}

// Missing, zero and malformed legacy prices are not evidence of a free item.
export function knownEstimate(
  amount: unknown,
  currency: unknown,
  status?: unknown,
) {
  if (
    status === "unknown" ||
    typeof amount !== "number" ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    typeof currency !== "string" ||
    !/^[A-Z]{3}$/.test(currency)
  )
    return null;
  return { amount, currency };
}

export function formatEstimate(
  amount: unknown,
  currency: unknown,
  status?: unknown,
): string {
  const price = knownEstimate(amount, currency, status);
  if (!price) return "Price unknown";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(price.amount);
}

export interface StayDates {
  startDate: string;
  endDate: string;
}

/** One unambiguous assignment per occupied date; checkout is never a night. */
export function occupiedHotelNights(days: TripDay[], stay: StayDates) {
  const dateValue = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const time = Date.parse(value);
    return Number.isFinite(time) &&
      new Date(time).toISOString().slice(0, 10) === value
      ? time
      : NaN;
  };
  const start = dateValue(stay.startDate);
  const end = dateValue(stay.endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
    return null;
  // Bound malformed legacy spans without manufacturing assignments.
  if ((end - start) / 86400000 > 366) return null;
  const nights: NonNullable<TripDay["hotel"]>[] = [];
  for (let time = start; time < end; time += 86400000) {
    const date = new Date(time).toISOString().slice(0, 10);
    const matching = days.filter((day) => day.date === date);
    if (matching.length !== 1 || !matching[0].hotel) return null;
    nights.push(matching[0].hotel);
  }
  return nights;
}

export function featuredStayEstimate(
  days: TripDay[],
  stay: StayDates,
  hotel: { id?: string; affiliatePartner?: string },
) {
  const nights = occupiedHotelNights(days, stay);
  if (!nights?.length || !hotel.id) return null;
  const prices = nights.map((night) =>
    knownEstimate(night.pricePerNight, night.currency, night.priceStatus),
  );
  if (
    prices.some((price) => !price) ||
    new Set(prices.map((price) => price?.currency)).size !== 1
  )
    return null;
  const assigned = nights.flatMap((night, index) =>
    night.id === hotel.id && night.affiliatePartner === hotel.affiliatePartner
      ? [prices[index]!]
      : [],
  );
  if (!assigned.length) return null;
  const amount = assigned.reduce((sum, price) => sum + price.amount, 0);
  return Number.isFinite(amount)
    ? { amount, currency: assigned[0].currency, nights: assigned.length }
    : null;
}

export function summarizeBudget(
  days: TripDay[],
  stay: StayDates | null,
  travelers: number,
  now: number = Date.now(),
) {
  const groups = new Map<string, CurrencyBudget>();
  let unknownItems = 0;
  const add = (
    category: BudgetCategory,
    amount: unknown,
    currency: unknown,
    status?: unknown,
    multiplier = 1,
  ) => {
    const price = knownEstimate(amount, currency, status);
    if (
      !price ||
      !Number.isFinite(multiplier) ||
      multiplier <= 0 ||
      !Number.isFinite(price.amount * multiplier)
    ) {
      unknownItems++;
      return;
    }
    const group = groups.get(price.currency) ?? {
      currency: price.currency,
      accommodation: 0,
      activities: 0,
      dining: 0,
      transport: 0,
      total: 0,
    };
    group[category] += price.amount * multiplier;
    group.total += price.amount * multiplier;
    groups.set(price.currency, group);
  };
  if (stay) {
    const nights = occupiedHotelNights(days, stay);
    if (nights === null) unknownItems++;
    else
      for (const hotel of nights)
        add(
          "accommodation",
          hotel.pricePerNight,
          hotel.currency,
          hotel.priceStatus,
        );
  }
  for (const day of days) {
    if (day.transport) {
      if (flightQuoteIsCurrent(day.transport, now))
        add("transport", day.transport.price, day.transport.currency);
      else unknownItems++;
    }
    for (const slot of [day.morning, day.afternoon, day.evening]) {
      if (!slot) continue;
      for (const activity of Array.isArray(slot.activities)
        ? slot.activities
        : []) {
        const cost = activity?.estimatedCost;
        add("activities", cost?.amount, cost?.currency, cost?.status);
      }
      const legacyMeal = (
        slot as unknown as {
          meal?: {
            estimatedCost?: {
              amount?: number;
              currency?: string;
              status?: string;
              perPerson?: boolean;
            };
          };
        }
      ).meal;
      const meals = Array.isArray(slot.meals)
        ? slot.meals
        : legacyMeal
          ? [legacyMeal]
          : [];
      for (const meal of meals) {
        const cost = meal?.estimatedCost;
        add(
          "dining",
          cost?.amount,
          cost?.currency,
          cost?.status,
          cost?.perPerson === true ? travelers : 1,
        );
      }
    }
  }
  return {
    groups: [...groups.values()].sort((a, b) =>
      a.currency.localeCompare(b.currency),
    ),
    unknownItems,
  };
}
