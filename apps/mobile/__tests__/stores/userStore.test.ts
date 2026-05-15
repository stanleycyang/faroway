import { useUserStore } from "../../stores/userStore";

// Reset store between tests
beforeEach(() => {
  useUserStore.setState({
    user: null,
    hasCompletedOnboarding: false,
    isAuthenticated: false,
  });
});

describe("useUserStore", () => {
  describe("initial state", () => {
    it("starts with null user and unauthenticated", () => {
      const state = useUserStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.hasCompletedOnboarding).toBe(false);
    });
  });

  describe("setUser", () => {
    const mockUser = {
      id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      preferences: { vibes: ["adventure"], budget: "moderate" },
    };

    it("sets user and marks as authenticated", () => {
      useUserStore.getState().setUser(mockUser);
      const state = useUserStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it("clears user and marks as unauthenticated when set to null", () => {
      useUserStore.getState().setUser(mockUser);
      useUserStore.getState().setUser(null);
      const state = useUserStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("setOnboardingComplete", () => {
    it("sets onboarding complete to true", () => {
      useUserStore.getState().setOnboardingComplete(true);
      expect(useUserStore.getState().hasCompletedOnboarding).toBe(true);
    });

    it("sets onboarding complete to false", () => {
      useUserStore.getState().setOnboardingComplete(true);
      useUserStore.getState().setOnboardingComplete(false);
      expect(useUserStore.getState().hasCompletedOnboarding).toBe(false);
    });
  });

  describe("updatePreferences", () => {
    const mockUser = {
      id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      preferences: { vibes: ["adventure"], budget: "moderate" },
    };

    it("updates preferences when user exists", () => {
      useUserStore.getState().setUser(mockUser);
      useUserStore.getState().updatePreferences({ budget: "luxury" });
      const state = useUserStore.getState();
      expect(state.user?.preferences.budget).toBe("luxury");
      expect(state.user?.preferences.vibes).toEqual(["adventure"]);
    });

    it("updates vibes array", () => {
      useUserStore.getState().setUser(mockUser);
      useUserStore
        .getState()
        .updatePreferences({ vibes: ["relaxation", "foodie"] });
      const state = useUserStore.getState();
      expect(state.user?.preferences.vibes).toEqual(["relaxation", "foodie"]);
    });

    it("does nothing when user is null", () => {
      useUserStore.getState().updatePreferences({ budget: "luxury" });
      expect(useUserStore.getState().user).toBeNull();
    });
  });

  describe("logout", () => {
    it("clears user and sets isAuthenticated to false", () => {
      useUserStore.getState().setUser({
        id: "user-1",
        name: "Jane",
        email: "jane@example.com",
        preferences: { vibes: [] },
      });
      useUserStore.getState().logout();
      const state = useUserStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });
});
