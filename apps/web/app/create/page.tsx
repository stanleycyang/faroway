"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Search,
  Calendar,
  Users,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowLeft,
  Check,
  Minus,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import { IMAGE_PATHS, getImageUrl } from "@faroway/constants";
import {
  PlacesAutocompleteInput,
  type PlaceResult,
} from "@/components/create/PlacesAutocompleteInput";
import { DatePicker } from "@/components/trips/DatePicker";
import { trackEvent } from "@/lib/analytics/mixpanel";
import { EVENTS } from "@faroway/analytics";

// Dynamic import — Leaflet must not run on the server
const DestinationMap = dynamic(
  () =>
    import("@/components/create/DestinationMap").then((m) => ({
      default: m.DestinationMap,
    })),
  { ssr: false },
);

const destinations = [
  {
    id: "tokyo",
    name: "Tokyo",
    country: "Japan",
    lat: 35.6762,
    lng: 139.6503,
    image: getImageUrl(IMAGE_PATHS.destinations.tokyo),
  },
  {
    id: "paris",
    name: "Paris",
    country: "France",
    lat: 48.8566,
    lng: 2.3522,
    image: getImageUrl(IMAGE_PATHS.destinations.paris),
  },
  {
    id: "bali",
    name: "Bali",
    country: "Indonesia",
    lat: -8.3405,
    lng: 115.092,
    image: getImageUrl(IMAGE_PATHS.destinations.bali),
  },
  {
    id: "new-york",
    name: "New York",
    country: "USA",
    lat: 40.7128,
    lng: -74.006,
    image: getImageUrl(IMAGE_PATHS.destinations["new-york"]),
  },
  {
    id: "santorini",
    name: "Santorini",
    country: "Greece",
    lat: 36.3932,
    lng: 25.4615,
    image: getImageUrl(IMAGE_PATHS.destinations.santorini),
  },
  {
    id: "barcelona",
    name: "Barcelona",
    country: "Spain",
    lat: 41.3874,
    lng: 2.1686,
    image: getImageUrl(IMAGE_PATHS.destinations.barcelona),
  },
];

const travelerTypes = [
  { id: "solo", label: "Solo", icon: "🧑" },
  { id: "couple", label: "Couple", icon: "💑" },
  { id: "family", label: "Family", icon: "👨‍👩‍👧‍👦" },
  { id: "friends", label: "Friends", icon: "👯" },
  { id: "business", label: "Business", icon: "💼" },
];

const vibes = [
  { id: "adventure", label: "Adventure", emoji: "🏔️" },
  { id: "relaxation", label: "Relaxation", emoji: "🏖️" },
  { id: "cultural", label: "Cultural", emoji: "🏛️" },
  { id: "foodie", label: "Foodie", emoji: "🍜" },
  { id: "nightlife", label: "Nightlife", emoji: "🌃" },
  { id: "romantic", label: "Romantic", emoji: "💕" },
  { id: "nature", label: "Nature", emoji: "🌿" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "wellness", label: "Wellness", emoji: "🧘" },
  { id: "photography", label: "Photography", emoji: "📸" },
];

interface SelectedPlace {
  name: string;
  lat: number;
  lng: number;
  placeId: string;
  isRecommended: boolean;
}

