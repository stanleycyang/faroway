"use client";

import React from "react";
import {
  isAllowedAffiliateUrl,
  itemTypeForAffiliatePartner,
} from "@faroway/constants";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";
import { AffiliateDisclosure } from "@/components/affiliates/AffiliateDisclosure";
import { TrackedAffiliateButton } from "@/components/affiliates/TrackedAffiliateButton";

export interface ToolAffiliateAction {
  key: string;
  link: AffiliateLinkResult;
  itemType?: "hotel" | "activity" | "restaurant" | "flight" | "transport";
}

export interface ToolAffiliateCardProps {
  title: string;
  subtitle?: string;
  placement: string;
  campaign: string;
  actions: ToolAffiliateAction[];
  editorialNote?: string;
  className?: string;
}

export function ToolAffiliateCard({
  title,
  subtitle,
  placement,
  campaign,
  actions,
  editorialNote,
  className = "",
}: ToolAffiliateCardProps) {
  const validActions = actions.filter(
    (
      action,
    ): action is ToolAffiliateAction & {
      link: AffiliateLinkResult & { url: string };
    } => Boolean(action.link.url && isAllowedAffiliateUrl(action.link.url)),
  );

  if (validActions.length === 0) {
    return null;
  }

  return (
    <div
      className={`rounded-2xl border border-[#DCE5E3] bg-[#EFF5F3] p-5 ${className}`}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {validActions.map((action, index) => (
          <TrackedAffiliateButton
            key={action.key}
            label={action.link.label}
            variant={index === 0 ? "secondary" : "subtle"}
            source="tool"
            placement={placement}
            campaign={campaign}
            itemId={action.key}
            itemName={action.link.label}
            itemType={
              action.itemType ??
              (action.link.vertical === "flights"
                ? "flight"
                : itemTypeForAffiliatePartner(action.link.partner))
            }
            affiliateUrl={action.link.url}
            partner={action.link.partner}
          />
        ))}
      </div>
      <div className="mt-3 space-y-1.5 border-t border-[#DCE5E3] pt-3">
        <AffiliateDisclosure
          variant="short"
          className="text-xs text-slate-600"
        />
        {editorialNote && (
          <p className="text-xs text-slate-600">{editorialNote}</p>
        )}
      </div>
    </div>
  );
}
