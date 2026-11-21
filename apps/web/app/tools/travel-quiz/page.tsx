import type { Metadata } from "next";
import { getAllGuides } from "@/lib/destination-guides";
import { buildHotelPartnerLinks } from "@/lib/affiliates/hotels";
import { buildActivityFallbackLinks } from "@/lib/affiliates/activities";
import {
  buildAiraloUrl,
  buildSafetyWingUrl,
} from "@/lib/affiliates/essentials";
import type { QuizAffiliateBundle } from "@/components/tools/quiz/QuizResults";
import { TravelQuizClient } from "@/components/tools/quiz/TravelQuizClient";

export const metadata: Metadata = {
  title: "Where Should I Travel? — Destination Quiz",
  description:
    "Take our 60-second travel quiz to discover your perfect destination. Answer 6 questions about your style, budget, and interests to get personalized recommendations.",
  alternates: { canonical: "/tools/travel-quiz" },
  openGraph: {
    title: "Destination Quiz — Where Should You Travel? | Faroway",
    description:
      "Find your dream destination in 60 seconds with our free travel quiz.",
    url: "/tools/travel-quiz",
  },
};

export default function TravelQuizPage() {
  const guides = getAllGuides();
  const affiliateBundlesBySlug: Record<string, QuizAffiliateBundle> = {};
  for (const dest of guides) {
    const trackingId = `tool-travel-quiz-${dest.slug}`;
    const hotels = buildHotelPartnerLinks({
      destination: `${dest.name}, ${dest.country}`,
      campaign: trackingId,
    });
    const activities = buildActivityFallbackLinks({
      destination: dest.name,
      trackingId,
    });
    affiliateBundlesBySlug[dest.slug] = {
      stay: hotels.primary,
      activity: activities[0] ?? null,
      esim: buildAiraloUrl({ countryOrDestination: dest.country, trackingId }),
      insurance: buildSafetyWingUrl({ destination: dest.name, trackingId }),
    };
  }

  const appSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Destination Travel Quiz",
    description:
      "Take a 60-second quiz to discover your perfect travel destination based on your style and interests.",
    url: "https://www.faroway.ai/tools/travel-quiz",
    applicationCategory: "TravelApplication",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    operatingSystem: "All",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(appSchema).replace(/</g, "\\u003c"),
        }}
      />
      <TravelQuizClient affiliateBundlesBySlug={affiliateBundlesBySlug} />
    </>
  );
}
