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

interface UseOfflineSyncOptions {
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
  const {
    autoSync = true,
    syncOnForeground = true,
    syncOnMount = true,
  } = options;

  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    lastSyncTime: null,
    pendingCount: 0,
    isOnline: true,
    error: null,
  });

  const initialized = useRef(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Initialize sync service
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      await syncService.initialize();
      syncService.setAutoSync(autoSync);
      
      // Initial sync if enabled
      if (syncOnMount) {
        await syncService.sync();
      }
    };

    init();

    // Subscribe to sync state changes
    const unsubscribe = syncService.subscribe(setSyncState);

    return () => {
      unsubscribe();
    };
  }, [autoSync, syncOnMount]);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    if (!syncOnForeground) return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - sync
        console.log('[useOfflineSync] App foregrounded, syncing...');
        await syncService.sync();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [syncOnForeground]);

  // Manual sync trigger
  const sync = useCallback(async (force: boolean = false): Promise<SyncResult> => {
    return syncService.sync(force);
  }, []);

  // Clear pending changes
  const clearPendingChanges = useCallback(async (): Promise<void> => {
    await offlineStorage.clearPendingMutations();
    setSyncState(prev => ({ ...prev, pendingCount: 0 }));
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
  const updateTripOffline = useCallback(async (tripId: string, updates: Partial<TripInput>): Promise<void> => {
    if (networkMonitor.isOnline()) {
      await syncService.queueUpdate(tripId, updates);
      await syncService.sync();
    } else {
      await syncService.queueUpdate(tripId, updates);
    }
  }, []);

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
