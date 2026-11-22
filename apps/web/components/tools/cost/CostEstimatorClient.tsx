"use client";

import { useState } from "react";
import { Backpack, Gem, Minus, Plus, Wallet } from "lucide-react";
import { BUDGET_RANGES, isAllowedAffiliateUrl } from "@faroway/constants";
import { getAllGuides, type DestinationGuide } from "@/lib/destination-guides";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";
import { getCostProfile } from "@/lib/tools/cost-data";
import { CostBreakdown } from "./CostBreakdown";
import { ToolHero } from "@/components/tools/ToolHero";
import {
  ToolAffiliateCard,
  type ToolAffiliateAction,
} from "@/components/tools/ToolAffiliateCard";

const guides = getAllGuides().filter((guide) => getCostProfile(guide.slug));

const BUDGET_OPTIONS = [
  {
    key: "budget",
    label: "Budget",
    icon: Backpack,
    description: "Hostels, street food, public transit",
  },
  {
    key: "moderate",
    label: "Mid-Range",
    icon: Wallet,
    description: "Hotels, restaurants, some tours",
  },
  {
    key: "luxury",
    label: "Luxury",
    icon: Gem,
    description: "Top hotels, fine dining, private tours",
  },
] as const;

export interface TripCostAffiliateBundle {
  staysByTier: Record<"budget" | "moderate" | "luxury", AffiliateLinkResult[]>;
  flights: AffiliateLinkResult[];
  fx: AffiliateLinkResult | null;
}

export interface CostEstimatorClientProps {
  affiliateLinksBySlug?: Record<string, TripCostAffiliateBundle>;
}

