/**
 * Offline Storage Manager
 * Uses AsyncStorage for persistent local data storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Trip } from '../../stores/tripStore';
import { readCachedTrips } from './cached-trip';
import { readCachedMutations } from './cached-mutations';
import { useUserStore } from '../../stores/userStore';

// Cache removal and all subsequent reads/writes share one queue. A new
// account's writes cannot land between the removals in an account cleanup.
let storageQueue: Promise<unknown> = Promise.resolve();
function serializeStorage<T>(work: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(work);
  storageQueue = result.catch(() => {});
  return result;
}
// Storage keys
const STORAGE_KEYS = {
  TRIPS: '@faroway/trips',
  PENDING_MUTATIONS: '@faroway/pending_mutations',
  LAST_SYNC: '@faroway/last_sync',
  SYNC_META: '@faroway/sync_meta',
} as const;

// Mutation types for offline queue
export type MutationType = 'create' | 'update' | 'delete';

// Deep-merge two mutation payloads so nested objects (e.g. `preferences`)
// don't get clobbered when a later update only changes a single sub-key.
function mergeMutationData(
  base: PendingMutationData | undefined,
  patch: PendingMutationData | undefined
): PendingMutationData {
  const result: PendingMutationData = { ...(base ?? {}) };
  if (!patch) return result;
  for (const [key, value] of Object.entries(patch)) {
    const existing = result[key];
    if (
      existing &&
      value &&
      typeof existing === 'object' &&
      typeof value === 'object' &&
      !Array.isArray(existing) &&
      !Array.isArray(value)
    ) {
      result[key] = mergeMutationData(
        existing as PendingMutationData,
        value as PendingMutationData
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

// `data` is the API request body for the mutation (e.g. POST /api/trips or
// PATCH /api/trips/[id]). It's snake_case-shaped to match the backend, not
// the camelCase TripInput, so we type it loosely here.
export type PendingMutationData = Record<string, unknown>;

export interface PendingMutation {
  // Visible local intent and its retry command commit in the same storage write.
  // Kept outside data so it is never sent as an API payload.
  localTrip?: Trip;
  ownerId?: string;
  id: string;
  type: MutationType;
  tripId: string;
  data?: PendingMutationData;
  timestamp: number;
  retryCount: number;
  blockedReason?: string;
}

export interface SyncMeta {
  lastSyncTime: number | null;
  lastSyncStatus: 'success' | 'partial' | 'failed' | null;
  pendingCount: number;
}

/** Pending intent is a view over saved data, never a replacement for that data. */
export function applyPendingTripChanges(saved: Trip[], pending: PendingMutation[]): Trip[] {
  const trips = new Map(saved.map((trip) => [trip.id, trip]));
  const added: string[] = [];
  for (const mutation of pending) {
    if (mutation.type === 'delete') trips.delete(mutation.tripId);
    else if (mutation.localTrip?.id === mutation.tripId) {
      if (!trips.has(mutation.tripId)) added.push(mutation.tripId);
      trips.set(mutation.tripId, mutation.localTrip);
    }
  }
  return [
    ...added.reverse().flatMap((id) => (trips.has(id) ? [trips.get(id)!] : [])),
    ...[...trips.values()].filter((trip) => !added.includes(trip.id)),
  ];
}

/**
 * Storage class for managing offline trip data
 */
class OfflineStorage {
  // Each serialized public operation gets its own invocation-time identity.
  private readonly account = useUserStore.getState();
  private assertOwner(expectedOwnerId = this.account.user?.id): string {
    const current = useUserStore.getState();
    if (
      !expectedOwnerId ||
      current.user?.id !== expectedOwnerId ||
      this.account.user?.id !== expectedOwnerId ||
      current.accountRevision !== this.account.accountRevision
    ) {
      throw new Error('Your account changed. Reopen your trips to continue.');
    }
    return expectedOwnerId;
  }
  // ==================== TRIPS ====================

