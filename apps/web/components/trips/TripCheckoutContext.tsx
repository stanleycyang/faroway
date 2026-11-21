"use client";

import { createContext, useContext } from "react";
import type { AffiliateClickItemType } from "@faroway/constants";
import type { AffiliateClickSource } from "@faroway/types";

export interface CheckoutSelection {
  id: string;
  name: string;
  date?: string;
  dateLabel?: string;
  attemptId?: string;
  mode?: "viator_hosted" | "partner_click";
  itemType?: AffiliateClickItemType;
  partner?: string;
  partnerLabel?: string;
  affiliateUrl?: string;
  price?: number;
  currency?: string;
  source?: AffiliateClickSource;
  placement?: string;
  campaign?: string;
}

export interface TripCheckoutContextValue {
  enabled: boolean;
  partnerEnabled: boolean;
  mode: "owner" | "shared";
  review: (selection: CheckoutSelection) => void;
}

export const CheckoutContext = createContext<TripCheckoutContextValue | null>(
  null,
);

export function useTripCheckout() {
  return useContext(CheckoutContext);
}
