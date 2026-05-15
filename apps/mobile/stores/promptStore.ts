import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface PromptStore {
  tripGenerationCount: number;
  lastRatingPromptDate: string | null;
  hasRatedApp: boolean;
  hasDismissedSignUpAfterGeneration: boolean;
  hasDismissedCreateBanner: boolean;

  // Actions
  incrementTripGeneration: () => void;
  markRatingPrompted: () => void;
  markRated: () => void;
  dismissSignUpPrompt: () => void;
  dismissCreateBanner: () => void;
  shouldShowRatingPrompt: () => boolean;
}

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

export const usePromptStore = create<PromptStore>()(
  persist(
    (set, get) => ({
      tripGenerationCount: 0,
      lastRatingPromptDate: null,
      hasRatedApp: false,
      hasDismissedSignUpAfterGeneration: false,
      hasDismissedCreateBanner: false,

      incrementTripGeneration: () =>
        set((state) => ({
          tripGenerationCount: state.tripGenerationCount + 1,
        })),

      markRatingPrompted: () =>
        set({ lastRatingPromptDate: new Date().toISOString() }),

      markRated: () => set({ hasRatedApp: true }),

      dismissSignUpPrompt: () =>
        set({ hasDismissedSignUpAfterGeneration: true }),

      dismissCreateBanner: () => set({ hasDismissedCreateBanner: true }),

      shouldShowRatingPrompt: () => {
        const { hasRatedApp, lastRatingPromptDate } = get();
        if (hasRatedApp) return false;
        if (!lastRatingPromptDate) return true;
        const elapsed = Date.now() - new Date(lastRatingPromptDate).getTime();
        return elapsed > SIXTY_DAYS_MS;
      },
    }),
    {
      name: "prompt-store",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
