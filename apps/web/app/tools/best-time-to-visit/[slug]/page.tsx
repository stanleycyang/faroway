import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar,
  ChevronRight,
  Droplets,
  Minus,
  Plus,
  ThermometerSun,
  Users,
} from "lucide-react";
import { isAllowedAffiliateUrl } from "@faroway/constants";
import { getGuideBySlug, getGuideSlugs } from "@/lib/destination-guides";
import { getClimateData } from "@/lib/tools/climate-data";
import { buildHotelPartnerLinks } from "@/lib/affiliates/hotels";
import { buildFlightFallbackLinks } from "@/lib/affiliates/flights";
import { buildActivityFallbackLinks } from "@/lib/affiliates/activities";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";
import { MonthlyClimateChart } from "@/components/tools/best-time/MonthlyClimateChart";
import { MonthlyGrid } from "@/components/tools/best-time/MonthlyGrid";
import { ToolCTA } from "@/components/tools/ToolCTA";
import { RelatedTools } from "@/components/tools/RelatedTools";
import {
  ToolAffiliateCard,
  type ToolAffiliateAction,
} from "@/components/tools/ToolAffiliateCard";

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function getNextUpcomingBestWindow(bestMonthLabel: string | undefined): {
  checkIn: string;
  checkOut: string;
} {
  const now = new Date();
  const key = bestMonthLabel?.trim().slice(0, 3).toLowerCase() ?? "";
  const targetMonth = Object.hasOwn(MONTH_INDEX, key)
    ? MONTH_INDEX[key]
    : (now.getUTCMonth() + 1) % 12;

  let year = now.getUTCFullYear();
  if (
    targetMonth < now.getUTCMonth() ||
    (targetMonth === now.getUTCMonth() && now.getUTCDate() > 8)
  ) {
    year += 1;
  }

  const start = new Date(Date.UTC(year, targetMonth, 10));
  const end = new Date(Date.UTC(year, targetMonth, 17));
  return {
    checkIn: start.toISOString().slice(0, 10),
    checkOut: end.toISOString().slice(0, 10),
  };
}

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
  const climate = getClimateData(slug);
  if (!dest || !climate) return {};

  return {
    title: `Best Time to Visit ${dest.name} — Monthly Guide`,
    description: `Find the best month to visit ${dest.name}, ${dest.country}. Monthly temperature, rainfall, crowd levels, events, and tips. Best months: ${climate.bestMonths.join(", ")}.`,
    alternates: { canonical: `/tools/best-time-to-visit/${slug}` },
    openGraph: {
      title: `Best Time to Visit ${dest.name} | Faroway`,
      description: `Climate data & travel tips for ${dest.name}. Best months: ${climate.bestMonths.join(", ")}.`,
      url: `/tools/best-time-to-visit/${slug}`,
      images: [
        { url: dest.heroImage, width: 1920, height: 1080, alt: dest.name },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Best Time to Visit ${dest.name} | Faroway`,
      description: `Climate data & travel tips for ${dest.name}. Best months: ${climate.bestMonths.join(", ")}.`,
      images: [dest.heroImage],
    },
  };
}

export default async function BestTimeDestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dest = getGuideBySlug(slug);
  const climate = getClimateData(slug);
  if (!dest || !climate) notFound();

  const bestMonthsData = climate.months.filter((m) =>
    climate.bestMonths.includes(m.month),
  );
  const peakMonths = climate.months.filter((m) => m.season === "peak");
  const shoulderMonths = climate.months.filter((m) => m.season === "shoulder");
  const offMonths = climate.months.filter((m) => m.season === "off");

  const trackingId = `tool-best-time-${slug}`;
  const bestMonthName = climate.bestMonths[0];
  const { checkIn, checkOut } = getNextUpcomingBestWindow(bestMonthName);
  const hotelResult = buildHotelPartnerLinks({
    destination: `${dest.name}, ${dest.country}`,
    checkIn,
    checkOut,
    adults: 2,
    campaign: trackingId,
  });
  const stays = [hotelResult.primary, ...hotelResult.alternatives]
    .filter((l): l is AffiliateLinkResult => Boolean(l?.url))
    .slice(0, 2);
  const flights = buildFlightFallbackLinks({
    destinationCity: dest.name,
    departureDate: checkIn,
    returnDate: checkOut,
    adults: 2,
    trackingId,
  });
  const activities = buildActivityFallbackLinks({
    destination: dest.name,
    date: checkIn,
    endDate: checkOut,
    trackingId,
  }).slice(0, 2);

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
    ...activities
      .filter((a) => a.url && isAllowedAffiliateUrl(a.url))
      .slice(0, 1)
      .map((a) => ({
        key: `${trackingId}-act-${a.partner}`,
        link: a,
        itemType: "activity" as const,
      })),
  ];

  // JSON-LD
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
        name: "Best Time to Visit",
        item: "https://www.faroway.ai/tools/best-time-to-visit",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: dest.name,
        item: `https://www.faroway.ai/tools/best-time-to-visit/${slug}`,
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
                href="/tools/best-time-to-visit"
                className="hover:text-primary-700 transition-colors"
              >
                Best Time to Visit
              </Link>
              <ChevronRight className="w-3 h-3" aria-hidden="true" />
              <span className="text-slate-900 font-medium">{dest.name}</span>
            </nav>

            <span className="inline-block px-4 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-800 text-sm font-semibold mb-4">
              {dest.continent}
            </span>
            <h1 className="font-editorial text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Best Time to Visit{" "}
              <span className="text-[#C03A31]">{dest.name}</span>
            </h1>
            <p className="text-lg text-slate-600 max-w-3xl leading-relaxed">
              {climate.summary}
            </p>
          </div>
        </section>

        {/* Best months highlight */}
        <section className="bg-gradient-to-br from-[#FAF8F3] via-white to-[#EFF5F3] border-y border-[#DCE5E3] py-10">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center gap-3 mb-6">
              <Calendar
                className="w-5 h-5 text-primary-700"
                aria-hidden="true"
              />
              <h2 className="font-editorial text-xl font-bold text-slate-900">
                Best Months to Visit
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {bestMonthsData.map((m) => (
                <div
                  key={m.month}
                  className="px-5 py-3 rounded-xl bg-white border border-[#DCE5E3] shadow-sm"
                >
                  <p className="text-sm font-bold text-slate-900">{m.month}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-600 flex items-center gap-1">
                      <ThermometerSun className="w-3 h-3" aria-hidden="true" />
                      {m.avgTempC}°C
                    </span>
                    <span className="text-xs text-slate-600 flex items-center gap-1">
                      <Droplets className="w-3 h-3" aria-hidden="true" />
                      {m.rainfallMm}mm
                    </span>
                    <span className="text-xs text-slate-600 flex items-center gap-1">
                      <Users className="w-3 h-3" aria-hidden="true" />
                      {m.crowdLevel}/5
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {affiliateActions.length > 0 && (
              <div className="mt-6">
                <ToolAffiliateCard
                  title={`Book for ${bestMonthName ?? "peak season"} (${checkIn} – ${checkOut})`}
                  subtitle={`Pre-dated stays, flights, and seasonal tours in ${dest.name} for the next ${bestMonthName ?? "recommended"} window.`}
                  placement="best_time_highlight"
                  campaign={trackingId}
                  actions={affiliateActions}
                  className="bg-white"
                />
              </div>
            )}
          </div>
        </section>

        {/* Temperature chart */}
        <section className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <MonthlyClimateChart months={climate.months} />
        </section>

        {/* Monthly grid */}
        <section className="max-w-7xl mx-auto px-6 pb-12 lg:pb-16">
          <h2 className="font-editorial text-2xl font-bold text-slate-900 mb-6">
            Month-by-Month Guide
          </h2>
          <MonthlyGrid months={climate.months} />
        </section>

        {/* Season breakdown */}
        <section className="bg-[#FAF8F3] border-y border-[#DCE5E3] py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="font-editorial text-2xl font-bold text-slate-900 mb-8">
              Season Breakdown
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  label: "Peak Season",
                  months: peakMonths,
                  color: "border-primary-200",
                  badge: "bg-primary-50 text-primary-800",
                },
                {
                  label: "Shoulder Season",
                  months: shoulderMonths,
                  color: "border-amber-300",
                  badge: "bg-amber-50 text-amber-800",
                },
                {
                  label: "Off Season",
                  months: offMonths,
                  color: "border-slate-300",
                  badge: "bg-slate-100 text-slate-700",
                },
              ].map(({ label, months: seasonMonths, color, badge }) => (
                <div
                  key={label}
                  className={`p-6 rounded-2xl bg-white border ${color}`}
                >
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${badge} mb-3`}
                  >
                    {label}
                  </span>
                  <p className="text-sm text-slate-700 font-medium mb-3">
                    {seasonMonths.map((m) => m.month).join(", ") || "N/A"}
                  </p>
                  {seasonMonths.length > 0 && (
                    <ul className="space-y-2">
                      {seasonMonths.slice(0, 2).flatMap((m) =>
                        m.pros.slice(0, 1).map((pro) => (
                          <li
                            key={`${m.month}-pro-${pro}`}
                            className="text-xs text-slate-600 flex items-start gap-2"
                          >
                            <Plus
                              className="w-3.5 h-3.5 text-emerald-700 mt-0.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>{pro}</span>
                          </li>
                        )),
                      )}
                      {seasonMonths.slice(0, 2).flatMap((m) =>
                        m.cons.slice(0, 1).map((con) => (
                          <li
                            key={`${m.month}-con-${con}`}
                            className="text-xs text-slate-600 flex items-start gap-2"
                          >
                            <Minus
                              className="w-3.5 h-3.5 text-red-700 mt-0.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>{con}</span>
                          </li>
                        )),
                      )}
                    </ul>
                  )}
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Best Time", value: dest.quickFacts.bestTime },
              { label: "Language", value: dest.quickFacts.language },
              { label: "Currency", value: dest.quickFacts.currency },
              { label: "Timezone", value: dest.quickFacts.timezone },
              { label: "Avg Budget", value: dest.quickFacts.avgBudget },
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

        <ToolCTA
          destination={dest.name}
          title={`Ready for ${dest.name}?`}
          description={`Let Faroway create your personalized ${dest.name} itinerary at your own pace.`}
        />
        <RelatedTools currentSlug="best-time-to-visit" />
      </main>
    </>
  );
}
