import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  Luggage,
  CheckSquare,
  Sparkles,
  Globe,
  ThermometerSun,
} from "lucide-react";
import { getGuideBySlug, getGuideSlugs } from "@/lib/destination-guides";
import {
  generatePackingList,
  TRIP_TYPES,
  type TripType,
} from "@/lib/tools/packing-data";
import { ToolCTA } from "@/components/tools/ToolCTA";
import { RelatedTools } from "@/components/tools/RelatedTools";

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
    title: `${dest.name} Packing List — What to Pack for ${dest.country}`,
    description: `Complete packing checklist for ${dest.name}, ${dest.country}. Destination-specific essentials, climate-appropriate clothing, and local tips. Customized by trip type.`,
    alternates: { canonical: `/tools/packing-list/${slug}` },
    openGraph: {
      title: `${dest.name} Packing List | Faroway`,
      description: `Smart packing checklist for ${dest.name} — customized by trip type and climate.`,
      url: `/tools/packing-list/${slug}`,
      images: [
        { url: dest.heroImage, width: 1920, height: 1080, alt: dest.name },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `What to Pack for ${dest.name} | Faroway`,
      description: `Complete packing checklist for ${dest.name}, ${dest.country}.`,
      images: [dest.heroImage],
    },
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function PackingListDestinationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const dest = getGuideBySlug(slug);
  if (!dest) notFound();

  // Generate lists for all trip types so we can show them as tabs (SSR)
  const tripLists = TRIP_TYPES.map((type) => ({
    ...type,
    categories: generatePackingList(slug, type.id),
  }));

  // Default to "city" trip type for the SSR render
  const defaultType = tripLists.find((t) => t.id === "city") || tripLists[0];

  const totalItems = defaultType.categories.reduce(
    (sum, cat) => sum + cat.items.length,
    0,
  );

  // JSON-LD
  const jsonLd = [
    {
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
          name: "Packing List",
          item: "https://www.faroway.ai/tools/packing-list",
        },
        {
          "@type": "ListItem",
          position: 3,
          name: dest.name,
          item: `https://www.faroway.ai/tools/packing-list/${slug}`,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: `What to Pack for ${dest.name}`,
      description: `Complete packing checklist for ${dest.name}, ${dest.country}. ${totalItems} items organized by category.`,
      step: defaultType.categories.map((cat, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: cat.category,
        text: cat.items.map((item) => item.name).join(", "),
      })),
    },
  ];

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
                href="/tools/packing-list"
                className="hover:text-primary transition-colors"
              >
                Packing List
              </Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-900 font-medium">{dest.name}</span>
            </nav>

            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
              {dest.continent}
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              What to Pack for{" "}
              <span className="text-gradient">{dest.name}</span>
            </h1>
            <p className="text-lg text-slate-600 max-w-3xl leading-relaxed">
              A complete, destination-specific packing checklist for{" "}
              {dest.name}, {dest.country}. Organized by category with local tips
              and climate-appropriate essentials.
            </p>
          </div>
        </section>

        {/* Quick Facts Bar */}
        <section className="bg-gradient-to-br from-primary-50 via-white to-amber-50 border-y border-slate-200/80 py-8">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <span className="text-sm text-slate-700">
                  <strong>{dest.country}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ThermometerSun className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-slate-700">
                  Best time: <strong>{dest.quickFacts.bestTime}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Luggage className="w-4 h-4 text-teal-600" />
                <span className="text-sm text-slate-700">
                  <strong>{totalItems} items</strong> in checklist
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Trip type selector (static tabs) */}
        <section className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Packing List by Trip Type
          </h2>
          <p className="text-slate-500 mb-8">
            Choose your travel style for a customized checklist. Each type adds
            specific gear and clothing.
          </p>

          <div className="flex flex-wrap gap-3 mb-10">
            {TRIP_TYPES.map((type) => (
              <Link
                key={type.id}
                href={`/tools/packing-list/${slug}#${type.id}`}
                className="px-5 py-2.5 rounded-full text-sm font-medium border border-slate-200/80 bg-white text-slate-700 hover:border-primary/30 hover:text-primary transition-all"
              >
                {type.emoji} {type.label}
              </Link>
            ))}
          </div>

          {/* Render all trip type lists */}
          {tripLists.map((tripType) => (
            <div key={tripType.id} id={tripType.id} className="mb-16">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">{tripType.emoji}</span>
                <h3 className="text-xl font-bold text-slate-900">
                  {tripType.label} Trip — {dest.name}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tripType.categories.map((cat) => (
                  <div
                    key={cat.category}
                    className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xl">{cat.emoji}</span>
                      <h4 className="text-lg font-bold text-slate-900">
                        {cat.category}
                      </h4>
                      <span className="ml-auto text-xs text-slate-400">
                        {cat.items.length} items
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {cat.items.map((item) => (
                        <li
                          key={item.name}
                          className="flex items-start gap-3 text-sm text-slate-600"
                        >
                          <CheckSquare
                            className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                              item.essential
                                ? "text-primary"
                                : "text-slate-300"
                            }`}
                          />
                          <span>
                            {item.name}
                            {item.essential && (
                              <span className="ml-1.5 text-xs font-medium text-primary">
                                Essential
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Cross-links to other destination tools */}
        <section className="bg-slate-50 border-y border-slate-200/80 py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">
              More Tools for {dest.name}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href={`/destinations/${dest.slug}`}
                className="p-5 rounded-xl bg-white border border-slate-200/80 hover:border-primary/20 hover:shadow-sm transition-all text-center"
              >
                <p className="font-semibold text-slate-900">
                  {dest.name} Travel Guide
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Highlights, tips & itinerary
                </p>
              </Link>
              <Link
                href={`/tools/best-time-to-visit/${dest.slug}`}
                className="p-5 rounded-xl bg-white border border-slate-200/80 hover:border-primary/20 hover:shadow-sm transition-all text-center"
              >
                <p className="font-semibold text-slate-900">
                  Best Time to Visit
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Monthly weather & crowds
                </p>
              </Link>
              <Link
                href={`/tools/trip-cost/${dest.slug}`}
                className="p-5 rounded-xl bg-white border border-slate-200/80 hover:border-primary/20 hover:shadow-sm transition-all text-center"
              >
                <p className="font-semibold text-slate-900">Trip Cost</p>
                <p className="text-xs text-slate-500 mt-1">
                  Budget breakdown & tips
                </p>
              </Link>
            </div>
          </div>
        </section>

        <ToolCTA
          title={`Ready for ${dest.name}?`}
          description={`Faroway creates your personalized ${dest.name} itinerary in 60 seconds — completely free.`}
        />
        <RelatedTools currentSlug="packing-list" />
      </main>
    </>
  );
}
