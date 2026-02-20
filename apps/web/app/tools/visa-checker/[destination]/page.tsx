import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChevronRight,
  Shield,
  ArrowRight,
  Info,
} from 'lucide-react';
import { getGuideBySlug, getGuideSlugs } from '@/lib/destination-guides';
import {
  getVisaInfoForDestination,
  getVisaSummary,
  visaStatusConfig,
  type VisaStatus,
} from '@/lib/tools/visa-data';
import { ToolCTA } from '@/components/tools/ToolCTA';
import { RelatedTools } from '@/components/tools/RelatedTools';

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
  if (summary['visa-free'] > 0) summaryParts.push(`Visa-free for ${summary['visa-free']} passport countries`);
  if (summary['e-visa'] > 0) summaryParts.push(`e-Visa for ${summary['e-visa']}`);
  if (summary['visa-required'] > 0) summaryParts.push(`Visa required for ${summary['visa-required']}`);

  return {
    title: `Do I Need a Visa for ${dest.name}? — Requirements by Passport`,
    description: `${dest.name} visa requirements for 15 passport countries. ${summaryParts.join('. ')}. Check stay duration and entry notes.`,
    alternates: { canonical: `/tools/visa-checker/${destination}` },
    openGraph: {
      title: `Visa Requirements: ${dest.name} | TripGenie`,
      description: `${dest.name} visa info for 15 passports. ${summaryParts[0] || ''}.`,
      url: `/tools/visa-checker/${destination}`,
      images: [{ url: dest.heroImage, width: 1920, height: 1080, alt: dest.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Visa Requirements: ${dest.name} | TripGenie`,
      description: `${dest.name} visa info for 15 passports. ${summaryParts[0] || ''}.`,
      images: [dest.heroImage],
    },
  };
}

const STATUS_ORDER: VisaStatus[] = ['visa-free', 'visa-on-arrival', 'e-visa', 'visa-required'];

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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Tools', item: 'https://tripgenie.ai/tools' },
      { '@type': 'ListItem', position: 2, name: 'Visa Checker', item: 'https://tripgenie.ai/tools/visa-checker' },
      { '@type': 'ListItem', position: 3, name: dest.name, item: `https://tripgenie.ai/tools/visa-checker/${destination}` },
    ],
  };

  // Sort entries by status order
  const sortedEntries = [...entries].sort(
    (a, b) => STATUS_ORDER.indexOf(a.visa.status) - STATUS_ORDER.indexOf(b.visa.status)
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="min-h-screen">
        {/* Hero */}
        <section className="pt-28 lg:pt-32 pb-12 lg:pb-16">
          <div className="max-w-7xl mx-auto px-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
              <Link href="/tools/visa-checker" className="hover:text-primary transition-colors">
                Visa Checker
              </Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-900 font-medium">{dest.name}</span>
            </nav>

            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
              {dest.continent}
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Do I Need a Visa for{' '}
              <span className="text-gradient">{dest.name}</span>?
            </h1>
            <p className="text-lg text-slate-600 max-w-3xl leading-relaxed">
              Visa requirements for {dest.name}, {dest.country} vary by passport.
              Below you&apos;ll find entry requirements for 15 passport countries including stay duration and important notes.
            </p>
          </div>
        </section>

        {/* Status summary bar */}
        <section className="bg-gradient-to-br from-primary-50 via-white to-amber-50 border-y border-slate-200/80 py-8">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center gap-3 mb-5">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-slate-900">
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
          </div>
        </section>

        {/* Passport matrix */}
        <section className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">
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
                    <span className="text-2xl">{passport.flag}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{passport.name}</p>
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-slate-600">
                      <span className="font-medium text-slate-700">Duration:</span> {visa.duration}
                    </p>
                    {visa.notes && (
                      <p className="text-xs text-slate-500">{visa.notes}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Key info */}
        <section className="bg-slate-50 border-y border-slate-200/80 py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              Important Information
            </h2>
            <div className="p-5 rounded-xl bg-white border border-slate-200/60 space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                Visa requirements can change without notice. Always verify current entry requirements with the official embassy or consulate of {dest.name} before traveling. The information above is for general guidance only.
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">
                Some countries may require additional documents such as proof of onward travel, sufficient funds, or travel insurance even for visa-free entry. Check airline requirements as they may differ from immigration rules.
              </p>
            </div>
          </div>
        </section>

        {/* Interactive CTA */}
        <section className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-r from-primary-50 to-amber-50 border border-primary/10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" />
                  Check Your Specific Passport
                </h3>
                <p className="text-sm text-slate-600">
                  Select your passport country and destination in our interactive Visa Checker for personalized results.
                </p>
              </div>
              <Link
                href="/tools/visa-checker"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-semibold text-sm hover:bg-primary-700 transition-colors shrink-0"
              >
                Use Visa Checker <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Cross-links */}
        <section className="max-w-7xl mx-auto px-6 pb-12 lg:pb-16">
          <h2 className="text-xl font-bold text-slate-900 mb-4">
            More About {dest.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href={`/destinations/${destination}`}
              className="p-4 rounded-xl border border-slate-200/60 bg-white hover:border-primary/30 hover:shadow-sm transition-all group"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors">
                {dest.name} Destination Guide
              </p>
              <p className="text-xs text-slate-500 mt-1">Highlights, itineraries & tips</p>
            </Link>
            <Link
              href={`/tools/best-time-to-visit/${destination}`}
              className="p-4 rounded-xl border border-slate-200/60 bg-white hover:border-primary/30 hover:shadow-sm transition-all group"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors">
                Best Time to Visit {dest.name}
              </p>
              <p className="text-xs text-slate-500 mt-1">Climate & crowd data by month</p>
            </Link>
            <Link
              href={`/tools/trip-cost/${destination}`}
              className="p-4 rounded-xl border border-slate-200/60 bg-white hover:border-primary/30 hover:shadow-sm transition-all group"
            >
              <p className="text-sm font-semibold text-slate-900 group-hover:text-primary transition-colors">
                Trip Cost for {dest.name}
              </p>
              <p className="text-xs text-slate-500 mt-1">Budget breakdowns & sample prices</p>
            </Link>
          </div>
        </section>

        <ToolCTA
          title={`Ready for ${dest.name}?`}
          description={`Let TripGenie create your personalized ${dest.name} itinerary — completely free.`}
        />
        <RelatedTools currentSlug="visa-checker" />
      </main>
    </>
  );
}
