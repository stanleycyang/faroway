import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { SyncState } from '../../lib/offline';
jest.mock('../../lib/supabase', () => ({ supabase: { auth: {} } }));

const mockListeners = new Set<(state: SyncState) => void>();
const mockInitialize = jest.fn();
const mockSync = jest.fn();
const mockAutoSync = jest.fn();
const mockClear = jest.fn();
const mockSubscribe = jest.fn((listener: (state: SyncState) => void) => {
  mockListeners.add(listener);
  listener({ status: 'idle', lastSyncTime: null, pendingCount: 0, isOnline: true, error: null });
  return () => {
    mockListeners.delete(listener);
  };
});
let mockAuth = { initialized: false, isAuthenticated: false };
jest.mock('../../components/AuthProvider', () => ({ useAuthContext: () => mockAuth }));
jest.mock('../../lib/offline', () => ({
  syncService: {
    initialize: (...args: unknown[]) => mockInitialize(...args),
    sync: (...args: unknown[]) => mockSync(...args),
    setAutoSync: (...args: unknown[]) => mockAutoSync(...args),
    subscribe: (listener: (state: SyncState) => void) => mockSubscribe(listener),
  },
  offlineStorage: { clearPendingMutations: () => mockClear() },
  networkMonitor: { isOnline: () => true },
}));
jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { OfflineProvider, useOfflineContext } from '../../components/OfflineProvider';
import { useUserStore } from '../../stores/userStore';

let renderer: ReactTestRenderer | undefined;
let state: ReturnType<typeof useOfflineSync>;
function Harness({ enabled = false }: { enabled?: boolean }) {
  state = useOfflineSync({ enabled });
  return null;
}
function ContextHarness() {
  state = useOfflineContext();
  return null;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
  mockAuth = { initialized: false, isAuthenticated: false };
  mockInitialize.mockResolvedValue(undefined);
  mockSync.mockResolvedValue({ success: true, synced: 0, failed: 0, errors: [] });
  useUserStore.getState().setUser({
    id: 'owner',
    name: 'Fixture',
    email: 'fixture@example.invalid',
    preferences: { vibes: [] },
  });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
  });
  renderer = undefined;
});

it('keeps one live subscription after Strict Mode replay and still receives status updates', async () => {
  await act(async () => {
    renderer = create(
      <React.StrictMode>
        <Harness />
      </React.StrictMode>
    );
  });
  expect(mockSubscribe.mock.calls.length).toBeGreaterThanOrEqual(2);
  expect(mockListeners.size).toBe(1);
  await act(async () => {
    for (const listener of mockListeners)
      listener({
        status: 'success',
        pendingCount: 3,
        lastSyncTime: 10,
        isOnline: true,
        error: null,
      });
  });
  expect(state.syncState.status).toBe('success');
  expect(state.pendingCount).toBe(3);
  await act(async () => {
    renderer!.unmount();
  });
  renderer = undefined;
  expect(mockListeners.size).toBe(0);
  expect(mockAutoSync).toHaveBeenLastCalledWith(false);
});

it('waits for resolved signed-in Auth before automatic startup sync', async () => {
  await act(async () => {
    renderer = create(
      <OfflineProvider>
        <ContextHarness />
      </OfflineProvider>
    );
  });
  expect(state.initialized).toBe(true);
  expect(mockSync).not.toHaveBeenCalled();
  expect(mockAutoSync).toHaveBeenLastCalledWith(false);
  mockAuth = { initialized: true, isAuthenticated: false };
  await act(async () => {
    renderer!.update(
      <OfflineProvider>
        <ContextHarness />
      </OfflineProvider>
    );
  });
  expect(mockSync).not.toHaveBeenCalled();
  mockAuth = { initialized: true, isAuthenticated: true };
  await act(async () => {
    renderer!.update(
      <OfflineProvider>
        <ContextHarness />
      </OfflineProvider>
    );
  });
  expect(mockSync).toHaveBeenCalledTimes(1);
  expect(mockAutoSync).toHaveBeenLastCalledWith(true);
});

it('does not sync after unmount while initialization is pending', async () => {
  let release!: () => void;
  mockInitialize.mockReturnValue(
    new Promise<void>((resolve) => {
      release = resolve;
    })
  );
  await act(async () => {
    renderer = create(<Harness enabled />);
  });
  expect(state.initialized).toBe(false);
  await act(async () => {
    renderer!.unmount();
  });
  renderer = undefined;
  await act(async () => {
    release();
  });
  expect(mockSync).not.toHaveBeenCalled();
  expect(mockListeners.size).toBe(0);
  expect(mockAutoSync).toHaveBeenLastCalledWith(false);
});

it('manual retry recovers initialization before starting sync', async () => {
  mockInitialize.mockRejectedValueOnce(new Error('storage not ready'));
  await act(async () => {
    renderer = create(<Harness />);
  });
  expect(state.initialized).toBe(false);
  expect(state.error).toContain('could not start');
  let release!: () => void;
  mockInitialize.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      release = resolve;
    })
  );
  let retry!: Promise<unknown>;
  await act(async () => {
    retry = state.sync(true);
  });
  expect(mockSync).not.toHaveBeenCalled();
  await act(async () => {
    release();
    await retry;
  });
  expect(state.initialized).toBe(true);
  expect(mockSync).toHaveBeenCalledWith(true);
});

it.each(['unmount', 'account change'])(
  'does not start a pending manual retry after %s',
  async (interruption) => {
    await act(async () => {
      renderer = create(<Harness />);
    });
    let release!: () => void;
    mockInitialize.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        release = resolve;
      })
    );
    let retry!: Promise<unknown>;
    await act(async () => {
      retry = state.sync(true);
    });
    await act(async () => {
      if (interruption === 'unmount') {
        renderer!.unmount();
        renderer = undefined;
      } else useUserStore.getState().logout();
    });
    await act(async () => {
      release();
      await retry;
    });
    expect(mockSync).not.toHaveBeenCalled();
  }
);

it('a completed clear from the previous account cannot erase the new account pending count', async () => {
  await act(async () => {
    renderer = create(<Harness />);
  });
  let release!: () => void;
  mockClear.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      release = resolve;
    })
  );
  let clearing!: Promise<void>;
  await act(async () => {
    clearing = state.clearPendingChanges();
  });
  await act(async () => {
    useUserStore.getState().setUser({
      id: 'next-owner',
      name: 'Next',
      email: 'next@example.invalid',
      preferences: { vibes: [] },
    });
  });
  await act(async () => {
    for (const listener of mockListeners)
      listener({
        status: 'idle',
        pendingCount: 3,
        lastSyncTime: null,
        isOnline: true,
        error: null,
      });
  });
  await act(async () => {
    release();
    await clearing;
  });
  expect(state.pendingCount).toBe(3);
});

it('a late initialization failure cannot replace recovery state for the next account', async () => {
  let rejectOld!: (error: Error) => void;
  mockInitialize.mockReturnValueOnce(
    new Promise<void>((_resolve, reject) => {
      rejectOld = reject;
    })
  );
  await act(async () => {
    renderer = create(<Harness />);
  });
  await act(async () => {
    useUserStore.getState().setUser({
      id: 'next-owner',
      name: 'Next',
      email: 'next@example.invalid',
      preferences: { vibes: [] },
    });
  });
  await act(async () => {
    rejectOld(new Error('Old account storage failed'));
  });
  expect(state.error).toBeNull();
  expect(state.initialized).toBe(true);
  expect(mockListeners.size).toBe(1);
});
