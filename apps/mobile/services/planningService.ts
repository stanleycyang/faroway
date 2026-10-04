import type { SearchInput } from '@faroway/types';
import { API_BASE_URL } from '../constants/api';
import { withPlanningConsent } from '../lib/planningConsent';

export class GenerationNotStartedError extends Error {}

async function checked(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  if (
    !response.ok &&
    response.status === 409 &&
    body?.code === 'ai_consent_required' &&
    body?.generationStarted === false
  )
    throw new GenerationNotStartedError(
      'Your trip is saved, but planning has not started. Review AI sharing to start it.'
    );
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : fallback);
  return body;
}

export async function createAndStartTrip(
  input: Omit<SearchInput, 'travelerType' | 'budget'> & { travelerType?: string; budget?: string },
  onCreated: (id: string) => void,
  signal?: AbortSignal
): Promise<string> {
  // Freeze the brief shown when the user chose to plan; never read mutable draft
  // state after an asynchronous consent dialog.
  const body = JSON.stringify({
    destination: input.destination,
    start_date: input.startDate,
    end_date: input.endDate,
    travelers: input.travelers,
    budget: input.budget || 'moderate',
    preferences: {
      travelerType: input.travelerType,
      originCity: input.originCity,
      originAirport: input.originAirport,
      vibes: input.vibes,
    },
  });
  return withPlanningConsent(async (authorization) => {
    const result = await checked(
      await fetch(`${API_BASE_URL}/api/trips`, {
        method: 'POST',
        headers: await authorization.headers(),
        signal: authorization.signal,
        body,
      }),
      'Failed to save trip'
    );
    const id = result?.trip?.id;
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))
      throw new Error(
        'The saved trip response was incomplete. Check your trips before trying again.'
      );
    onCreated(id);
    await checked(
      await fetch(`${API_BASE_URL}/api/trips/${encodeURIComponent(id)}/generate`, {
        method: 'POST',
        headers: await authorization.headers(),
        signal: authorization.signal,
      }),
      'Failed to start generation'
    );
    return id;
  }, signal);
}

export async function regenerateTrip(tripId: string) {
  return withPlanningConsent(async ({ headers, signal }) =>
    checked(
      await fetch(`${API_BASE_URL}/api/trips/${encodeURIComponent(tripId)}/generate`, {
        method: 'POST',
        headers: await headers(),
        signal,
        body: '{}',
      }),
      'Failed to generate itinerary'
    )
  );
}

export async function recoverUnstartedTrip(tripId: string) {
  const { supabase } = await import('../lib/supabase');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Sign in to recover this trip.');
  const result = await checked(
    await fetch(`${API_BASE_URL}/api/trips/${encodeURIComponent(tripId)}`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    }),
    'Could not verify the saved trip. Reconnect to check its status.'
  );
  const trip = result?.trip ?? result;
  if (trip?.status !== 'draft' || trip.search_id) return; // Existing/uncertain attempt: reconnect only.
  const current = await supabase.auth.getSession();
  if (current.data.session?.user.id !== data.session.user.id)
    throw new Error('Your account changed. Reopen your saved trip.');
  await regenerateTrip(tripId);
}