  /**
   * Save all trips to local storage
   */
  async saveTrips(trips: Trip[], expectedOwnerId?: string): Promise<void> {
    try {
      const ownerId = this.assertOwner(expectedOwnerId);
      // One write binds identity and content atomically; legacy unowned caches
      // are deliberately not assigned to whichever person signs in next.
      const data = JSON.stringify({ version: 1, ownerId, trips });
      await AsyncStorage.setItem(STORAGE_KEYS.TRIPS, data);
    } catch (error) {
      console.error('[OfflineStorage] Error saving trips:', error);
      throw error;
    }
  }

  /**
   * Load all trips from local storage
   */
  async loadSavedTrips(): Promise<Trip[]> {
    try {
      if (!this.account.user?.id) return [];
      const ownerId = this.assertOwner();
      const data = await AsyncStorage.getItem(STORAGE_KEYS.TRIPS);
      this.assertOwner(ownerId);
      if (!data) return [];
      const cache = JSON.parse(data);
      return cache?.version === 1 && cache.ownerId === ownerId ? readCachedTrips(cache.trips) : [];
    } catch (error) {
      console.error('[OfflineStorage] Error loading trips:', error);
      throw error;
    }
  }

  async loadTrips(): Promise<Trip[]> {
    if (!this.account.user?.id) return [];
    const trips = await this.loadSavedTrips();
    const pending = await this.getPendingMutations();
    this.assertOwner();
    // Failed reads propagate so callers can distinguish recovery from an empty cache.
    return applyPendingTripChanges(trips, pending);
  }

  /**
   * Save a single trip (upsert)
   */
  async saveTrip(trip: Trip, expectedOwnerId?: string): Promise<void> {
    try {
      this.assertOwner(expectedOwnerId);
      const trips = await this.loadSavedTrips();
      const existingIndex = trips.findIndex((t) => t.id === trip.id);

      if (existingIndex >= 0) {
        trips[existingIndex] = trip;
      } else {
        trips.unshift(trip);
      }

      await this.saveTrips(trips);
    } catch (error) {
      console.error('[OfflineStorage] Error saving trip:', error);
      throw error;
    }
  }

  /**
   * Delete a trip from local storage
   */
  async deleteTrip(tripId: string, expectedOwnerId?: string): Promise<void> {
    try {
      this.assertOwner(expectedOwnerId);
      const trips = await this.loadSavedTrips();
      const filtered = trips.filter((t) => t.id !== tripId);
      await this.saveTrips(filtered);
    } catch (error) {
      console.error('[OfflineStorage] Error deleting trip:', error);
      throw error;
    }
  }

  /**
   * Get a single trip by ID
   */
  async getTrip(tripId: string): Promise<Trip | null> {
    try {
      const trips = await this.loadTrips();
      return trips.find((t) => t.id === tripId) || null;
    } catch (error) {
      console.error('[OfflineStorage] Error getting trip:', error);
      return null;
    }
  }

  // ==================== PENDING MUTATIONS ====================

