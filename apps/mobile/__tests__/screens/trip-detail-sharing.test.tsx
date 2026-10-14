import React from 'react';
import { act, create } from 'react-test-renderer';
jest.mock('../../constants/api', () => ({ API_BASE_URL: 'https://fixture.test' }));
let mockHasTrip = true;
let mockCurrentTrip: typeof trip | null = null;
const mockGetTrip = jest.fn();
const mockRefreshSuccess = jest.fn();
const mockRefreshError = jest.fn();
const mockCreateLink = jest.fn();
const mockRevoke = jest.fn();
const mockNativeShare = jest.fn();
let mockOwner = 'account-a';
let mockRevision = 0;
const trip = {
  id: 'trip-a',
  destination: 'Tokyo',
  country: 'Japan',
  startDate: '2026-11-01',
  endDate: '2026-11-04',
  travelers: 2,
  days: [],
  vibes: [],
  createdAt: '2026-10-13',
  status: 'planned',
};
jest.mock('../../stores/userStore', () => ({
  useUserStore: Object.assign(
    (select: (s: unknown) => unknown) =>
      select({ user: { id: mockOwner }, accountRevision: mockRevision }),
    { getState: () => ({ user: { id: mockOwner }, accountRevision: mockRevision }) }
  ),
}));
jest.mock('../../stores/tripStore', () => ({
  useTripStore: () => ({
    trips: mockHasTrip ? [trip] : [],
    currentTrip: mockCurrentTrip,
    isHydrated: true,
  }),
}));
jest.mock('../../hooks/useTrips', () => ({ useTrips: () => ({ getTripById: mockGetTrip }) }));
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  Image: 'Image',
  RefreshControl: 'RefreshControl',
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  FlatList: 'FlatList',
  Alert: { alert: jest.fn() },
  Share: { share: (...args: unknown[]) => mockNativeShare(...args) },
  Platform: { OS: 'ios' },
  Animated: {
    View: 'AnimatedView',
    ScrollView: 'AnimatedScrollView',
    Image: 'AnimatedImage',
    event: () => jest.fn(),
    Value: jest.fn().mockImplementation(() => ({ interpolate: () => 0 })),
  },
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'trip-a' }),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { AUTOMATIC: 'automatic' },
}));
jest.mock('../../components/ui', () => ({ Button: 'Button', VibeChips: 'VibeChips' }));
jest.mock('../../components/AuthProvider', () => ({
  useAuthContext: () => ({ isAuthenticated: true }),
}));
jest.mock('../../components/AuthGate', () => ({
  AuthGate: (props: Record<string, unknown>) => React.createElement('AuthGate', props),
}));
jest.mock('../../components/RatingPrompt', () => ({ RatingPrompt: () => null }));
jest.mock('../../stores/promptStore', () => ({
  usePromptStore: () => ({ tripGenerationCount: 0, shouldShowRatingPrompt: () => false }),
}));
jest.mock('../../hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('../../utils/haptics', () => ({
  hapticFeedback: { light: jest.fn(), success: mockRefreshSuccess, error: mockRefreshError },
}));
jest.mock('../../lib/tripSharing', () => ({
  shareOwnedTrip: (...args: unknown[]) => mockCreateLink(...args),
  revokeOwnedTripShare: (...args: unknown[]) => mockRevoke(...args),
}));
import { Alert } from 'react-native';
import TripDetailScreen from '../../app/trip/[id]';

