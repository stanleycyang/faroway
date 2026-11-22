import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Calendar } from "lucide-react";
import { isAllowedAffiliateUrl } from "@faroway/constants";
import { getContinents, getGuidesByContinent } from "@/lib/destination-guides";
import { getClimateData } from "@/lib/tools/climate-data";
import { buildHotelPartnerLinks } from "@/lib/affiliates/hotels";
import { buildFlightFallbackLinks } from "@/lib/affiliates/flights";
import { buildAiraloUrl } from "@/lib/affiliates/essentials";
import { ToolHero } from "@/components/tools/ToolHero";
import { ToolCTA } from "@/components/tools/ToolCTA";
import {
  ToolAffiliateCard,
  type ToolAffiliateAction,
} from "@/components/tools/ToolAffiliateCard";

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
  const trackingId = "tool-best-time-index";
  const hotelResult = buildHotelPartnerLinks({
    destination: "popular destinations",
    campaign: trackingId,
  });
  const flights = buildFlightFallbackLinks({
    departureDate: "",
    trackingId,
  });
  const esim = buildAiraloUrl({ trackingId });

  const affiliateActions: ToolAffiliateAction[] = [
    ...(hotelResult.primary?.url &&
    isAllowedAffiliateUrl(hotelResult.primary.url)
      ? [
          {
            key: `${trackingId}-stay-${hotelResult.primary.partner}`,
            link: hotelResult.primary,
            itemType: "hotel" as const,
          },
        ]
      : []),
    ...flights
      .filter((f) => f.url && isAllowedAffiliateUrl(f.url))
      .slice(0, 1)
      .map((f) => ({
        key: `${trackingId}-flight-${f.partner}`,
        link: f,
        itemType: "flight" as const,
      })),
    ...(esim.url && isAllowedAffiliateUrl(esim.url)
      ? [
          {
            key: `${trackingId}-esim`,
            link: esim,
            itemType: "activity" as const,
          },
        ]
      : []),
  ];

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
              <h2 className="font-editorial text-2xl font-bold text-slate-900 mb-6">
                {continent}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {withClimate.map((dest) => {
                  const climate = getClimateData(dest.slug);
                  return (
                    <Link
                      key={dest.slug}
                      href={`/tools/best-time-to-visit/${dest.slug}`}
                      prefetch={false}
                      className="group overflow-hidden rounded-2xl border border-[#DCE5E3] bg-white shadow-sm hover:shadow-md transition-all"
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
                          <p className="text-sm text-white/90">
                            {dest.country}
                          </p>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                          <Calendar
                            className="w-4 h-4 text-primary-700"
                            aria-hidden="true"
                          />
                          <span className="font-medium">
                            Best: {climate?.bestMonths.join(", ")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {climate?.summary}
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 mt-3 group-hover:gap-2 transition-all">
                          View monthly data{" "}
                          <ArrowRight className="w-3 h-3" aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {affiliateActions.length > 0 && (
          <ToolAffiliateCard
            title="Compare seasonal flights, stays & eSIM coverage"
            subtitle="Once you pick your ideal travel window, compare partner rates in one click."
            placement="best_time_index"
            campaign={trackingId}
            actions={affiliateActions}
          />
        )}
      </section>

      <ToolCTA />
    </main>
  );
}
