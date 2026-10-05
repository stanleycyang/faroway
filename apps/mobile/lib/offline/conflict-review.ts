import type { PendingMutation } from './storage';
export { savedTripReviewUrl as tripWebUrl } from '../savedTripUrl';

const fields: Record<string, string> = {
  destination: 'Destination',
  start_date: 'Start date',
  end_date: 'End date',
  travelers: 'Travelers',
  budget_tier: 'Budget',
  vibes: 'Trip vibes',
  travelerType: 'Traveling as',
  originCity: 'Starting city',
  originAirport: 'Starting airport',
  adults: 'Adults',
  children: 'Children',
  interests: 'Interests',
};

export function conflictRows(mutation: PendingMutation, latest?: Record<string, unknown>) {
  const flatten = (value: Record<string, unknown>) => {
    const { preferences, expectedUpdatedAt: _revision, ...rest } = value;
    return { ...rest, ...(preferences && typeof preferences === 'object' ? preferences : {}) };
  };
  const local = flatten(mutation.data ?? {});
  const server = flatten(latest ?? {});
  const display = (value: unknown) =>
    value === undefined || value === null || value === ''
      ? 'Not set'
      : Array.isArray(value)
        ? value.join(', ') || 'None'
        : String(value);
  return Object.entries(local).map(([key, value]) => ({
    label: fields[key] ?? key,
    yours: display(value),
    latest: latest ? display(server[key]) : 'Load the latest trip to compare',
  }));
}

export function supportsConflictReapply(mutation: PendingMutation) {
  if (mutation.type !== 'update' || !mutation.data) return false;
  return Object.entries(mutation.data).every(([key, value]) => {
    if (key === 'expectedUpdatedAt') return true;
    if (key === 'preferences')
      return (
        !!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).every((field) => field in fields)
      );
    return ['destination', 'start_date', 'end_date', 'travelers', 'budget_tier', 'vibes'].includes(
      key
    );
  });
}
