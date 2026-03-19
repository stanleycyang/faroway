import { Mixpanel } from "mixpanel-react-native";
import { Platform } from "react-native";
import { EVENTS } from "@faroway/analytics";
import type { EventName, UserProperties } from "@faroway/analytics";

const MIXPANEL_TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;

let mixpanel: Mixpanel | null = null;
let initPromise: Promise<void> | null = null;

export function initMixpanel(): Promise<void> {
  if (initPromise) return initPromise;
  if (!MIXPANEL_TOKEN) return Promise.resolve();

  initPromise = (async () => {
    try {
      const instance = new Mixpanel(MIXPANEL_TOKEN, true);
      await instance.init();
      mixpanel = instance;
    } catch (error) {
      console.warn("[Analytics] Failed to initialize Mixpanel:", error);
      initPromise = null;
    }
  })();

  return initPromise;
}

export function trackEvent(
  event: EventName,
  properties?: Record<string, unknown>,
) {
  if (!mixpanel) return;
  mixpanel.track(event, {
    platform: Platform.OS as "ios" | "android",
    ...properties,
  });
}

export function trackScreenView(screenName: string) {
  trackEvent(EVENTS.SCREEN_VIEW, { screen_name: screenName });
}

export function identifyUser(
  userId: string,
  properties?: Partial<UserProperties>,
) {
  if (!mixpanel) return;
  mixpanel.identify(userId);
  if (properties) {
    const people = mixpanel.getPeople();
    people.set({
      ...properties,
      platform: Platform.OS,
    });
  }
}

export function resetUser() {
  if (!mixpanel) return;
  mixpanel.reset();
}
