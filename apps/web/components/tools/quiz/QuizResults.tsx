"use client";

import Image from "next/image";
import Link from "next/link";
import { RotateCcw, Sparkles } from "lucide-react";
import {
  isAllowedAffiliateUrl,
  itemTypeForAffiliatePartner,
} from "@faroway/constants";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";
import type { QuizResult } from "@/lib/tools/quiz-scoring";
import { AffiliateDisclosure } from "@/components/affiliates/AffiliateDisclosure";
import { TrackedAffiliateButton } from "@/components/affiliates/TrackedAffiliateButton";

export interface QuizAffiliateBundle {
  stay: AffiliateLinkResult | null;
  activity: AffiliateLinkResult | null;
  esim: AffiliateLinkResult | null;
  insurance: AffiliateLinkResult | null;
}

interface QuizResultsProps {
  results: QuizResult[];
  onRestart: () => void;
  affiliateBundlesBySlug?: Record<string, QuizAffiliateBundle>;
}

const RANK_COLORS = [
  "bg-[#143D46] text-white",
  "bg-primary-700 text-white",
  "bg-slate-800 text-white",
];

const RANK_LABELS = ["Best Match", "2nd Match", "3rd Match"];

export function QuizResults({
  results,
  onRestart,
  affiliateBundlesBySlug,
}: QuizResultsProps) {
  let hasAnyAffiliate = false;

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-10">
        <h1
          tabIndex={-1}
          className="font-editorial text-3xl md:text-4xl font-bold text-slate-900 mb-3"
        >
          Your Perfect <span className="text-[#C03A31]">Destinations</span>
        </h1>
        <p className="text-slate-600 text-lg">
          Based on your travel style, here are your top matches
        </p>
      </div>

      <div className="space-y-6">
        {results.map((result, i) => {
          const slug = result.destination.slug;
          const bundle = affiliateBundlesBySlug?.[slug];
          const validStay =
            bundle?.stay?.url && isAllowedAffiliateUrl(bundle.stay.url)
              ? bundle.stay
              : null;
          const validActivity =
            bundle?.activity?.url && isAllowedAffiliateUrl(bundle.activity.url)
              ? bundle.activity
              : null;
          const validEsim =
            bundle?.esim?.url && isAllowedAffiliateUrl(bundle.esim.url)
              ? bundle.esim
              : null;
          const validInsurance =
            bundle?.insurance?.url &&
            isAllowedAffiliateUrl(bundle.insurance.url)
              ? bundle.insurance
              : null;

          if (validStay || validActivity || validEsim || validInsurance) {
            hasAnyAffiliate = true;
          }

          const placement = `quiz_result_rank_${i + 1}`;
          const campaign = `tool-travel-quiz-${slug}`;

          return (
            <div
              key={slug}
              className="group relative overflow-hidden rounded-2xl border border-[#DCE5E3] bg-white shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex flex-col md:flex-row">
                {/* Image */}
                <div className="relative w-full md:w-64 h-48 md:h-auto flex-shrink-0">
                  <Image
                    src={result.destination.cardImage}
                    alt={result.destination.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 256px"
                  />
                  <div
                    className={`absolute top-3 left-3 px-3 py-1 rounded-full ${RANK_COLORS[i] ?? "bg-[#143D46] text-white"} text-xs font-bold shadow-lg`}
                  >
                    {RANK_LABELS[i]}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h2 className="font-editorial text-xl font-bold text-slate-900">
                        {result.destination.name}
                      </h2>
                      <p className="text-sm text-slate-600">
                        {result.destination.country}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary-700">
                        {result.matchPercent}%
                      </div>
                      <p className="text-xs text-slate-600">match</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                    {result.destination.tagline}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {result.matchReasons.map((reason) => (
                      <span
                        key={reason}
                        className="px-2.5 py-1 rounded-full bg-[#EFF5F3] text-[#143D46] text-xs font-semibold"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                      href={`/create?destination=${encodeURIComponent(result.destination.name)}`}
                      className="inline-flex items-center gap-2 bg-[#143D46] hover:bg-[#0E2C33] text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5"
                    >
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                      Plan My {result.destination.name} Trip
                    </Link>

                    {validStay?.url && (
                      <TrackedAffiliateButton
                        label={validStay.label}
                        variant="subtle"
                        source="tool"
                        placement={placement}
                        campaign={campaign}
                        itemId={`quiz-${slug}-stay-${validStay.partner}`}
                        itemName={validStay.label}
                        itemType="hotel"
                        affiliateUrl={validStay.url}
                        partner={validStay.partner}
                      />
                    )}
                    {validActivity?.url && (
                      <TrackedAffiliateButton
                        label={validActivity.label}
                        variant="subtle"
                        source="tool"
                        placement={placement}
                        campaign={campaign}
                        itemId={`quiz-${slug}-act-${validActivity.partner}`}
                        itemName={validActivity.label}
                        itemType="activity"
                        affiliateUrl={validActivity.url}
                        partner={validActivity.partner}
                      />
                    )}
                    {validEsim?.url && (
                      <TrackedAffiliateButton
                        label={validEsim.label}
                        variant="subtle"
                        source="tool"
                        placement={placement}
                        campaign={campaign}
                        itemId={`quiz-${slug}-esim-${validEsim.partner}`}
                        itemName={validEsim.label}
                        itemType={itemTypeForAffiliatePartner(
                          validEsim.partner,
                        )}
                        affiliateUrl={validEsim.url}
                        partner={validEsim.partner}
                      />
                    )}
                    {validInsurance?.url && (
                      <TrackedAffiliateButton
                        label={validInsurance.label}
                        variant="subtle"
                        source="tool"
                        placement={placement}
                        campaign={campaign}
                        itemId={`quiz-${slug}-ins-${validInsurance.partner}`}
                        itemName={validInsurance.label}
                        itemType={itemTypeForAffiliatePartner(
                          validInsurance.partner,
                        )}
                        affiliateUrl={validInsurance.url}
                        partner={validInsurance.partner}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasAnyAffiliate && (
        <div className="mt-6 text-center">
          <AffiliateDisclosure
            variant="short"
            className="text-xs text-slate-600"
          />
        </div>
      )}

      <div className="text-center mt-8">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          Retake Quiz
        </button>
      </div>
    </div>
  );
}
