import React from 'react';
import { act, create } from 'react-test-renderer';
let mockOwner = 'account-a';
let mockRevision = 0;
jest.mock('../../stores/userStore', () => ({
  useUserStore: Object.assign(
    (select: (s: unknown) => unknown) =>
      select({ user: { id: mockOwner }, accountRevision: mockRevision }),
    { getState: () => ({ user: { id: mockOwner }, accountRevision: mockRevision }) }
  ),
}));
const mockReplace = jest.fn();
const mockListeners = new Set<() => void>();
const validDraft = {
  destination: 'Tokyo',
  startDate: '2026-11-01',
  endDate: '2026-11-04',
  travelers: 2,
};
let mockState = { draftInput: validDraft, finishGeneration: jest.fn() };
jest.mock('../../stores/tripStore', () => ({
  useTripStore: () =>
    React.useSyncExternalStore(
      (listener) => {
        mockListeners.add(listener);
        return () => {
          mockListeners.delete(listener);
        };
      },
      () => mockState
    ),
}));
const mockValue = jest.fn().mockImplementation(() => ({
  interpolate: () => 0,
  setValue: jest.fn(),
  stopAnimation: jest.fn(),
}));
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  Image: 'Image',
  ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'ios' },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  Easing: { linear: 0 },
  Animated: { View: 'AnimatedView', Text: 'AnimatedText', Value: mockValue },
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {}, absoluteFillObject: {} },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('../../components/AuthProvider', () => ({
  useAuthContext: () => ({ initialized: true, isAuthenticated: true }),
}));
jest.mock('../../stores/promptStore', () => ({
  usePromptStore: () => ({
    tripGenerationCount: 0,
    incrementTripGeneration: jest.fn(),
    shouldShowRatingPrompt: () => false,
  }),
}));
jest.mock('../../components/RatingPrompt', () => ({ RatingPrompt: () => null }));
jest.mock('../../components/GenerationHotelFacts', () => ({ GenerationHotelFacts: () => null }));
jest.mock('../../hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('../../lib/json-render/registry', () => ({ registry: {} }));
jest.mock('../../hooks/useStreamingItinerary', () => ({
  useStreamingItinerary: () => ({
    isComplete: true,
    tripId: 'trip-a',
    blocks: [],
    progress: 100,
    error: null,
    topHotel: null,
    days: [{ dayNumber: 1, date: '2026-11-01', title: 'Arrival' }],
  }),
}));
import GeneratingScreen from '../../app/create/generating';

it('opening a completed itinerary does not redirect to setup after draft clearing', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockReplace.mockClear();
  mockValue.mockClear();
  mockState = {
    draftInput: validDraft,
    finishGeneration: jest.fn(() => {
      mockState = {
        ...mockState,
        draftInput: { ...validDraft, destination: '', startDate: '', endDate: '' },
      };
      mockListeners.forEach((listener) => listener());
    }),
  };
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<GeneratingScreen />);
    });
    await act(async () => {
      expect(mockValue).not.toHaveBeenCalled();
      const open = renderer.root.findByProps({ accessibilityLabel: 'View your generated trip' })
        .props.onPress;
      open();
      open();
    });
    expect(mockReplace.mock.calls).toEqual([['/trip/trip-a']]);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});

it.each([
  { startDate: '2026-02-30', endDate: '2026-03-04' },
  { startDate: '2026-11-04', endDate: '2026-11-01' },
])('invalid generation draft returns to setup: %j', async (dates) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockReplace.mockClear();
  mockState = { draftInput: { ...validDraft, ...dates }, finishGeneration: jest.fn() };
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<GeneratingScreen />);
    });
    expect(mockReplace).toHaveBeenCalledWith('/create');
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: 'View your generated trip' })
    ).toHaveLength(0);
    expect(mockState.finishGeneration).not.toHaveBeenCalled();
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});

it('a completed-trip callback after exit cannot save or navigate', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockReplace.mockClear();
  mockState = { draftInput: validDraft, finishGeneration: jest.fn() };
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<GeneratingScreen />);
    });
    const open = renderer.root.findByProps({ accessibilityLabel: 'View your generated trip' }).props
      .onPress;
    await act(async () => {
      renderer.unmount();
    });
    await act(async () => {
      open();
    });
    expect(mockState.finishGeneration).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});

it.each(['different account', 'same-owner reauthentication'])(
  'old completed-trip callback ignores %s before render',
  async (change) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mockOwner = 'account-a';
    mockRevision = 0;
    mockReplace.mockClear();
    mockState = { draftInput: validDraft, finishGeneration: jest.fn() };
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<GeneratingScreen />);
      });
      const open = renderer.root.findByProps({ accessibilityLabel: 'View your generated trip' })
        .props.onPress;
      if (change === 'different account') mockOwner = 'account-b';
      mockRevision += 2;
      await act(async () => {
        open();
      });
      expect(mockState.finishGeneration).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      mockOwner = 'account-a';
      mockRevision = 0;
    }
  }
);
