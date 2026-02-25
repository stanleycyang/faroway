import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { DollarSign, ArrowRight } from 'lucide-react';
import { getContinents, getGuidesByContinent } from '@/lib/destination-guides';
import { getCostProfile, getCostLevel } from '@/lib/tools/cost-data';
import { CostEstimatorClient } from '@/components/tools/cost/CostEstimatorClient';
import { ToolCTA } from '@/components/tools/ToolCTA';

export const metadata: Metadata = {
  title: 'Trip Cost Estimator — Budget Your Travel',
  description:
    'Estimate your trip cost with detailed breakdowns for accommodation, food, transport, and activities. Covers 14 popular destinations with local pricing.',
  alternates: { canonical: '/tools/trip-cost' },
  openGraph: {
    title: 'Trip Cost Estimator | Faroway',
    description: 'Free travel budget calculator for 14 destinations — see cost breakdowns instantly.',
    url: '/tools/trip-cost',
  },
};

export default function TripCostPage() {
  const continents = getContinents().filter((c) => c !== 'All');

  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Trip Cost Estimator',
    description: 'Estimate your trip cost with detailed breakdowns for accommodation, food, transport, and activities.',
    url: 'https://www.faroway.ai/tools/trip-cost',
    applicationCategory: 'TravelApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    operatingSystem: 'All',
  };

  return (
    <main className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema).replace(/</g, '\\u003c') }} />
      <CostEstimatorClient />

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            Cost Guides by Destination
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Detailed budget breakdowns, sample prices, and money-saving tips for every destination.
          </p>
        </div>

        {continents.map((continent) => {
          const guides = getGuidesByContinent(continent);
          const withCost = guides.filter((g) => getCostProfile(g.slug));
          if (withCost.length === 0) return null;

          return (
            <div key={continent} className="mb-12">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">
                {continent}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {withCost.map((dest) => {
                  const cost = getCostProfile(dest.slug);
                  if (!cost) return null;
                  const level = getCostLevel(cost.costMultiplier);
                  const levelColor =
                    level === 'Budget-Friendly'
                      ? 'bg-emerald-50 text-emerald-700'
                      : level === 'Moderate'
                        ? 'bg-amber-50 text-amber-700'
                        : level === 'Above Average'
                          ? 'bg-orange-50 text-orange-700'
                          : 'bg-red-50 text-red-700';

                  return (
                    <Link
                      key={dest.slug}
                      href={`/tools/trip-cost/${dest.slug}`}
                      className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="relative h-40">
                        <Image
                          src={dest.cardImage}
                          alt={dest.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        <div className="absolute bottom-3 left-3">
                          <h4 className="text-lg font-bold text-white">
                            {dest.name}
                          </h4>
                          <p className="text-sm text-white/80">{dest.country}</p>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                          <DollarSign className="w-4 h-4 text-primary" />
                          <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${levelColor}`}>
                            {level}
                          </span>
                          <span className="text-xs text-slate-500">
                            {cost.currency} ({cost.currencySymbol})
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          From ~${cost.samplePrices[0]?.priceUSD} for {cost.samplePrices[0]?.item.toLowerCase()}
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary mt-3 group-hover:gap-2 transition-all">
                          View cost guide <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <ToolCTA />
    </main>
  );
}