  /**
   * Add a mutation to the offline queue
   */
  async addPendingMutation(
    mutation: Omit<PendingMutation, 'id' | 'timestamp' | 'retryCount'>
  ): Promise<PendingMutation> {
    try {
      const ownerId = this.assertOwner(mutation.ownerId);
      const mutations = await this.getPendingMutations();

      // Check if there's already a pending mutation for this trip
      const existingIndex = mutations.findIndex((m) => m.tripId === mutation.tripId);

      const newMutation: PendingMutation = {
        ...mutation,
        ownerId,
        id: `mutation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
      };

      // If there's an existing mutation, handle conflicts
      if (existingIndex >= 0) {
        const existing = mutations[existingIndex];

        // Delete supersedes everything
        if (mutation.type === 'delete') {
          mutations[existingIndex] = newMutation;
        }
        // Create + Update = Update the created data
        else if (existing.type === 'create' && mutation.type === 'update') {
          mutations[existingIndex] = {
            ...existing,
            localTrip: mutation.localTrip ?? existing.localTrip,
            data: mergeMutationData(existing.data, mutation.data),
            timestamp: Date.now(),
          };
        }
        // Update + Update = Merge updates
        else if (existing.type === 'update' && mutation.type === 'update') {
          mutations[existingIndex] = {
            ...existing,
            localTrip: mutation.localTrip ?? existing.localTrip,
            data: {
              ...mergeMutationData(existing.data, mutation.data),
              expectedUpdatedAt: existing.data?.expectedUpdatedAt,
            },
            timestamp: Date.now(),
          };
        }
        // Otherwise replace
        else {
          mutations[existingIndex] = newMutation;
        }
      } else {
        mutations.push(newMutation);
      }

      await this.savePendingMutations(mutations);
      await this.updateSyncMeta({ pendingCount: mutations.length });

      // If we merged into an existing mutation, return that merged entry; otherwise the new one.
      return existingIndex >= 0 ? mutations[existingIndex] : newMutation;
    } catch (error) {
      console.error('[OfflineStorage] Error adding pending mutation:', error);
      throw error;
    }
  }

  /**
   * Get all pending mutations
   */
  async getPendingMutations(): Promise<PendingMutation[]> {
    try {
      if (!this.account.user?.id) return [];
      const ownerId = this.assertOwner();
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_MUTATIONS);
      this.assertOwner(ownerId);
      if (!data) return [];
      const mutations = JSON.parse(data);
      return readCachedMutations(mutations, ownerId);
    } catch (error) {
      console.error('[OfflineStorage] Error getting pending mutations:', error);
      throw error;
    }
  }

  /**
   * Save pending mutations
   */
  async savePendingMutations(mutations: PendingMutation[]): Promise<void> {
    try {
      const ownerId = this.assertOwner();
      if (mutations.some((mutation) => mutation.ownerId !== ownerId)) {
        throw new Error('These saved changes belong to another account.');
      }
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_MUTATIONS);
      this.assertOwner(ownerId);
      const previous = data ? JSON.parse(data) : [];
      if (!Array.isArray(previous)) throw new Error('The saved change queue could not be read.');
      // A failed cleanup must not expose another owner or overwrite their queue.
      const otherOwners = previous.filter((mutation) => mutation?.ownerId !== ownerId);
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_MUTATIONS,
        JSON.stringify([...otherOwners, ...mutations])
      );
    } catch (error) {
      console.error('[OfflineStorage] Error saving pending mutations:', error);
      throw error;
    }
  }

  /**
   * Remove a mutation from the queue (after successful sync)
   */
  async removePendingMutation(mutationId: string): Promise<void> {
    try {
      const mutations = await this.getPendingMutations();
      const filtered = mutations.filter((m) => m.id !== mutationId);
      await this.savePendingMutations(filtered);
      await this.updateSyncMeta({ pendingCount: filtered.length });
    } catch (error) {
      console.error('[OfflineStorage] Error removing pending mutation:', error);
      throw error;
    }
  }

  /**
   * Increment retry count for a mutation
   */
  async blockPendingMutation(mutationId: string, reason: string): Promise<void> {
    const mutations = await this.getPendingMutations();
    const mutation = mutations.find((item) => item.id === mutationId);
    if (mutation) {
      mutation.blockedReason = reason;
      await this.savePendingMutations(mutations);
    }
  }

  async incrementMutationRetry(mutationId: string): Promise<void> {
    try {
      const mutations = await this.getPendingMutations();
      const index = mutations.findIndex((m) => m.id === mutationId);
      if (index >= 0) {
        mutations[index].retryCount++;
        await this.savePendingMutations(mutations);
      }
    } catch (error) {
      console.error('[OfflineStorage] Error incrementing retry:', error);
    }
  }

  /**
   * Clear all pending mutations (use with caution)
   */
  async clearPendingMutations(): Promise<void> {
    try {
      await this.savePendingMutations([]);
      await this.updateSyncMeta({ pendingCount: 0 });
    } catch (error) {
      console.error('[OfflineStorage] Error clearing pending mutations:', error);
      throw error;
    }
  }

  // ==================== SYNC METADATA ====================

  /**
   * Get sync metadata
   */
  async getSyncMeta(): Promise<SyncMeta> {
    try {
      if (!this.account.user?.id)
        return { lastSyncTime: null, lastSyncStatus: null, pendingCount: 0 };
      const ownerId = this.assertOwner();
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_META);
      this.assertOwner(ownerId);
      const meta = data ? JSON.parse(data) : null;
      if (meta?.ownerId !== ownerId) {
        return {
          lastSyncTime: null,
          lastSyncStatus: null,
          pendingCount: (await this.getPendingMutations()).length,
        };
      }
      return { ...meta, pendingCount: (await this.getPendingMutations()).length } as SyncMeta;
    } catch (error) {
      console.error('[OfflineStorage] Error getting sync meta:', error);
      throw error;
    }
  }

  /**
   * Update sync metadata
   */
  async updateSyncMeta(updates: Partial<SyncMeta>): Promise<void> {
    try {
      const ownerId = this.assertOwner();
      const current = await this.getSyncMeta();
      this.assertOwner(ownerId);
      const updated = { ...current, ...updates, ownerId };
      await AsyncStorage.setItem(STORAGE_KEYS.SYNC_META, JSON.stringify(updated));
    } catch (error) {
      console.error('[OfflineStorage] Error updating sync meta:', error);
    }
  }

  /**
   * Record a successful sync
   */
  async recordSuccessfulSync(): Promise<void> {
    await this.updateSyncMeta({
      lastSyncTime: Date.now(),
      lastSyncStatus: 'success',
    });
  }

  /**
   * Record a failed sync
   */
  async recordFailedSync(): Promise<void> {
    await this.updateSyncMeta({
      lastSyncTime: Date.now(),
      lastSyncStatus: 'failed',
    });
  }

  // ==================== UTILITIES ====================

  /**
   * Clear all offline data (for logout/reset)
   */
  async clearAll(authorize: () => Promise<void> = async () => {}): Promise<void> {
    // Recheck identity after earlier storage work, immediately before removal.
    // Later operations (including a new account's save) wait for ALL removals.
    await authorize();
    const current = useUserStore.getState();
    if (
      current.user?.id !== this.account.user?.id ||
      current.accountRevision !== this.account.accountRevision
    ) {
      throw new Error('Your account changed. The new account cache was kept.');
    }
    const results = await Promise.allSettled([
      AsyncStorage.removeItem(STORAGE_KEYS.TRIPS),
      AsyncStorage.removeItem(STORAGE_KEYS.PENDING_MUTATIONS),
      AsyncStorage.removeItem(STORAGE_KEYS.SYNC_META),
      AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC),
    ]);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  }

  /**
   * Get storage stats for debugging
   */
  async getStorageStats(): Promise<{
    tripCount: number;
    pendingMutations: number;
    lastSync: number | null;
  }> {
    const trips = await this.loadTrips();
    const mutations = await this.getPendingMutations();
    const meta = await this.getSyncMeta();

    return {
      tripCount: trips.length,
      pendingMutations: mutations.length,
      lastSync: meta.lastSyncTime,
    };
  }
}

// Export singleton instance
// Serialize whole public operations, not individual AsyncStorage calls: nested
// read-modify-write methods stay atomic and cannot span another account's clear.
export const offlineStorage = new Proxy(new OfflineStorage(), {
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    return typeof value === 'function'
      ? (...args: unknown[]) => {
          const operation = new OfflineStorage();
          return serializeStorage(() => value.apply(operation, args));
        }
      : value;
  },
});
