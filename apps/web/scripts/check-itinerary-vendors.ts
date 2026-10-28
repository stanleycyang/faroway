#!/usr/bin/env bun

import {
  isViatorConfigured,
  searchViatorProducts,
} from "../lib/affiliates/viator";
import {
  isTripAdvisorConfigured,
  searchTripAdvisorLocations,
} from "../lib/affiliates/tripadvisor";
import {
  generateDuffelLink,
  isDuffelConfigured,
  searchDuffelFlights,
} from "../lib/affiliates/duffel";
import {
  isGYGConfigured,
  searchGYGActivities,
} from "../lib/affiliates/getyourguide";
import { searchGooglePlacesActivities } from "../lib/search/agents/activities";
import { searchGooglePlacesDining } from "../lib/search/agents/dining";
import { fetchWithTimeout } from "../lib/search/runtime";

type VendorState = "ok" | "skipped" | "failed";
const REQUIRE_ALL_VENDORS = process.env.ITINERARY_VENDOR_REQUIRE_ALL === "true";
const CHECK_START_DATE = formatDateOffset(45);

interface VendorCheck {
  vendor: string;
  state: VendorState;
  detail: string;
}

function configured(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function formatDateOffset(daysFromNow: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

async function checkViator(): Promise<VendorCheck> {
  if (!isViatorConfigured()) {
    return { vendor: "Viator", state: "skipped", detail: "not configured" };
  }

  const products = await searchViatorProducts({
    destination: "Tokyo",
    startDate: CHECK_START_DATE,
    limit: 1,
  });

  return products.length > 0
    ? {
        vendor: "Viator",
        state: "ok",
        detail: "product search returned inventory",
      }
    : {
        vendor: "Viator",
        state: "failed",
        detail: "product search returned no inventory",
      };
}

async function checkTripAdvisor(): Promise<VendorCheck> {
  if (!isTripAdvisorConfigured()) {
    return {
      vendor: "TripAdvisor",
      state: "skipped",
      detail: "not configured",
    };
  }

  const [hotels, restaurants, attractions] = await Promise.all([
    searchTripAdvisorLocations("Tokyo hotel", "hotels"),
    searchTripAdvisorLocations("Tokyo sushi", "restaurants"),
    searchTripAdvisorLocations("Tokyo museum", "attractions"),
  ]);
  const missing = [
    hotels.length === 0 ? "hotels" : null,
    restaurants.length === 0 ? "restaurants" : null,
    attractions.length === 0 ? "attractions" : null,
  ].filter(Boolean);

  return missing.length === 0
    ? {
        vendor: "TripAdvisor",
        state: "ok",
        detail:
          "location search returned results for hotels, restaurants, and attractions",
      }
    : {
        vendor: "TripAdvisor",
        state: "failed",
        detail: `location search missing categories: ${missing.join(", ")}; check key entitlement`,
      };
}

async function checkGooglePlaces(): Promise<VendorCheck> {
  if (!configured(process.env.GOOGLE_PLACES_API_KEY)) {
    return {
      vendor: "Google Places",
      state: "skipped",
      detail: "not configured",
    };
  }

  const [activities, dining] = await Promise.all([
    searchGooglePlacesActivities("Tokyo", ["museum"]),
    searchGooglePlacesDining("Tokyo", ["sushi"]),
  ]);
  return activities.length > 0 && dining.length > 0
    ? {
        vendor: "Google Places",
        state: "ok",
        detail: "text search returned activity and dining results",
      }
    : {
        vendor: "Google Places",
        state: "failed",
        detail: `text search returned insufficient results (activities=${activities.length}, dining=${dining.length})`,
      };
}

async function checkDuffel(): Promise<VendorCheck> {
  if (!isDuffelConfigured()) {
    return { vendor: "Duffel", state: "skipped", detail: "not configured" };
  }

  const offers = await searchDuffelFlights({
    origin: "SFO",
    destination: "LAX",
    departureDate: CHECK_START_DATE,
    passengers: [{ type: "adult", count: 1 }],
    limit: 1,
  });

  if (offers.length === 0) {
    return {
      vendor: "Duffel",
      state: "failed",
      detail: "offer request returned no offers",
    };
  }

  const link = await generateDuffelLink(offers[0].offerId, 5);
  return link
    ? {
        vendor: "Duffel",
        state: "ok",
        detail: "offer request and links session returned results",
      }
    : {
        vendor: "Duffel",
        state: "failed",
        detail:
          "offer request returned offers but links session returned no URL",
      };
}

async function checkGetYourGuide(): Promise<VendorCheck> {
  if (!isGYGConfigured()) {
    return {
      vendor: "GetYourGuide",
      state: "skipped",
      detail: "not configured",
    };
  }

  const activities = await searchGYGActivities({
    destination: "Tokyo",
    startDate: CHECK_START_DATE,
    limit: 1,
  });

  return activities.length > 0
    ? {
        vendor: "GetYourGuide",
        state: "ok",
        detail: "activity search returned inventory",
      }
    : {
        vendor: "GetYourGuide",
        state: "failed",
        detail: "activity search returned no inventory",
      };
}

async function checkTavily(): Promise<VendorCheck> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!configured(apiKey)) {
    return { vendor: "Tavily", state: "skipped", detail: "not configured" };
  }

  const response = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: "best local experiences in Tokyo",
      search_depth: "basic",
      max_results: 1,
    }),
  });

  if (!response.ok) {
    return {
      vendor: "Tavily",
      state: "failed",
      detail: `search returned HTTP ${response.status}`,
    };
  }

  const data = (await response.json()) as { results?: unknown[] };
  return Array.isArray(data.results) && data.results.length > 0
    ? { vendor: "Tavily", state: "ok", detail: "search returned results" }
    : {
        vendor: "Tavily",
        state: "failed",
        detail: "search returned no results",
      };
}

const checks = await Promise.allSettled([
  checkViator(),
  checkTripAdvisor(),
  checkGooglePlaces(),
  checkDuffel(),
  checkGetYourGuide(),
  checkTavily(),
]);

const results: VendorCheck[] = checks.map((result, index) => {
  if (result.status === "fulfilled") return result.value;
  const vendors = [
    "Viator",
    "TripAdvisor",
    "Google Places",
    "Duffel",
    "GetYourGuide",
    "Tavily",
  ];
  return {
    vendor: vendors[index] || "Unknown",
    state: "failed",
    detail:
      result.reason instanceof Error ? result.reason.message : "unknown error",
  };
});

const reportableResults = REQUIRE_ALL_VENDORS
  ? results.map((result) =>
      result.state === "skipped"
        ? {
            ...result,
            state: "failed" as const,
            detail: `${result.detail}; required by ITINERARY_VENDOR_REQUIRE_ALL=true`,
          }
        : result,
    )
  : results;

for (const result of reportableResults) {
  const marker =
    result.state === "ok" ? "OK" : result.state === "skipped" ? "SKIP" : "FAIL";
  console.log(`${marker} ${result.vendor}: ${result.detail}`);
}

if (reportableResults.some((result) => result.state === "failed")) {
  process.exitCode = 1;
}
