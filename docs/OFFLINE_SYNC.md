# Faroway Offline-First Architecture

## Overview

Faroway implements an offline-first architecture that enables users to view, create, and edit trips even without an internet connection. Changes are automatically synced to Supabase when connectivity is restored.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Components                         │
│  (TripList, TripDetail, CreateTrip, etc.)                   │
├─────────────────────────────────────────────────────────────┤
│                     Custom Hooks                             │
│  useTrips • useOfflineSync • useNetworkStatus               │
├─────────────────────────────────────────────────────────────┤
│                   Zustand Trip Store                         │
│  (in-memory state with offline persistence)                  │
├─────────────────────────────────────────────────────────────┤
│                    Offline Library                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Storage   │  │   Network   │  │    Sync     │         │
│  │ AsyncStorage│  │  NetInfo    │  │  Service    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                   External Services                          │
│  AsyncStorage (local) ←──→ Supabase API (remote)            │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Offline Storage (`lib/offline/storage.ts`)

Handles persistent local storage using AsyncStorage:

- **Trip Caching**: Stores all user trips locally
- **Pending Mutations**: Queue of changes waiting to sync
- **Sync Metadata**: Last sync time, status, pending count

```typescript
import { offlineStorage } from '../lib/offline';

// Load trips from local storage
const trips = await offlineStorage.loadTrips();

// Save a trip
await offlineStorage.saveTrip(trip);

// Get pending mutations
const pending = await offlineStorage.getPendingMutations();
```

### 2. Network Monitor (`lib/offline/network.ts`)

Real-time network connectivity detection:

```typescript
import { networkMonitor, isOnline } from '../lib/offline';

// Check current status
if (isOnline()) {
  // Make API calls
}

// Subscribe to changes
const unsubscribe = networkMonitor.subscribe((state) => {
  console.log('Network:', state.status); // 'online' | 'offline' | 'unknown'
});
```

### 3. Sync Service (`lib/offline/sync.ts`)

Manages bidirectional synchronization:

```typescript
import { syncService } from '../lib/offline';

// Manual sync
await syncService.sync();

// Subscribe to sync state
syncService.subscribe((state) => {
  console.log('Sync status:', state.status);
  console.log('Pending:', state.pendingCount);
});

// Queue offline operations
await syncService.queueCreate(trip);
await syncService.queueUpdate(tripId, updates);
await syncService.queueDelete(tripId);
```

## React Hooks

### useOfflineSync

Primary hook for offline-first functionality:

```typescript
import { useOfflineSync } from '../hooks/useOfflineSync';

function MyComponent() {
  const {
    // State
    isOnline,
    isOffline,
    isSyncing,
    hasPendingChanges,
    pendingCount,
    lastSyncTime,
    error,

    // Actions
    sync,
    clearPendingChanges,
    
    // Offline operations
    getTripsOffline,
    createTripOffline,
    updateTripOffline,
    deleteTripOffline,
  } = useOfflineSync();

  // Use in your component...
}
```

### useNetworkStatus

Simple network status hook:

```typescript
import { useNetworkStatus } from '../hooks/useOfflineSync';

function MyComponent() {
  const { isOnline, isOffline } = useNetworkStatus();
  
  return (
    <View>
      {isOffline && <Text>You're offline</Text>}
    </View>
  );
}
```

### useSyncStatus

Sync status indicators:

```typescript
import { useSyncStatus } from '../hooks/useOfflineSync';

function MyComponent() {
  const { status, pendingCount, isSyncing, hasPending } = useSyncStatus();
  
  return (
    <View>
      {isSyncing && <ActivityIndicator />}
      {hasPending && <Text>{pendingCount} pending</Text>}
    </View>
  );
}
```

## UI Components

### SyncStatusBanner

Shows sync status at the top of the screen:

```tsx
import { SyncStatusBanner } from '../components/ui/SyncStatusBanner';

<SyncStatusBanner 
  position="top"        // 'top' | 'bottom'
  autoHide={true}       // Hide when nothing to show
  allowManualSync={true} // Allow tap to sync
/>
```

