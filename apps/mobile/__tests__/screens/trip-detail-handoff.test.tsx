import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AFFILIATE_DISCLOSURE_SHORT } from '@faroway/constants';

const mockOpenAffiliateLink = jest.fn();
const mockReviewSavedTripBooking = jest.fn();
const mockOpenBrowserAsync = jest.fn().mockResolvedValue({ type: 'cancel' });

jest.mock('../../constants/api', () => ({
  API_BASE_URL: 'https://api.faroway.ai',
  WEB_BASE_URL: 'https://www.faroway.ai',
}));

jest.mock('../../services/api', () => ({
  isAllowedAffiliateUrl: jest.fn((url: string) => url.startsWith('https://')),
  openAffiliateLink: (...args: unknown[]) => mockOpenAffiliateLink(...args),
}));

jest.mock('../../lib/savedTripBooking', () => ({
  reviewSavedTripBooking: (...args: unknown[]) => mockReviewSavedTripBooking(...args),
}));

const mockTripId = '11111111-1111-4111-8111-111111111111';
let mockTripData: Record<string, unknown>;

jest.mock('../../stores/userStore', () => ({
  useUserStore: Object.assign(
    (select: (s: unknown) => unknown) => select({ user: { id: 'user-1' }, accountRevision: 0 }),
    { getState: () => ({ user: { id: 'user-1' }, accountRevision: 0 }) }
  ),
}));

jest.mock('../../stores/tripStore', () => ({
  useTripStore: Object.assign(
    () => ({
      trips: [mockTripData],
      currentTrip: mockTripData,
      isHydrated: true,
    }),
    {
      getState: () => ({
        trips: [mockTripData],
        currentTrip: mockTripData,
        isHydrated: true,
      }),
    }
  ),
}));

