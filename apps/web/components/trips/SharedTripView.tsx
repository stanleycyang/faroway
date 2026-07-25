import React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import Image from "next/image";
import { TripHeader } from "@/components/trips/TripHeader";
import { ItineraryDay } from "@/components/trips/ItineraryDay";
import { ShareButtons } from "@/components/ShareButtons";
import type { TripDay } from "@/lib/ai/types";

interface SharedItinerary {
  days: TripDay[];
  overview: string;
  totalEstimatedCost?: {
    amount: number;
    currency: string;
  };
  packingList?: string[];
  generalTips?: string[];
  generatedAt: string;
}

interface SharedTripViewProps {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelerType?: string;
  vibes?: string[];
  budgetTier?: string;
  itinerary: SharedItinerary | null;
  shareToken: string;
  shareUrl: string;
}

export function SharedTripView({
  destination,
  startDate,
  endDate,
  travelers,
  travelerType,
  vibes,
  itinerary,
  shareToken,
  shareUrl,
}: SharedTripViewProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <TripHeader
        destination={destination}
        startDate={startDate}
        endDate={endDate}
        travelers={travelers}
        totalCost={itinerary?.totalEstimatedCost}
        backUrl="/"
        showActions={false}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Trip Meta */}
        {(travelerType || (vibes && vibes.length > 0)) && (
          <div className="flex flex-wrap gap-2 mb-6">
            {travelerType && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-primary-50 text-primary-700 font-semibold ring-1 ring-primary-200/50">
                {travelerType}
              </span>
            )}
            {vibes?.map((vibe) => (
              <span
                key={vibe}
                className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-primary-50 text-primary-700 ring-1 ring-primary-200/50"
              >
                {vibe}
              </span>
            ))}
          </div>
        )}

        {/* Overview */}
        {itinerary?.overview && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              Trip Overview
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {itinerary.overview}
            </p>
          </div>
        )}

        {/* Day-by-Day Itinerary */}
        {itinerary?.days && itinerary.days.length > 0 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">
              Day-by-Day Itinerary
            </h2>
            {itinerary.days.map((day) => (
              <ItineraryDay
                key={day.dayNumber}
                dayNumber={day.dayNumber}
                date={day.date}
                title={day.title}
                summary={day.summary}
                morning={day.morning}
                afternoon={day.afternoon}
                evening={day.evening}
                totalEstimatedCost={day.totalEstimatedCost}
                tips={day.tips}
                defaultExpanded={true}
              />
            ))}
          </div>
        )}

        {/* General Tips */}
        {itinerary?.generalTips && itinerary.generalTips.length > 0 && (
          <div className="mt-6 bg-gradient-to-r from-primary-50 to-amber-50 rounded-2xl p-6 border border-primary-100/50">
            <h3 className="font-bold text-primary-800 mb-3 flex items-center gap-2">
              <span className="text-lg">💡</span> Travel Tips for {destination}
            </h3>
            <ul className="space-y-2">
              {itinerary.generalTips.map((tip, i) => (
                <li
                  key={i}
                  className="text-sm text-primary-700 flex items-start gap-2"
                >
                  <span className="text-primary-400 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Packing List */}
        {itinerary?.packingList && itinerary.packingList.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-lg">🧳</span> Packing Suggestions
            </h3>
            <div className="flex flex-wrap gap-2">
              {itinerary.packingList.map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-700 font-medium"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Share Section */}
        <div className="mt-8 bg-gradient-to-r from-primary-50 to-amber-50 rounded-2xl p-6 sm:p-8 text-center border border-primary-100/30">
          <h3 className="font-bold text-gray-900 mb-2 text-lg">
            📤 Share This Trip
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Know someone who&apos;d love this itinerary? Spread the word!
          </p>
          <ShareButtons
            url={shareUrl}
            title={`${destination} Trip Itinerary`}
            description={`Check out this ${itinerary?.days?.length || ""}-day AI-generated itinerary to ${destination}! Created with Faroway.`}
            hashtags={["Faroway", "Travel", destination.replace(/\s+/g, "")]}
            className="justify-center"
          />
        </div>

        <div className="mt-6 text-center">
          <Link
            href={`/report?type=shared_trip&token=${encodeURIComponent(shareToken)}`}
            className="text-sm font-semibold text-gray-500 underline-offset-4 hover:text-gray-800 hover:underline"
          >
            Report this itinerary
          </Link>
        </div>

        {/* CTA Banner */}
        <div className="mt-8 bg-gradient-to-br from-primary to-primary-700 rounded-2xl p-8 sm:p-10 text-center text-white overflow-hidden relative">
          {/* Decorative glow */}
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />

          <div className="relative">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 shadow-lg overflow-hidden">
              <Image
                src="/icon.png"
                alt="Faroway"
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-2xl font-black mb-3">Create Your Own Trip</h3>
            <p className="text-white/80 mb-6 max-w-md mx-auto leading-relaxed">
              Plan your perfect trip in 60 seconds with our AI-powered travel
              planner. Get personalized itineraries, hotel picks, and bookable
              experiences.
            </p>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-primary-700 rounded-full font-bold hover:bg-white/90 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
            >
              <Sparkles className="w-5 h-5" />
              Get Started Free
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
