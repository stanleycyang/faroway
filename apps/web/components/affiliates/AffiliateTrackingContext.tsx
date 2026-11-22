"use client";

import React, { createContext, useContext } from "react";
import type { AffiliateClickSource } from "@faroway/types";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";

export interface AffiliateTrackingContextValue {
  tripId?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  source: AffiliateClickSource;
  hotelPartnerLinks?: {
    primary: AffiliateLinkResult | null;
    alternatives: AffiliateLinkResult[];
    liteapiLiveCheckoutEnabled?: boolean;
  };
  flightFallbackLinks?: AffiliateLinkResult[];
  essentials?: Record<string, AffiliateLinkResult>;
}

const AffiliateTrackingContext =
  createContext<AffiliateTrackingContextValue | null>(null);

export function AffiliateTrackingProvider({
  value,
  children,
}: {
  value: AffiliateTrackingContextValue;
  children: React.ReactNode;
}) {
  return (
    <AffiliateTrackingContext.Provider value={value}>
      {children}
    </AffiliateTrackingContext.Provider>
  );
}

export function useAffiliateTracking(): AffiliateTrackingContextValue | null {
  return useContext(AffiliateTrackingContext);
}
