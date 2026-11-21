"use client";

import React, { useState } from "react";
import { ExternalLink } from "lucide-react";
import { isAllowedAffiliateUrl } from "@faroway/constants";
import { AffiliateDisclosure } from "./AffiliateDisclosure";
import {
  trackAndOpenAffiliateLink,
  type TrackAndOpenInput,
  type TrackAffiliateClickResult,
} from "./track-click-client";

export interface TrackedAffiliateButtonProps extends TrackAndOpenInput {
  label: string;
  variant?: "primary" | "secondary" | "subtle" | "onDark" | "badge";
  className?: string;
  showDisclosure?: boolean;
  disclosureClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
  hideIcon?: boolean;
  onTracked?: (
    result: TrackAffiliateClickResult & { openedInNewTab: boolean },
  ) => void;
}

const variantClasses: Record<
  NonNullable<TrackedAffiliateButtonProps["variant"]>,
  string
> = {
  primary:
    "w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary-700 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-800 transition-colors disabled:opacity-60",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors disabled:opacity-60",
  subtle:
    "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[#DCE5E3] bg-[#EFF5F3] px-3.5 py-1.5 text-xs font-semibold text-[#143D46] hover:bg-[#DCE5E3]/70 transition-colors disabled:opacity-60",
  onDark:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#143D46] hover:bg-[#EFF5F3] transition-colors disabled:opacity-60",
  badge:
    "inline-flex items-center gap-1.5 rounded-lg bg-[#EFF5F3] px-2.5 py-1 text-xs font-semibold text-[#0F766E] hover:bg-[#DCE5E3]/70 transition-colors disabled:opacity-60",
};

export function TrackedAffiliateButton({
  label,
  variant = "primary",
  className,
  showDisclosure = false,
  disclosureClassName,
  disabled = false,
  ariaLabel,
  hideIcon = false,
  onTracked,
  ...input
}: TrackedAffiliateButtonProps) {
  const [busy, setBusy] = useState(false);

  if (!isAllowedAffiliateUrl(input.affiliateUrl)) {
    return null;
  }

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.focus();
    if (busy || disabled) return;
    setBusy(true);
    try {
      const result = await trackAndOpenAffiliateLink(input);
      if (result) {
        onTracked?.(result);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={variant === "primary" ? "space-y-2" : "inline-block"}>
      <button
        type="button"
        disabled={disabled || busy}
        aria-label={ariaLabel}
        onClick={(event) => void handleClick(event)}
        className={className ?? variantClasses[variant]}
      >
        <span>{busy ? "Opening partner…" : label}</span>
        {!hideIcon && (
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
      </button>
      {showDisclosure && (
        <AffiliateDisclosure
          className={
            disclosureClassName ?? "text-center text-xs text-slate-600"
          }
        />
      )}
    </div>
  );
}
