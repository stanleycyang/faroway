import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, Sparkles } from 'lucide-react';
import { getAllGuides, getContinents, getGuidesByContinent } from '@/lib/destination-guides';

export const metadata: Metadata = {
  title: 'Destination Guides — Travel Inspiration & Tips',
  description:
    'Explore our curated destination guides with local tips, sample itineraries, and must-see highlights. From Tokyo to Cape Town — plan your dream trip with TripGenie.',
  alternates: { canonical: '/destinations' },
  openGraph: {
    title: 'TripGenie Destination Guides — Travel Inspiration & Tips',
    description:
      'Curated destination guides with local tips, sample itineraries, and must-see highlights for 15+ destinations worldwide.',
    type: 'website',
    url: '/destinations',
  },
};

export default function DestinationsIndex() {
  const guides = getAllGuides();
  const continents = getContinents();

  // JSON-LD BreadcrumbList
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tripgenie.ai' },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Destinations',
        item: 'https://www.tripgenie.ai/destinations',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <main className="min-h-screen pt-20">
        {/* Hero */}
        <section className="relative py-16 lg:py-24 bg-gradient-to-br from-primary-50 via-white to-amber-50 overflow-hidden">
          <div className="absolute top-10 right-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl" />

          <div className="container mx-auto px-6 max-w-7xl relative">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <MapPin className="w-4 h-4" />
                {guides.length} Curated Guides
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                Destination{' '}
                <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
                  Guides
                </span>
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Curated travel guides with local tips, sample itineraries, and must-see highlights.
                Find your next adventure and plan it with AI.
              </p>
            </div>
          </div>
        </section>

        {/* Destination Grid */}
        <section className="container mx-auto px-6 max-w-7xl py-16">
          {/* Continent Labels */}
          {['Asia', 'Europe', 'Americas', 'Africa', 'Oceania'].map((continent) => {
            const items = getGuidesByContinent(continent);
            if (items.length === 0) return null;
            return (
              <div key={continent} className="mb-16">
                <h2 className="text-2xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                  <span className="inline-block w-8 h-1 rounded-full bg-gradient-to-r from-primary to-amber-500" />
                  {continent}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {items.map((dest) => (
                    <Link
                      key={dest.slug}
                      href={`/destinations/${dest.slug}`}
                      className="group rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden">
                        <Image
                          src={dest.cardImage}
                          alt={`${dest.name}, ${dest.country}`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        <div className="absolute bottom-3 left-3 flex gap-1.5">
                          {dest.vibes.slice(0, 2).map((vibe) => (
                            <span
                              key={vibe}
                              className="px-2.5 py-1 rounded-full bg-white/90 text-xs font-medium text-slate-700 backdrop-blur-sm"
                            >
                              {vibe}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors">
                          {dest.name}
                        </h3>
                        <p className="text-sm text-slate-500 mb-2">{dest.country}</p>
                        <p className="text-sm text-slate-600 line-clamp-2">{dest.tagline}</p>
                        <div className="mt-3 flex items-center gap-1 text-primary text-sm font-medium">
                          Explore guide
                          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-br from-primary-600 to-amber-500 py-16">
          <div className="container mx-auto px-6 max-w-4xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to plan your trip?
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
              TripGenie creates a personalized day-by-day itinerary for any destination in 60 seconds — for free.
            </p>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 bg-white text-primary-600 px-8 py-4 rounded-full text-lg font-semibold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
            >
              <Sparkles className="w-5 h-5" />
              Plan My Trip — It&apos;s Free
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
