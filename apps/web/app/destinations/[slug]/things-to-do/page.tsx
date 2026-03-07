import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  MapPin,
  Sparkles,
  Clock,
  DollarSign,
  Lightbulb,
  Compass,
  Utensils,
  Map,
  Moon,
  Star,
} from "lucide-react";
import {
  getThingsToDoGuide,
  getThingsToDoSlugs,
  type ThingToDo,
} from "@/lib/tools/things-to-do-data";

// ─── Static Generation ───────────────────────────────────────────────────────

export function generateStaticParams() {
  return getThingsToDoSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getThingsToDoGuide(slug);
  if (!guide) return {};

  const totalThings =
    guide.topAttractions.length +
    guide.hiddenGems.length +
    guide.foodExperiences.length +
    guide.dayTrips.length +
    guide.nightlife.length;

  return {
    title: `${totalThings} Best Things to Do in ${guide.name} (2026) — Local Tips`,
    description: `Discover the best things to do in ${guide.name}, ${guide.country}. Top attractions, hidden gems, food experiences, day trips, and nightlife — with local tips, budgets, and timing.`,
    alternates: {
      canonical: `/destinations/${slug}/things-to-do`,
    },
    openGraph: {
      title: `Best Things to Do in ${guide.name} | Faroway`,
      description: `${totalThings} must-do experiences in ${guide.name} — attractions, hidden gems, food, day trips & nightlife.`,
      type: "article",
      url: `/destinations/${slug}/things-to-do`,
      images: [
        {
          url: guide.heroImage,
          width: 1920,
          height: 1080,
          alt: `Things to do in ${guide.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Best Things to Do in ${guide.name} | Faroway`,
      description: `${totalThings} must-do experiences in ${guide.name}.`,
      images: [guide.heroImage],
    },
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ThingCard({ thing }: { thing: ThingToDo }) {
  return (
    <div className="group p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md hover:border-primary/20 transition-all">
      <div className="flex items-start gap-4">
        <span className="text-3xl flex-shrink-0">{thing.emoji}</span>
        <div className="flex-1">
          <span className="text-xs font-medium text-primary uppercase tracking-wide">
            {thing.category}
          </span>
          <h3 className="text-lg font-bold text-slate-900 mt-1 mb-2">
            {thing.title}
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed mb-3">
            {thing.description}
          </p>

          {/* Meta badges */}
          <div className="flex flex-wrap gap-2">
            {thing.duration && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs">
                <Clock className="w-3 h-3" />
                {thing.duration}
              </span>
            )}
            {thing.budget && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs">
                <DollarSign className="w-3 h-3" />
                {thing.budget}
              </span>
            )}
            {thing.bestTime && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs">
                <Clock className="w-3 h-3" />
                {thing.bestTime}
              </span>
            )}
          </div>

          {/* Tip */}
          {thing.tip && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-50/50 border border-amber-200/50">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-600">{thing.tip}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  count,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
}) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-3 mb-6">
      {icon}
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-medium">
        {count}
      </span>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ThingsToDoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getThingsToDoGuide(slug);
  if (!guide) notFound();

  const totalThings =
    guide.topAttractions.length +
    guide.hiddenGems.length +
    guide.foodExperiences.length +
    guide.dayTrips.length +
    guide.nightlife.length;

  // JSON-LD
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Destinations",
          item: "https://www.faroway.ai/destinations",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: guide.name,
          item: `https://www.faroway.ai/destinations/${slug}`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Things to Do",
          item: `https://www.faroway.ai/destinations/${slug}/things-to-do`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "TouristDestination",
      name: guide.name,
      description: guide.intro,
      image: guide.heroImage,
      containedInPlace: {
        "@type": "Country",
        name: guide.country,
      },
      touristType: [
        "Sightseeing",
        "Cultural tourism",
        "Food tourism",
        "Adventure tourism",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Best Things to Do in ${guide.name}`,
      numberOfItems: totalThings,
      itemListElement: guide.topAttractions.map((thing, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: thing.title,
        description: thing.description,
      })),
    },
  ];

  // Section anchors for quick nav
  const sections = [
    {
      id: "attractions",
      label: "Top Attractions",
      count: guide.topAttractions.length,
    },
    {
      id: "hidden-gems",
      label: "Hidden Gems",
      count: guide.hiddenGems.length,
    },
    { id: "food", label: "Food & Drink", count: guide.foodExperiences.length },
    { id: "day-trips", label: "Day Trips", count: guide.dayTrips.length },
    { id: "nightlife", label: "Nightlife", count: guide.nightlife.length },
  ].filter((s) => s.count > 0);

  return (
    <>
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
          }}
        />
      ))}

      <main className="min-h-screen">
        {/* Hero */}
        <section className="relative h-[50vh] min-h-[350px] max-h-[500px]">
          <Image
            src={guide.heroImage}
            alt={`Things to do in ${guide.name}`}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

          <div className="absolute inset-0 flex items-end">
            <div className="container mx-auto px-6 max-w-7xl pb-10 lg:pb-14">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-white/70 text-sm mb-4">
                <Link
                  href="/destinations"
                  className="hover:text-white transition-colors"
                >
                  Destinations
                </Link>
                <ChevronRight className="w-3 h-3" />
                <Link
                  href={`/destinations/${slug}`}
                  className="hover:text-white transition-colors"
                >
                  {guide.name}
                </Link>
                <ChevronRight className="w-3 h-3" />
                <span className="text-white">Things to Do</span>
              </nav>

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">
                {totalThings} Best Things to Do in {guide.name}
              </h1>
              <p className="text-lg text-white/90 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                {guide.country}
              </p>
            </div>
          </div>
        </section>

        {/* Quick nav */}
        <section className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200/80">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-1 overflow-x-auto py-3 -mx-1">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="px-4 py-2 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap"
                >
                  {s.label}{" "}
                  <span className="text-slate-400">({s.count})</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Intro */}
        <section className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <div className="max-w-3xl">
            <p className="text-lg text-slate-600 leading-relaxed">
              {guide.intro}
            </p>
          </div>
        </section>

        {/* Top Attractions */}
        {guide.topAttractions.length > 0 && (
          <section id="attractions" className="max-w-7xl mx-auto px-6 pb-12">
            <SectionHeading
              icon={<Star className="w-5 h-5 text-primary" />}
              title="Top Attractions"
              count={guide.topAttractions.length}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {guide.topAttractions.map((thing) => (
                <ThingCard key={thing.title} thing={thing} />
              ))}
            </div>
          </section>
        )}

        {/* Hidden Gems */}
        {guide.hiddenGems.length > 0 && (
          <section
            id="hidden-gems"
            className="bg-gradient-to-br from-primary-50 via-white to-amber-50 border-y border-slate-200/80 py-12 lg:py-16"
          >
            <div className="max-w-7xl mx-auto px-6">
              <SectionHeading
                icon={<Compass className="w-5 h-5 text-amber-500" />}
                title="Hidden Gems"
                count={guide.hiddenGems.length}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {guide.hiddenGems.map((thing) => (
                  <ThingCard key={thing.title} thing={thing} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Food Experiences */}
        {guide.foodExperiences.length > 0 && (
          <section
            id="food"
            className="max-w-7xl mx-auto px-6 py-12 lg:py-16"
          >
            <SectionHeading
              icon={<Utensils className="w-5 h-5 text-teal-600" />}
              title="Food & Drink"
              count={guide.foodExperiences.length}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {guide.foodExperiences.map((thing) => (
                <ThingCard key={thing.title} thing={thing} />
              ))}
            </div>
          </section>
        )}

        {/* Day Trips */}
        {guide.dayTrips.length > 0 && (
          <section
            id="day-trips"
            className="bg-slate-50 border-y border-slate-200/80 py-12 lg:py-16"
          >
            <div className="max-w-7xl mx-auto px-6">
              <SectionHeading
                icon={<Map className="w-5 h-5 text-sky-600" />}
                title="Day Trips"
                count={guide.dayTrips.length}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {guide.dayTrips.map((thing) => (
                  <ThingCard key={thing.title} thing={thing} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Nightlife */}
        {guide.nightlife.length > 0 && (
          <section
            id="nightlife"
            className="max-w-7xl mx-auto px-6 py-12 lg:py-16"
          >
            <SectionHeading
              icon={<Moon className="w-5 h-5 text-violet-600" />}
              title="Nightlife & Evening"
              count={guide.nightlife.length}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {guide.nightlife.map((thing) => (
                <ThingCard key={thing.title} thing={thing} />
              ))}
            </div>
          </section>
        )}

        {/* Cross-links */}
        <section className="bg-slate-50 border-y border-slate-200/80 py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">
              Plan Your {guide.name} Trip
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link
                href={`/destinations/${slug}`}
                className="p-5 rounded-xl bg-white border border-slate-200/80 hover:border-primary/20 hover:shadow-sm transition-all text-center"
              >
                <p className="font-semibold text-slate-900 text-sm">
                  Travel Guide
                </p>
                <p className="text-xs text-slate-500 mt-1">Overview & tips</p>
              </Link>
              <Link
                href={`/tools/best-time-to-visit/${slug}`}
                className="p-5 rounded-xl bg-white border border-slate-200/80 hover:border-primary/20 hover:shadow-sm transition-all text-center"
              >
                <p className="font-semibold text-slate-900 text-sm">
                  Best Time to Visit
                </p>
                <p className="text-xs text-slate-500 mt-1">Weather & crowds</p>
              </Link>
              <Link
                href={`/tools/trip-cost/${slug}`}
                className="p-5 rounded-xl bg-white border border-slate-200/80 hover:border-primary/20 hover:shadow-sm transition-all text-center"
              >
                <p className="font-semibold text-slate-900 text-sm">
                  Trip Cost
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Budget & expenses
                </p>
              </Link>
              <Link
                href={`/tools/packing-list/${slug}`}
                className="p-5 rounded-xl bg-white border border-slate-200/80 hover:border-primary/20 hover:shadow-sm transition-all text-center"
              >
                <p className="font-semibold text-slate-900 text-sm">
                  Packing List
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  What to bring
                </p>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-br from-primary-600 to-amber-500 py-16">
          <div className="container mx-auto px-6 max-w-4xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready for {guide.name}?
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
              Faroway turns all these experiences into a personalized day-by-day
              itinerary — free and in 60 seconds.
            </p>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 bg-white text-primary-600 px-8 py-4 rounded-full text-lg font-semibold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
            >
              <Sparkles className="w-5 h-5" />
              Plan My {guide.name} Trip
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
