"use client";

import React from "react";
import Link from "next/link";
import {
  BedDouble,
  Compass,
  CreditCard,
  Plane,
  ShieldCheck,
  Sparkles,
  Wifi,
} from "lucide-react";
import {
  isAllowedAffiliateUrl,
  itemTypeForAffiliatePartner,
} from "@faroway/constants";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";
import { AffiliateDisclosure } from "@/components/affiliates/AffiliateDisclosure";
import { TrackedAffiliateButton } from "@/components/affiliates/TrackedAffiliateButton";

export interface BlogEssentialEntry {
  key: "insurance" | "esim" | "carRental" | "visa" | "fx";
  title: string;
  link: AffiliateLinkResult;
}

export interface BlogAffiliateSectionProps {
  postSlug: string;
  destinationLabel?: string;
  plannerHref: string;
  isFinancialContent: boolean;
  stays: AffiliateLinkResult[];
  activities: AffiliateLinkResult[];
  flights: AffiliateLinkResult[];
  essentials: BlogEssentialEntry[];
  financialLinks?: {
    fx: AffiliateLinkResult | null;
    insurance: AffiliateLinkResult | null;
  };
}

function keepValidLinks(links: AffiliateLinkResult[]): AffiliateLinkResult[] {
  return links.filter((link): link is AffiliateLinkResult & { url: string } =>
    Boolean(link.url && isAllowedAffiliateUrl(link.url)),
  );
}