it.each(['confirmed', 'after exit', 'account change'])(
  'native share handles %s',
  async (scenario) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    mockOwner = 'account-a';
    mockRevision = 0;
    let release!: (url: string) => void;
    mockCreateLink.mockImplementation(
      () =>
        new Promise((yes) => {
          release = yes;
        })
    );
    mockNativeShare.mockResolvedValue({ action: 'sharedAction' });
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<TripDetailScreen />);
      });
      await act(async () => {
        const share = renderer.root.findByProps({ accessibilityLabel: 'Share trip' }).props.onPress;
        void share();
        void share();
      });
      expect(Alert.alert).toHaveBeenCalledTimes(1);
      await act(async () => {
        jest.mocked(Alert.alert).mock.calls[0][2]![2].onPress!();
      });
      expect(mockCreateLink).toHaveBeenCalledTimes(1);
      if (scenario === 'after exit')
        await act(async () => {
          renderer.unmount();
        });
      if (scenario === 'account change') {
        mockOwner = 'account-b';
        mockRevision++;
      }
      await act(async () => {
        release('https://example.test/s/token-a');
      });
      if (scenario === 'confirmed')
        expect(mockNativeShare).toHaveBeenCalledWith({
          message: 'Check out my trip to Tokyo! https://example.test/s/token-a',
          url: 'https://example.test/s/token-a',
          title: 'Tokyo Trip Itinerary',
        });
      else expect(mockNativeShare).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      mockOwner = 'account-a';
      mockRevision = 0;
    }
  }
);

it.each(['confirmed', 'failure', 'old dialog after exit'])(
  'native revoke handles %s',
  async (scenario) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    mockOwner = 'account-a';
    mockRevision = 0;
    mockRevoke.mockReset();
    if (scenario === 'failure')
      mockRevoke.mockRejectedValue(new Error('Public access could not be confirmed off.'));
    else mockRevoke.mockResolvedValue(undefined);
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<TripDetailScreen />);
      });
      await act(async () => {
        void renderer.root.findByProps({ accessibilityLabel: 'Share trip' }).props.onPress();
      });
      const revoke = jest.mocked(Alert.alert).mock.calls[0][2]![1].onPress!;
      if (scenario === 'old dialog after exit')
        await act(async () => {
          renderer.unmount();
        });
      await act(async () => {
        revoke();
        revoke();
      });
      expect(mockNativeShare).not.toHaveBeenCalled();
      expect(mockCreateLink).not.toHaveBeenCalled();
      if (scenario === 'old dialog after exit') expect(mockRevoke).not.toHaveBeenCalled();
      else {
        expect(mockRevoke).toHaveBeenCalledTimes(1);
        expect(mockRevoke).toHaveBeenCalledWith('trip-a');
        if (scenario === 'confirmed')
          expect(Alert.alert).toHaveBeenLastCalledWith(
            'Public access turned off',
            'The old public link no longer works.'
          );
        else
          expect(Alert.alert).toHaveBeenLastCalledWith(
            'Sharing did not finish',
            expect.stringContaining('could not be confirmed off')
          );
      }
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
    }
  }
);

it.each(['current', 'failed read', 'after exit', 'account revision'])(
  'native refresh handles %s without losing the loaded trip',
  async (scenario) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    mockOwner = 'account-a';
    mockRevision = 0;
    let release!: (value: unknown) => void;
    mockGetTrip.mockReset().mockImplementation(
      () =>
        new Promise((yes) => {
          release = yes;
        })
    );
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<TripDetailScreen />);
      });
      const refreshProps = () =>
        renderer.root.findByType('AnimatedScrollView' as React.ElementType).props.refreshControl
          .props;
      await act(async () => {
        const refresh = refreshProps().onRefresh;
        void refresh();
        void refresh();
      });
      expect(mockGetTrip).toHaveBeenCalledTimes(1);
      expect(refreshProps().refreshing).toBe(true);
      if (scenario === 'after exit')
        await act(async () => {
          renderer.unmount();
        });
      if (scenario === 'account revision') mockRevision += 2;
      await act(async () => {
        release(scenario === 'failed read' ? null : trip);
      });
      if (scenario === 'after exit' || scenario === 'account revision') {
        expect(mockRefreshSuccess).not.toHaveBeenCalled();
        expect(mockRefreshError).not.toHaveBeenCalled();
        expect(Alert.alert).not.toHaveBeenCalled();
      } else {
        expect(refreshProps().refreshing).toBe(false);
        expect(
          renderer.root
            .findAllByType('Text' as React.ElementType)
            .some((text) => text.children.includes('Tokyo'))
        ).toBe(true);
        if (scenario === 'failed read')
          expect(Alert.alert).toHaveBeenLastCalledWith(
            'Couldn’t refresh trip',
            expect.stringContaining('last loaded trip is kept')
          );
        else expect(mockRefreshSuccess).toHaveBeenCalledTimes(1);
        mockGetTrip.mockResolvedValueOnce(trip);
        await act(async () => {
          await refreshProps().onRefresh();
        });
        expect(mockGetTrip).toHaveBeenCalledTimes(2);
      }
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      mockRevision = 0;
    }
  }
);

