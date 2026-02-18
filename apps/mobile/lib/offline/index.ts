/**
 * Offline Module Exports
 * Re-exports all offline-first functionality
 */

// Storage
export { 
  offlineStorage, 
  type PendingMutation, 
  type MutationType,
  type SyncMeta,
} from './storage';

// Network
export { 
  networkMonitor, 
  getNetworkStatus, 
  isOnline,
  type NetworkStatus,
  type NetworkState,
} from './network';

// Sync
export { 
  syncService,
  type SyncStatus,
  type SyncResult,
  type SyncState,
  type ConflictStrategy,
} from './sync';
