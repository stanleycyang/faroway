import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight, Info, Shield } from "lucide-react";
import { isAllowedAffiliateUrl } from "@faroway/constants";
import { getGuideBySlug, getGuideSlugs } from "@/lib/destination-guides";
import {
  buildSafetyWingUrl,
  buildVisaToolUrl,
} from "@/lib/affiliates/essentials";
import {
  getVisaInfoForDestination,
  getVisaSummary,
  visaStatusConfig,
  type VisaStatus,
} from "@/lib/tools/visa-data";
import { ToolCTA } from "@/components/tools/ToolCTA";
import { RelatedTools } from "@/components/tools/RelatedTools";
import {
  ToolAffiliateCard,
  type ToolAffiliateAction,
} from "@/components/tools/ToolAffiliateCard";

export function generateStaticParams() {
  return getGuideSlugs().map((slug) => ({ destination: slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ destination: string }>;
}): Promise<Metadata> {
  const { destination } = await params;
  const dest = getGuideBySlug(destination);
  if (!dest) return {};

  const summary = getVisaSummary(destination);
  const summaryParts: string[] = [];
  if (summary["visa-free"] > 0)
    summaryParts.push(
      `Visa-free for ${summary["visa-free"]} passport countries`,
    );
  if (summary["e-visa"] > 0)
    summaryParts.push(`e-Visa for ${summary["e-visa"]}`);
  if (summary["visa-required"] > 0)
    summaryParts.push(`Visa required for ${summary["visa-required"]}`);

  return {
    title: `Do I Need a Visa for ${dest.name}? — Requirements by Passport`,
    description: `${dest.name} visa requirements for 15 passport countries. ${summaryParts.join(". ")}. Check stay duration and entry notes.`,
    alternates: { canonical: `/tools/visa-checker/${destination}` },
    openGraph: {
      title: `Visa Requirements: ${dest.name} | Faroway`,
      description: `${dest.name} visa info for 15 passports. ${summaryParts[0] || ""}.`,
      url: `/tools/visa-checker/${destination}`,
      images: [
        { url: dest.heroImage, width: 1920, height: 1080, alt: dest.name },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Visa Requirements: ${dest.name} | Faroway`,
      description: `${dest.name} visa info for 15 passports. ${summaryParts[0] || ""}.`,
      images: [dest.heroImage],
    },
  };
}

const STATUS_ORDER: VisaStatus[] = [
  "visa-free",
  "visa-on-arrival",
  "e-visa",
  "visa-required",
];

export default async function VisaDestinationPage({
  params,
}: {
  params: Promise<{ destination: string }>;
}) {
  const { destination } = await params;
  const dest = getGuideBySlug(destination);
  const entries = getVisaInfoForDestination(destination);
  if (!dest || entries.length === 0) notFound();

  const summary = getVisaSummary(destination);
  const trackingId = `tool-visa-${destination}`;
  const visaLink = buildVisaToolUrl({
    destinationCountry: dest.country,
    trackingId,
  });
  const insuranceLink = buildSafetyWingUrl({
    destination: dest.name,
    trackingId,
  });

  const affiliateActions: ToolAffiliateAction[] = [];
  if (visaLink.url && isAllowedAffiliateUrl(visaLink.url)) {
    affiliateActions.push({
      key: `tool-visa-${destination}-${visaLink.partner}`,
      link: visaLink,
      itemType: "activity",
    });
  }
  if (insuranceLink.url && isAllowedAffiliateUrl(insuranceLink.url)) {
    affiliateActions.push({
      key: `tool-visa-${destination}-insurance-${insuranceLink.partner}`,
      link: insuranceLink,
      itemType: "activity",
    });
  }

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
        name: "Visa Checker",
        item: "https://www.faroway.ai/tools/visa-checker",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: dest.name,
        item: `https://www.faroway.ai/tools/visa-checker/${destination}`,
      },
    ],
  };

  // Sort entries by status order
  const sortedEntries = [...entries].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.visa.status) - STATUS_ORDER.indexOf(b.visa.status),
  );

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
                href="/tools/visa-checker"
                className="hover:text-primary-700 transition-colors"
              >
                Visa Checker
              </Link>
              <ChevronRight className="w-3 h-3" aria-hidden="true" />
              <span className="text-slate-900 font-medium">{dest.name}</span>
            </nav>

            <span className="inline-block px-4 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-800 text-sm font-semibold mb-4">
              {dest.continent}
            </span>
            <h1 className="font-editorial text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Do I Need a Visa for{" "}
              <span className="text-[#C03A31]">{dest.name}</span>?
            </h1>
            <p className="text-lg text-slate-600 max-w-3xl leading-relaxed">
              Visa requirements for {dest.name}, {dest.country} vary by
              passport. Below you&apos;ll find entry requirements for 15
              passport countries including stay duration and important notes.
            </p>
          </div>
        </section>

        {/* Status summary bar */}
        <section className="bg-[#FAF8F3] border-y border-[#DCE5E3] py-8">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center gap-3 mb-5">
              <Shield className="w-5 h-5 text-primary-700" aria-hidden="true" />
              <h2 className="font-editorial text-xl font-bold text-slate-900">
                Visa Status Summary
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {STATUS_ORDER.map((status) => {
                const count = summary[status];
                if (count === 0) return null;
                const config = visaStatusConfig[status];
                return (
                  <span
                    key={status}
                    className={`px-4 py-2 rounded-xl border ${config.border} ${config.bg} ${config.color} text-sm font-semibold`}
                  >
                    {count} {config.label}
                  </span>
                );
              })}
            </div>

            {affiliateActions.length > 0 && (
              <div className="mt-6">
                <ToolAffiliateCard
                  title={`Apply or check official entry requirements for ${dest.country}`}
                  subtitle="Verify visa paperwork and optional travel medical insurance with trusted partners."
                  placement="visa_destination_summary"
                  campaign={trackingId}
                  actions={affiliateActions}
                  className="bg-white"
                />
              </div>
            )}
          </div>
        </section>

        {/* Passport matrix */}
        <section className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <h2 className="font-editorial text-2xl font-bold text-slate-900 mb-8">
            Requirements by Passport
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedEntries.map(({ passport, visa }) => {
              const config = visaStatusConfig[visa.status];
              return (
                <div
                  key={passport.code}
                  className={`p-5 rounded-2xl bg-white border ${config.border} shadow-sm`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-9 h-9 rounded-lg bg-[#EFF5F3] text-[#143D46] font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {passport.code}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {passport.name}
                      </p>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${config.bg} ${config.color}`}
                      >
                        {config.label}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-slate-600">
                      <span className="font-medium text-slate-700">
                        Duration:
                      </span>{" "}
                      {visa.duration}
                    </p>
                    {visa.notes && (
                      <p className="text-xs text-slate-600">{visa.notes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Key info */}
        <section className="bg-[#FAF8F3] border-y border-[#DCE5E3] py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="font-editorial text-xl font-bold text-slate-900 mb-4">
              Important Information
            </h2>
            <div className="p-5 rounded-xl bg-white border border-[#DCE5E3] space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                Visa requirements can change without notice. Always verify
                current entry requirements with the official embassy or
                consulate of {dest.country} before traveling. The information
                above is for general guidance only.
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">
                Some countries may require additional documents such as proof of
                onward travel, sufficient funds, or travel insurance even for
                visa-free entry. Check airline requirements as they may differ
                from immigration rules.
              </p>
            </div>
          </div>
        </section>

        {/* Interactive CTA */}
        <section className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <div className="p-6 md:p-8 rounded-2xl bg-[#EFF5F3] border border-[#DCE5E3]">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Info
                    className="w-5 h-5 text-primary-700"
                    aria-hidden="true"
                  />
                  Check Your Specific Passport
                </h3>
                <p className="text-sm text-slate-600">
                  Select your passport country and destination in our
                  interactive Visa Checker for personalized results.
                </p>
              </div>
              <Link
                href="/tools/visa-checker"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary-700 text-white font-semibold text-sm hover:bg-primary-800 transition-colors shrink-0"
              >
                Use Visa Checker{" "}
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
              href={`/destinations/${destination}`}
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
              href={`/tools/best-time-to-visit/${destination}`}
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
              href={`/tools/trip-cost/${destination}`}
              className="p-4 rounded-xl border border-[#DCE5E3] bg-white hover:border-primary-700/30 hover:shadow-sm transition-all group"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-primary-700 transition-colors">
                Trip Cost for {dest.name}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Budget breakdowns &amp; sample prices
              </p>
            </Link>
          </div>
        </section>

        <ToolCTA
          destination={dest.name}
          title={`Ready for ${dest.name}?`}
          description={`Let Faroway create your personalized ${dest.name} itinerary at your own pace.`}
        />
        <RelatedTools currentSlug="visa-checker" />
      </main>
    </>
  );
}
