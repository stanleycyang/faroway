import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ThermometerSun,
  Users,
  MapPin,
  Sparkles,
  Globe,
} from "lucide-react";
import {
  getMonthGuide,
  getAllMonthSlugs,
  getMonthLabel,
  getAdjacentMonths,
} from "@/lib/tools/best-by-month-data";

// ─── Static Generation ───────────────────────────────────────────────────────

export function generateStaticParams() {
  return getAllMonthSlugs().map((month) => ({ month }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ month: string }>;
}): Promise<Metadata> {
  const { month } = await params;
  const guide = getMonthGuide(month);
  if (!guide) return {};

  const label = getMonthLabel(month);
  const topNames = guide.destinations
    .slice(0, 5)
    .map((d) => d.name)
    .join(", ");

  return {
    title: `Best Places to Travel in ${label} 2026 — Top Destinations`,
    description: `Discover the ${guide.destinations.length} best destinations to visit in ${label}. Weather data, crowd levels, and travel tips for ${topNames}, and more.`,
    alternates: { canonical: `/travel/best-in-${month}` },
    openGraph: {
      title: `Best Places to Travel in ${label} | Faroway`,
      description: `Top ${guide.destinations.length} destinations for ${label} travel, ranked by weather, value, and crowds.`,
      url: `/travel/best-in-${month}`,
      images: guide.destinations[0]
        ? [
            {
              url: guide.destinations[0].heroImage,
              width: 1920,
              height: 1080,
              alt: guide.destinations[0].name,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `Best Places to Travel in ${label} | Faroway`,
      description: `Top destinations for ${label}: ${topNames}.`,
      images: guide.destinations[0]
        ? [guide.destinations[0].heroImage]
        : [],
    },
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function BestInMonthPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  const guide = getMonthGuide(month);
  if (!guide) notFound();

  const label = getMonthLabel(month);
  const { prev, next } = getAdjacentMonths(month);

  // JSON-LD
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://www.faroway.ai",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Travel",
          item: "https://www.faroway.ai/travel",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: `Best in ${label}`,
          item: `https://www.faroway.ai/travel/best-in-${month}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Best Places to Travel in ${label}`,
      description: guide.description,
      numberOfItems: guide.destinations.length,
      itemListElement: guide.destinations.map((d, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: d.name,
        url: `https://www.faroway.ai/destinations/${d.slug}`,
      })),
    },
  ];

  const seasonBadge = (season: "peak" | "shoulder" | "off") => {
    const styles = {
      peak: "bg-primary/10 text-primary",
      shoulder: "bg-amber-50 text-amber-600",
      off: "bg-slate-100 text-slate-500",
    };
    const labels = {
      peak: "Peak Season",
      shoulder: "Shoulder Season",
      off: "Off Season",
    };
    return (
      <span
        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[season]}`}
      >
        {labels[season]}
      </span>
    );
  };

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
        <section className="pt-28 lg:pt-32 pb-12 lg:pb-16">
          <div className="max-w-7xl mx-auto px-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
              <Link
                href="/destinations"
                className="hover:text-primary transition-colors"
              >
                Destinations
              </Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-900 font-medium">
                Best in {label}
              </span>
            </nav>

            <div className="flex items-center gap-3 mb-4">
              <Calendar className="w-6 h-6 text-primary" />
              <span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                {label}
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Best Places to Travel in{" "}
              <span className="text-gradient">{label}</span>
            </h1>
            <p className="text-lg text-slate-600 max-w-3xl leading-relaxed">
              {guide.description}
            </p>
          </div>
        </section>

        {/* Month navigation */}
        <section className="border-y border-slate-200/80 bg-slate-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link
              href={`/travel/best-in-${prev.slug}`}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-primary transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {prev.label}
            </Link>
            <span className="text-sm font-medium text-slate-900">
              {guide.destinations.length} destinations for {label}
            </span>
            <Link
              href={`/travel/best-in-${next.slug}`}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-primary transition-colors"
            >
              {next.label}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* Destination cards */}
        <section className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Top {guide.destinations.length} Destinations
          </h2>
          <p className="text-slate-500 mb-10">
            Ranked by weather, value, and crowd levels for {label} travel
          </p>

          <div className="space-y-6">
            {guide.destinations.map((dest, i) => (
              <article
                key={dest.slug}
                className="group flex flex-col md:flex-row gap-6 p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md hover:border-primary/20 transition-all"
              >
                {/* Rank + Image */}
                <div className="relative md:w-72 lg:w-80 flex-shrink-0">
                  <div className="absolute top-3 left-3 z-10 w-9 h-9 rounded-full bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                    {i + 1}
                  </div>
                  <div className="relative h-48 md:h-full rounded-xl overflow-hidden">
                    <Image
                      src={dest.heroImage}
                      alt={`${dest.name}, ${dest.country}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 100vw, 320px"
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {seasonBadge(dest.season)}
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {dest.continent}
                      </span>
                    </div>

                    <Link href={`/destinations/${dest.slug}`}>
                      <h3 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-primary transition-colors">
                        {dest.name}
                      </h3>
                    </Link>
                    <p className="text-sm text-slate-500 flex items-center gap-1 mb-3">
                      <MapPin className="w-3.5 h-3.5" />
                      {dest.country}
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed mb-4">
                      {dest.tagline}
                    </p>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-4 mb-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <ThermometerSun className="w-4 h-4 text-amber-500" />
                        <span>
                          {dest.avgTempC}°C / {dest.avgTempF}°F
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Users className="w-4 h-4 text-sky-500" />
                        <span>Crowds: {dest.crowdLevel}/5</span>
                      </div>
                    </div>

                    {/* Events */}
                    {dest.events.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {dest.events.map((event) => (
                          <span
                            key={event}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium"
                          >
                            {event}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Pros */}
                    {dest.pros.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {dest.pros.map((pro) => (
                          <span
                            key={pro}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium"
                          >
                            + {pro}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                    <Link
                      href={`/destinations/${dest.slug}`}
                      className="text-sm font-semibold text-primary hover:text-primary-600 transition-colors"
                    >
                      Full Guide →
                    </Link>
                    <Link
                      href={`/tools/best-time-to-visit/${dest.slug}`}
                      className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Climate Details
                    </Link>
                    <Link
                      href={`/tools/trip-cost/${dest.slug}`}
                      className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                    >
                      Cost Estimate
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Browse all months */}
        <section className="bg-slate-50 border-y border-slate-200/80 py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">
              Browse by Month
            </h2>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {getAllMonthSlugs().map((slug) => {
                const l = getMonthLabel(slug);
                const isCurrent = slug === month;
                return (
                  <Link
                    key={slug}
                    href={`/travel/best-in-${slug}`}
                    className={`p-4 rounded-xl text-center text-sm font-medium transition-all ${
                      isCurrent
                        ? "bg-primary text-white shadow-lg shadow-primary/25"
                        : "bg-white border border-slate-200/80 text-slate-700 hover:border-primary/30 hover:shadow-sm"
                    }`}
                  >
                    {l}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-br from-primary-600 to-amber-500 py-16">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Found Your {label} Destination?
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
              Let Faroway create a personalized itinerary in 60 seconds —
              completely free and tailored to your style.
            </p>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 bg-white text-primary-600 px-8 py-4 rounded-full text-lg font-semibold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
            >
              <Sparkles className="w-5 h-5" />
              Plan My Trip — Free
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
