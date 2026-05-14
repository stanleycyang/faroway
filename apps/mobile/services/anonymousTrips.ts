import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../lib/supabase';

export const ANONYMOUS_TRIPS_KEY = '@faroway/anonymous_trips';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeTripIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((id): id is string => typeof id === 'string' && UUID_PATTERN.test(id))),
  ];
}

export async function getAnonymousTripIds(): Promise<string[]> {
  const stored = await AsyncStorage.getItem(ANONYMOUS_TRIPS_KEY);
  if (!stored) return [];

  try {
    return normalizeTripIds(JSON.parse(stored));
  } catch {
    return [];
  }
}

export async function rememberAnonymousTripId(tripId: string): Promise<void> {
  if (!UUID_PATTERN.test(tripId)) return;

  const tripIds = await getAnonymousTripIds();
  if (tripIds.includes(tripId)) return;

  await AsyncStorage.setItem(ANONYMOUS_TRIPS_KEY, JSON.stringify([...tripIds, tripId]));
}

export async function clearAnonymousTripIds(): Promise<void> {
  await AsyncStorage.removeItem(ANONYMOUS_TRIPS_KEY);
}

async function saveAnonymousTripIds(tripIds: string[]): Promise<void> {
  const normalized = normalizeTripIds(tripIds);

  if (normalized.length === 0) {
    await clearAnonymousTripIds();
    return;
  }

  await AsyncStorage.setItem(ANONYMOUS_TRIPS_KEY, JSON.stringify(normalized));
}

async function removeAnonymousTripIds(claimedTripIds: string[]): Promise<void> {
  const claimed = new Set(normalizeTripIds(claimedTripIds));
  if (claimed.size === 0) return;

  const remaining = (await getAnonymousTripIds()).filter((tripId) => !claimed.has(tripId));
  await saveAnonymousTripIds(remaining);
}

function parseClaimedTripIds(value: unknown): string[] | null {
  if (typeof value !== 'object' || value === null || !('tripIds' in value)) return null;

  return normalizeTripIds((value as { tripIds?: unknown }).tripIds);
}

export async function claimAnonymousTrips(accessToken: string): Promise<boolean> {
  const tripIds = await getAnonymousTripIds();
  if (tripIds.length === 0) return true;

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/claim-trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ tripIds }),
    });

    if (!response.ok) return false;

    const responseBody = (await response.json().catch(() => null)) as unknown;
    const claimedTripIds = parseClaimedTripIds(responseBody);

    if (!claimedTripIds) {
      await clearAnonymousTripIds();
      return true;
    }

    await removeAnonymousTripIds(claimedTripIds);
    return claimedTripIds.length === tripIds.length;
  } catch {
    return false;
  }
}
