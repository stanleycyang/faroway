'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { getAllGuides, type DestinationGuide } from '@/lib/destination-guides';
import { getCostProfile } from '@/lib/tools/cost-data';
import { BUDGET_RANGES } from '@tripgenie/constants';
import { CostBreakdown } from './CostBreakdown';
import { ToolHero } from '@/components/tools/ToolHero';
import { ToolCTA } from '@/components/tools/ToolCTA';
import { RelatedTools } from '@/components/tools/RelatedTools';

const guides = getAllGuides();

const BUDGET_OPTIONS = [
  { key: 'budget', label: 'Budget', emoji: '🎒', description: 'Hostels, street food, public transit' },
  { key: 'moderate', label: 'Mid-Range', emoji: '💳', description: 'Hotels, restaurants, some tours' },
  { key: 'luxury', label: 'Luxury', emoji: '👑', description: 'Top hotels, fine dining, private tours' },
] as const;

export function CostEstimatorClient() {
  const [destination, setDestination] = useState<DestinationGuide | null>(null);
  const [days, setDays] = useState(5);
  const [travelers, setTravelers] = useState(2);
  const [budgetKey, setBudgetKey] = useState<'budget' | 'moderate' | 'luxury'>('moderate');
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
    const budgetLabel = BUDGET_OPTIONS.find((o) => o.key === budgetKey)?.label || '';

    return (
      <main className="min-h-screen">
        <div className="max-w-xl mx-auto px-6 pt-28 lg:pt-32 pb-16">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {destination.name} Trip Cost
              </h1>
              <p className="text-sm text-slate-500">
                {days} days, {travelers} {travelers === 1 ? 'person' : 'people'}, {budgetLabel.toLowerCase()} budget
              </p>
            </div>
            <button
              onClick={handleReset}
              className="text-sm text-primary font-medium hover:underline"
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
        </div>

        <ToolCTA
          title={`Plan Your ${destination.name} Trip`}
          description={`Get a personalized ${destination.name} itinerary with real booking links — free.`}
        />
        <RelatedTools currentSlug="trip-cost" />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <ToolHero
        badge="Free Tool"
        title="Trip Cost Estimator"
        gradientWord="Cost"
        description="Estimate your total trip cost with detailed breakdowns for accommodation, food, transport, and activities across 14 destinations."
      />

      <section className="max-w-xl mx-auto px-6 pb-16">
        {/* Destination */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-slate-900 mb-3">
            Destination
          </label>
          <select
            value={destination?.slug || ''}
            onChange={(e) => {
              const guide = guides.find((g) => g.slug === e.target.value);
              setDestination(guide || null);
              setShowResult(false);
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

        {/* Duration stepper */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-slate-900 mb-3">
            Duration (days)
          </label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDays((d) => Math.max(1, d - 1))}
              className="w-10 h-10 rounded-xl border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-2xl font-bold text-slate-900 w-12 text-center">
              {days}
            </span>
            <button
              onClick={() => setDays((d) => Math.min(30, d + 1))}
              className="w-10 h-10 rounded-xl border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Travelers stepper */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-slate-900 mb-3">
            Travelers
          </label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTravelers((t) => Math.max(1, t - 1))}
              className="w-10 h-10 rounded-xl border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-2xl font-bold text-slate-900 w-12 text-center">
              {travelers}
            </span>
            <button
              onClick={() => setTravelers((t) => Math.min(10, t + 1))}
              className="w-10 h-10 rounded-xl border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Budget level */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-slate-900 mb-3">
            Budget Level
          </label>
          <div className="grid grid-cols-3 gap-3">
            {BUDGET_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setBudgetKey(opt.key)}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  budgetKey === opt.key
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-slate-200 hover:border-primary/30'
                }`}
              >
                <span className="text-2xl block mb-1">{opt.emoji}</span>
                <span className="text-sm font-semibold text-slate-900 block">
                  {opt.label}
                </span>
                <span className="text-xs text-slate-500">${BUDGET_RANGES[opt.key].daily}/day</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleEstimate}
          disabled={!destination}
          className="w-full py-3.5 rounded-full bg-gradient-to-r from-primary to-amber-500 text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          Calculate My Trip Cost
        </button>
      </section>

      <RelatedTools currentSlug="trip-cost" />
      <ToolCTA />
    </main>
  );
}
