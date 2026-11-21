"use client";

import React from "react";
import { Globe2 } from "lucide-react";
import {
  isAllowedAffiliateUrl,
  itemTypeForAffiliatePartner,
} from "@faroway/constants";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";
import { AffiliateDisclosure } from "@/components/affiliates/AffiliateDisclosure";
import { TrackedAffiliateButton } from "@/components/affiliates/TrackedAffiliateButton";

export interface DestinationsIndexEssentialsStripProps {
  stays: AffiliateLinkResult[];
  flights: AffiliateLinkResult[];
  esim: AffiliateLinkResult | null;
  insurance: AffiliateLinkResult | null;
}

export function DestinationsIndexEssentialsStrip({
  stays,
  flights,
  esim,
  insurance,
}: DestinationsIndexEssentialsStripProps) {
  const validStay = stays.find((l) => l.url && isAllowedAffiliateUrl(l.url));
  const validFlight = flights.find(
    (l) => l.url && isAllowedAffiliateUrl(l.url),
  );
  const validEsim = esim?.url && isAllowedAffiliateUrl(esim.url) ? esim : null;
  const validInsurance =
    insurance?.url && isAllowedAffiliateUrl(insurance.url) ? insurance : null;

  if (!validStay && !validFlight && !validEsim && !validInsurance) {
    return null;
  }

  return (
    <section
      aria-label="Compare stays, flights, and travel essentials"
      className="container mx-auto max-w-7xl px-6 pb-16"
    >
      <div className="rounded-2xl border border-[#DCE5E3] bg-[#EFF5F3] p-6 md:p-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#143D46] text-white">
              <Globe2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-editorial text-xl font-bold text-slate-900">
                Compare Stays, Flights &amp; Travel Essentials
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Check rates across trusted partners before locking in your next
                destination.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {validStay?.url && (
              <TrackedAffiliateButton
                label={validStay.label}
                variant="secondary"
                source="destination_guide"
                placement="destinations_index"
                campaign="destinations-index"
                itemId={`dest-index-stay-${validStay.partner}`}
                itemName={validStay.label}
                itemType="hotel"
                affiliateUrl={validStay.url}
                partner={validStay.partner}
              />
            )}
            {validFlight?.url && (
              <TrackedAffiliateButton
                label={validFlight.label}
                variant="subtle"
                source="destination_guide"
                placement="destinations_index"
                campaign="destinations-index"
                itemId={`dest-index-flight-${validFlight.partner}`}
                itemName={validFlight.label}
                itemType="flight"
                affiliateUrl={validFlight.url}
                partner={validFlight.partner}
              />
            )}
            {validEsim?.url && (
              <TrackedAffiliateButton
                label={validEsim.label}
                variant="subtle"
                source="destination_guide"
                placement="destinations_index"
                campaign="destinations-index"
                itemId="dest-index-airalo-esim"
                itemName={validEsim.label}
                itemType={itemTypeForAffiliatePartner(validEsim.partner)}
                affiliateUrl={validEsim.url}
                partner={validEsim.partner}
              />
            )}
            {validInsurance?.url && (
              <TrackedAffiliateButton
                label={validInsurance.label}
                variant="subtle"
                source="destination_guide"
                placement="destinations_index"
                campaign="destinations-index"
                itemId="dest-index-safetywing"
                itemName={validInsurance.label}
                itemType={itemTypeForAffiliatePartner(validInsurance.partner)}
                affiliateUrl={validInsurance.url}
                partner={validInsurance.partner}
              />
            )}
          </div>
        </div>
        <div className="mt-4 border-t border-[#DCE5E3] pt-3">
          <AffiliateDisclosure
            variant="short"
            className="text-xs text-slate-600"
          />
        </div>
      </div>
    </section>
  );
}
