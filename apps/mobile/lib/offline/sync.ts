import { readOwnedTripPages } from '../tripListPages';
import { retainTripDetail } from '../tripSummary';
/**
 * Sync Service
 * Handles background synchronization between local storage and Supabase
 */

import { offlineStorage, PendingMutation } from './storage';
import { networkMonitor } from './network';
import { API_BASE_URL } from '../supabase';
import { normalizeTripStatus } from '../tripStatus';
import type { Trip, TripInput } from '../../stores/tripStore';
import { IMAGE_PATHS, getImageUrl } from '@faroway/constants';

import { requestWithTimeout } from '../../services/request';
import * as Crypto from 'expo-crypto';
import { captureTripAccount, readTripSession } from '../tripAccountScope';
import { useUserStore } from '../../stores/userStore';

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
  const { data, error } = await readTripSession();
  if (error || !data.session || (ownerId && data.session.user.id !== ownerId))
    throw new Error('Your account changed. Reopen your trips before syncing.');
  return data.session;
}

async function ownedSyncResponse(input: RequestInfo | URL, init: RequestInit, ownerId: string) {
  const account = captureTripAccount();
  account.assertCurrent();
  if (account.ownerId !== ownerId)
    throw new Error('Your account changed. Reopen your trips before syncing.');
  const headers = await account.headers();
  account.assertCurrent();
  const response = await syncResponse(input, {
    ...init,
    headers: { ...init.headers, ...headers },
  });
  account.assertCurrent();
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

/** A 200 response alone must never erase the user's durable pending edits. */
function confirmedTripReceipt(
  value: unknown,
  tripId: string,
  ownerId: string,
  previousRevision?: string
) {
  const trip = (value as { trip?: Record<string, unknown> } | null)?.trip;
  if (
    !trip ||
    trip.id !== tripId ||
    trip.user_id !== ownerId ||
    (previousRevision !== undefined &&
      (typeof trip.updated_at !== 'string' ||
        !trip.updated_at.trim() ||
        trip.updated_at === previousRevision))
  )
    throw new TripRevisionConflict(
      'The save response could not be verified. Your local changes are kept. Load the latest trip before retrying.'
    );
  return trip;
}

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
  private mutationRevision = 0;
  private mutationsSettled: Promise<void> = Promise.resolve();
  private lastSyncAttempt: number = 0;
  private networkUnsubscribe: (() => void) | null = null;
  private autoSyncEnabled: boolean = false;
  private hasResolvedNetwork: boolean = false;
  private initialization: Promise<void> | null = null;
  private accountUnsubscribe: (() => void) | null = null;
  private stateOwner: string | undefined;
  private stateRevision: number | undefined;

  /** A detail read must not combine a server reply with an obsolete queue snapshot. */
  captureMutationRead() {
    const revision = this.mutationRevision;
    return {
      settled: this.mutationsSettled,
      isCurrent: () => revision === this.mutationRevision,
    };
  }

  private beginMutationSync(): () => void {
    this.syncInProgress = true;
    this.mutationRevision++;
    let settle!: () => void;
    this.mutationsSettled = new Promise<void>((resolve) => {
      settle = resolve;
    });
    return () => {
      this.syncInProgress = false;
      this.mutationRevision++;
      settle();
    };
  }

  /**
   * Initialize the sync service
   */
  initialize(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.initializeOnce().catch((error) => {
        this.accountUnsubscribe?.();
        this.accountUnsubscribe = null;
        this.networkUnsubscribe?.();
        this.networkUnsubscribe = null;
        this.initialization = null;
        throw error;
      });
    }
    return this.initialization;
  }

  private async initializeOnce(): Promise<void> {
    const account = captureTripAccount();
    this.accountUnsubscribe = useUserStore.subscribe((current, previous) => {
      if (current.accountRevision === previous.accountRevision) return;
      this.lastSyncAttempt = 0;
      this.updateState(
        {
          status: this.state.isOnline ? 'idle' : 'offline',
          lastSyncTime: null,
          pendingCount: 0,
          error: null,
        },
        captureTripAccount()
      );
    });
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
    this.state.isOnline = networkMonitor.isOnline();
    this.updateState(
      {
        lastSyncTime: meta.lastSyncTime,
        pendingCount: meta.pendingCount,
        status: this.state.isOnline ? 'idle' : 'offline',
        error: null,
      },
      account
    );

    console.log('[SyncService] Initialized', this.state);
  }

  /**
   * Get current sync state
   */
  getState(): SyncState {
    const current = useUserStore.getState();
    if (this.stateOwner !== current.user?.id || this.stateRevision !== current.accountRevision) {
      return {
        ...this.state,
        status: this.state.isOnline ? 'idle' : 'offline',
        pendingCount: 0,
        lastSyncTime: null,
        error: null,
      };
    }
    return { ...this.state };
  }

  /**
   * Subscribe to sync state changes
   */
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());

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
        listener(this.getState());
      } catch (error) {
        console.error('[SyncService] Listener error:', error);
      }
    });
  }

  /**
   * Update state and notify listeners
   */
  private updateState(
    updates: Partial<SyncState>,
    account?: ReturnType<typeof captureTripAccount>
  ): void {
    if (account) {
      if (!account.isCurrent()) return;
      this.stateOwner = account.ownerId;
      this.stateRevision = account.accountRevision;
    }
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
    const account = captureTripAccount();
    if (!account.ownerId) return { success: false, synced: 0, failed: 0, errors: [] };
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
      this.updateState({ status: 'offline', error: 'No network connection' }, account);
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: [{ mutationId: '', error: 'Offline' }],
      };
    }

    const finishMutationSync = this.beginMutationSync();
    this.lastSyncAttempt = now;
    this.updateState({ status: 'syncing', error: null }, account);

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Step 1: Push pending mutations first
      const pushResult = await this.pushPendingMutations(account);
      account.assertCurrent();
      result.synced = pushResult.synced;
      result.failed = pushResult.failed;
      result.errors = pushResult.errors;

      result.success = result.failed === 0;

      // Step 2: Pull latest from server
      await this.pullFromServer(account.ownerId);
      account.assertCurrent();

      // Update state
      const meta = await offlineStorage.getSyncMeta();
      account.assertCurrent();
      this.updateState(
        {
          status: result.failed > 0 ? 'error' : 'success',
          lastSyncTime: Date.now(),
          pendingCount: meta.pendingCount,
          error: result.failed > 0 ? `${result.failed} items failed to sync` : null,
        },
        account
      );

      if (result.failed === 0) await offlineStorage.recordSuccessfulSync();
      else await offlineStorage.recordFailedSync();

      console.log('[SyncService] Sync complete:', result);
      return result;
    } catch (error: unknown) {
      result.success = false;
      if (!account.isCurrent()) return result;

      // Treat network request failures (server unreachable) as temporary offline,
      // not as a hard error. This prevents error spam when the backend isn't running.
      const isNetworkError =
        error instanceof TypeError && /network request failed/i.test(error.message);

      if (isNetworkError) {
        console.log('[SyncService] Backend unreachable, treating as offline');
        this.updateState(
          {
            status: 'offline',
            error: null,
          },
          account
        );
        return result;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[SyncService] Sync failed:', error);
      result.errors.push({ mutationId: '', error: errorMessage });

      this.updateState(
        {
          status: 'error',
          error: errorMessage,
        },
        account
      );

      await offlineStorage.recordFailedSync();

      return result;
    } finally {
      finishMutationSync();
      if (!account.isCurrent() && this.autoSyncEnabled && useUserStore.getState().user) {
        void this.sync(true);
      }
    }
  }

  /**
   * Push pending mutations to server
   */
  private async pushPendingMutations(
    account: ReturnType<typeof captureTripAccount>
  ): Promise<SyncResult> {
    const mutations = await offlineStorage.getPendingMutations();
    account.assertCurrent();
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    if (mutations.length === 0) {
      return result;
    }

    console.log(`[SyncService] Pushing ${mutations.length} pending mutations`);

    // Process in order (oldest first)
    const sorted = mutations.sort((a, b) => a.timestamp - b.timestamp);

    for (const mutation of sorted) {
      account.assertCurrent();
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
        account.assertCurrent();
        await offlineStorage.removePendingMutation(mutation.id);
        result.synced++;
        console.log(`[SyncService] Mutation ${mutation.id} synced successfully`);
      } catch (error: unknown) {
        if (!account.isCurrent()) throw error;
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
    const headers = { 'Content-Type': 'application/json' };

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
        const trip = confirmedTripReceipt(
          await response.json(),
          mutation.data.requestId,
          mutation.ownerId
        );
        if (mutation.tripId.startsWith('local_')) {
          // Replace local trip with server trip
          await offlineStorage.deleteTrip(mutation.tripId, mutation.ownerId);
          await offlineStorage.saveTrip(this.transformApiTrip(trip), mutation.ownerId);
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
        confirmedTripReceipt(
          await response.json(),
          mutation.tripId,
          mutation.ownerId,
          typeof mutation.data?.expectedUpdatedAt === 'string'
            ? mutation.data.expectedUpdatedAt
            : ''
        );
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
  private async pullFromServer(ownerId: string): Promise<void> {
    try {
      const session = await accountSession(ownerId);
      const account = captureTripAccount();
      account.assertCurrent();
      const data = {
        trips: await readOwnedTripPages(
          session.user.id,
          (cursor) =>
            ownedSyncResponse(
              `${API_BASE_URL}/api/trips${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
              { method: 'GET', headers: { 'Content-Type': 'application/json' } },
              session.user.id
            ),
          account.assertCurrent
        ),
      };
      const serverTrips: Trip[] = (data.trips || []).map(this.transformApiTrip);

      // Get local trips
      const localTrips = await offlineStorage.loadSavedTrips();
      account.assertCurrent();

      // Merge: server wins for existing trips, keep local-only trips
      const summaryIds = new Set<string>(
        (data.trips || [])
          .filter((trip: { itinerary?: unknown }) => !trip.itinerary)
          .map((trip: { id: string }) => trip.id)
      );
      const mergedTrips = this.mergeTrips(localTrips, serverTrips, summaryIds);

      await accountSession(session.user.id);
      account.assertCurrent();
      await offlineStorage.saveTrips(mergedTrips, session.user.id);
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
  private mergeTrips(local: Trip[], server: Trip[], summaryIds: Set<string>): Trip[] {
    const merged: Map<string, Trip> = new Map();

    const cachedById = new Map(local.map((trip) => [trip.id, trip]));
    // First, add all server trips (authoritative)
    server.forEach((trip) => {
      const cached = cachedById.get(trip.id);
      merged.set(trip.id, retainTripDetail(trip, cached, summaryIds.has(trip.id)));
    });

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
    const account = captureTripAccount();
    account.assertCurrent();
    const snapshot = JSON.parse(JSON.stringify(trip)) as Trip;
    const session = await accountSession(account.ownerId);
    account.assertCurrent();
    await offlineStorage.addPendingMutation({
      type: 'create',
      localTrip: snapshot,
      ownerId: session.user.id,
      tripId: snapshot.id,
      // Store the snake_case API payload so a later sync can POST it
      // directly. Anything else would 400 against the backend's
      // CreateTripSchema.
      data: { ...buildTripCreatePayload(snapshot), requestId: Crypto.randomUUID() },
    });

    const meta = await offlineStorage.getSyncMeta();
    account.assertCurrent();
    this.updateState({ pendingCount: meta.pendingCount }, account);
  }

  /**
   * Queue an update operation (for offline)
   */
  async queueUpdate(tripId: string, updates: Partial<TripInput>): Promise<void> {
    if (this.syncInProgress) throw new Error('Wait for sync to finish before editing this trip.');
    const account = captureTripAccount();
    account.assertCurrent();
    const snapshot = JSON.parse(JSON.stringify(updates)) as Partial<TripInput>;
    const session = await accountSession(account.ownerId);
    account.assertCurrent();
    // Update local storage
    const trip = await offlineStorage.getTrip(tripId);
    account.assertCurrent();
    if (!trip) throw new Error('Reopen your saved trip before editing it offline.');
    await offlineStorage.addPendingMutation({
      type: 'update',
      localTrip: { ...trip, ...snapshot },
      ownerId: session.user.id,
      tripId,
      // Same snake_case contract as create — the API's UpdateTripSchema
      // is strict() and rejects camelCase keys.
      data: buildTripUpdatePayload(snapshot, trip?.updatedAt),
    });

    const meta = await offlineStorage.getSyncMeta();
    account.assertCurrent();
    this.updateState({ pendingCount: meta.pendingCount }, account);
  }

  /**
   * Queue a delete operation (for offline)
   */
  async queueDelete(tripId: string): Promise<void> {
    if (this.syncInProgress) throw new Error('Wait for sync to finish before editing trips.');
    const account = captureTripAccount();
    account.assertCurrent();
    const session = await accountSession(account.ownerId);
    account.assertCurrent();
    await offlineStorage.addPendingMutation({
      type: 'delete',
      ownerId: session.user.id,
      tripId,
    });

    const meta = await offlineStorage.getSyncMeta();
    account.assertCurrent();
    this.updateState({ pendingCount: meta.pendingCount }, account);
  }

  /** Explicit traveler choice after comparing the current server brief. */
  async resolveBlockedMutation(snapshot: PendingMutation, revision?: string): Promise<void> {
    const account = captureTripAccount();
    account.assertCurrent();
    if (snapshot.ownerId !== account.ownerId)
      throw new Error('These changes belong to another account.');
    if (this.syncInProgress)
      throw new Error('Wait for sync to finish before resolving this change.');
    const finishMutationSync = this.beginMutationSync();
    this.updateState({ status: 'syncing' }, account);
    try {
      const current = (await offlineStorage.getPendingMutations()).find(
        (m) => m.id === snapshot.id
      );
      account.assertCurrent();
      if (!current?.blockedReason || JSON.stringify(current) !== JSON.stringify(snapshot))
        throw new Error('Your local changes changed. Review them again before continuing.');
      if (revision) {
        const session = await accountSession(snapshot.ownerId);
        const response = await ownedSyncResponse(
          `${API_BASE_URL}/api/trips/${snapshot.tripId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...snapshot.data, expectedUpdatedAt: revision }),
          },
          session.user.id
        );
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Could not save. Your local changes are still kept.');
        }
        confirmedTripReceipt(await response.json(), snapshot.tripId, session.user.id, revision);
      }
      await offlineStorage.removePendingMutation(snapshot.id);
      account.assertCurrent();
      this.updateState(
        {
          pendingCount: (await offlineStorage.getPendingMutations()).length,
          status: 'idle',
          error: null,
        },
        account
      );
    } finally {
      finishMutationSync();
      if (this.state.status === 'syncing') this.updateState({ status: 'error' }, account);
    }
  }

  /**
   * Clear all local data (for logout)
   */
  async clearAll(): Promise<void> {
    const account = captureTripAccount();
    await offlineStorage.clearAll();
    this.updateState(
      {
        status: 'idle',
        lastSyncTime: null,
        pendingCount: 0,
        error: null,
      },
      account
    );
  }

  /**
   * Cleanup subscriptions
   */
  cleanup(): void {
    this.accountUnsubscribe?.();
    this.accountUnsubscribe = null;
    this.initialization = null;
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const syncService = new SyncService();
