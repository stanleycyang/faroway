import { Mixpanel } from "mixpanel-react-native";
import { Platform } from "react-native";
import type { EventName, UserProperties } from "@faroway/analytics";

const MIXPANEL_TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;

let mixpanel: Mixpanel | null = null;
let initialized = false;

export async function initMixpanel(): Promise<void> {
  if (initialized || !MIXPANEL_TOKEN) return;

  try {
    mixpanel = new Mixpanel(MIXPANEL_TOKEN, true);
    await mixpanel.init();
    initialized = true;
  } catch (error) {
    console.warn("[Analytics] Failed to initialize Mixpanel:", error);
  }
}

export function trackEvent(
  event: EventName,
  properties?: Record<string, unknown>,
) {
  if (!mixpanel || !initialized) return;
  mixpanel.track(event, {
    platform: Platform.OS as "ios" | "android",
    ...properties,
  });
}

export function trackScreenView(screenName: string) {
  trackEvent("Screen View" as EventName, { screen_name: screenName });
}

export function identifyUser(
  userId: string,
  properties?: Partial<UserProperties>,
) {
  if (!mixpanel || !initialized) return;
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
  if (!mixpanel || !initialized) return;
  mixpanel.reset();
}