export function CostEstimatorClient({
  affiliateLinksBySlug,
}: CostEstimatorClientProps = {}) {
  const [destination, setDestination] = useState<DestinationGuide | null>(null);
  const [days, setDays] = useState(5);
  const [travelers, setTravelers] = useState(2);
  const [budgetKey, setBudgetKey] = useState<"budget" | "moderate" | "luxury">(
    "moderate",
  );
  const [showResult, setShowResult] = useState(false);

  const profile = destination ? getCostProfile(destination.slug) : null;

  const handleEstimate = () => {
    if (destination && profile) setShowResult(true);
  };

  const handleReset = () => {
    setShowResult(false);
  };

  if (showResult && destination && profile) {
    const dailyBudget = BUDGET_RANGES[budgetKey].daily;
    const budgetLabel =
      BUDGET_OPTIONS.find((o) => o.key === budgetKey)?.label || "";

    const bundle = affiliateLinksBySlug?.[destination.slug];
    const actions: ToolAffiliateAction[] = [];
    if (bundle) {
      for (const stay of bundle.staysByTier[budgetKey] ?? []) {
        if (stay.url && isAllowedAffiliateUrl(stay.url)) {
          actions.push({
            key: `tool-cost-${destination.slug}-${budgetKey}-stay-${stay.partner}`,
            link: stay,
            itemType: "hotel",
          });
        }
      }
      for (const flight of bundle.flights.slice(0, 1)) {
        if (flight.url && isAllowedAffiliateUrl(flight.url)) {
          actions.push({
            key: `tool-cost-${destination.slug}-flight-${flight.partner}`,
            link: flight,
            itemType: "flight",
          });
        }
      }
      if (bundle.fx?.url && isAllowedAffiliateUrl(bundle.fx.url)) {
        actions.push({
          key: `tool-cost-${destination.slug}-wise-fx`,
          link: bundle.fx,
          itemType: "activity",
        });
      }
    }

    return (
      <div>
        <div className="max-w-xl mx-auto px-6 pt-28 lg:pt-32 pb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-editorial text-2xl font-bold text-slate-900">
                {destination.name} Trip Cost
              </h1>
              <p className="text-sm text-slate-600">
                {days} days, {travelers} {travelers === 1 ? "person" : "people"}
                , {budgetLabel.toLowerCase()} budget
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="text-sm text-primary-700 font-semibold hover:underline"
            >
              New estimate
            </button>
          </div>

          <CostBreakdown
            profile={profile}
            dailyBudget={dailyBudget}
            days={days}
            travelers={travelers}
            budgetLabel={budgetLabel}
            destinationName={destination.name}
          />

          {actions.length > 0 && (
            <ToolAffiliateCard
              title={`Compare real prices for ${destination.name}`}
              subtitle={`Check ${budgetLabel.toLowerCase()} stays for ${travelers} ${travelers === 1 ? "traveler" : "travelers"}, flights, and ${profile.currency} exchange rates.`}
              placement="trip_cost_result"
              campaign={`tool-trip-cost-${destination.slug}`}
              actions={actions}
              editorialNote="Financial & exchange rates vary by provider and market timing; verify current fees and rates directly with Wise before transferring."
              className="mt-8"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <ToolHero
        badge="Free Tool"
        title="Trip Cost Estimator"
        gradientWord="Cost"
        description="Estimate your total trip cost with detailed breakdowns for accommodation, food, transport, and activities across 40+ destinations."
      />

      <section className="max-w-xl mx-auto px-6 pb-16">
        {/* Destination */}
        <div className="mb-8">
          <label
            htmlFor="cost-destination"
            className="block text-sm font-semibold text-slate-900 mb-3"
          >
            Destination
          </label>
          <select
            id="cost-destination"
            value={destination?.slug || ""}
            onChange={(e) => {
              const guide = guides.find((g) => g.slug === e.target.value);
              setDestination(guide || null);
              setShowResult(false);
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

        {/* Duration stepper */}
        <fieldset className="mb-8">
          <legend className="block text-sm font-semibold text-slate-900 mb-3">
            Duration (days)
          </legend>
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Decrease trip duration"
              onClick={() => setDays((d) => Math.max(1, d - 1))}
              disabled={days <= 1}
              className="w-10 h-10 rounded-xl border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="w-4 h-4" aria-hidden="true" />
            </button>
            <output
              aria-live="polite"
              aria-label={`${days} ${days === 1 ? "day" : "days"}`}
              className="text-2xl font-bold text-slate-900 w-12 text-center"
            >
              {days}
            </output>
            <button
              type="button"
              aria-label="Increase trip duration"
              onClick={() => setDays((d) => Math.min(30, d + 1))}
              disabled={days >= 30}
              className="w-10 h-10 rounded-xl border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </fieldset>

        {/* Travelers stepper */}
        <fieldset className="mb-8">
          <legend className="block text-sm font-semibold text-slate-900 mb-3">
            Travelers
          </legend>
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="Decrease number of travelers"
              onClick={() => setTravelers((t) => Math.max(1, t - 1))}
              disabled={travelers <= 1}
              className="w-10 h-10 rounded-xl border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Minus className="w-4 h-4" aria-hidden="true" />
            </button>
            <output
              aria-live="polite"
              aria-label={`${travelers} ${travelers === 1 ? "traveler" : "travelers"}`}
              className="text-2xl font-bold text-slate-900 w-12 text-center"
            >
              {travelers}
            </output>
            <button
              type="button"
              aria-label="Increase number of travelers"
              onClick={() => setTravelers((t) => Math.min(10, t + 1))}
              disabled={travelers >= 10}
              className="w-10 h-10 rounded-xl border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </fieldset>

        {/* Budget level */}
        <fieldset className="mb-8">
          <legend className="block text-sm font-semibold text-slate-900 mb-3">
            Budget Level
          </legend>
          <div className="grid grid-cols-3 gap-3">
            {BUDGET_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  type="button"
                  key={opt.key}
                  onClick={() => setBudgetKey(opt.key)}
                  aria-pressed={budgetKey === opt.key}
                  className={`p-4 rounded-xl border-2 text-center transition-all bg-white ${
                    budgetKey === opt.key
                      ? "border-primary-700 bg-primary-50 shadow-sm"
                      : "border-[#DCE5E3] hover:border-primary-700/40"
                  }`}
                >
                  <div className="flex justify-center mb-2">
                    <Icon
                      className={`w-6 h-6 ${
                        budgetKey === opt.key
                          ? "text-primary-700"
                          : "text-[#143D46]"
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-900 block">
                    {opt.label}
                  </span>
                  <span className="text-xs text-slate-600">
                    ${BUDGET_RANGES[opt.key].daily}/day
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={handleEstimate}
          disabled={!profile}
          className="w-full py-3.5 rounded-full bg-primary-700 hover:bg-primary-800 text-white font-semibold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Calculate My Trip Cost
        </button>
      </section>
    </div>
  );
}
