import type { Metadata } from "next";
import { getAllGuides } from "@/lib/destination-guides";
import { buildTripEssentials } from "@/lib/affiliates/essentials";
import {
  PackingListClient,
  type PackingAffiliateBundle,
} from "@/components/tools/packing/PackingListClient";

export const metadata: Metadata = {
  title: "Packing List Generator — Never Forget Essentials",
  description:
    "Generate a smart packing checklist for your trip. Customized by destination, trip type, and climate. Check items off and save your progress.",
  alternates: { canonical: "/tools/packing-list" },
  openGraph: {
    title: "Smart Packing List Generator | Faroway",
    description:
      "Customized packing checklists for 14 destinations — free, no sign-up.",
    url: "/tools/packing-list",
  },
};

export default function PackingListPage() {
  const guides = getAllGuides();
  const essentialsBySlug: Record<string, PackingAffiliateBundle> = {};
  for (const guide of guides) {
    const built = buildTripEssentials({
      destination: guide.name,
      country: guide.country,
      trackingId: `tool-packing-${guide.slug}`,
    });
    essentialsBySlug[guide.slug] = {
      esim: built.esim,
      insurance: built.insurance,
      carRental: built.carRental,
      visa: built.visa,
    };
  }

  const appSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Smart Packing List Generator",
    description:
      "Generate a customized packing checklist based on your destination, trip type, and climate.",
    url: "https://www.faroway.ai/tools/packing-list",
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
      <PackingListClient essentialsBySlug={essentialsBySlug} />
    </>
  );
}
