import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  preferences: {
    vibes: string[];
    budget?: string;
    travelerType?: string;
  };
}

interface UserStore {
  user: User | null;
  hasCompletedOnboarding: boolean;
  isAuthenticated: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setOnboardingComplete: (complete: boolean) => void;
  updatePreferences: (preferences: Partial<User['preferences']>) => void;
  logout: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  hasCompletedOnboarding: false,
  isAuthenticated: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
    }),

  setOnboardingComplete: (complete) =>
    set({ hasCompletedOnboarding: complete }),

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
    set({
      user: null,
      isAuthenticated: false,
    }),
}));
