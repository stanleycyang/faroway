import type { Metadata } from "next";
import { currencies } from "@/lib/tools/currency-data";
import { buildWiseUrl } from "@/lib/affiliates/essentials";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";
import { CurrencyConverterClient } from "@/components/tools/currency/CurrencyConverterClient";

export const metadata: Metadata = {
  title: "Currency Converter — Travel Money Calculator",
  description:
    "Convert between 11 travel currencies with approximate rates. Includes destination-specific tips for handling money abroad.",
  alternates: { canonical: "/tools/currency-converter" },
  openGraph: {
    title: "Currency Converter | Faroway",
    description:
      "Free travel currency converter with tips for 14 destinations.",
    url: "/tools/currency-converter",
  },
};

export default function CurrencyConverterPage() {
  const wiseBaseLink = buildWiseUrl({});
  const wisePairLinks: Record<string, AffiliateLinkResult> = {};
  for (const from of currencies) {
    for (const to of currencies) {
      wisePairLinks[`${from.code}-${to.code}`] = buildWiseUrl({
        sourceCurrency: from.code,
        targetCurrency: to.code,
      });
    }
  }

  const appSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Travel Currency Converter",
    description:
      "Convert between travel currencies with destination-specific tips for handling money abroad.",
    url: "https://www.faroway.ai/tools/currency-converter",
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
      <CurrencyConverterClient
        wisePairLinks={wisePairLinks}
        wiseBaseLink={wiseBaseLink}
      />
    </>
  );
}
