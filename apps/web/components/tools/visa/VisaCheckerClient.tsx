"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, Clock, Info, Shield } from "lucide-react";
import { isAllowedAffiliateUrl } from "@faroway/constants";
import { getAllGuides } from "@/lib/destination-guides";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";
import {
  getVisaInfo,
  passportCountries,
  visaStatusConfig,
  type VisaStatus,
} from "@/lib/tools/visa-data";
import { ToolHero } from "@/components/tools/ToolHero";
import {
  ToolAffiliateCard,
  type ToolAffiliateAction,
} from "@/components/tools/ToolAffiliateCard";

const guides = getAllGuides();

const STATUS_ICONS: Record<VisaStatus, typeof Shield> = {
  "visa-free": Shield,
  "visa-on-arrival": Clock,
  "e-visa": Info,
  "visa-required": AlertTriangle,
};

export interface VisaCheckerClientProps {
  visaLinksByDest?: Record<string, AffiliateLinkResult>;
  insuranceLinksByDest?: Record<string, AffiliateLinkResult>;
}

function enrichIvisaNationality(
  link: AffiliateLinkResult | undefined,
  passportName: string,
): AffiliateLinkResult | null {
  if (!link?.url || !isAllowedAffiliateUrl(link.url)) return null;
  try {
    const parsed = new URL(link.url);
    if (parsed.hostname.toLowerCase() === "www.ivisa.com") {
      parsed.searchParams.set("nationality", passportName);
      const nextUrl = parsed.toString();
      if (isAllowedAffiliateUrl(nextUrl)) {
        return { ...link, url: nextUrl };
      }
    }
  } catch {
    return link;
  }
  return link;
}

export function VisaCheckerClient({
  visaLinksByDest,
  insuranceLinksByDest,
}: VisaCheckerClientProps = {}) {
  const [passportCode, setPassportCode] = useState("");
  const [destinationSlug, setDestinationSlug] = useState("");

  const visaInfo =
    passportCode && destinationSlug
      ? getVisaInfo(passportCode, destinationSlug)
      : null;

  const destination = guides.find((g) => g.slug === destinationSlug);
  const passport = passportCountries.find((p) => p.code === passportCode);

  const actions: ToolAffiliateAction[] = [];
  if (destination && passport) {
    const visaLink = enrichIvisaNationality(
      visaLinksByDest?.[destination.slug],
      passport.name,
    );
    if (visaLink?.url) {
      actions.push({
        key: `tool-visa-${destination.slug}-${visaLink.partner}`,
        link: visaLink,
        itemType: "activity",
      });
    }
    const insLink = insuranceLinksByDest?.[destination.slug];
    if (insLink?.url && isAllowedAffiliateUrl(insLink.url)) {
      actions.push({
        key: `tool-visa-${destination.slug}-insurance-${insLink.partner}`,
        link: insLink,
        itemType: "activity",
      });
    }
  }

  return (
    <div>
      <ToolHero
        badge="Free Tool"
        title="Visa Checker"
        gradientWord="Visa"
        description="Check general visa guidance for 40+ popular destinations based on your passport country. Always verify requirements with an official authority before travel."
      />

      <section className="max-w-xl mx-auto px-6 pb-16">
        {/* Passport Country */}
        <div className="mb-6">
          <label
            htmlFor="visa-passport"
            className="block text-sm font-semibold text-slate-900 mb-3"
          >
            Your Passport
          </label>
          <select
            id="visa-passport"
            value={passportCode}
            onChange={(e) => setPassportCode(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700"
          >
            <option value="">Select your passport country</option>
            {passportCountries.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>

        {/* Destination */}
        <div className="mb-8">
          <label
            htmlFor="visa-destination"
            className="block text-sm font-semibold text-slate-900 mb-3"
          >
            Destination
          </label>
          <select
            id="visa-destination"
            value={destinationSlug}
            onChange={(e) => setDestinationSlug(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700"
          >
            <option value="">Select a destination</option>
            {guides.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}, {g.country}
              </option>
            ))}
          </select>
        </div>

        {/* Result Card */}
        {visaInfo && destination && passport && (
          <div
            role="status"
            aria-live="polite"
            className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-5"
          >
            <div
              className={`rounded-2xl border-2 ${visaStatusConfig[visaInfo.status].border} ${visaStatusConfig[visaInfo.status].bg} p-6`}
            >
              {/* Status Badge */}
              <div className="flex items-center gap-3 mb-4">
                {(() => {
                  const StatusIcon = STATUS_ICONS[visaInfo.status];
                  return (
                    <div
                      className={`w-12 h-12 rounded-xl ${visaStatusConfig[visaInfo.status].bg} border ${visaStatusConfig[visaInfo.status].border} flex items-center justify-center`}
                    >
                      <StatusIcon
                        className={`w-6 h-6 ${visaStatusConfig[visaInfo.status].color}`}
                        aria-hidden="true"
                      />
                    </div>
                  );
                })()}
                <div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${visaStatusConfig[visaInfo.status].color} ${visaStatusConfig[visaInfo.status].bg} border ${visaStatusConfig[visaInfo.status].border}`}
                  >
                    {visaStatusConfig[visaInfo.status].label}
                  </span>
                </div>
              </div>

              {/* Details */}
              <h2 className="text-lg font-bold text-slate-900 mb-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded bg-white/90 border border-[#DCE5E3] px-2 py-0.5 font-mono text-xs font-bold text-[#143D46]">
                  {passport.code}
                </span>
                <span>{passport.name}</span>
                <ArrowRight
                  className="w-4 h-4 text-[#C03A31]"
                  aria-hidden="true"
                />
                <span>{destination.name}</span>
              </h2>

              <div className="space-y-3 mt-4">
                <div className="flex items-start gap-3">
                  <Clock
                    className="w-4 h-4 text-slate-600 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      Stay Duration
                    </p>
                    <p className="text-sm text-slate-600">
                      {visaInfo.duration}
                    </p>
                  </div>
                </div>

                {visaInfo.notes && (
                  <div className="flex items-start gap-3">
                    <Info
                      className="w-4 h-4 text-slate-600 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Notes
                      </p>
                      <p className="text-sm text-slate-600">{visaInfo.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {actions.length > 0 && (
              <ToolAffiliateCard
                title={`Prepare entry & protection for ${destination.name}`}
                subtitle={`Verify official ${destination.country} entry rules or add travel medical coverage.`}
                placement="visa_checker_result"
                campaign="tool-visa-checker"
                actions={actions}
              />
            )}

            {/* Disclaimer */}
            <div className="rounded-xl bg-[#FAF8F3] border border-[#DCE5E3] p-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>Disclaimer:</strong> Visa requirements change
                frequently. Always verify with your country&apos;s embassy or
                the destination&apos;s immigration authority before traveling.
                This tool provides general guidance only and should not be
                relied upon as legal advice.
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!passportCode || !destinationSlug) && (
          <div className="text-center py-12 rounded-2xl border-2 border-dashed border-[#DCE5E3] bg-white">
            <Shield
              className="w-12 h-12 text-[#143D46]/40 mx-auto mb-3"
              aria-hidden="true"
            />
            <p className="text-sm text-slate-600">
              Select your passport and destination to check visa requirements
            </p>
          </div>
        )}

        {passportCode && destinationSlug && !visaInfo && (
          <div
            role="status"
            className="rounded-2xl border border-[#DCE5E3] bg-white p-6 text-center"
          >
            <h2 className="font-semibold text-slate-900">
              Guidance unavailable
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              We do not have guidance for this combination yet. Check the
              destination&apos;s official immigration authority before travel.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
