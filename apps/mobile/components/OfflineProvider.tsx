/**
 * OfflineProvider
 * Context provider for offline-first functionality
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useOfflineSync, type UseOfflineSyncReturn } from '../hooks/useOfflineSync';
import type { Trip, TripInput } from '../stores/tripStore';
import type { SyncState, SyncResult } from '../lib/offline';

interface OfflineContextValue extends Omit<UseOfflineSyncReturn, 'syncState'> {
  // Re-expose state individually
  syncState: SyncState;
  initialized: boolean;
}

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

interface OfflineProviderProps {
  children: ReactNode;
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

export function OfflineProvider({ 
  children,
  autoSync = true,
  syncOnForeground = true,
  syncOnMount = true,
}: OfflineProviderProps) {
  const [initialized, setInitialized] = useState(false);
  
  const offlineSync = useOfflineSync({
    autoSync,
    syncOnForeground,
    syncOnMount,
  });

  // Mark as initialized once we have a sync state
  useEffect(() => {
    if (offlineSync.syncState.status !== 'idle' || offlineSync.syncState.isOnline !== undefined) {
      setInitialized(true);
    }
  }, [offlineSync.syncState]);

  const value: OfflineContextValue = {
    ...offlineSync,
    initialized,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

/**
 * Hook to access offline context
 */
export function useOfflineContext(): OfflineContextValue {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOfflineContext must be used within an OfflineProvider');
  }
  return context;
}

/**
 * Hook to check if offline features are available
 */
export function useIsOfflineReady(): boolean {
  const context = useContext(OfflineContext);
  return context?.initialized ?? false;
}
