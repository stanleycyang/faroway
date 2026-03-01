import type { Metadata } from "next";
import { PackingListClient } from "@/components/tools/packing/PackingListClient";

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
      <PackingListClient />
    </>
  );
}
