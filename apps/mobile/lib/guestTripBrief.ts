import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { parseTripDate } from './tripDate';
import type { TripInput } from '../stores/tripStore';

const key = 'faroway:guest-trip-brief:v1';
const lifetimeMs = 24 * 60 * 60 * 1000;
const date = z
  .string()
  .refine(
    (value) =>
      value === '' ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseTripDate(value).getTime()))
  );
const brief = z
  .object({
    destination: z.string().max(200),
    country: z.string().max(200).optional(),
    placeId: z.string().max(500).optional(),
    startDate: date,
    endDate: date,
    travelers: z.number().int().min(1).max(50),
    travelerType: z.enum(['solo', 'couple', 'family', 'friends', 'business']),
    originCity: z.string().max(200).optional(),
    originAirport: z.string().max(10).optional(),
    vibes: z.array(z.string().min(1).max(100)).max(5),
    budget: z.string().max(100).optional(),
  })
  .refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate);
const record = z.object({ version: z.literal(1), savedAt: z.number().finite(), brief });
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.catch(() => {});
  return result;
}

export class GuestBriefReadError extends Error {
  constructor(readonly storedRecord: string) {
    super('Your unfinished guest brief could not be read.');
    this.name = 'GuestBriefReadError';
  }
}

/** Device-local guest choices only; never stores tokens, trips or provider links. */
export function readGuestTripBrief(now = Date.now()): Promise<TripInput | null> {
  return serialize(async () => {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new GuestBriefReadError(raw);
    }
    const parsed = record.safeParse(value);
    if (!parsed.success) throw new GuestBriefReadError(raw);
    if (parsed.data.savedAt > now || now - parsed.data.savedAt > lifetimeMs) return null;
    return parsed.data.brief;
  });
}
/** Re-check the live guest/account epoch before a queued write starts. */
export function saveGuestTripBrief(
  input: TripInput,
  isCurrentGuest: () => boolean,
  now = Date.now()
) {
  const parsed = brief.safeParse(input);
  if (!parsed.success)
    return Promise.reject(new Error('These trip choices could not be saved on this device.'));
  const snapshot = parsed.data;
  return serialize(async () => {
    if (!isCurrentGuest()) return;
    await AsyncStorage.setItem(key, JSON.stringify({ version: 1, savedAt: now, brief: snapshot }));
  });
}
/** Serialize clear behind older writes so an account transition cannot resurrect them. */
export function clearGuestTripBrief() {
  return serialize(() => AsyncStorage.removeItem(key));
}

/** Deliberate discard applies only to the exact unreadable record reviewed. */
export function discardReviewedGuestBrief(reviewed: string, isCurrentGuest: () => boolean) {
  return serialize(async () => {
    if (!isCurrentGuest()) return false;
    const current = await AsyncStorage.getItem(key);
    if (!isCurrentGuest()) return false;
    if (current !== reviewed)
      throw new Error(
        'Saved choices changed. Reopen the planner to review them before discarding.'
      );
    await AsyncStorage.removeItem(key);
    return true;
  });
}
