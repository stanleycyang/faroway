import { flightQuoteIsCurrent } from '@faroway/constants';

export interface TripCost {
  amount: number;
  currency: string;
  perPerson?: boolean;
}

export function readTripCost(value: unknown): TripCost | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const cost = value as Record<string, unknown>;
  if (
    cost.status === 'unknown' ||
    typeof cost.amount !== 'number' ||
    !Number.isFinite(cost.amount) ||
    cost.amount < 0 ||
    typeof cost.currency !== 'string' ||
    !/^[A-Z]{3}$/.test(cost.currency)
  )
    return undefined;
  return {
    amount: cost.amount,
    currency: cost.currency,
    ...(typeof cost.perPerson === 'boolean' ? { perPerson: cost.perPerson } : {}),
  };
}

export function formatTripCost(cost: TripCost): string {
  return `${cost.currency} ${cost.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}${cost.perPerson ? ' / person' : ''}`;
}

export function formatKnownPrice(amount: unknown, currency?: string): string {
  const cost = readTripCost({ amount, currency });
  return cost ? formatTripCost(cost) : 'Price unavailable';
}

export function summarizeTripCosts(
  trip: {
    hotel?: { totalPrice: number; currency?: string };
    days: {
      transport?: {
        price?: number;
        currency: string;
        affiliatePartner?: string;
        expiresAt?: string;
      };
      activities: { estimatedCost?: TripCost }[];
    }[];
  },
  now: number = Date.now()
): string[] {
  const groups = new Map<string, { cost: TripCost; basis: string }>();
  const add = (value: unknown, basis: string) => {
    const cost = readTripCost(value);
    if (!cost) return;
    const key = `${cost.currency}:${basis}`;
    const group = groups.get(key);
    if (group) group.cost.amount += cost.amount;
    else groups.set(key, { cost: { ...cost, perPerson: undefined }, basis });
  };
  if (trip.hotel && trip.hotel.totalPrice > 0)
    add({ amount: trip.hotel.totalPrice, currency: trip.hotel.currency }, 'stay');
  for (const day of trip.days) {
    if (day.transport && flightQuoteIsCurrent(day.transport, now))
      add({ amount: day.transport.price, currency: day.transport.currency }, 'transport');
    for (const activity of day.activities)
      add(
        activity.estimatedCost,
        activity.estimatedCost?.perPerson ? 'activities / person' : 'activities'
      );
  }
  return [...groups.values()].map(({ cost, basis }) => `${formatTripCost(cost)} · ${basis}`);
}
