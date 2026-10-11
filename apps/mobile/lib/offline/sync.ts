/**
 * Sync Service
 * Handles background synchronization between local storage and Supabase
 */

import { offlineStorage, PendingMutation } from './storage';
import { networkMonitor } from './network';
import { API_BASE_URL, getAuthHeaders } from '../supabase';
import { normalizeTripStatus } from '../tripStatus';
import type { Trip, TripInput } from '../../stores/tripStore';
import { IMAGE_PATHS, getImageUrl } from '@faroway/constants';

import { requestWithTimeout } from '../../services/request';
import { supabase } from '../supabase';
import * as Crypto from 'expo-crypto';

async function syncResponse(input: RequestInfo | URL, init: RequestInit) {
  return requestWithTimeout(
    input,
    init,
    async (response) => {
      const data = await response.json().catch(() => null);
      return { ok: response.ok, status: response.status, json: async () => data };
    },
    15_000
  );
}

async function accountSession(ownerId?: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session || (ownerId && data.session.user.id !== ownerId))
    throw new Error('Your account changed. Reopen your trips before syncing.');
  return data.session;
}

async function ownedSyncResponse(input: RequestInfo | URL, init: RequestInit, ownerId: string) {
  const session = await accountSession(ownerId);
  const response = await syncResponse(input, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${session.access_token}` },
  });
  await accountSession(ownerId);
  return response;
}

import { buildTripCreatePayload, buildTripUpdatePayload } from './trip-payload';
export { buildTripCreatePayload, buildTripUpdatePayload } from './trip-payload';

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

type SyncListener = (state: SyncState) => void;

// Conflict resolution strategy
export type ConflictStrategy = 'client-wins' | 'server-wins' | 'last-write-wins';

// Maximum automatic retries before retaining a mutation for explicit review
const MAX_RETRY_COUNT = 3;

// Minimum time between syncs (prevent rapid-fire)
const MIN_SYNC_INTERVAL = 5000; // 5 seconds

/**
 * Sync Service class
 * Manages bidirectional sync between local storage and backend
 */
class TripRevisionConflict extends Error {}

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
      const pushResult = await this.pushPendingMutations();
      result.synced = pushResult.synced;
      result.failed = pushResult.failed;
      result.errors = pushResult.errors;

      result.success = result.failed === 0;

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

      if (result.failed === 0) await offlineStorage.recordSuccessfulSync();
      else await offlineStorage.recordFailedSync();

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
  private async pushPendingMutations(): Promise<SyncResult> {
    const mutations = await offlineStorage.getPendingMutations();
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    if (mutations.length === 0) {
      return result;
    }

    console.log(`[SyncService] Pushing ${mutations.length} pending mutations`);

    // Process in order (oldest first)
    const sorted = mutations.sort((a, b) => a.timestamp - b.timestamp);

    for (const mutation of sorted) {
      if (mutation.blockedReason) {
        result.failed++;
        result.errors.push({ mutationId: mutation.id, error: mutation.blockedReason });
        continue;
      }
      // Skip if too many retries
      if (mutation.retryCount >= MAX_RETRY_COUNT) {
        const reason =
          'Automatic sync stopped after repeated failures. Your changes are saved; review them before retrying or discarding.';
        await offlineStorage.blockPendingMutation(mutation.id, reason);
        result.failed++;
        result.errors.push({ mutationId: mutation.id, error: reason });
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
        if (error instanceof TripRevisionConflict) {
          await offlineStorage.blockPendingMutation(mutation.id, errorMessage);
        } else {
          await offlineStorage.incrementMutationRetry(mutation.id);
        }
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
    if (!mutation.ownerId)
      throw new TripRevisionConflict(
        'This older request has no verified account. Review your saved trips before retrying or discarding it.'
      );
    const headers = await getAuthHeaders();

    switch (mutation.type) {
      case 'create': {
        if (typeof mutation.data?.requestId !== 'string')
          throw new TripRevisionConflict(
            'This older creation request has no safe retry identity. Check My Trips before discarding it or starting a new trip.'
          );
        const response = await ownedSyncResponse(
          `${API_BASE_URL}/api/trips`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(mutation.data),
          },
          mutation.ownerId
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          if ([409, 410].includes(response.status))
            throw new TripRevisionConflict(error?.error || 'Review this creation request.');
          throw new Error(error.error || `HTTP ${response.status}`);
        }

        // Update local trip with server-generated ID
        const { trip } = await response.json();
        if (!trip || typeof trip.id !== 'string')
          throw new Error('Trip creation was not confirmed. Your local request is kept.');
        if (mutation.tripId.startsWith('local_')) {
          // Replace local trip with server trip
          await offlineStorage.deleteTrip(mutation.tripId);
          await offlineStorage.saveTrip(this.transformApiTrip(trip));
        }
        break;
      }

      case 'update': {
        const response = await ownedSyncResponse(
          `${API_BASE_URL}/api/trips/${mutation.tripId}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify(mutation.data),
          },
          mutation.ownerId
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          if (response.status === 409 || response.status === 428)
            throw new TripRevisionConflict(
              error.error || 'Load the latest trip and review your unsynced changes.'
            );
          throw new Error(error.error || `HTTP ${response.status}`);
        }
        break;
      }

      case 'delete': {
        const response = await ownedSyncResponse(
          `${API_BASE_URL}/api/trips/${mutation.tripId}`,
          {
            method: 'DELETE',
            headers,
          },
          mutation.ownerId
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
      const session = await accountSession();
      const headers = await getAuthHeaders();
      const response = await ownedSyncResponse(
        `${API_BASE_URL}/api/trips`,
        {
          method: 'GET',
          headers,
        },
        session.user.id
      );

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
      const localTrips = await offlineStorage.loadTrips();

      // Merge: server wins for existing trips, keep local-only trips
      const mergedTrips = this.mergeTrips(localTrips, serverTrips);

      await accountSession(session.user.id);
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
   * Merge local and server trips
   * Strategy: Server wins for conflicts, keep local-only (pending) trips
   */
  private mergeTrips(local: Trip[], server: Trip[]): Trip[] {
    const merged: Map<string, Trip> = new Map();

    // First, add all server trips (authoritative)
    server.forEach((trip) => merged.set(trip.id, trip));

    // Then, add local-only trips (those with local_ prefix that haven't synced)
    local.forEach((trip) => {
      if (trip.id.startsWith('local_') && !merged.has(trip.id)) {
        merged.set(trip.id, trip);
      }
    });

    return Array.from(merged.values());
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
      planNeedsRefresh: apiTrip.preferences?.planNeedsRefresh === true,
      days: apiTrip.preferences?.planNeedsRefresh ? [] : apiTrip.itinerary?.days || [],
      coverImage:
        apiTrip.cover_image ||
        getImageUrl(IMAGE_PATHS.blog['ultimate-guide-planning-trip-with-ai']),
      createdAt: apiTrip.created_at,
      updatedAt: apiTrip.updated_at,
      status: normalizeTripStatus(apiTrip.status),
    };
  }

  /**
   * Queue a create operation (for offline)
   */
  async queueCreate(trip: Trip): Promise<void> {
    if (this.syncInProgress) throw new Error('Wait for sync to finish before editing trips.');
    const session = await accountSession();
    await offlineStorage.saveTrip(trip);
    await offlineStorage.addPendingMutation({
      type: 'create',
      ownerId: session.user.id,
      tripId: trip.id,
      // Store the snake_case API payload so a later sync can POST it
      // directly. Anything else would 400 against the backend's
      // CreateTripSchema.
      data: { ...buildTripCreatePayload(trip), requestId: Crypto.randomUUID() },
    });

    const meta = await offlineStorage.getSyncMeta();
    this.updateState({ pendingCount: meta.pendingCount });
  }

  /**
   * Queue an update operation (for offline)
   */
  async queueUpdate(tripId: string, updates: Partial<TripInput>): Promise<void> {
    if (this.syncInProgress) throw new Error('Wait for sync to finish before editing this trip.');
    const session = await accountSession();
    // Update local storage
    const trip = await offlineStorage.getTrip(tripId);
    if (trip) {
      await offlineStorage.saveTrip({ ...trip, ...updates } as Trip);
    }

    await offlineStorage.addPendingMutation({
      type: 'update',
      ownerId: session.user.id,
      tripId,
      // Same snake_case contract as create — the API's UpdateTripSchema
      // is strict() and rejects camelCase keys.
      data: buildTripUpdatePayload(updates, trip?.updatedAt),
    });

    const meta = await offlineStorage.getSyncMeta();
    this.updateState({ pendingCount: meta.pendingCount });
  }

  /**
   * Queue a delete operation (for offline)
   */
  async queueDelete(tripId: string): Promise<void> {
    if (this.syncInProgress) throw new Error('Wait for sync to finish before editing trips.');
    const session = await accountSession();
    await offlineStorage.deleteTrip(tripId);
    await offlineStorage.addPendingMutation({
      type: 'delete',
      ownerId: session.user.id,
      tripId,
    });

    const meta = await offlineStorage.getSyncMeta();
    this.updateState({ pendingCount: meta.pendingCount });
  }

  /** Explicit traveler choice after comparing the current server brief. */
  async resolveBlockedMutation(snapshot: PendingMutation, revision?: string): Promise<void> {
    if (this.syncInProgress)
      throw new Error('Wait for sync to finish before resolving this change.');
    this.syncInProgress = true;
    this.updateState({ status: 'syncing' });
    try {
      const current = (await offlineStorage.getPendingMutations()).find(
        (m) => m.id === snapshot.id
      );
      if (!current?.blockedReason || JSON.stringify(current) !== JSON.stringify(snapshot))
        throw new Error('Your local changes changed. Review them again before continuing.');
      if (revision) {
        const session = await accountSession(snapshot.ownerId);
        const response = await ownedSyncResponse(
          `${API_BASE_URL}/api/trips/${snapshot.tripId}`,
          {
            method: 'PATCH',
            headers: await getAuthHeaders(),
            body: JSON.stringify({ ...snapshot.data, expectedUpdatedAt: revision }),
          },
          session.user.id
        );
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Could not save. Your local changes are still kept.');
        }
      }
      await offlineStorage.removePendingMutation(snapshot.id);
      this.updateState({
        pendingCount: (await offlineStorage.getPendingMutations()).length,
        status: 'idle',
        error: null,
      });
    } finally {
      this.syncInProgress = false;
      if (this.state.status === 'syncing') this.updateState({ status: 'error' });
    }
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
