import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import { parseTripDate } from './tripDate';

const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(parseTripDate(value).getTime()), 'Invalid calendar date');

const key = (userId: string) => `faroway:pending-create:${encodeURIComponent(userId)}`;
type Receipt = { version: 1; requestId: string; body: string };
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>) {
  const result = queue.then(work);
  queue = result.catch(() => {});
  return result;
}

/** Save identity before I/O. A lost response or restarted screen reuses it. */
export function pendingTripCreation(userId: string, body: string): Promise<Receipt> {
  return serialize(async () => {
    const raw = await AsyncStorage.getItem(key(userId));
    if (raw !== null) {
      const receipt = JSON.parse(raw) as Receipt;
      if (
        receipt.version !== 1 ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          receipt.requestId
        ) ||
        typeof receipt.body !== 'string'
      )
        throw new Error(
          'Your saved creation request could not be read. Keep it and check My Trips before starting again.'
        );
      if (receipt.body !== body)
        throw new Error(
          'An unfinished trip request is saved. Restore its choices or choose Start a new trip after checking My Trips.'
        );
      return receipt;
    }
    const receipt: Receipt = { version: 1, requestId: Crypto.randomUUID(), body };
    await AsyncStorage.setItem(key(userId), JSON.stringify(receipt));
    return receipt;
  });
}
export function finishTripCreation(userId: string, requestId: string) {
  return serialize(async () => {
    const raw = await AsyncStorage.getItem(key(userId));
    if (raw && (JSON.parse(raw) as Receipt).requestId === requestId)
      await AsyncStorage.removeItem(key(userId));
  });
}
/** Caller presents an explicit fresh-trip choice; existing server trips remain saved. */
export function discardTripCreation(userId: string) {
  return serialize(() => AsyncStorage.removeItem(key(userId)));
}

/** Capture the exact local receipt shown by a deliberate discard confirmation. */
export function readTripCreationReceipt(userId: string): Promise<string | null> {
  return serialize(() => AsyncStorage.getItem(key(userId)));
}

/** A stale confirmation must not erase a newer request. Account deletion uses discardTripCreation. */
export function discardReviewedTripCreation(userId: string, reviewedReceipt: string | null) {
  return serialize(async () => {
    const current = await AsyncStorage.getItem(key(userId));
    if (current !== reviewedReceipt)
      throw new Error('Your pending trip changed. Review it again before starting a new trip.');
    if (current !== null) await AsyncStorage.removeItem(key(userId));
  });
}

/** Restore only validated planner fields; corrupt/future records remain untouched. */
export function savedTripCreationDraft(userId: string) {
  return serialize(async () => {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return null;
    const receipt = JSON.parse(raw) as Receipt;
    if (
      receipt.version !== 1 ||
      typeof receipt.body !== 'string' ||
      !z.string().uuid().safeParse(receipt.requestId).success
    )
      throw new Error('The saved trip request could not be read.');
    const body = z
      .object({
        destination: z.string().trim().min(1).max(200),
        start_date: DateOnly,
        end_date: DateOnly,
        travelers: z.number().int().min(1).max(50),
        budget: z.enum(['budget', 'moderate', 'luxury']).optional(),
        preferences: z.object({
          travelerType: z.enum(['solo', 'couple', 'family', 'friends', 'business']).optional(),
          originCity: z.string().max(200).optional(),
          originAirport: z.string().max(10).optional(),
          vibes: z.array(z.string().max(50)).max(10).optional(),
        }),
      })
      .refine(
        (value) => parseTripDate(value.end_date) >= parseTripDate(value.start_date),
        'End date precedes start date'
      )
      .parse(JSON.parse(receipt.body));
    return {
      destination: body.destination,
      startDate: body.start_date,
      endDate: body.end_date,
      travelers: body.travelers,
      budget: body.budget,
      travelerType: body.preferences.travelerType || 'couple',
      originCity: body.preferences.originCity,
      originAirport: body.preferences.originAirport,
      vibes: body.preferences.vibes || [],
    };
  });
}
