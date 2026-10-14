import { z } from 'zod';
import type { PendingMutation } from './storage';
import { readCachedTrips } from './cached-trip';

const mutation = z
  .object({
    ownerId: z.string().min(1),
    id: z.string().min(1),
    type: z.enum(['create', 'update', 'delete']),
    tripId: z.string().min(1),
    timestamp: z.number().finite(),
    retryCount: z.number().int().nonnegative(),
    data: z.record(z.string(), z.unknown()).optional(),
    blockedReason: z.string().optional(),
    localTrip: z.unknown().optional(),
  })
  .passthrough();

/** Foreign and legacy unowned intent stays private; unreadable owned intent stays stored. */
export function readCachedMutations(value: unknown, ownerId: string): PendingMutation[] {
  const message =
    'Couldn’t read your saved changes on this device. They are kept; try syncing again before making more offline changes.';
  if (!Array.isArray(value)) throw new Error(message);
  return value
    .filter((item) => item?.ownerId === ownerId)
    .map((item) => {
      const result = mutation.safeParse(item);
      if (!result.success) throw new Error(message);
      const { localTrip, ...command } = result.data;
      if (localTrip === undefined) return command;
      try {
        const trip = readCachedTrips([localTrip])[0];
        if (trip.id !== command.tripId) throw new Error(message);
        return { ...command, localTrip: trip };
      } catch {
        throw new Error(message);
      }
    });
}
