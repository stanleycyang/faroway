import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar,
  ChevronRight,
  ThermometerSun,
  Droplets,
  Users,
} from "lucide-react";
import { getGuideBySlug, getGuideSlugs } from "@/lib/destination-guides";
import { getClimateData } from "@/lib/tools/climate-data";
import { MonthlyClimateChart } from "@/components/tools/best-time/MonthlyClimateChart";
import { MonthlyGrid } from "@/components/tools/best-time/MonthlyGrid";
import { ToolCTA } from "@/components/tools/ToolCTA";
import { RelatedTools } from "@/components/tools/RelatedTools";

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
            <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
              <Link
                href="/tools/best-time-to-visit"
                className="hover:text-primary transition-colors"
              >
                Best Time to Visit
              </Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-900 font-medium">{dest.name}</span>
            </nav>

            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
              {dest.continent}
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Best Time to Visit{" "}
              <span className="text-gradient">{dest.name}</span>
            </h1>
            <p className="text-lg text-slate-600 max-w-3xl leading-relaxed">
              {climate.summary}
            </p>
          </div>
        </section>

        {/* Best months highlight */}
        <section className="bg-gradient-to-br from-primary-50 via-white to-amber-50 border-y border-slate-200/80 py-10">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-slate-900">
                Best Months to Visit
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {bestMonthsData.map((m) => (
                <div
                  key={m.month}
                  className="px-5 py-3 rounded-xl bg-white border border-primary/20 shadow-sm"
                >
                  <p className="text-sm font-bold text-slate-900">{m.month}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <ThermometerSun className="w-3 h-3" />
                      {m.avgTempC}°C
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Droplets className="w-3 h-3" />
                      {m.rainfallMm}mm
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {m.crowdLevel}/5
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Temperature chart */}
        <section className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <MonthlyClimateChart months={climate.months} />
        </section>

        {/* Monthly grid */}
        <section className="max-w-7xl mx-auto px-6 pb-12 lg:pb-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Month-by-Month Guide
          </h2>
          <MonthlyGrid months={climate.months} />
        </section>

        {/* Season breakdown */}
        <section className="bg-slate-50 border-y border-slate-200/80 py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">
              Season Breakdown
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  label: "Peak Season",
                  months: peakMonths,
                  color: "border-primary/30",
                  badge: "bg-primary/10 text-primary",
                },
                {
                  label: "Shoulder Season",
                  months: shoulderMonths,
                  color: "border-amber-300",
                  badge: "bg-amber-50 text-amber-600",
                },
                {
                  label: "Off Season",
                  months: offMonths,
                  color: "border-slate-300",
                  badge: "bg-slate-100 text-slate-500",
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
                            className="text-xs text-slate-500 flex items-start gap-2"
                          >
                            <span className="text-green-500 mt-0.5">+</span>
                            {pro}
                          </li>
                        )),
                      )}
                      {seasonMonths.slice(0, 2).flatMap((m) =>
                        m.cons.slice(0, 1).map((con) => (
                          <li
                            key={`${m.month}-con-${con}`}
                            className="text-xs text-slate-500 flex items-start gap-2"
                          >
                            <span className="text-red-400 mt-0.5">-</span>
                            {con}
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
          <h2 className="text-xl font-bold text-slate-900 mb-6">
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
                className="p-4 rounded-xl bg-slate-50 border border-slate-200/60"
              >
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
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
