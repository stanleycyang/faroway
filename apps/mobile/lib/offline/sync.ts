/**
 * Sync Service
 * Handles background synchronization between local storage and Supabase
 */

import { offlineStorage, PendingMutation, PendingMutationData } from './storage';
import { networkMonitor } from './network';
import { API_BASE_URL, getAuthHeaders } from '../supabase';
import { normalizeTripStatus } from '../tripStatus';
import type { Trip, TripInput } from '../../stores/tripStore';
import { IMAGE_PATHS, getImageUrl } from '@faroway/constants';
import { fetchWithTimeout } from '../../services/request';
import { buildTripUpdatePayload } from '../../services/tripPayload';

export { buildTripUpdatePayload } from '../../services/tripPayload';

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
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ mutationId: string; error: string }>;
}

export interface SyncState {
  status: SyncStatus;
  lastSyncTime: number | null;
  pendingCount: number;
  isOnline: boolean;
  error: string | null;
}

/**
 * Merge server state without overwriting local changes that are still queued.
 * Deletes remain hidden, updates remain client-visible, and locally-created
 * trips remain available until the server acknowledges them.
 */
export function mergeTripsForSync(
  local: Trip[],
  server: Trip[],
  pendingMutations: PendingMutation[]
): Trip[] {
  const pendingByTrip = new Map(
    pendingMutations.map((mutation) => [mutation.tripId, mutation.type])
  );
  const localById = new Map(local.map((trip) => [trip.id, trip]));
  const merged = new Map<string, Trip>();

  for (const serverTrip of server) {
    const pendingType = pendingByTrip.get(serverTrip.id);
    if (pendingType === 'delete') continue;
    if (pendingType === 'update') {
      merged.set(serverTrip.id, localById.get(serverTrip.id) ?? serverTrip);
      continue;
    }
    merged.set(serverTrip.id, serverTrip);
  }

  for (const localTrip of local) {
    const pendingType = pendingByTrip.get(localTrip.id);
    if (pendingType === 'delete') continue;
    if (pendingType === 'create' || pendingType === 'update' || localTrip.id.startsWith('local_')) {
      merged.set(localTrip.id, localTrip);
    }
  }

  return Array.from(merged.values());
}

type SyncListener = (state: SyncState) => void;

// Conflict resolution strategy
export type ConflictStrategy = 'client-wins' | 'server-wins' | 'last-write-wins';

// Maximum retries before abandoning a mutation
const MAX_RETRY_COUNT = 3;

// Minimum time between syncs (prevent rapid-fire)
const MIN_SYNC_INTERVAL = 5000; // 5 seconds

/**
 * Sync Service class
 * Manages bidirectional sync between local storage and backend
 */
class SyncService {
  private state: SyncState = {
    status: 'idle',
    lastSyncTime: null,
    pendingCount: 0,
    isOnline: true,
    error: null,
  };

  private listeners: Set<SyncListener> = new Set();
  private syncInProgress: boolean = false;
  private lastSyncAttempt: number = 0;
  private networkUnsubscribe: (() => void) | null = null;
  private autoSyncEnabled: boolean = true;
  private hasResolvedNetwork: boolean = false;

  /**
   * Initialize the sync service
   */
  async initialize(): Promise<void> {
    // Initialize network monitoring
    await networkMonitor.initialize();

    // Subscribe to network changes
    this.networkUnsubscribe = networkMonitor.subscribe(async (networkState) => {
      const wasOffline = !this.state.isOnline;
      this.state.isOnline = networkState.status === 'online';

      // Only trigger "network restored" sync after the initial state has settled.
      // The unknown → online transition at startup is not a real restore.
      if (wasOffline && this.state.isOnline && this.autoSyncEnabled && this.hasResolvedNetwork) {
        console.log('[SyncService] Network restored, triggering sync');
        await this.sync();
      }

      if (networkState.status !== 'unknown') {
        this.hasResolvedNetwork = true;
      }

      this.notifyListeners();
    });

    // Load initial sync state
    const meta = await offlineStorage.getSyncMeta();
    this.state.lastSyncTime = meta.lastSyncTime;
    this.state.pendingCount = meta.pendingCount;
    this.state.isOnline = networkMonitor.isOnline();

    if (!this.state.isOnline) {
      this.state.status = 'offline';
    }

    console.log('[SyncService] Initialized', this.state);
  }

  /**
   * Get current sync state
   */
  getState(): SyncState {
    return { ...this.state };
  }

