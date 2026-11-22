import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockPush = jest.fn();

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  RefreshControl: 'RefreshControl',
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: jest.fn() },
  Platform: { OS: 'ios', select: (opts: Record<string, unknown>) => opts.ios ?? opts.default },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  Animated: {
    View: 'AnimatedView',
    ScrollView: 'AnimatedScrollView',
    event: () => jest.fn(),
    parallel: () => ({ start: jest.fn() }),
    timing: () => ({ start: jest.fn() }),
    Value: jest.fn().mockImplementation(() => ({ interpolate: () => 0, setValue: jest.fn() })),
  },
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('../../components/ui', () => ({
  PlacesAutocomplete: 'PlacesAutocomplete',
  DestinationCard: 'DestinationCard',
  TripCard: 'TripCard',
  Button: 'Button',
}));
jest.mock('../../services/api', () => ({
  getPopularDestinations: jest.fn().mockResolvedValue({ data: null }),
  getTrendingDestinations: jest.fn().mockResolvedValue({ data: null }),
}));
jest.mock('../../stores/tripStore', () => ({
  useTripStore: Object.assign(
    (sel?: (s: { trips: unknown[] }) => unknown) => (sel ? sel({ trips: [] }) : { trips: [] }),
    { getState: () => ({ trips: [] }) }
  ),
}));
jest.mock('../../stores/userStore', () => ({
  useUserStore: (sel: (s: { isAuthenticated: boolean }) => unknown) =>
    sel({ isAuthenticated: false }),
}));
jest.mock('../../components/AuthProvider', () => ({
  useAuthContext: () => ({
    isAuthenticated: false,
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
    loading: false,
  }),
}));
jest.mock('../../hooks/useTrips', () => ({
  useTrips: () => ({ trips: [], loading: false, error: null, fetchTrips: jest.fn() }),
}));
jest.mock('../../hooks/useLocalCalendarDate', () => ({
  useLocalCalendarDate: () => '2026-11-21',
}));
jest.mock('../../hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('../../lib/fontScaleEpoch', () => ({ useFontScaleEpoch: () => 0 }));
jest.mock('../../utils/haptics', () => ({
  hapticFeedback: { light: jest.fn(), medium: jest.fn(), selection: jest.fn(), success: jest.fn() },
}));

import ExploreScreen from '../../app/(tabs)/index';
import TripsScreen from '../../app/(tabs)/trips';

describe('Explore & Trips thumb-zone Plan Trip CTA and Maestro contract', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mockPush.mockClear();
  });

  it('keeps Maestro "Create your trip" and adds thumb-zone "Plan Trip" CTA on Explore without emojis', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<ExploreScreen />);
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Create your trip');
    expect(json).toContain('Plan Trip');
    expect(json).not.toMatch(/[✈️🏨🗺️⭐✓]/u);

    const fab = tree.root.findByProps({ accessibilityLabel: 'Plan Trip' });
    await act(async () => fab.props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/create');
    await act(async () => tree.unmount());
  });

  it('renders thumb-zone "Plan Trip" CTA on Trips screen', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<TripsScreen />);
    });

    const fab = tree.root.findByProps({ accessibilityLabel: 'Plan Trip' });
    await act(async () => fab.props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/create');
    await act(async () => tree.unmount());
  });
});
