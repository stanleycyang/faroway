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
type AnimationHandle = {
  start: jest.Mock;
  stop: jest.Mock;
  callback?: (result: { finished: boolean }) => void;
};
const mockAnimations: AnimationHandle[] = [];
const mockTiming = jest.fn((_value: unknown, _config: unknown) => {
  const handle: AnimationHandle = { start: jest.fn(), stop: jest.fn() };
  handle.start.mockImplementation((callback) => {
    handle.callback = callback;
  });
  mockAnimations.push(handle);
  return handle;
});
const mockStaticAnimation = () => ({ start: jest.fn(), stop: jest.fn() });
let mockReduced = false;
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
  Animated: {
    View: 'AnimatedView',
    Text: 'AnimatedText',
    Value: mockValue,
    timing: mockTiming,
    spring: mockStaticAnimation,
    parallel: mockStaticAnimation,
    sequence: mockStaticAnimation,
    loop: mockStaticAnimation,
  },
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
jest.mock('../../hooks/useReduceMotion', () => ({ useReduceMotion: () => mockReduced }));
jest.mock('../../lib/json-render/registry', () => ({ registry: {} }));
jest.mock('../../hooks/useStreamingItinerary', () => ({
  useStreamingItinerary: () => ({
    isComplete: false,
    tripId: 'trip-a',
    blocks: [],
    progress: 100,
    error: null,
    topHotel: null,
    days: [{ dayNumber: 1, date: '2026-11-01', title: 'Arrival' }],
  }),
}));
import GeneratingScreen from '../../app/create/generating';

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockAnimations.length = 0;
  mockReduced = false;
  mockOwner = 'account-a';
  mockRevision = 0;
  mockState = { draftInput: validDraft, finishGeneration: jest.fn() };
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterEach(() => {
  jest.useRealTimers();
});

it.each(['exit', 'reduced motion'])(
  'a pending fact fade cannot continue after %s',
  async (interruption) => {
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<GeneratingScreen />);
      });
      await act(async () => {
        jest.advanceTimersByTime(4000);
      });
      const fade = mockAnimations.find((animation) => animation.callback);
      expect(fade).toBeDefined();
      await act(async () => {
        if (interruption === 'exit') renderer.unmount();
        else {
          mockReduced = true;
          renderer.update(<GeneratingScreen />);
        }
      });
      expect(fade!.stop).toHaveBeenCalled();
      const timingCalls = mockTiming.mock.calls.length;
      await act(async () => {
        fade!.callback!({ finished: true });
        jest.advanceTimersByTime(4000);
      });
      expect(mockTiming).toHaveBeenCalledTimes(timingCalls);
    } finally {
      await act(async () => {
        renderer.unmount();
      });
    }
  }
);

it('a completed active fact fade starts the next fade, while an interrupted fade does not', async () => {
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<GeneratingScreen />);
    });
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    const fade = mockAnimations.find((animation) => animation.callback)!;
    const before = mockTiming.mock.calls.length;
    await act(async () => {
      fade.callback!({ finished: false });
    });
    expect(mockTiming).toHaveBeenCalledTimes(before);
    await act(async () => {
      fade.callback!({ finished: true });
    });
    expect(mockTiming).toHaveBeenCalledTimes(before + 1);
  } finally {
    await act(async () => {
      renderer.unmount();
    });
  }
});
