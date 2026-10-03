import type { PendingMutationData } from './storage';
import type { Trip, TripInput } from '../../stores/tripStore';

/**
 * Serialize a locally-created Trip into the snake_case body that
 * `POST /api/trips` expects. Used by the offline mutation queue and by
 * the unit tests that document the contract.
 */
export function buildTripCreatePayload(trip: Trip): PendingMutationData {
  return {
    destination: trip.destination,
    start_date: trip.startDate,
    end_date: trip.endDate,
    travelers: trip.travelers,
    budget: trip.budget,
    preferences: {
      travelerType: trip.travelerType,
      originCity: trip.originCity,
      originAirport: trip.originAirport,
      vibes: trip.vibes,
      budget: trip.budget,
    },
  };
}

/**
 * Serialize a Trip update (partial fields) into the snake_case body that
 * `PATCH /api/trips/[id]` expects. Only present fields are included so we
 * don't accidentally overwrite untouched server fields with undefined.
 */
export function buildTripUpdatePayload(
  patch: Partial<TripInput>,
  expectedUpdatedAt?: string
): PendingMutationData {
  const body: PendingMutationData = { ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}) };
  if (patch.destination !== undefined) body.destination = patch.destination;
  const preferences: Record<string, unknown> = {};

  if (patch.startDate !== undefined) body.start_date = patch.startDate;
  if (patch.endDate !== undefined) body.end_date = patch.endDate;
  if (patch.travelers !== undefined) body.travelers = patch.travelers;
  if (patch.vibes !== undefined) body.vibes = patch.vibes;
  if (patch.budget !== undefined) {
    body.budget_tier = patch.budget;
  }
  if (patch.travelerType !== undefined) preferences.travelerType = patch.travelerType;
  if (patch.originCity !== undefined) preferences.originCity = patch.originCity;
  if (patch.originAirport !== undefined) preferences.originAirport = patch.originAirport;

  if (Object.keys(preferences).length > 0) {
    body.preferences = preferences;
  }
  return body;
}
