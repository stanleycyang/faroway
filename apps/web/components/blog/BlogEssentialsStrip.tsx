"use client";

import React from "react";
import { Globe2, Plane, ShieldCheck, Wallet, Wifi } from "lucide-react";
import {
  isAllowedAffiliateUrl,
  itemTypeForAffiliatePartner,
} from "@faroway/constants";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";
import { AffiliateDisclosure } from "@/components/affiliates/AffiliateDisclosure";
import { TrackedAffiliateButton } from "@/components/affiliates/TrackedAffiliateButton";

export interface BlogEssentialsStripProps {
  flightLinks: AffiliateLinkResult[];
  esim: AffiliateLinkResult | null;
  fx: AffiliateLinkResult | null;
  insurance: AffiliateLinkResult | null;
}

export function BlogEssentialsStrip({
  flightLinks,
  esim,
  fx,
  insurance,
}: BlogEssentialsStripProps) {
  const validFlights = flightLinks.filter(
    (link) => link.url && isAllowedAffiliateUrl(link.url),
  );
  const validEsim = esim?.url && isAllowedAffiliateUrl(esim.url) ? esim : null;
  const validFx = fx?.url && isAllowedAffiliateUrl(fx.url) ? fx : null;
  const validInsurance =
    insurance?.url && isAllowedAffiliateUrl(insurance.url) ? insurance : null;

  if (validFlights.length === 0 && !validEsim && !validFx && !validInsurance) {
    return null;
  }

  return (
    <section
      aria-label="Travel essentials and booking partners"
      className="container mx-auto max-w-7xl px-6 pb-4"
    >
      <div className="rounded-2xl border border-[#DCE5E3] bg-[#EFF5F3] p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#143D46] text-white">
              <Globe2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-editorial text-xl font-bold text-slate-900">
                Ready to turn inspiration into a trip?
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                Compare airfare, stay connected with eSIM data, and pack travel
                money essentials from trusted partners.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {validFlights[0]?.url && (
              <TrackedAffiliateButton
                label={validFlights[0].label}
                variant="secondary"
                source="blog"
                placement="blog_index"
                campaign="blog-index"
                itemId={`blog-index-flight-${validFlights[0].partner}`}
                itemName={validFlights[0].label}
                itemType="flight"
                affiliateUrl={validFlights[0].url}
                partner={validFlights[0].partner}
              />
            )}
            {validEsim?.url && (
              <TrackedAffiliateButton
                label={validEsim.label}
                variant="subtle"
                source="blog"
                placement="blog_index"
                campaign="blog-index"
                itemId="blog-index-airalo-esim"
                itemName={validEsim.label}
                itemType={itemTypeForAffiliatePartner(validEsim.partner)}
                affiliateUrl={validEsim.url}
                partner={validEsim.partner}
              />
            )}
            {validFx?.url && (
              <TrackedAffiliateButton
                label={validFx.label}
                variant="subtle"
                source="blog"
                placement="blog_index"
                campaign="blog-index"
                itemId="blog-index-wise-fx"
                itemName={validFx.label}
                itemType={itemTypeForAffiliatePartner(validFx.partner)}
                affiliateUrl={validFx.url}
                partner={validFx.partner}
              />
            )}
            {validInsurance?.url && (
              <TrackedAffiliateButton
                label={validInsurance.label}
                variant="subtle"
                source="blog"
                placement="blog_index"
                campaign="blog-index"
                itemId="blog-index-safetywing"
                itemName={validInsurance.label}
                itemType={itemTypeForAffiliatePartner(validInsurance.partner)}
                affiliateUrl={validInsurance.url}
                partner={validInsurance.partner}
              />
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#DCE5E3] pt-3">
          <div className="flex items-center gap-4 text-xs font-medium text-slate-700">
            <span className="inline-flex items-center gap-1">
              <Plane
                className="h-3.5 w-3.5 text-[#0F766E]"
                aria-hidden="true"
              />
              Flights
            </span>
            <span className="inline-flex items-center gap-1">
              <Wifi className="h-3.5 w-3.5 text-[#0F766E]" aria-hidden="true" />
              eSIM
            </span>
            <span className="inline-flex items-center gap-1">
              <Wallet
                className="h-3.5 w-3.5 text-[#0F766E]"
                aria-hidden="true"
              />
              Travel Money
            </span>
            {validInsurance && (
              <span className="inline-flex items-center gap-1">
                <ShieldCheck
                  className="h-3.5 w-3.5 text-[#0F766E]"
                  aria-hidden="true"
                />
                Insurance
              </span>
            )}
          </div>
          <AffiliateDisclosure
            variant="short"
            className="text-xs text-slate-600"
          />
        </div>
      </div>
    </section>
  );
}
