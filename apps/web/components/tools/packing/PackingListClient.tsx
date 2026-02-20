'use client';

import { useState } from 'react';
import { getAllGuides, type DestinationGuide } from '@/lib/destination-guides';
import {
  generatePackingList,
  TRIP_TYPES,
  type TripType,
  type PackingCategory,
} from '@/lib/tools/packing-data';
import { PackingChecklist } from './PackingChecklist';
import { ToolCTA } from '@/components/tools/ToolCTA';
import { RelatedTools } from '@/components/tools/RelatedTools';
import { ToolHero } from '@/components/tools/ToolHero';

const guides = getAllGuides();

export function PackingListClient() {
  const [destination, setDestination] = useState<DestinationGuide | null>(null);
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [packingList, setPackingList] = useState<PackingCategory[] | null>(null);

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
    return (
      <main className="min-h-screen">
        <div className="max-w-2xl mx-auto px-6 pt-28 lg:pt-32 pb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Packing for {destination.name}
              </h1>
              <p className="text-sm text-slate-500">
                {TRIP_TYPES.find((t) => t.id === tripType)?.emoji}{' '}
                {TRIP_TYPES.find((t) => t.id === tripType)?.label} trip
              </p>
            </div>
            <button
              onClick={handleReset}
              className="text-sm text-primary font-medium hover:underline print-hidden"
            >
              New list
            </button>
          </div>

          <PackingChecklist
            categories={packingList}
            storageKey={`packing-${destination.slug}-${tripType}`}
          />
        </div>

        <div className="print-hidden">
          <ToolCTA
            title={`Ready to Plan Your ${destination.name} Trip?`}
            description={`Let TripGenie create a personalized ${destination.name} itinerary — completely free.`}
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
          <label className="block text-sm font-semibold text-slate-900 mb-3">
            Where are you going?
          </label>
          <select
            value={destination?.slug || ''}
            onChange={(e) => {
              const guide = guides.find((g) => g.slug === e.target.value);
              setDestination(guide || null);
            }}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
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
        <div className="mb-8">
          <label className="block text-sm font-semibold text-slate-900 mb-3">
            What type of trip?
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TRIP_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setTripType(type.id)}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  tripType === type.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-slate-200 hover:border-primary/30'
                }`}
              >
                <span className="text-2xl block mb-1">{type.emoji}</span>
                <span className="text-sm font-medium text-slate-900">
                  {type.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!destination || !tripType}
          className="w-full py-3.5 rounded-full bg-gradient-to-r from-primary to-amber-500 text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          Generate My Packing List
        </button>
      </section>

      <RelatedTools currentSlug="packing-list" />
      <ToolCTA />
    </main>
  );
}