### SyncIndicator

Compact indicator for headers:

```tsx
import { SyncIndicator } from '../components/ui/SyncStatusBanner';

<Header>
  <SyncIndicator />
</Header>
```

### OfflineBadge

Badge for list items:

```tsx
import { OfflineBadge } from '../components/ui/SyncStatusBanner';

<TripCard trip={trip}>
  <OfflineBadge 
    isPending={trip.id.startsWith('local_')}
    isLocal={true}
  />
</TripCard>
```

## Sync Strategy

### Conflict Resolution

Faroway uses a **last-write-wins** strategy:

1. When syncing, pending mutations are processed in order (oldest first)
2. Server data is fetched after pushing local changes
3. Server data is authoritative for existing trips
4. Local-only trips (with `local_` prefix) are preserved until synced

### Mutation Queue

Mutations are intelligently merged:

| Existing | New | Result |
|----------|-----|--------|
| create | update | Merge data into create |
| update | update | Merge updates together |
| any | delete | Replace with delete |

### Retry Logic

- Failed mutations are retried up to 3 times
- Retry count persists across app restarts
- After max retries, mutations are dropped (with error logged)

## Data Flow

### Creating a Trip Offline

```
1. User creates trip
2. Trip saved to local storage with local_xxx ID
3. Mutation queued: { type: 'create', tripId: 'local_xxx', data: {...} }
4. UI immediately shows new trip
5. When online:
   - Sync service pushes mutation
   - Server returns real ID
   - Local trip replaced with server trip
```

### Editing a Trip Offline

```
1. User edits trip
2. Changes saved to local storage
3. Mutation queued: { type: 'update', tripId: 'xxx', data: {...} }
4. UI immediately shows changes
5. When online:
   - Sync service pushes mutation
   - Server confirms update
```

## Provider Setup

The `OfflineProvider` is already configured in `app/_layout.tsx`:

```tsx
export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <OfflineProvider 
          autoSync={true}        // Sync when network restored
          syncOnForeground={true} // Sync when app foregrounded
          syncOnMount={true}      // Initial sync on app start
        >
          <RootLayoutNav />
        </OfflineProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
```

## Testing Offline Mode

### iOS Simulator

1. Open Control Center (swipe down)
2. Toggle Airplane Mode
3. Or use Network Link Conditioner

### Android Emulator

1. Pull down notification shade
2. Toggle Airplane Mode
3. Or use `adb shell svc wifi disable`

### Expo Go

1. Use device settings to toggle Airplane Mode
2. Test with real device for accurate behavior

## Environment Variables

No additional environment variables needed for offline functionality. The existing Supabase configuration is used:

```env
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=your-backend-url
```

## Storage Keys

All offline data is stored under these AsyncStorage keys:

| Key | Description |
|-----|-------------|
| `@faroway/trips` | Cached trip data |
| `@faroway/pending_mutations` | Queue of pending changes |
| `@faroway/sync_meta` | Sync metadata (last sync time, status) |

## Best Practices

1. **Always use hooks**: Use `useTrips` or `useOfflineSync` instead of direct API calls
2. **Check network before heavy operations**: Generation requires network
3. **Show clear UI feedback**: Use `SyncStatusBanner` and `OfflineBadge`
4. **Handle errors gracefully**: Fallback to cached data when possible
5. **Test airplane mode**: Verify offline behavior regularly

## Troubleshooting

### Sync not working

1. Check network connectivity: `networkMonitor.isOnline()`
2. Check for pending mutations: `await offlineStorage.getPendingMutations()`
3. Check sync state: `syncService.getState()`
4. Force sync: `await syncService.sync(true)`

### Data not persisting

1. Verify AsyncStorage is working: `await AsyncStorage.getItem('@faroway/trips')`
2. Check for storage errors in console
3. Clear and re-hydrate: `await offlineStorage.clearAll()`

### Conflicts

1. Server data is authoritative
2. Local-only trips (local_xxx) are preserved
3. Check `getPendingMutations()` for stuck items
