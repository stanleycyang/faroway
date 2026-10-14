import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin,
  Clock,
  Globe,
  Banknote,
  Languages,
  Calendar,
  Sparkles,
  Lightbulb,
  ChevronRight,
} from "lucide-react";
import { getGuideBySlug, getGuideSlugs } from "@/lib/destination-guides";

// ─── Static Generation ───────────────────────────────────────────────────────
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
  if (!dest) return {};

  return {
    title: `${dest.name} Travel Guide — Things to Do, Tips & Itinerary`,
    description: `Plan your ${dest.name} trip with our complete guide. Discover the best things to do, local travel tips, a 3-day sample itinerary, and practical info for visiting ${dest.name}, ${dest.country}.`,
    alternates: { canonical: `/destinations/${dest.slug}` },
    openGraph: {
      title: `${dest.name} Travel Guide | Faroway`,
      description: dest.tagline,
      type: "article",
      url: `/destinations/${dest.slug}`,
      images: [
        {
          url: dest.heroImage,
          width: 1920,
          height: 1080,
          alt: `${dest.name}, ${dest.country}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${dest.name} Travel Guide | Faroway`,
      description: dest.tagline,
      images: [dest.heroImage],
    },
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function DestinationGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dest = getGuideBySlug(slug);
  if (!dest) notFound();

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
          name: "Destinations",
          item: "https://www.faroway.ai/destinations",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: dest.name,
          item: `https://www.faroway.ai/destinations/${dest.slug}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "TouristDestination",
      name: dest.name,
      description: dest.description,
      image: dest.heroImage,
      touristType: dest.vibes,
      containedInPlace: {
        "@type": "Country",
        name: dest.country,
      },
    },
  ];

  return (
    <>
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <main className="min-h-screen">
        {/* ─── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative h-[60vh] min-h-[400px] max-h-[600px]">
          <Image
            src={dest.heroImage}
            alt={`${dest.name}, ${dest.country}`}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />

          <div className="absolute inset-0 flex items-end">
            <div className="container mx-auto px-6 max-w-7xl pb-12 lg:pb-16">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-white/70 text-sm mb-4">
                <Link
                  href="/destinations"
                  className="hover:text-white transition-colors"
                >
                  Destinations
                </Link>
                <ChevronRight className="w-3 h-3" />
                <span className="text-white">{dest.name}</span>
              </nav>

              <div className="flex flex-wrap gap-2 mb-4">
                {dest.vibes.map((vibe) => (
                  <span
                    key={vibe}
                    className="px-3 py-1 rounded-full bg-white/20 text-white text-sm font-medium backdrop-blur-sm"
                  >
                    {vibe}
                  </span>
                ))}
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2">
                {dest.name}
              </h1>
              <p className="text-xl text-white/90 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                {dest.country}
              </p>
              <p className="text-lg text-white/80 mt-3 max-w-2xl italic">
                {dest.tagline}
              </p>
            </div>
          </div>
        </section>

        {/* ─── About ────────────────────────────────────────────────────── */}
        <section className="container mx-auto px-6 max-w-7xl py-12 lg:py-16">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              About {dest.name}
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              {dest.description}
            </p>
          </div>
        </section>

        {/* ─── Quick Facts ──────────────────────────────────────────────── */}
        <section className="bg-slate-50 border-y border-slate-200/80">
          <div className="container mx-auto px-6 max-w-7xl py-10">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Quick Facts
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              <QuickFactCard
                icon={<Calendar className="w-5 h-5" />}
                label="Best Time"
                value={dest.quickFacts.bestTime}
              />
              <QuickFactCard
                icon={<Languages className="w-5 h-5" />}
                label="Language"
                value={dest.quickFacts.language}
              />
              <QuickFactCard
                icon={<Banknote className="w-5 h-5" />}
                label="Currency"
                value={dest.quickFacts.currency}
              />
              <QuickFactCard
                icon={<Clock className="w-5 h-5" />}
                label="Timezone"
                value={dest.quickFacts.timezone}
              />
              <QuickFactCard
                icon={<Globe className="w-5 h-5" />}
                label="Avg Budget"
                value={dest.quickFacts.avgBudget}
              />
            </div>
          </div>
        </section>

        {/* ─── Highlights ───────────────────────────────────────────────── */}
        <section className="container mx-auto px-6 max-w-7xl py-12 lg:py-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Top Things to Do
          </h2>
          <p className="text-slate-500 mb-8">
            {dest.highlights.length} must-see experiences in {dest.name}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dest.highlights.map((h, i) => (
              <div
                key={i}
                className="group p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md hover:border-primary/20 transition-all"
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl flex-shrink-0">{h.emoji}</span>
                  <div>
                    <span className="text-xs font-medium text-primary uppercase tracking-wide">
                      {h.category}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1 mb-2">
                      {h.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {h.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Sample Itinerary ─────────────────────────────────────────── */}
        <section className="bg-gradient-to-br from-primary-50 via-white to-amber-50">
          <div className="container mx-auto px-6 max-w-7xl py-12 lg:py-16">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-bold text-slate-900">
                3-Day Sample Itinerary
              </h2>
            </div>
            <p className="text-slate-500 mb-10">
              A taste of what Faroway can create — fully customized to your
              preferences.
            </p>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[18px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-primary to-amber-500 hidden md:block" />

              <div className="space-y-8">
                {dest.sampleItinerary.map((day) => (
                  <div key={day.day} className="relative flex gap-6">
                    {/* Day marker */}
                    <div className="hidden md:flex flex-col items-center">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-primary/25 z-10">
                        {day.day}
                      </div>
                    </div>

                    {/* Day content */}
                    <div className="flex-1 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="md:hidden inline-flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-primary to-amber-500 text-white text-xs font-bold">
                          {day.day}
                        </span>
                        <h3 className="text-lg font-bold text-slate-900">
                          Day {day.day}: {day.title}
                        </h3>
                      </div>
                      <ul className="space-y-2">
                        {day.activities.map((activity, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-3 text-sm text-slate-600"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            {activity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center mt-10">
              <Link
                href={`/create?destination=${encodeURIComponent(dest.name)}`}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 hover:from-primary-600 hover:to-amber-600 text-white px-6 py-3 rounded-full text-sm font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5"
              >
                <Sparkles className="w-4 h-4" />
                Create My {dest.name} Itinerary — Free
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Travel Tips ──────────────────────────────────────────────── */}
        <section className="container mx-auto px-6 max-w-7xl py-12 lg:py-16">
          <div className="flex items-center gap-3 mb-6">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h2 className="text-2xl font-bold text-slate-900">
              Travel Tips for {dest.name}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dest.travelTips.map((tip, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-5 rounded-xl bg-amber-50/50 border border-amber-200/50"
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <p className="text-sm text-slate-700 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Bottom CTA ───────────────────────────────────────────────── */}
        <section className="bg-gradient-to-br from-primary-600 to-amber-500 py-16">
          <div className="container mx-auto px-6 max-w-4xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready for {dest.name}?
            </h2>
            <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
              Faroway creates a personalized {dest.name} itinerary in 60 seconds
              — completely free and tailored to your style.
            </p>
            <Link
              href={`/create?destination=${encodeURIComponent(dest.name)}`}
              className="inline-flex items-center gap-2 bg-white text-primary-600 px-8 py-4 rounded-full text-lg font-semibold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all"
            >
              <Sparkles className="w-5 h-5" />
              Plan My {dest.name} Trip
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function QuickFactCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm font-semibold text-slate-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
