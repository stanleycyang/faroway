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

export function summarizeBudget(
  days: TripDay[],
  hotel: {
    pricePerNight?: number;
    currency?: string;
    priceStatus?: string;
  } | null,
  nights: number,
  travelers: number,
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
  if (nights > 0)
    add(
      "accommodation",
      hotel?.pricePerNight,
      hotel?.currency,
      hotel?.priceStatus,
      nights,
    );
  for (const day of days) {
    if (day.transport)
      add("transport", day.transport.price, day.transport.currency);
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
