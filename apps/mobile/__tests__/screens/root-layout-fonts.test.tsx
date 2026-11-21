import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockPreventAutoHideAsync = jest.fn().mockResolvedValue(true);
const mockHideAsync = jest.fn().mockResolvedValue(true);
const mockUseFonts = jest.fn();
let mockInitialized = true;

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: () => mockPreventAutoHideAsync(),
  hideAsync: () => mockHideAsync(),
}));
jest.mock('expo-font', () => ({
  useFonts: (...args: unknown[]) => mockUseFonts(...args),
}));
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (comp: React.ComponentType) => comp,
  captureException: jest.fn(),
}));
jest.mock('expo-router', () => ({
  Stack: Object.assign(
    ({ children }: { children: React.ReactNode }) => React.createElement('Stack', null, children),
    {
      Screen: 'Screen',
    }
  ),
  router: { replace: jest.fn() },
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native', () => ({
  View: 'View',
  ActivityIndicator: 'ActivityIndicator',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Platform: { OS: 'ios', select: (opts: Record<string, string>) => opts.ios ?? opts.default },
  StyleSheet: { create: (s: unknown) => s },
}));
jest.mock('../../components/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useAuthContext: () => ({ initialized: mockInitialized }),
}));
jest.mock('../../components/NotificationProvider', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));
jest.mock('../../components/OfflineProvider', () => ({
  OfflineProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));
jest.mock('../../components/ui/TripSyncConflicts', () => ({ TripSyncConflicts: () => null }));
jest.mock('../../components/ui/SyncStatusBanner', () => ({ SyncStatusBanner: () => null }));
jest.mock('../../stores/tripStore', () => ({
  useTripStore: (sel: (s: { hydrateFromOffline: () => Promise<void> }) => unknown) =>
    sel({ hydrateFromOffline: jest.fn().mockResolvedValue(undefined) }),
}));
jest.mock('../../stores/userStore', () => ({
  useUserStore: (sel: (s: { accountRevision: number }) => unknown) => sel({ accountRevision: 0 }),
}));
jest.mock('../../hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));

Object.assign(globalThis, { __DEV__: false });

import RootLayout from '../../app/_layout';
import { FONT_LOAD_TIMEOUT_MS, FONT_SOURCES } from '../../constants/fonts';

describe('RootLayout brand font loading', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mockHideAsync.mockClear();
    mockUseFonts.mockReset();
    mockInitialized = true;
  });

  it('prevents auto-hide at startup, loads PlusJakartaSans & PlayfairDisplay, and hides splash when ready', async () => {
    expect(mockPreventAutoHideAsync).toHaveBeenCalledTimes(1);
    mockUseFonts.mockReturnValue([true, null]);

    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<RootLayout />);
    });

    expect(mockUseFonts).toHaveBeenCalledWith(FONT_SOURCES);
    expect(mockHideAsync).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType('Stack' as unknown as React.ComponentType)).toHaveLength(1);
    await act(async () => tree.unmount());
  });

  it('never blocks rendering and hides splash when font loading errors or times out', async () => {
    jest.useFakeTimers();
    try {
      mockUseFonts.mockReturnValue([false, new Error('Offline')]);
      let tree!: ReactTestRenderer;
      await act(async () => {
        tree = create(<RootLayout />);
      });
      expect(mockHideAsync).toHaveBeenCalledTimes(1);
      expect(tree.root.findAllByType('Stack' as unknown as React.ComponentType)).toHaveLength(1);
      await act(async () => tree.unmount());

      mockHideAsync.mockClear();
      mockUseFonts.mockReturnValue([false, null]);
      await act(async () => {
        tree = create(<RootLayout />);
      });
      expect(mockHideAsync).not.toHaveBeenCalled();
      expect(tree.root.findAllByType('Stack' as unknown as React.ComponentType)).toHaveLength(1);

      await act(async () => {
        jest.advanceTimersByTime(FONT_LOAD_TIMEOUT_MS + 10);
      });
      expect(mockHideAsync).toHaveBeenCalledTimes(1);
      await act(async () => tree.unmount());
    } finally {
      jest.useRealTimers();
    }
  });
});
