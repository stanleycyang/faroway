import mixpanel from "mixpanel-browser";
import type { EventName, UserProperties } from "@faroway/analytics";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

let initialized = false;

export function initMixpanel() {
  if (initialized || !MIXPANEL_TOKEN || typeof window === "undefined") return;

  mixpanel.init(MIXPANEL_TOKEN, {
    track_pageview: "url-with-path",
    persistence: "localStorage",
    ignore_dnt: false,
  });

  initialized = true;
}

export function trackEvent(
  event: EventName,
  properties?: Record<string, unknown>,
) {
  if (!initialized) return;
  mixpanel.track(event, { platform: "web", ...properties });
}

export function identifyUser(
  userId: string,
  properties?: Partial<UserProperties>,
) {
  if (!initialized) return;
  mixpanel.identify(userId);
  if (properties) {
    mixpanel.people.set({ ...properties, platform: "web" });
  }
}

export function resetUser() {
  if (!initialized) return;
  mixpanel.reset();
}
