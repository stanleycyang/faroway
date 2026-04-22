import type { Metadata } from "next";
import { WorldMapClient } from "./WorldMapClient";

export const metadata: Metadata = {
  title: "World Map Tracker — Pin Every Country You've Visited",
  description:
    "A beautiful, interactive world map to track every country you've lived in, visited, or still dream of. No sign-up, no backend — everything lives in your browser. Export JSON, share by URL, download as PNG.",
  alternates: { canonical: "/tools/world-map" },
  openGraph: {
    title: "World Map Tracker | Faroway",
    description:
      "Pin every country you've visited. Free, private, and shareable — no account needed.",
    url: "/tools/world-map",
  },
};

export default function WorldMapPage() {
  const appSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "World Map Tracker",
    description:
      "Interactive travel map to pin every country you've visited, with dates, notes, and photos. Export JSON and share by URL.",
    url: "https://www.faroway.ai/tools/world-map",
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
      <main className="min-h-screen pt-20 lg:pt-24 pb-16">
        <WorldMapClient />
      </main>
    </>
  );
}
