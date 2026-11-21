import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ChevronRight,
  Coins,
  DollarSign,
  Gem,
  Info,
  Wallet,
} from "lucide-react";
import { BUDGET_RANGES, isAllowedAffiliateUrl } from "@faroway/constants";
import { getGuideBySlug, getGuideSlugs } from "@/lib/destination-guides";
import { getCostLevel, getCostProfile } from "@/lib/tools/cost-data";
import { buildHotelPartnerLinks } from "@/lib/affiliates/hotels";
import { buildFlightFallbackLinks } from "@/lib/affiliates/flights";
import { buildWiseUrl } from "@/lib/affiliates/essentials";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";
import { ToolCTA } from "@/components/tools/ToolCTA";
import { RelatedTools } from "@/components/tools/RelatedTools";
import {
  ToolAffiliateCard,
  type ToolAffiliateAction,
} from "@/components/tools/ToolAffiliateCard";

export function generateStaticParams() {
  return getGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dest = getGuideBySlug(slug);
  const cost = getCostProfile(slug);
  if (!dest || !cost) return {};

  const level = getCostLevel(cost.costMultiplier);
  return {
    title: `How Much Does a Trip to ${dest.name} Cost? — Budget Guide`,
    description: `Plan your ${dest.name} budget: ${level} destination. Daily costs from $${Math.round(BUDGET_RANGES.budget.daily * cost.costMultiplier)} (budget) to $${Math.round(BUDGET_RANGES.luxury.daily * cost.costMultiplier)} (luxury). Currency: ${cost.currency}. Sample prices and detailed breakdowns.`,
    alternates: { canonical: `/tools/trip-cost/${slug}` },
    openGraph: {
      title: `Trip Cost: ${dest.name} | Faroway`,
      description: `${dest.name} travel costs — ${level}. Budget from $${Math.round(BUDGET_RANGES.budget.daily * cost.costMultiplier)}/day.`,
      url: `/tools/trip-cost/${slug}`,
      images: [
        { url: dest.heroImage, width: 1920, height: 1080, alt: dest.name },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Trip Cost: ${dest.name} | Faroway`,
      description: `${dest.name} travel costs — ${level}. Budget from $${Math.round(BUDGET_RANGES.budget.daily * cost.costMultiplier)}/day.`,
      images: [dest.heroImage],
    },
  };
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  accommodation: { label: "Accommodation", color: "bg-primary-700" },
  food: { label: "Food & Dining", color: "bg-amber-600" },
  transport: { label: "Transport", color: "bg-[#143D46]" },
  activities: { label: "Activities", color: "bg-violet-700" },
  misc: { label: "Miscellaneous", color: "bg-slate-500" },
};

const COST_LEVEL_STYLES: Record<string, { bg: string; text: string }> = {
  "Budget-Friendly": { bg: "bg-emerald-50", text: "text-emerald-800" },
  Moderate: { bg: "bg-amber-50", text: "text-amber-800" },
  "Above Average": { bg: "bg-orange-50", text: "text-orange-800" },
  Expensive: { bg: "bg-red-50", text: "text-red-800" },
};

export default async function TripCostDestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dest = getGuideBySlug(slug);
  const cost = getCostProfile(slug);
  if (!dest || !cost) notFound();

  const level = getCostLevel(cost.costMultiplier);
  const levelStyle = COST_LEVEL_STYLES[level] ?? {
    bg: "bg-slate-50",
    text: "text-slate-700",
  };

  const budgetDaily = Math.round(
    BUDGET_RANGES.budget.daily * cost.costMultiplier,
  );
  const moderateDaily = Math.round(
    BUDGET_RANGES.moderate.daily * cost.costMultiplier,
  );
  const luxuryDaily = Math.round(
    BUDGET_RANGES.luxury.daily * cost.costMultiplier,
  );

  const trackingId = `tool-trip-cost-${slug}`;
  const hotelResult = buildHotelPartnerLinks({
    destination: `${dest.name}, ${dest.country}`,
    adults: 2,
    budgetTier: level === "Budget-Friendly" ? "budget" : "moderate",
    campaign: trackingId,
  });
  const stays = [hotelResult.primary, ...hotelResult.alternatives]
    .filter((l): l is AffiliateLinkResult => Boolean(l?.url))
    .slice(0, 2);
  const flights = buildFlightFallbackLinks({
    destinationCity: dest.name,
    departureDate: "",
    adults: 2,
    trackingId,
  });
  const wiseLink = buildWiseUrl({
    sourceCurrency: "USD",
    targetCurrency: cost.currency,
    destination: dest.country,
  });

  const affiliateActions: ToolAffiliateAction[] = [
    ...stays
      .filter((s) => s.url && isAllowedAffiliateUrl(s.url))
      .map((s) => ({
        key: `${trackingId}-stay-${s.partner}`,
        link: s,
        itemType: "hotel" as const,
      })),
    ...flights
      .filter((f) => f.url && isAllowedAffiliateUrl(f.url))
      .slice(0, 1)
      .map((f) => ({
        key: `${trackingId}-flight-${f.partner}`,
        link: f,
        itemType: "flight" as const,
      })),
    ...(wiseLink.url && isAllowedAffiliateUrl(wiseLink.url)
      ? [
          {
            key: `${trackingId}-wise-fx`,
            link: wiseLink,
            itemType: "activity" as const,
          },
        ]
      : []),
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Tools",
        item: "https://www.faroway.ai/tools",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Trip Cost",
        item: "https://www.faroway.ai/tools/trip-cost",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: dest.name,
        item: `https://www.faroway.ai/tools/trip-cost/${slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <main className="min-h-screen">
        {/* Hero */}
        <section className="pt-28 lg:pt-32 pb-12 lg:pb-16">
          <div className="max-w-7xl mx-auto px-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-slate-600 mb-6">
              <Link
                href="/tools/trip-cost"
                className="hover:text-primary-700 transition-colors"
              >
                Trip Cost Estimator
              </Link>
              <ChevronRight className="w-3 h-3" aria-hidden="true" />
              <span className="text-slate-900 font-medium">{dest.name}</span>
            </nav>

            <span className="inline-block px-4 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-800 text-sm font-semibold mb-4">
              {dest.continent}
            </span>
            <h1 className="font-editorial text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              How Much Does a Trip to{" "}
              <span className="text-[#C03A31]">{dest.name}</span> Cost?
            </h1>
            <p className="text-lg text-slate-600 max-w-3xl leading-relaxed">
              {dest.name} is a
              {level === "Above Average" || level === "Expensive" ? "n" : ""}{" "}
              <span
                className={`inline-block px-2 py-0.5 rounded-md ${levelStyle.bg} ${levelStyle.text} font-semibold text-base`}
              >
                {level}
              </span>{" "}
              destination. Daily costs range from ${budgetDaily} for budget
              travelers to ${luxuryDaily} for luxury experiences. The local
              currency is {cost.currency} ({cost.currencySymbol}).
            </p>
          </div>
        </section>

        {/* Cost overview cards */}
        <section className="bg-gradient-to-br from-[#FAF8F3] via-white to-[#EFF5F3] border-y border-[#DCE5E3] py-10">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="font-editorial text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <DollarSign
                className="w-5 h-5 text-primary-700"
                aria-hidden="true"
              />
              Daily Cost Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  tier: "Budget",
                  daily: budgetDaily,
                  icon: Wallet,
                  color: "border-emerald-200",
                  badge: "bg-emerald-50 text-emerald-800",
                },
                {
                  tier: "Mid-Range",
                  daily: moderateDaily,
                  icon: Coins,
                  color: "border-amber-200",
                  badge: "bg-amber-50 text-amber-800",
                },
                {
                  tier: "Luxury",
                  daily: luxuryDaily,
                  icon: Gem,
                  color: "border-violet-200",
                  badge: "bg-violet-50 text-violet-800",
                },
              ].map(({ tier, daily, icon: Icon, color, badge }) => (
                <div
                  key={tier}
                  className={`p-6 rounded-2xl bg-white border ${color} shadow-sm`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${badge}`}
                    >
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      {tier}
                    </span>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 mb-1">
                    ${daily}
                    <span className="text-base font-normal text-slate-600">
                      /day
                    </span>
                  </p>
                  <p className="text-sm text-slate-600">
                    ~${daily * 5} for a 5-day trip
                  </p>
                </div>
              ))}
            </div>

            {affiliateActions.length > 0 && (
              <div className="mt-6">
                <ToolAffiliateCard
                  title={`Check live stays, flights & ${cost.currency} rates for ${dest.name}`}
                  subtitle="Compare hotel rates, airfare, and low-fee currency exchange before booking."
                  placement="trip_cost_guide"
                  campaign={trackingId}
                  actions={affiliateActions}
                  editorialNote="Exchange rates and card terms change over time; verify current pricing directly with Wise before transferring."
                  className="bg-white"
                />
              </div>
            )}
          </div>
        </section>

        {/* Budget breakdown */}
        <section className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <h2 className="font-editorial text-2xl font-bold text-slate-900 mb-8">
            Where Your Money Goes
          </h2>
          <div className="space-y-4">
            {Object.entries(cost.breakdown).map(([key, pct]) => {
              const meta = CATEGORY_LABELS[key];
              if (!meta) return null;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      {meta.label}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {pct}%
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-100">
                    <div
                      className={`h-3 rounded-full ${meta.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Sample prices */}
        <section className="bg-[#FAF8F3] border-y border-[#DCE5E3] py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="font-editorial text-2xl font-bold text-slate-900 mb-8">
              Sample Prices in {dest.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {cost.samplePrices.map((sp) => (
                <div
                  key={sp.item}
                  className="flex items-center justify-between p-4 rounded-xl bg-white border border-[#DCE5E3]"
                >
                  <span className="text-sm text-slate-700">{sp.item}</span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">
                      ${sp.priceUSD}
                    </span>
                    {cost.exchangeRate !== 1 && (
                      <span className="block text-xs text-slate-600">
                        {cost.currencySymbol}
                        {Math.round(
                          sp.priceUSD * cost.exchangeRate,
                        ).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quick facts */}
        <section className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <h2 className="font-editorial text-xl font-bold text-slate-900 mb-6">
            Quick Facts — {dest.name}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Currency",
                value: `${cost.currency} (${cost.currencySymbol})`,
              },
              {
                label: "Exchange Rate",
                value:
                  cost.exchangeRate === 1
                    ? "N/A (USD)"
                    : `1 USD = ${cost.exchangeRate} ${cost.currency}`,
              },
              { label: "Cost Level", value: level },
              {
                label: "Budget Tip",
                value:
                  cost.costMultiplier <= 0.7
                    ? "Eat local — incredible value"
                    : cost.costMultiplier <= 1.0
                      ? "Mix dining out with markets"
                      : "Book early for best hotel deals",
              },
            ].map((fact) => (
              <div
                key={fact.label}
                className="p-4 rounded-xl bg-[#FAF8F3] border border-[#DCE5E3]"
              >
                <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">
                  {fact.label}
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {fact.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive CTA */}
        <section className="max-w-7xl mx-auto px-6 pb-12 lg:pb-16">
          <div className="p-6 md:p-8 rounded-2xl bg-[#EFF5F3] border border-[#DCE5E3]">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Info
                    className="w-5 h-5 text-primary-700"
                    aria-hidden="true"
                  />
                  Want a Custom Estimate?
                </h3>
                <p className="text-sm text-slate-600">
                  Adjust trip length, travel style, and group size in our
                  interactive Trip Cost Calculator.
                </p>
              </div>
              <Link
                href="/tools/trip-cost"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary-700 text-white font-semibold text-sm hover:bg-primary-800 transition-colors shrink-0"
              >
                Try the Calculator{" "}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Cross-links */}
        <section className="max-w-7xl mx-auto px-6 pb-12 lg:pb-16">
          <h2 className="font-editorial text-xl font-bold text-slate-900 mb-4">
            More About {dest.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href={`/destinations/${slug}`}
              className="p-4 rounded-xl border border-[#DCE5E3] bg-white hover:border-primary-700/30 hover:shadow-sm transition-all group"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-primary-700 transition-colors">
                {dest.name} Destination Guide
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Highlights, itineraries &amp; tips
              </p>
            </Link>
            <Link
              href={`/tools/best-time-to-visit/${slug}`}
              className="p-4 rounded-xl border border-[#DCE5E3] bg-white hover:border-primary-700/30 hover:shadow-sm transition-all group"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-primary-700 transition-colors">
                Best Time to Visit {dest.name}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Climate &amp; crowd data by month
              </p>
            </Link>
            <Link
              href={`/tools/visa-checker/${slug}`}
              className="p-4 rounded-xl border border-[#DCE5E3] bg-white hover:border-primary-700/30 hover:shadow-sm transition-all group"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-primary-700 transition-colors">
                Visa Requirements for {dest.name}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Check by passport country
              </p>
            </Link>
          </div>
        </section>

        <ToolCTA
          destination={dest.name}
          title={`Ready for ${dest.name}?`}
          description={`Let Faroway create your personalized ${dest.name} itinerary at your own pace.`}
        />
        <RelatedTools currentSlug="trip-cost" />
      </main>
    </>
  );
}
