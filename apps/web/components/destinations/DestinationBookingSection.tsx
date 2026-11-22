"use client";

import React from "react";
import { BedDouble, Compass, Plane, ShieldCheck, Sparkles } from "lucide-react";
import {
  isAllowedAffiliateUrl,
  itemTypeForAffiliatePartner,
} from "@faroway/constants";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";
import { AffiliateDisclosure } from "@/components/affiliates/AffiliateDisclosure";
import { TrackedAffiliateButton } from "@/components/affiliates/TrackedAffiliateButton";

export interface DestinationEssentialEntry {
  key: "insurance" | "esim" | "carRental" | "visa" | "fx";
  title: string;
  link: AffiliateLinkResult;
}

export interface DestinationBookingSectionProps {
  destinationName: string;
  country: string;
  slug: string;
  stays: AffiliateLinkResult[];
  activities: AffiliateLinkResult[];
  flights: AffiliateLinkResult[];
  essentials: DestinationEssentialEntry[];
}

function keepValidLinks(links: AffiliateLinkResult[]): AffiliateLinkResult[] {
  return links.filter((link): link is AffiliateLinkResult & { url: string } =>
    Boolean(link.url && isAllowedAffiliateUrl(link.url)),
  );
}

export function DestinationBookingSection({
  destinationName,
  country,
  slug,
  stays,
  activities,
  flights,
  essentials,
}: DestinationBookingSectionProps) {
  const validStays = keepValidLinks(stays);
  const validActivities = keepValidLinks(activities);
  const validFlights = keepValidLinks(flights);
  const validEssentials = essentials.filter(
    (
      entry,
    ): entry is DestinationEssentialEntry & {
      link: AffiliateLinkResult & { url: string };
    } => Boolean(entry.link.url && isAllowedAffiliateUrl(entry.link.url)),
  );

  if (
    validStays.length === 0 &&
    validActivities.length === 0 &&
    validFlights.length === 0 &&
    validEssentials.length === 0
  ) {
    return null;
  }

  const campaign = `destination-guide-${slug}`;

  return (
    <section
      aria-label={`Plan and book ${destinationName}`}
      className="border-y border-[#DCE5E3] bg-[#EFF5F3]/60 py-12 lg:py-16"
    >
      <div className="container mx-auto max-w-7xl px-6">
        <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE5E3] bg-white px-3.5 py-1 text-xs font-semibold text-[#0F766E]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Book {destinationName}
            </span>
            <h2 className="font-editorial mt-3 text-2xl font-bold text-slate-900 md:text-3xl">
              Compare Stays, Tours, Flights &amp; Trip Essentials
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Trusted booking partners tailored for {destinationName}, {country}
              .
            </p>
          </div>
          <AffiliateDisclosure
            variant="short"
            className="text-xs text-slate-600"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {validStays.length > 0 && (
            <div className="rounded-2xl border border-[#DCE5E3] bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF5F3] text-[#143D46]">
                  <BedDouble className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Where to Stay</h3>
                  <p className="text-xs text-slate-600">
                    Hotels, boutique stays &amp; hostels in {destinationName}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {validStays.map((link) => (
                  <TrackedAffiliateButton
                    key={`${link.partner}-${link.label}`}
                    label={link.label}
                    variant="subtle"
                    source="destination_guide"
                    placement="destination_stays"
                    campaign={campaign}
                    itemId={`dest-${slug}-stay-${link.partner}`}
                    itemName={link.label}
                    itemType="hotel"
                    affiliateUrl={link.url!}
                    partner={link.partner}
                  />
                ))}
              </div>
            </div>
          )}

          {validActivities.length > 0 && (
            <div className="rounded-2xl border border-[#DCE5E3] bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF5F3] text-[#143D46]">
                  <Compass className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    Tours &amp; Experiences
                  </h3>
                  <p className="text-xs text-slate-600">
                    Guided tours, day trips &amp; skip-the-line tickets
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {validActivities.map((link) => (
                  <TrackedAffiliateButton
                    key={`${link.partner}-${link.label}`}
                    label={link.label}
                    variant="subtle"
                    source="destination_guide"
                    placement="destination_activities"
                    campaign={campaign}
                    itemId={`dest-${slug}-act-${link.partner}`}
                    itemName={link.label}
                    itemType="activity"
                    affiliateUrl={link.url!}
                    partner={link.partner}
                  />
                ))}
              </div>
            </div>
          )}

          {validFlights.length > 0 && (
            <div className="rounded-2xl border border-[#DCE5E3] bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF5F3] text-[#143D46]">
                  <Plane className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Compare Flights</h3>
                  <p className="text-xs text-slate-600">
                    Search routes and fare alerts to {destinationName}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {validFlights.map((link) => (
                  <TrackedAffiliateButton
                    key={`${link.partner}-${link.label}`}
                    label={link.label}
                    variant="subtle"
                    source="destination_guide"
                    placement="destination_flights"
                    campaign={campaign}
                    itemId={`dest-${slug}-flight-${link.partner}`}
                    itemName={link.label}
                    itemType="flight"
                    affiliateUrl={link.url!}
                    partner={link.partner}
                  />
                ))}
              </div>
            </div>
          )}

          {validEssentials.length > 0 && (
            <div className="rounded-2xl border border-[#DCE5E3] bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFF5F3] text-[#143D46]">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Trip Essentials</h3>
                  <p className="text-xs text-slate-600">
                    eSIM data, car rentals, visa check &amp; travel money
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {validEssentials.map((entry) => (
                  <TrackedAffiliateButton
                    key={`${entry.key}-${entry.link.partner}`}
                    label={entry.link.label}
                    variant="subtle"
                    source="destination_guide"
                    placement="destination_essentials"
                    campaign={campaign}
                    itemId={`dest-${slug}-${entry.key}-${entry.link.partner}`}
                    itemName={entry.link.label}
                    itemType={itemTypeForAffiliatePartner(entry.link.partner)}
                    affiliateUrl={entry.link.url!}
                    partner={entry.link.partner}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6">
          <AffiliateDisclosure
            variant="full"
            className="text-xs text-slate-600"
          />
        </div>
      </div>
    </section>
  );
}
