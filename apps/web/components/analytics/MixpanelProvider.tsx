"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initMixpanel, trackEvent } from "@/lib/analytics/mixpanel";
import { EVENTS } from "@faroway/analytics";

export function MixpanelProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize Mixpanel on mount
  useEffect(() => {
    initMixpanel();
  }, []);

  // Track page views on route changes
  useEffect(() => {
    trackEvent(EVENTS.PAGE_VIEW, {
      path: pathname,
      search: searchParams.toString(),
    });
  }, [pathname, searchParams]);

  return <>{children}</>;
}