export function BlogAffiliateSection({
  postSlug,
  destinationLabel,
  plannerHref,
  isFinancialContent,
  stays,
  activities,
  flights,
  essentials,
  financialLinks,
}: BlogAffiliateSectionProps) {
  const validStays = keepValidLinks(stays);
  const validActivities = keepValidLinks(activities);
  const validFlights = keepValidLinks(flights);
  const validEssentials = essentials.filter(
    (
      item,
    ): item is BlogEssentialEntry & {
      link: AffiliateLinkResult & { url: string };
    } => Boolean(item.link.url && isAllowedAffiliateUrl(item.link.url)),
  );
  const validFx =
    financialLinks?.fx?.url && isAllowedAffiliateUrl(financialLinks.fx.url)
      ? financialLinks.fx
      : null;
  const validInsurance =
    financialLinks?.insurance?.url &&
    isAllowedAffiliateUrl(financialLinks.insurance.url)
      ? financialLinks.insurance
      : null;

  const hasContextCards =
    validStays.length > 0 ||
    validActivities.length > 0 ||
    validFlights.length > 0 ||
    validEssentials.length > 0;
  const hasFinancialBlock =
    isFinancialContent && Boolean(validFx || validInsurance);

  if (!hasContextCards && !hasFinancialBlock) {
    return null;
  }

  const campaign = `blog-${postSlug}`;

  return (
    <section
      aria-label="Travel booking and essentials"
      className="my-12 space-y-6"
    >
      {hasFinancialBlock && (
        <div className="rounded-2xl border border-[#DCE5E3] bg-[#EFF5F3] p-6 md:p-8">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#143D46] text-white">
              <CreditCard className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#0F766E]">
                Travel Money &amp; Coverage
              </p>
              <h2 className="font-editorial mt-1 text-2xl font-bold text-slate-900">
                Smart Financial Essentials for Your Trip
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Compare low-fee multi-currency spending and travel medical
                protection alongside the tips in this guide.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                {validFx && validFx.url && (
                  <TrackedAffiliateButton
                    label={validFx.label}
                    variant="primary"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
                    source="blog"
                    placement="blog_financial_block"
                    campaign={campaign}
                    itemId={`blog-${postSlug}-wise-fx`}
                    itemName={validFx.label}
                    itemType={itemTypeForAffiliatePartner(validFx.partner)}
                    affiliateUrl={validFx.url}
                    partner={validFx.partner}
                  />
                )}
                {validInsurance && validInsurance.url && (
                  <TrackedAffiliateButton
                    label={validInsurance.label}
                    variant="secondary"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#143D46] bg-white px-5 py-2.5 text-sm font-semibold text-[#143D46] transition-colors hover:bg-[#FAF8F3]"
                    source="blog"
                    placement="blog_financial_block"
                    campaign={campaign}
                    itemId={`blog-${postSlug}-safetywing`}
                    itemName={validInsurance.label}
                    itemType={itemTypeForAffiliatePartner(
                      validInsurance.partner,
                    )}
                    affiliateUrl={validInsurance.url}
                    partner={validInsurance.partner}
                  />
                )}
              </div>

              <div className="mt-4 space-y-2 border-t border-[#DCE5E3] pt-3">
                <AffiliateDisclosure
                  variant="full"
                  className="text-xs leading-relaxed text-slate-600"
                />
                <p className="text-xs leading-relaxed text-slate-700">
                  Editorial disclosure: Financial rates, card terms, FX fees,
                  and insurance coverage vary by country and change over time.
                  Verify current terms directly with the provider before
                  applying or purchasing.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasContextCards && (
        <div className="rounded-2xl border border-[#DCE5E3] bg-[#FAF8F3] p-6 md:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-[#DCE5E3] pb-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#0F766E]">
                {destinationLabel
                  ? `Plan ${destinationLabel}`
                  : "Traveler Toolkit"}
              </p>
              <h2 className="font-editorial mt-1 text-2xl font-bold text-slate-900">
                {destinationLabel
                  ? `Book ${destinationLabel} Stays, Flights & Essentials`
                  : "Flights & Trip Essentials for Your Next Trip"}
              </h2>
            </div>
            <Link
              href={plannerHref}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#143D46] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0E2C33]"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Plan this trip with Faroway
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {validStays.length > 0 && (
              <div className="rounded-xl border border-[#DCE5E3] bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#143D46]">
                  <BedDouble
                    className="h-4 w-4 text-[#C03A31]"
                    aria-hidden="true"
                  />
                  <span>Where to Stay</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {validStays.map((link) => (
                    <TrackedAffiliateButton
                      key={`${link.partner}-${link.label}`}
                      label={link.label}
                      variant="subtle"
                      source="blog"
                      placement="blog_post_context"
                      campaign={campaign}
                      itemId={`blog-${postSlug}-stay-${link.partner}`}
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
              <div className="rounded-xl border border-[#DCE5E3] bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#143D46]">
                  <Compass
                    className="h-4 w-4 text-[#C03A31]"
                    aria-hidden="true"
                  />
                  <span>Tours &amp; Experiences</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {validActivities.map((link) => (
                    <TrackedAffiliateButton
                      key={`${link.partner}-${link.label}`}
                      label={link.label}
                      variant="subtle"
                      source="blog"
                      placement="blog_post_context"
                      campaign={campaign}
                      itemId={`blog-${postSlug}-act-${link.partner}`}
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
              <div className="rounded-xl border border-[#DCE5E3] bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#143D46]">
                  <Plane
                    className="h-4 w-4 text-[#C03A31]"
                    aria-hidden="true"
                  />
                  <span>Compare Flights</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {validFlights.map((link) => (
                    <TrackedAffiliateButton
                      key={`${link.partner}-${link.label}`}
                      label={link.label}
                      variant="subtle"
                      source="blog"
                      placement="blog_post_context"
                      campaign={campaign}
                      itemId={`blog-${postSlug}-flight-${link.partner}`}
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
              <div className="rounded-xl border border-[#DCE5E3] bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#143D46]">
                  {validEssentials.some((e) => e.key === "insurance") ? (
                    <ShieldCheck
                      className="h-4 w-4 text-[#C03A31]"
                      aria-hidden="true"
                    />
                  ) : (
                    <Wifi
                      className="h-4 w-4 text-[#C03A31]"
                      aria-hidden="true"
                    />
                  )}
                  <span>Trip Essentials</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {validEssentials.map((entry) => (
                    <TrackedAffiliateButton
                      key={`${entry.key}-${entry.link.partner}`}
                      label={entry.link.label}
                      variant="subtle"
                      source="blog"
                      placement="blog_post_context"
                      campaign={campaign}
                      itemId={`blog-${postSlug}-${entry.key}-${entry.link.partner}`}
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

          <div className="mt-5 border-t border-[#DCE5E3] pt-3">
            <AffiliateDisclosure
              variant="full"
              className="text-xs leading-relaxed text-slate-600"
            />
          </div>
        </div>
      )}
    </section>
  );
}
