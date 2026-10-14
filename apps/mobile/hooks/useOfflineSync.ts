/**
 * useOfflineSync Hook
 * React hook for managing offline-first functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  syncService,
  offlineStorage,
  networkMonitor,
  type SyncState,
  type SyncStatus,
  type SyncResult,
} from '../lib/offline';
import type { Trip, TripInput } from '../stores/tripStore';
import { useUserStore } from '../stores/userStore';
import { captureTripAccount } from '../lib/tripAccountScope';

interface UseOfflineSyncOptions {
  /** Auth must have resolved a signed-in account before automatic sync. */
  enabled?: boolean;
  /**
   * Enable auto-sync on network restore
   * @default true
   */
  autoSync?: boolean;

  /**
   * Sync when app returns to foreground
   * @default true
   */
  syncOnForeground?: boolean;

  /**
   * Initial sync on mount
   * @default true
   */
  syncOnMount?: boolean;
}

export interface UseOfflineSyncReturn {
  // State
  initialized: boolean;
  syncState: SyncState;
  isOnline: boolean;
  isOffline: boolean;
  isSyncing: boolean;
  hasPendingChanges: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  error: string | null;

  // Actions
  sync: (force?: boolean) => Promise<SyncResult>;
  clearPendingChanges: () => Promise<void>;

  // Offline operations
  getTripsOffline: () => Promise<Trip[]>;
  createTripOffline: (trip: Trip) => Promise<void>;
  updateTripOffline: (tripId: string, updates: Partial<TripInput>) => Promise<void>;
  deleteTripOffline: (tripId: string) => Promise<void>;
}

/**
 * Hook for offline-first data management
 */
export function useOfflineSync(options: UseOfflineSyncOptions = {}): UseOfflineSyncReturn {
  const { autoSync = true, syncOnForeground = true, syncOnMount = true, enabled = true } = options;
  const accountRevision = useUserStore((state) => state.accountRevision);

  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    lastSyncTime: null,
    pendingCount: 0,
    isOnline: true,
    error: null,
  });

  const [initialized, setInitialized] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Subscriptions must survive Strict Mode effect replay. The service owns
  // a single initialization promise; each mounted hook owns its subscription.
  useEffect(() => {
    let active = true;
    const account = captureTripAccount();
    const current = () => active && account.isCurrent();
    setInitialized(false);
    const unsubscribe = syncService.subscribe((state) => {
      if (current()) setSyncState(state);
    });
    void syncService
      .initialize()
      .then(() => {
        if (current()) setInitialized(true);
      })
      .catch(() => {
        if (current())
          setSyncState((previous) => ({
            ...previous,
            status: 'error',
            error: 'Offline sync could not start. Your saved trips are kept.',
          }));
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [accountRevision]);

  useEffect(() => {
    syncService.setAutoSync(enabled && autoSync);
    return () => {
      syncService.setAutoSync(false);
    };
  }, [enabled, autoSync]);

  useEffect(() => {
    if (!enabled || !syncOnMount) return;
    let active = true;
    void syncService
      .initialize()
      .then(() => {
        if (active) return syncService.sync();
      })
      .catch(() => {
        /* The initialization effect exposes the recovery state. */
      });
    return () => {
      active = false;
    };
  }, [enabled, syncOnMount, accountRevision]);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    if (!enabled || !syncOnForeground) return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const previous = appState.current;
      appState.current = nextAppState;
      if (previous.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - sync
        console.log('[useOfflineSync] App foregrounded, syncing...');
        await syncService.sync();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [enabled, syncOnForeground]);

  // Manual sync trigger
  const sync = useCallback(async (force: boolean = false): Promise<SyncResult> => {
    const account = captureTripAccount();
    try {
      await syncService.initialize();
      account.assertCurrent();
      if (!mounted.current)
        return {
          success: false,
          synced: 0,
          failed: 0,
          errors: [{ mutationId: '', error: 'Sync was cancelled.' }],
        };
      setInitialized(true);
      return syncService.sync(force);
    } catch {
      const message = 'Offline sync could not start. Please try again.';
      if (mounted.current && account.isCurrent())
        setSyncState((previous) => ({ ...previous, status: 'error', error: message }));
      return { success: false, synced: 0, failed: 0, errors: [{ mutationId: '', error: message }] };
    }
  }, []);

  // Clear pending changes
  const clearPendingChanges = useCallback(async (): Promise<void> => {
    const account = captureTripAccount();
    await offlineStorage.clearPendingMutations();
    if (mounted.current && account.isCurrent())
      setSyncState((prev) => ({ ...prev, pendingCount: 0 }));
  }, []);

  // Get trips from offline storage
  const getTripsOffline = useCallback(async (): Promise<Trip[]> => {
    return offlineStorage.loadTrips();
  }, []);

  // Create trip with offline support
  const createTripOffline = useCallback(async (trip: Trip): Promise<void> => {
    // Ensure local ID if not set
    const tripWithId: Trip = {
      ...trip,
      id: trip.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: trip.createdAt || new Date().toISOString(),
    };

    if (networkMonitor.isOnline()) {
      // Online: try to sync immediately
      await syncService.queueCreate(tripWithId);
      await syncService.sync();
    } else {
      // Offline: queue for later
      await syncService.queueCreate(tripWithId);
    }
  }, []);

  // Update trip with offline support
  const updateTripOffline = useCallback(
    async (tripId: string, updates: Partial<TripInput>): Promise<void> => {
      if (networkMonitor.isOnline()) {
        await syncService.queueUpdate(tripId, updates);
        await syncService.sync();
      } else {
        await syncService.queueUpdate(tripId, updates);
      }
    },
    []
  );

  // Delete trip with offline support
  const deleteTripOffline = useCallback(async (tripId: string): Promise<void> => {
    if (networkMonitor.isOnline()) {
      await syncService.queueDelete(tripId);
      await syncService.sync();
    } else {
      await syncService.queueDelete(tripId);
    }
  }, []);

  return {
    // State
    initialized,
    syncState,
    isOnline: syncState.isOnline,
    isOffline: !syncState.isOnline,
    isSyncing: syncState.status === 'syncing',
    hasPendingChanges: syncState.pendingCount > 0,
    pendingCount: syncState.pendingCount,
    lastSyncTime: syncState.lastSyncTime,
    error: syncState.error,

    // Actions
    sync,
    clearPendingChanges,

    // Offline operations
    getTripsOffline,
    createTripOffline,
    updateTripOffline,
    deleteTripOffline,
  };
}

/**
 * Simple hook for just network status
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const init = async () => {
      await networkMonitor.initialize();
    };
    init();

    const unsubscribe = networkMonitor.subscribe((state) => {
      setIsOnline(state.status === 'online');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}

/**
 * Hook to get sync status indicators
 */
export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = syncService.subscribe((state) => {
      setStatus(state.status);
      setPendingCount(state.pendingCount);
      setLastSync(state.lastSyncTime);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    status,
    pendingCount,
    lastSync,
    isSyncing: status === 'syncing',
    hasPending: pendingCount > 0,
    isSuccess: status === 'success',
    isError: status === 'error',
    isOffline: status === 'offline',
  };
}
