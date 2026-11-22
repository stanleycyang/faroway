import type { PendingMutation } from './storage';
import { travelerRequirementLines, travelerRequirementsSchema } from '../travelerRequirements';
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
  requirements: 'Dietary & access needs',
  adults: 'Adults',
  children: 'Children',
  interests: 'Interests',
};

export function conflictRows(mutation: PendingMutation, latest?: Record<string, unknown>) {
  const flatten = (value: Record<string, unknown>) => {
    const { preferences, expectedUpdatedAt: _revision, requestId: _requestId, ...rest } = value;
    return { ...rest, ...(preferences && typeof preferences === 'object' ? preferences : {}) };
  };
  const local = flatten(mutation.data ?? {});
  const server = flatten(latest ?? {});
  const display = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return 'Not set';
    if (key === 'requirements') {
      const parsed = travelerRequirementsSchema.nullish().safeParse(value);
      if (parsed.success) {
        return travelerRequirementLines(parsed.data).join('; ') || 'None';
      }
    }
    if (Array.isArray(value)) return value.join(', ') || 'None';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return 'Custom details';
      }
    }
    return String(value);
  };
  return Object.entries(local).map(([key, value]) => ({
    label: fields[key] ?? key,
    yours: display(key, value),
    latest: latest ? display(key, server[key]) : 'Load the latest trip to compare',
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
