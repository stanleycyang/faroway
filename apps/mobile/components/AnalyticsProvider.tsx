import { useEffect, useRef } from "react";
import { useSegments } from "expo-router";
import { initMixpanel, trackScreenView } from "../lib/analytics/mixpanel";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const initCalled = useRef(false);

  useEffect(() => {
    if (initCalled.current) return;
    initCalled.current = true;
    initMixpanel();
  }, []);

  // Track screen views on navigation
  useEffect(() => {
    const screenName = segments.length > 0 ? segments.join("/") : "index";
    trackScreenView(screenName);
  }, [segments]);

  return <>{children}</>;
}