export default function CreateTripPage() {
  const router = useRouter();
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(
    null,
  );
  const [showDestinations, setShowDestinations] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [travelers, setTravelers] = useState(2);
  const [travelerType, setTravelerType] = useState("couple");
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState("");

  const selectedRecommendedDest = selectedPlace?.isRecommended
    ? destinations.find((d) => d.name === selectedPlace.name)
    : null;

  const toggleVibe = (vibeId: string) => {
    setSelectedVibes((prev) =>
      prev.includes(vibeId)
        ? prev.filter((v) => v !== vibeId)
        : prev.length < 5
          ? [...prev, vibeId]
          : prev,
    );
  };

  const canGenerate = selectedPlace && startDate && endDate;

  const handleSelectRecommended = (dest: (typeof destinations)[number]) => {
    setSelectedPlace({
      name: dest.name,
      lat: dest.lat,
      lng: dest.lng,
      placeId: dest.id,
      isRecommended: true,
    });
    setShowDestinations(false);
    trackEvent(EVENTS.TRIP_DESTINATION_SELECTED, {
      destination: dest.name,
      country: dest.country,
      is_recommended: true,
    });
  };

  const handleSelectFromAutocomplete = (place: PlaceResult) => {
    const recommended = destinations.find(
      (d) => d.name.toLowerCase() === place.name.toLowerCase(),
    );
    setSelectedPlace({
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      placeId: place.placeId,
      isRecommended: !!recommended,
    });
    setShowDestinations(false);
    trackEvent(EVENTS.TRIP_DESTINATION_SELECTED, {
      destination: place.name,
      is_recommended: !!recommended,
    });
  };

  const handleChangeDestination = () => {
    setSelectedPlace(null);
    setShowDestinations(true);
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setGenerateError(null);
    setProgressMessage("Creating your trip...");

    trackEvent(EVENTS.TRIP_GENERATING, {
      destination: selectedPlace.name,
      start_date: format(startDate!, "yyyy-MM-dd"),
      end_date: format(endDate!, "yyyy-MM-dd"),
      travelers,
      traveler_type: travelerType,
      vibes: selectedVibes,
    });

    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: selectedPlace.name,
          start_date: format(startDate!, "yyyy-MM-dd"),
          end_date: format(endDate!, "yyyy-MM-dd"),
          travelers,
          budget: "moderate",
          preferences: {
            travelerType,
            vibes: selectedVibes,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create trip");
      }

      const { trip } = await response.json();

      // Store anonymous trip ID in localStorage so it can be claimed after sign-up
      if (!trip.user_id) {
        try {
          const stored = JSON.parse(
            localStorage.getItem("faroway_anonymous_trips") || "[]",
          );
          if (!stored.includes(trip.id)) {
            stored.push(trip.id);
            localStorage.setItem(
              "faroway_anonymous_trips",
              JSON.stringify(stored),
            );
          }
        } catch {
          localStorage.setItem(
            "faroway_anonymous_trips",
            JSON.stringify([trip.id]),
          );
        }
      }

      setProgressMessage("Starting AI trip planner...");

      const genResponse = await fetch(`/api/trips/${trip.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: {
            vibes: selectedVibes,
          },
        }),
      });

      if (!genResponse.ok) {
        const genData = await genResponse.json().catch(() => ({}));
        if (genResponse.status !== 409) {
          throw new Error(
            genData.error || "Failed to start itinerary generation",
          );
        }
      }

      trackEvent(EVENTS.TRIP_CREATED, {
        trip_id: trip.id,
        destination: selectedPlace.name,
        duration_days: Math.ceil(
          (endDate!.getTime() - startDate!.getTime()) / (1000 * 60 * 60 * 24),
        ),
        travelers,
        traveler_type: travelerType,
        vibes: selectedVibes,
      });

      // Redirect to trip detail page — real progress happens there via SSE
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      setGenerateError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
      setIsGenerating(false);
      setProgressMessage("");
    }
  };

  const renderSelectedDestination = () => {
    if (!selectedPlace || showDestinations) return null;

    const hasCoords = selectedPlace.lat !== 0 && selectedPlace.lng !== 0;
    const country = selectedRecommendedDest?.country;

    return (
      <div className="relative h-48 rounded-xl overflow-hidden group">
        {hasCoords ? (
          <DestinationMap
            lat={selectedPlace.lat}
            lng={selectedPlace.lng}
            name={selectedPlace.name}
          />
        ) : (
          <div className="h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {selectedPlace.name}
              </p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-4 left-4">
          {country && (
            <p className="text-primary-300 text-sm font-medium uppercase tracking-wide drop-shadow-lg">
              {country}
            </p>
          )}
          <h3 className="text-2xl font-bold text-white drop-shadow-lg">
            {selectedPlace.name}
          </h3>
        </div>
        <button
          onClick={handleChangeDestination}
          className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium text-gray-700 hover:bg-white transition-colors z-10"
        >
          Change
        </button>
      </div>
    );
  };

  const renderDestinationSearch = () => {
    if (selectedPlace && !showDestinations) return null;

    return (
      <>
        <PlacesAutocompleteInput
          onSelect={handleSelectFromAutocomplete}
          localDestinations={destinations.map((d) => ({
            name: d.name,
            country: d.country,
          }))}
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          {destinations.map((dest) => (
            <button
              key={dest.id}
              aria-label={`Select ${dest.name}, ${dest.country}`}
              aria-pressed={selectedPlace?.name === dest.name}
              onClick={() => handleSelectRecommended(dest)}
              className={`relative h-32 rounded-xl overflow-hidden group ${selectedPlace?.name === dest.name ? "ring-2 ring-primary ring-offset-2" : ""}`}
            >
              <Image
                src={dest.image}
                alt={`${dest.name}, ${dest.country}`}
                fill
                className="object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3">
                <p className="text-white font-semibold">{dest.name}</p>
                <p className="text-white/70 text-xs">{dest.country}</p>
              </div>
              {selectedPlace?.name === dest.name && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline font-medium">Back</span>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">
            Plan Your Trip
          </h1>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 mb-8">
          <div
            className={`h-1 flex-1 rounded-full ${selectedPlace ? "bg-primary" : "bg-gray-200"}`}
          />
          <div
            className={`h-1 flex-1 rounded-full ${startDate && endDate ? "bg-primary" : "bg-gray-200"}`}
          />
          <div
            className={`h-1 flex-1 rounded-full ${showAdvanced && (selectedVibes.length > 0 || travelerType) ? "bg-primary" : "bg-gray-200"}`}
          />
        </div>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <Search className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Where do you want to go?
              </h2>
              <p className="text-sm text-gray-500">
                Search or select a destination
              </p>
            </div>
          </div>

          {renderSelectedDestination()}
          {renderDestinationSearch()}
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                When are you traveling?
              </h2>
              <p className="text-sm text-gray-500">Select your trip dates</p>
            </div>
          </div>

          <DatePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-gray-600" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-semibold text-gray-900">
                  Customize your trip
                </h2>
                <p className="text-sm text-gray-500">
                  Travelers, trip type, vibes (optional)
                </p>
              </div>
            </div>
            {showAdvanced ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showAdvanced && (
            <div className="px-6 pb-6 pt-2 border-t border-gray-100">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Number of travelers
                </label>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                  <span className="text-gray-700 font-medium">Travelers</span>
                  <div className="flex items-center gap-4">
                    <button
                      aria-label="Decrease travelers"
                      onClick={() => setTravelers(Math.max(1, travelers - 1))}
                      disabled={travelers <= 1}
                      className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span
                      className="text-xl font-semibold text-gray-900 w-8 text-center"
                      aria-live="polite"
                    >
                      {travelers}
                    </span>
                    <button
                      aria-label="Increase travelers"
                      onClick={() => setTravelers(Math.min(10, travelers + 1))}
                      disabled={travelers >= 10}
                      className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Who&apos;s traveling?
                </label>
                <div className="flex flex-wrap gap-2">
                  {travelerTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setTravelerType(type.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all ${
                        travelerType === type.id
                          ? "border-primary bg-primary-50 text-primary-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <span>{type.icon}</span>
                      <span className="font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What&apos;s your vibe?
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  Select up to 5 that match your travel style
                </p>
                <div className="flex flex-wrap gap-2">
                  {vibes.map((vibe) => (
                    <button
                      key={vibe.id}
                      onClick={() => toggleVibe(vibe.id)}
                      disabled={
                        !selectedVibes.includes(vibe.id) &&
                        selectedVibes.length >= 5
                      }
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all ${
                        selectedVibes.includes(vibe.id)
                          ? "border-primary bg-primary-50 text-primary-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      }`}
                    >
                      <span>{vibe.emoji}</span>
                      <span className="font-medium">{vibe.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="sticky bottom-0 bg-gray-50 pt-4 pb-8 -mx-4 px-4 sm:-mx-6 sm:px-6">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
              canGenerate && !isGenerating
                ? "bg-primary hover:bg-primary-600 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {progressMessage || "Creating your itinerary..."}
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Itinerary
              </>
            )}
          </button>
          {generateError && (
            <div
              className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-center"
              role="alert"
            >
              {generateError}
            </div>
          )}
          <p className="text-center text-sm text-gray-500 mt-3">
            {canGenerate
              ? "AI will create a personalized day-by-day plan"
              : "Select a destination and dates to continue"}
          </p>
        </div>
      </main>
    </div>
  );
}
