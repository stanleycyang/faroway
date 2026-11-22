"use client";

import React from "react";
import {
  AFFILIATE_DISCLOSURE_FULL,
  AFFILIATE_DISCLOSURE_SHORT,
} from "@faroway/constants";

export interface AffiliateDisclosureProps {
  variant?: "short" | "full";
  className?: string;
}

export function AffiliateDisclosure({
  variant = "short",
  className = "text-xs leading-relaxed text-slate-600",
}: AffiliateDisclosureProps) {
  return (
    <p className={className}>
      {variant === "full"
        ? AFFILIATE_DISCLOSURE_FULL
        : AFFILIATE_DISCLOSURE_SHORT}
    </p>
  );
}