it.each(['dismiss', 'authenticated', 'after exit'])(
  'missing-trip sign-in sheet handles %s',
  async (action) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    mockHasTrip = false;
    mockOwner = 'account-a';
    mockRevision = 0;
    mockGetTrip.mockReset().mockRejectedValue(new Error('Please sign in to view your trips'));
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<TripDetailScreen />);
      });
      expect(mockGetTrip).toHaveBeenCalledTimes(1);
      await act(async () => {
        renderer.root.findByProps({ title: 'Sign in to view trips' }).props.onPress();
      });
      const sheet = renderer.root.findByType('AuthGate' as React.ElementType);
      expect(sheet.props.visible).toBe(true);
      expect(sheet.props.trigger).toBe('general');
      if (action === 'dismiss') {
        await act(async () => {
          sheet.props.onClose();
        });
        expect(renderer.root.findByType('AuthGate' as React.ElementType).props.visible).toBe(false);
        expect(mockGetTrip).toHaveBeenCalledTimes(1);
      } else if (action === 'authenticated') {
        await act(async () => {
          sheet.props.onAuthenticated();
        });
        expect(mockGetTrip).toHaveBeenCalledTimes(2);
        expect(renderer.root.findByType('AuthGate' as React.ElementType).props.visible).toBe(false);
      } else {
        const authenticated = sheet.props.onAuthenticated;
        await act(async () => {
          renderer.unmount();
        });
        await act(async () => {
          authenticated();
        });
        expect(mockGetTrip).toHaveBeenCalledTimes(1);
      }
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      mockHasTrip = true;
    }
  }
);

it('uses refreshed trip details instead of the older list summary', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockHasTrip = true;
  mockCurrentTrip = { ...trip, destination: 'Refreshed Tokyo' };
  let renderer: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<TripDetailScreen />);
  });
  expect(
    renderer!.root
      .findAllByProps({ accessibilityRole: 'header' })
      .map((node) => node.props.children)
  ).toContain('Refreshed Tokyo');
  await act(async () => {
    renderer!.unmount();
  });
  mockCurrentTrip = null;
});

it('keeps the requested trip when current detail belongs to another trip', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockHasTrip = true;
  mockCurrentTrip = { ...trip, id: 'another-trip', destination: 'Unrelated destination' };
  let renderer: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<TripDetailScreen />);
  });
  const headings = renderer!.root
    .findAllByProps({ accessibilityRole: 'header' })
    .map((node) => node.props.children);
  expect(headings).toContain('Tokyo');
  expect(headings).not.toContain('Unrelated destination');
  await act(async () => {
    renderer!.unmount();
  });
  mockCurrentTrip = null;
});

it('offers retry after a temporary server detail-read failure', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockHasTrip = false;
  mockCurrentTrip = null;
  mockGetTrip.mockReset().mockRejectedValue(new Error('Failed to fetch trip'));
  let renderer: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<TripDetailScreen />);
    });
    expect(mockGetTrip).toHaveBeenCalledTimes(1);
    await act(async () => {
      renderer!.root.findByProps({ title: 'Try again' }).props.onPress();
    });
    expect(mockGetTrip).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => {
      renderer!.unmount();
    });
    mockHasTrip = true;
  }
});
