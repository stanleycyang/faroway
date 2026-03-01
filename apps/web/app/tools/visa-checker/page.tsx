import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Shield, ArrowRight } from "lucide-react";
import { getContinents, getGuidesByContinent } from "@/lib/destination-guides";
import { getVisaSummary, visaStatusConfig } from "@/lib/tools/visa-data";
import { VisaCheckerClient } from "@/components/tools/visa/VisaCheckerClient";
import { ToolCTA } from "@/components/tools/ToolCTA";

export const metadata: Metadata = {
  title: "Visa Checker — Do I Need a Visa?",
  description:
    "Check visa requirements for 14 popular destinations based on your passport. Instant results with stay duration, visa type, and travel tips.",
  alternates: { canonical: "/tools/visa-checker" },
  openGraph: {
    title: "Visa Checker | Faroway",
    description:
      "Free visa requirement checker for 14 destinations — know before you go.",
    url: "/tools/visa-checker",
  },
};

export default function VisaCheckerPage() {
  const continents = getContinents().filter((c) => c !== "All");

  const appSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Visa Checker",
    description:
      "Check visa requirements for popular destinations based on your passport country.",
    url: "https://www.faroway.ai/tools/visa-checker",
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
      <VisaCheckerClient />

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            Visa Guides by Destination
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            See visa requirements for all 15 passport countries at a glance —
            organized by destination.
          </p>
        </div>

        {continents.map((continent) => {
          const guides = getGuidesByContinent(continent);
          if (guides.length === 0) return null;

          return (
            <div key={continent} className="mb-12">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">
                {continent}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {guides.map((dest) => {
                  const summary = getVisaSummary(dest.slug);
                  const dominant =
                    summary["visa-free"] >= 10
                      ? "Visa-free for most passports"
                      : summary["visa-free"] >= 5
                        ? "Mixed visa requirements"
                        : "Visa required for most passports";

                  return (
                    <Link
                      key={dest.slug}
                      href={`/tools/visa-checker/${dest.slug}`}
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
                          <h4 className="text-lg font-bold text-white">
                            {dest.name}
                          </h4>
                          <p className="text-sm text-white/80">
                            {dest.country}
                          </p>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                          <Shield className="w-4 h-4 text-primary" />
                          <span className="font-medium">{dominant}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {summary["visa-free"] > 0 && (
                            <span
                              className={`px-2 py-0.5 rounded-md text-xs font-semibold ${visaStatusConfig["visa-free"].bg} ${visaStatusConfig["visa-free"].color}`}
                            >
                              {summary["visa-free"]} Visa-Free
                            </span>
                          )}
                          {summary["visa-on-arrival"] > 0 && (
                            <span
                              className={`px-2 py-0.5 rounded-md text-xs font-semibold ${visaStatusConfig["visa-on-arrival"].bg} ${visaStatusConfig["visa-on-arrival"].color}`}
                            >
                              {summary["visa-on-arrival"]} VOA
                            </span>
                          )}
                          {summary["e-visa"] > 0 && (
                            <span
                              className={`px-2 py-0.5 rounded-md text-xs font-semibold ${visaStatusConfig["e-visa"].bg} ${visaStatusConfig["e-visa"].color}`}
                            >
                              {summary["e-visa"]} e-Visa
                            </span>
                          )}
                          {summary["visa-required"] > 0 && (
                            <span
                              className={`px-2 py-0.5 rounded-md text-xs font-semibold ${visaStatusConfig["visa-required"].bg} ${visaStatusConfig["visa-required"].color}`}
                            >
                              {summary["visa-required"]} Visa Req.
                            </span>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
                          View all requirements{" "}
                          <ArrowRight className="w-3 h-3" />
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
