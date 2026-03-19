import React, { useEffect, useState } from "react";
import { useSegments } from "expo-router";
import { initMixpanel, trackScreenView } from "../lib/analytics/mixpanel";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initMixpanel().then(() => setReady(true));
  }, []);

  // Track screen views on navigation (only after init completes)
  useEffect(() => {
    if (!ready) return;
    const screenName = segments.length > 0 ? segments.join("/") : "index";
    trackScreenView(screenName);
  }, [segments, ready]);

  return <>{children}</>;
}
