// Mock AsyncStorage before importing store
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

import { usePromptStore } from '../../stores/promptStore';

beforeEach(() => {
  usePromptStore.setState({
    tripGenerationCount: 0,
    lastRatingPromptDate: null,
    hasRatedApp: false,
    hasDismissedSignUpAfterGeneration: false,
    hasDismissedCreateBanner: false,
  });
});

describe('usePromptStore', () => {
  describe('initial state', () => {
    it('starts with zero generation count and no flags set', () => {
      const state = usePromptStore.getState();
      expect(state.tripGenerationCount).toBe(0);
      expect(state.lastRatingPromptDate).toBeNull();
      expect(state.hasRatedApp).toBe(false);
      expect(state.hasDismissedSignUpAfterGeneration).toBe(false);
      expect(state.hasDismissedCreateBanner).toBe(false);
    });
  });

  describe('incrementTripGeneration', () => {
    it('increments count by 1', () => {
      usePromptStore.getState().incrementTripGeneration();
      expect(usePromptStore.getState().tripGenerationCount).toBe(1);
    });

    it('increments multiple times', () => {
      usePromptStore.getState().incrementTripGeneration();
      usePromptStore.getState().incrementTripGeneration();
      usePromptStore.getState().incrementTripGeneration();
      expect(usePromptStore.getState().tripGenerationCount).toBe(3);
    });
  });

  describe('markRatingPrompted', () => {
    it('sets lastRatingPromptDate to an ISO string', () => {
      usePromptStore.getState().markRatingPrompted();
      const date = usePromptStore.getState().lastRatingPromptDate;
      expect(date).not.toBeNull();
      expect(new Date(date!).getTime()).not.toBeNaN();
    });
  });

  describe('markRated', () => {
    it('sets hasRatedApp to true', () => {
      usePromptStore.getState().markRated();
      expect(usePromptStore.getState().hasRatedApp).toBe(true);
    });
  });

  describe('dismissSignUpPrompt', () => {
    it('sets hasDismissedSignUpAfterGeneration to true', () => {
      usePromptStore.getState().dismissSignUpPrompt();
      expect(usePromptStore.getState().hasDismissedSignUpAfterGeneration).toBe(true);
    });
  });

  describe('dismissCreateBanner', () => {
    it('sets hasDismissedCreateBanner to true', () => {
      usePromptStore.getState().dismissCreateBanner();
      expect(usePromptStore.getState().hasDismissedCreateBanner).toBe(true);
    });
  });

  describe('shouldShowRatingPrompt', () => {
    it('returns true when user has not been prompted', () => {
      expect(usePromptStore.getState().shouldShowRatingPrompt()).toBe(true);
    });

    it('returns false when user has already rated', () => {
      usePromptStore.getState().markRated();
      expect(usePromptStore.getState().shouldShowRatingPrompt()).toBe(false);
    });

    it('returns false when last prompt was recent', () => {
      usePromptStore.getState().markRatingPrompted();
      expect(usePromptStore.getState().shouldShowRatingPrompt()).toBe(false);
    });

    it('returns true when last prompt was over 60 days ago', () => {
      const sixtyOneDaysAgo = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000).toISOString();
      usePromptStore.setState({ lastRatingPromptDate: sixtyOneDaysAgo });
      expect(usePromptStore.getState().shouldShowRatingPrompt()).toBe(true);
    });
  });
});