  /**
   * Subscribe to sync state changes
   */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('[SyncService] Listener error:', error);
      }
    });
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<SyncState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  /**
   * Enable/disable automatic syncing
   */
  setAutoSync(enabled: boolean): void {
    this.autoSyncEnabled = enabled;
  }

  /**
   * Full sync - fetch from server and push pending changes
   */
  async sync(force: boolean = false): Promise<SyncResult> {
    // Prevent concurrent syncs
    if (this.syncInProgress) {
      console.log('[SyncService] Sync already in progress');
      return { success: false, synced: 0, failed: 0, errors: [] };
    }

    // Rate limiting
    const now = Date.now();
    if (!force && now - this.lastSyncAttempt < MIN_SYNC_INTERVAL) {
      console.log('[SyncService] Sync rate limited');
      return { success: false, synced: 0, failed: 0, errors: [] };
    }

    // Check network
    if (!networkMonitor.isOnline()) {
      this.updateState({ status: 'offline', error: 'No network connection' });
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: [{ mutationId: '', error: 'Offline' }],
      };
    }

    this.syncInProgress = true;
    this.lastSyncAttempt = now;
    this.updateState({ status: 'syncing', error: null });

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Step 1: Push pending mutations first
      const pushResult = await this.pushPendingMutations(force);
      result.synced = pushResult.synced;
      result.failed = pushResult.failed;
      result.errors = pushResult.errors;
      result.success = pushResult.failed === 0;

      // Step 2: Pull latest from server
      await this.pullFromServer();

      // Update state
      const meta = await offlineStorage.getSyncMeta();
      this.updateState({
        status: result.failed > 0 ? 'error' : 'success',
        lastSyncTime: Date.now(),
        pendingCount: meta.pendingCount,
        error: result.failed > 0 ? `${result.failed} items failed to sync` : null,
      });

      await offlineStorage.updateSyncMeta({
        lastSyncTime: Date.now(),
        lastSyncStatus: result.failed > 0 ? 'partial' : 'success',
      });

      console.log('[SyncService] Sync complete:', result);
      return result;
    } catch (error: unknown) {
      result.success = false;

      // Treat network request failures (server unreachable) as temporary offline,
      // not as a hard error. This prevents error spam when the backend isn't running.
      const isNetworkError =
        error instanceof TypeError && /network request failed/i.test(error.message);

      if (isNetworkError) {
        console.log('[SyncService] Backend unreachable, treating as offline');
        this.updateState({
          status: 'offline',
          error: null,
        });
        return result;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[SyncService] Sync failed:', error);
      result.errors.push({ mutationId: '', error: errorMessage });

      this.updateState({
        status: 'error',
        error: errorMessage,
      });

      await offlineStorage.recordFailedSync();

      return result;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Push pending mutations to server
   */
  private async pushPendingMutations(force: boolean): Promise<SyncResult> {
    const mutations = await offlineStorage.getPendingMutations();
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    if (mutations.length === 0) {
      return result;
    }

    console.log(`[SyncService] Pushing ${mutations.length} pending mutations`);

    // Process in order (oldest first)
    const sorted = mutations.sort((a, b) => a.timestamp - b.timestamp);

    for (const mutation of sorted) {
      // Automatic sync stops hammering a permanently failing mutation, but
      // preserves it so a pull cannot erase the user's local edit. A manual
      // forced sync is still allowed to retry it.
      if (!force && mutation.retryCount >= MAX_RETRY_COUNT) {
        console.log(`[SyncService] Mutation ${mutation.id} exceeded automatic retry limit`);
        result.failed++;
        result.errors.push({ mutationId: mutation.id, error: 'Max retries exceeded' });
        continue;
      }

      try {
        await this.executeMutation(mutation);
        await offlineStorage.removePendingMutation(mutation.id);
        result.synced++;
        console.log(`[SyncService] Mutation ${mutation.id} synced successfully`);
      } catch (error: unknown) {
        // If backend is unreachable, stop processing the rest of the queue
        const isNetworkError =
          error instanceof TypeError && /network request failed/i.test(error.message);
        if (isNetworkError) {
          throw error; // Let sync() handle this as offline
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[SyncService] Mutation ${mutation.id} failed:`, error);
        await offlineStorage.incrementMutationRetry(mutation.id);
        result.failed++;
        result.errors.push({ mutationId: mutation.id, error: errorMessage });
      }
    }

    return result;
  }

  /**
   * Execute a single mutation on the server
   */
  private async executeMutation(mutation: PendingMutation): Promise<void> {
    const headers = await getAuthHeaders();

    switch (mutation.type) {
      case 'create': {
        const response = await fetchWithTimeout(`${API_BASE_URL}/api/trips`, {
          method: 'POST',
          headers,
          body: JSON.stringify(mutation.data),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(error.error || `HTTP ${response.status}`);
        }

        // Update local trip with server-generated ID
        const { trip } = await response.json();
        if (trip && mutation.tripId.startsWith('local_')) {
          // Replace local trip with server trip
          await offlineStorage.deleteTrip(mutation.tripId);
          await offlineStorage.saveTrip(this.transformApiTrip(trip));
        }
        break;
      }

      case 'update': {
        const response = await fetchWithTimeout(
          `${API_BASE_URL}/api/trips/${encodeURIComponent(mutation.tripId)}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify(mutation.data),
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(error.error || `HTTP ${response.status}`);
        }
        break;
      }

      case 'delete': {
        const response = await fetchWithTimeout(
          `${API_BASE_URL}/api/trips/${encodeURIComponent(mutation.tripId)}`,
          {
            method: 'DELETE',
            headers,
          }
        );

        // 404 is acceptable for delete (already deleted)
        if (!response.ok && response.status !== 404) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(error.error || `HTTP ${response.status}`);
        }
        break;
      }
    }
  }

  /**
   * Pull latest trips from server
   */
  private async pullFromServer(): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/trips`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log('[SyncService] Not authenticated, skipping pull');
          return;
        }
        throw new Error(`Failed to fetch trips: HTTP ${response.status}`);
      }

      const data = await response.json();
      const serverTrips: Trip[] = (data.trips || []).map(this.transformApiTrip);

      // Get local trips
      const [localTrips, pendingMutations] = await Promise.all([
        offlineStorage.loadTrips(),
        offlineStorage.getPendingMutations(),
      ]);

      const mergedTrips = mergeTripsForSync(localTrips, serverTrips, pendingMutations);

      await offlineStorage.saveTrips(mergedTrips);
      console.log(`[SyncService] Pulled ${serverTrips.length} trips from server`);
    } catch (error) {
      // Network errors are handled by sync() — only log non-network failures here
      const isNetworkError =
        error instanceof TypeError && /network request failed/i.test((error as Error).message);
      if (!isNetworkError) {
        console.error('[SyncService] Pull failed:', error);
      }
      throw error;
    }
  }

  /**
   * Transform API trip format to local Trip format
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformApiTrip(apiTrip: any): Trip {
    return {
      id: apiTrip.id,
      destination: apiTrip.destination,
      country: apiTrip.country || '',
      startDate: apiTrip.start_date,
      endDate: apiTrip.end_date,
      travelers: apiTrip.travelers,
      travelerType: apiTrip.traveler_type || 'solo',
      vibes: apiTrip.vibes || [],
      budget: apiTrip.budget,
      days: apiTrip.itinerary?.days || [],
      coverImage:
        apiTrip.cover_image ||
        getImageUrl(IMAGE_PATHS.blog['ultimate-guide-planning-trip-with-ai']),
      createdAt: apiTrip.created_at,
      status: normalizeTripStatus(apiTrip.status),
    };
  }

  /**
   * Queue a create operation (for offline)
   */
  async queueCreate(trip: Trip): Promise<void> {
    await offlineStorage.saveTrip(trip);
    await offlineStorage.addPendingMutation({
      type: 'create',
      tripId: trip.id,
      // Store the snake_case API payload so a later sync can POST it
      // directly. Anything else would 400 against the backend's
      // CreateTripSchema.
      data: buildTripCreatePayload(trip),
    });

    const meta = await offlineStorage.getSyncMeta();
    this.updateState({ pendingCount: meta.pendingCount });
  }

  /**
   * Queue an update operation (for offline)
   */
  async queueUpdate(tripId: string, updates: Partial<TripInput>): Promise<void> {
    // Update local storage
    const trip = await offlineStorage.getTrip(tripId);
    if (trip) {
      await offlineStorage.saveTrip({ ...trip, ...updates } as Trip);
    }

    await offlineStorage.addPendingMutation({
      type: 'update',
      tripId,
      // Same snake_case contract as create — the API's UpdateTripSchema
      // is strict() and rejects camelCase keys.
      data: buildTripUpdatePayload(updates),
    });

    const meta = await offlineStorage.getSyncMeta();
    this.updateState({ pendingCount: meta.pendingCount });
  }

  /**
   * Queue a delete operation (for offline)
   */
  async queueDelete(tripId: string): Promise<void> {
    await offlineStorage.deleteTrip(tripId);
    await offlineStorage.addPendingMutation({
      type: 'delete',
      tripId,
    });

    const meta = await offlineStorage.getSyncMeta();
    this.updateState({ pendingCount: meta.pendingCount });
  }

  /**
   * Clear all local data (for logout)
   */
  async clearAll(): Promise<void> {
    await offlineStorage.clearAll();
    this.updateState({
      status: 'idle',
      lastSyncTime: null,
      pendingCount: 0,
      error: null,
    });
  }

  /**
   * Cleanup subscriptions
   */
  cleanup(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const syncService = new SyncService();
