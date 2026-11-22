"use client";

import { useState } from "react";
import {
  Briefcase,
  Building2,
  Mountain,
  Sparkles,
  Sun,
  type LucideIcon,
} from "lucide-react";
import {
  isAllowedAffiliateUrl,
  itemTypeForAffiliatePartner,
} from "@faroway/constants";
import { useHydrated } from "@/hooks/useHydrated";
import { getAllGuides, type DestinationGuide } from "@/lib/destination-guides";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";
import {
  TRIP_TYPES,
  generatePackingList,
  type PackingCategory,
  type TripType,
} from "@/lib/tools/packing-data";
import { PackingChecklist } from "./PackingChecklist";
import { ToolCTA } from "@/components/tools/ToolCTA";
import { RelatedTools } from "@/components/tools/RelatedTools";
import { ToolHero } from "@/components/tools/ToolHero";
import {
  ToolAffiliateCard,
  type ToolAffiliateAction,
} from "@/components/tools/ToolAffiliateCard";

const guides = getAllGuides();

const TRIP_TYPE_ICONS: Record<TripType, LucideIcon> = {
  beach: Sun,
  city: Building2,
  hiking: Mountain,
  business: Briefcase,
  wellness: Sparkles,
};

export interface PackingAffiliateBundle {
  esim: AffiliateLinkResult;
  insurance: AffiliateLinkResult;
  carRental: AffiliateLinkResult;
  visa: AffiliateLinkResult;
}

export interface PackingListClientProps {
  essentialsBySlug?: Record<string, PackingAffiliateBundle>;
}

export function PackingListClient({
  essentialsBySlug,
}: PackingListClientProps = {}) {
  const hydrated = useHydrated();
  const [destination, setDestination] = useState<DestinationGuide | null>(null);
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [packingList, setPackingList] = useState<PackingCategory[] | null>(
    null,
  );

  const handleGenerate = () => {
    if (!destination || !tripType) return;
    const list = generatePackingList(destination.slug, tripType);
    setPackingList(list);
  };

  const handleReset = () => {
    setDestination(null);
    setTripType(null);
    setPackingList(null);
  };

  if (packingList && destination && tripType) {
    const selectedType = TRIP_TYPES.find((t) => t.id === tripType);
    const SelectedIcon = TRIP_TYPE_ICONS[tripType] ?? Sparkles;
    const bundle = essentialsBySlug?.[destination.slug];
    const actions: ToolAffiliateAction[] = [];

    if (bundle) {
      if (bundle.esim.url && isAllowedAffiliateUrl(bundle.esim.url)) {
        actions.push({
          key: `tool-packing-${destination.slug}-esim`,
          link: bundle.esim,
          itemType: itemTypeForAffiliatePartner(bundle.esim.partner),
        });
      }
      if (bundle.insurance.url && isAllowedAffiliateUrl(bundle.insurance.url)) {
        actions.push({
          key: `tool-packing-${destination.slug}-insurance`,
          link: bundle.insurance,
          itemType: itemTypeForAffiliatePartner(bundle.insurance.partner),
        });
      }
      const secondaryLink =
        tripType === "hiking" || tripType === "beach"
          ? bundle.carRental
          : bundle.visa;
      if (secondaryLink.url && isAllowedAffiliateUrl(secondaryLink.url)) {
        actions.push({
          key: `tool-packing-${destination.slug}-${secondaryLink.partner}`,
          link: secondaryLink,
          itemType: itemTypeForAffiliatePartner(secondaryLink.partner),
        });
      }
    }

    return (
      <main className="min-h-screen">
        <div className="max-w-2xl mx-auto px-6 pt-28 lg:pt-32 pb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-editorial text-2xl font-bold text-slate-900">
                Packing for {destination.name}
              </h1>
              <p className="text-sm text-slate-600 flex items-center gap-1.5 mt-0.5">
                <SelectedIcon
                  className="w-4 h-4 text-[#0F766E]"
                  aria-hidden="true"
                />
                <span>{selectedType?.label} trip</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="text-sm text-primary-700 font-semibold hover:underline print-hidden"
            >
              New list
            </button>
          </div>

          <PackingChecklist
            categories={packingList}
            storageKey={`packing-${destination.slug}-${tripType}`}
          />

          {actions.length > 0 && (
            <div className="mt-10 print-hidden">
              <ToolAffiliateCard
                title={`Pre-trip essentials for ${destination.name}`}
                subtitle={`Check off your eSIM data, travel protection, and ${tripType === "hiking" || tripType === "beach" ? "rental car" : "entry requirements"} before departure.`}
                placement="packing_essentials"
                campaign={`tool-packing-${destination.slug}`}
                actions={actions}
              />
            </div>
          )}
        </div>

        <div className="print-hidden">
          <ToolCTA
            destination={destination.name}
            title={`Ready to Plan Your ${destination.name} Trip?`}
            description={`Let Faroway create a personalized ${destination.name} itinerary at your own pace.`}
          />
          <RelatedTools currentSlug="packing-list" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <ToolHero
        badge="Free Tool"
        title="Smart Packing List"
        gradientWord="Packing"
        description="Generate a customized packing checklist based on your destination and trip type. Check items off, and your progress saves automatically."
      />

      <section className="max-w-xl mx-auto px-6 pb-16">
        {/* Destination picker */}
        <div className="mb-8">
          <label
            htmlFor="packing-destination"
            className="block text-sm font-semibold text-slate-900 mb-3"
          >
            Where are you going?
          </label>
          <select
            id="packing-destination"
            disabled={!hydrated}
            value={destination?.slug || ""}
            onChange={(e) => {
              const guide = guides.find((g) => g.slug === e.target.value);
              setDestination(guide || null);
            }}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700/30 focus:border-primary-700"
          >
            <option value="">Select a destination</option>
            {guides.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.name}, {g.country}
              </option>
            ))}
          </select>
        </div>

        {/* Trip type picker */}
        <fieldset className="mb-8">
          <legend className="block text-sm font-semibold text-slate-900 mb-3">
            What type of trip?
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TRIP_TYPES.map((type) => {
              const Icon = TRIP_TYPE_ICONS[type.id] ?? Sparkles;
              return (
                <button
                  type="button"
                  key={type.id}
                  disabled={!hydrated}
                  onClick={() => setTripType(type.id)}
                  aria-pressed={tripType === type.id}
                  className={`p-4 rounded-xl border-2 text-center transition-all bg-white ${
                    tripType === type.id
                      ? "border-primary-700 bg-primary-50 shadow-sm"
                      : "border-[#DCE5E3] hover:border-primary-700/40"
                  }`}
                >
                  <div className="flex justify-center mb-1.5">
                    <Icon
                      className={`w-6 h-6 ${
                        tripType === type.id
                          ? "text-primary-700"
                          : "text-[#143D46]"
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-900">
                    {type.label}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!hydrated || !destination || !tripType}
          className="w-full py-3.5 rounded-full bg-primary-700 hover:bg-primary-800 text-white font-semibold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Generate My Packing List
        </button>
      </section>

      <RelatedTools currentSlug="packing-list" />
      <ToolCTA />
    </main>
  );
}
