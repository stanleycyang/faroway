import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Calendar, ArrowRight } from "lucide-react";
import { getContinents, getGuidesByContinent } from "@/lib/destination-guides";
import { getClimateData } from "@/lib/tools/climate-data";
import { ToolHero } from "@/components/tools/ToolHero";
import { ToolCTA } from "@/components/tools/ToolCTA";

export const metadata: Metadata = {
  title: "Best Time to Visit — Climate & Crowd Data",
  description:
    "Find the best month to visit 14 popular destinations. Monthly temperature, rainfall, crowd levels, events, and seasonal tips.",
  alternates: { canonical: "/tools/best-time-to-visit" },
  openGraph: {
    title: "Best Time to Visit Any Destination | Faroway",
    description:
      "Climate data, crowd levels & events for 14 destinations — find your perfect month.",
    url: "/tools/best-time-to-visit",
  },
};

export default function BestTimeToVisitPage() {
  const continents = getContinents().filter((c) => c !== "All");

  const appSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Best Time to Visit Guide",
    description:
      "Find the best month to visit any destination with climate data, crowd levels, and seasonal events.",
    url: "https://www.faroway.ai/tools/best-time-to-visit",
    applicationCategory: "TravelApplication",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    operatingSystem: "All",
  };

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(appSchema).replace(/</g, "\\u003c"),
        }}
      />
      <ToolHero
        badge="Free Guide"
        title="Best Time to Visit"
        gradientWord="Best Time"
        description="Monthly climate data, crowd levels, events, and seasonal tips for 14 popular destinations. Find the perfect month for your trip."
      />

      <section className="max-w-7xl mx-auto px-6 pb-16">
        {continents.map((continent) => {
          const guides = getGuidesByContinent(continent);
          // Only show destinations that have climate data
          const withClimate = guides.filter((g) => getClimateData(g.slug));
          if (withClimate.length === 0) return null;

          return (
            <div key={continent} className="mb-12">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                {continent}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {withClimate.map((dest) => {
                  const climate = getClimateData(dest.slug);
                  return (
                    <Link
                      key={dest.slug}
                      href={`/tools/best-time-to-visit/${dest.slug}`}
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
                          <h3 className="text-lg font-bold text-white">
                            {dest.name}
                          </h3>
                          <p className="text-sm text-white/80">
                            {dest.country}
                          </p>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span className="font-medium">
                            Best: {climate?.bestMonths.join(", ")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {climate?.summary}
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary mt-3 group-hover:gap-2 transition-all">
                          View monthly data <ArrowRight className="w-3 h-3" />
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