jest.mock('../../hooks/useTrips', () => ({
  useTrips: () => ({ getTripById: jest.fn().mockResolvedValue(null), deleteTrip: jest.fn() }),
}));

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  Image: 'Image',
  RefreshControl: 'RefreshControl',
  ActivityIndicator: 'ActivityIndicator',
  Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? React.createElement('Modal', { visible }, children) : null,
  FlatList: ({
    data,
    renderItem,
    ListHeaderComponent,
    ListFooterComponent,
  }: {
    data: unknown[];
    renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
    ListHeaderComponent?: React.ReactNode | (() => React.ReactNode);
    ListFooterComponent?: React.ReactNode | (() => React.ReactNode);
  }) =>
    React.createElement(
      'FlatList',
      null,
      typeof ListHeaderComponent === 'function' ? ListHeaderComponent() : ListHeaderComponent,
      data.map((item, index) => renderItem({ item, index })),
      typeof ListFooterComponent === 'function' ? ListFooterComponent() : ListFooterComponent
    ),
  Alert: { alert: jest.fn() },
  Share: { share: jest.fn() },
  Linking: { openURL: jest.fn() },
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
  useRouter: () => ({ replace: jest.fn(), dismissTo: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: mockTripId }),
  useFocusEffect: () => undefined,
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: (...args: unknown[]) => mockOpenBrowserAsync(...args),
  WebBrowserPresentationStyle: { AUTOMATIC: 'automatic' },
}));
jest.mock('../../components/ui', () => ({
  Button: ({ title, onPress }: { title: string; onPress: () => void }) =>
    React.createElement('Button', { title, onPress, accessibilityLabel: title }),
  VibeChips: 'VibeChips',
}));
jest.mock('../../components/AuthProvider', () => ({
  useAuthContext: () => ({ isAuthenticated: true }),
}));
jest.mock('../../components/AuthGate', () => ({ AuthGate: () => null }));
jest.mock('../../components/RatingPrompt', () => ({ RatingPrompt: () => null }));
jest.mock('../../components/trip/OnTripCompanionCard', () => ({ OnTripCompanionCard: () => null }));
jest.mock('../../components/trip/TripRemixSheet', () => ({ TripRemixSheet: () => null }));
jest.mock('../../lib/tripSharing', () => ({
  shareOwnedTrip: jest.fn(),
  revokeOwnedTripShare: jest.fn(),
}));
jest.mock('../../stores/promptStore', () => ({
  usePromptStore: () => ({ tripGenerationCount: 0, shouldShowRatingPrompt: () => false }),
}));
jest.mock('../../hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('../../utils/haptics', () => ({
  hapticFeedback: {
    light: jest.fn(),
    warning: jest.fn(),
    selection: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import TripDetailScreen from '../../app/trip/[id]';

function serializeTree(node: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(node, (key, value: unknown) => {
    if (key === '_owner') return undefined;
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return undefined;
      seen.add(value);
    }
    return value;
  });
}

function buildTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: mockTripId,
    destination: 'Paris',
    country: 'France',
    startDate: '2026-11-01',
    endDate: '2026-11-04',
    travelers: 2,
    travelerType: 'couple',
    vibes: ['culture'],
    coverImage: 'https://images.example/paris.jpg',
    createdAt: '2026-10-01',
    status: 'planned',
    hotel: {
      id: 'htl-1',
      name: 'Hotel Lumiere',
      description: 'Boutique stay',
      pricePerNight: 240,
      currency: 'USD',
      totalPrice: 720,
      rating: 4.7,
      reviewCount: 120,
      amenities: ['wifi'],
      images: [],
      bookingUrl: 'https://www.stay22.com/embed/gm?aid=1',
      affiliatePartner: 'stay22',
      location: { name: 'Marais', address: '1 Rue', lat: 0, lng: 0 },
    },
    days: [
      {
        dayNumber: 1,
        date: '2026-11-01',
        theme: 'Arrival & Louvre',
        transport: {
          type: 'flight',
          provider: 'Duffel Flights',
          affiliatePartner: 'duffel',
          departure: { airport: 'SFO', city: 'San Francisco', dateTime: '2026-11-01T08:00:00Z' },
          arrival: { airport: 'CDG', city: 'Paris', dateTime: '2026-11-01T18:00:00Z' },
          duration: 600,
          stops: 0,
          price: 650,
          currency: 'USD',
          bookingUrl: 'https://links.duffel.com/offer/1',
        },
        activities: [
          {
            id: 'act-1',
            time: 'Morning',
            title: 'Louvre Guided Tour',
            description: 'Skip the line',
            location: 'Louvre',
            duration: '2 hours',
            type: 'attraction',
            price: 'USD 65',
            estimatedCost: { amount: 65, currency: 'USD' },
            bookingUrl: 'https://www.viator.com/tours/Paris/Louvre',
            affiliatePartner: 'viator',
          },
          {
            id: 'meal-1',
            time: 'Evening',
            title: 'Le Bistro',
            description: 'Dinner',
            location: 'Saint-Germain',
            duration: '',
            type: 'restaurant',
            bookingUrl: 'https://www.opentable.com/r/le-bistro',
            affiliatePartner: 'opentable',
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('TripDetailScreen direct affiliate handoff & brand UI', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    mockOpenAffiliateLink.mockResolvedValue(undefined);
    mockTripData = buildTrip();
  });

  it('routes hotel, flight, activity, and restaurant CTAs to direct partner handoff instead of reviewSavedTripBooking', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<TripDetailScreen />);
    });

    const json = serializeTree(tree.toJSON());
    expect(json).toContain(AFFILIATE_DISCLOSURE_SHORT);
    // Old competing button hexes are completely absent
    expect(json).not.toContain('#6366f1');
    expect(json).not.toContain('#f97316');
    expect(json).not.toContain('#1e40af');

    const cases = [
      {
        label: 'Check hotel rates on Stay22 for Hotel Lumiere',
        confirmLabel: 'Continue to Stay22',
        expectedUrl: 'https://www.stay22.com/embed/gm?aid=1',
        expectedPartner: 'stay22',
      },
      {
        label: 'Check flight options from SFO to CDG',
        confirmLabel: 'Continue to Duffel',
        expectedUrl: 'https://links.duffel.com/offer/1',
        expectedPartner: 'duffel',
      },
      {
        label: 'Check options on Viator for Louvre Guided Tour',
        confirmLabel: 'Continue to Viator',
        expectedUrl: 'https://www.viator.com/tours/Paris/Louvre',
        expectedPartner: 'viator',
      },
      {
        label: 'Check options on OpenTable for Le Bistro',
        confirmLabel: 'Continue to OpenTable',
        expectedUrl: 'https://www.opentable.com/r/le-bistro',
        expectedPartner: 'opentable',
      },
    ];

    for (const c of cases) {
      const btn = tree.root.findByProps({ accessibilityLabel: c.label });
      await act(async () => btn.props.onPress());
      const confirmBtn = tree.root.findByProps({ accessibilityLabel: c.confirmLabel });
      await act(async () => confirmBtn.props.onPress());

      expect(mockOpenAffiliateLink).toHaveBeenLastCalledWith(
        expect.objectContaining({
          tripId: mockTripId,
          affiliateUrl: c.expectedUrl,
          affiliatePartner: c.expectedPartner,
        }),
        expect.any(Function)
      );
    }

    expect(mockReviewSavedTripBooking).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  it('opens BookingsSheet with Trip Essentials, context labels, and FTC disclosure', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<TripDetailScreen />);
    });

    const openSheetBtn = tree.root.findByProps({ accessibilityLabel: 'Booking options' });
    await act(async () => openSheetBtn.props.onPress());

    const sheetJson = serializeTree(tree.toJSON());
    expect(sheetJson).toContain('Hotel stay');
    expect(sheetJson).toContain('Trip essentials');
    expect(sheetJson).toContain('Airalo');
    expect(sheetJson).toContain('SafetyWing');
    expect(sheetJson).toContain(AFFILIATE_DISCLOSURE_SHORT);

    const airaloBtn = tree.root.findByProps({
      accessibilityLabel: 'Travel eSIM data via Airalo',
    });
    await act(async () => airaloBtn.props.onPress());
    const confirmAiralo = tree.root.findByProps({ accessibilityLabel: 'Continue to Airalo' });
    await act(async () => confirmAiralo.props.onPress());

    expect(mockOpenAffiliateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        affiliatePartner: 'airalo',
        affiliateUrl: 'https://www.airalo.com/',
      }),
      expect.any(Function)
    );
    await act(async () => tree.unmount());
  });

  it('reserves reviewSavedTripBooking for planNeedsRefresh banner', async () => {
    mockTripData = buildTrip({ planNeedsRefresh: true, days: [], hotel: undefined });
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<TripDetailScreen />);
    });

    const refreshLink = tree.root.findByProps({ accessibilityRole: 'link' });
    await act(async () => refreshLink.props.onPress());
    expect(mockReviewSavedTripBooking).toHaveBeenCalledWith(mockTripId, expect.any(Function));
    await act(async () => tree.unmount());
  });
});
