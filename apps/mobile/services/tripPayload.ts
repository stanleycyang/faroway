import type { Trip } from '@faroway/types';

export interface TripUpdateInput {
  destination?: string;
  startDate?: string;
  endDate?: string;
  start_date?: string;
  end_date?: string;
  status?: Trip['status'];
  budget_tier?: string;
  preferences?: Record<string, unknown>;
  travelers?: number;
  travelerType?: string;
  originCity?: string;
  originAirport?: string;
  vibes?: string[];
  budget?: string | number | null;
}

/** Explicit server fields win over aliases; omitted preferences stay omitted. */
export function buildTripUpdatePayload(patch: TripUpdateInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const preferences: Record<string, unknown> = { ...patch.preferences };

  if (patch.destination !== undefined) body.destination = patch.destination;
  if (patch.startDate !== undefined) body.start_date = patch.startDate;
  if (patch.endDate !== undefined) body.end_date = patch.endDate;
  if (patch.start_date !== undefined) body.start_date = patch.start_date;
  if (patch.end_date !== undefined) body.end_date = patch.end_date;
  if (patch.status !== undefined) body.status = patch.status;
  if (patch.travelers !== undefined) body.travelers = patch.travelers;
  if (patch.vibes !== undefined) body.vibes = patch.vibes;
  if (typeof patch.budget === 'string') {
    body.budget_tier = patch.budget;
    preferences.budget = patch.budget;
  }
  if (patch.travelerType !== undefined) preferences.travelerType = patch.travelerType;
  if (patch.originCity !== undefined) preferences.originCity = patch.originCity;
  if (patch.originAirport !== undefined) preferences.originAirport = patch.originAirport;
  if (patch.budget_tier !== undefined) {
    body.budget_tier = patch.budget_tier;
    preferences.budget = patch.budget_tier;
  }

  if (Object.keys(preferences).length > 0) {
    body.preferences = preferences;
  }

  return body;
}
