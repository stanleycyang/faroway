import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  preferences: {
    vibes: string[];
    budget?: string;
    travelerType?: string;
  };
  notificationSettings?: Record<string, boolean>;
}

interface UserStore {
  user: User | null;
  hasCompletedOnboarding: boolean;
  isAuthenticated: boolean;
  // Memory-only identity epoch; profile edits do not invalidate account work.
  accountRevision: number;

  // Actions
  setUser: (user: User | null) => void;
  setOnboardingComplete: (complete: boolean) => void;
  updatePreferences: (preferences: Partial<User['preferences']>) => void;
  logout: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      user: null,
      hasCompletedOnboarding: false,
      isAuthenticated: false,
      accountRevision: 0,

      setUser: (user) =>
        set((state) => ({
          user,
          isAuthenticated: !!user,
          accountRevision: state.accountRevision + (state.user?.id === user?.id ? 0 : 1),
        })),

      setOnboardingComplete: (complete) => set({ hasCompletedOnboarding: complete }),

      updatePreferences: (preferences) =>
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                preferences: { ...state.user.preferences, ...preferences },
              }
            : null,
        })),

      logout: () =>
        set((state) => ({
          user: null,
          isAuthenticated: false,
          accountRevision: state.accountRevision + 1,
        })),
    }),
    {
      name: 'user-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
      }),
    }
  )
);
