import React from "react";
import { act, create } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  ActivityResult,
  DiningResult,
  HotelResult,
  SearchPlan,
  TransportResult,
  TripDay,
} from "@faroway/types";
import {
  MAX_AGENT_DISCOVERIES,
  buildAccessibilityDiscovery,
  buildActivitiesDiscovery,
  buildDayOneDiscovery,
  buildDiningDiscoveries,
  buildEnrichmentDiscovery,
  buildHotelsDiscovery,
  buildOrchestratorDiscovery,
  buildTransportDiscovery,
  extractAgentDiscoveries,
  mergeDiscoveries,
  type AgentDiscovery,
} from "@/lib/trips/streaming-dossier";
import { useTripGeneration } from "@/hooks/useTripGeneration";
import { ItineraryGenerationLoader } from "@/components/trips/ItineraryGenerationLoader";

const sampleHotel: HotelResult = {
  id: "hotel-1",
  name: "Hotel Grand Kyoto",
  location: {
    name: "Kyoto",
    neighborhood: "Gion",
    address: "123 Gion St",
    lat: 35.0,
    lng: 135.7,
  },
  vibeScore: 92,
  vibeMatch: ["culture"],
  userRating: 4.8,
  reviewCount: 410,
  pricePerNight: 290,
  currency: "USD",
  amenities: ["Wi-Fi", "Onsen"],
  description: "Quiet stay in Gion",
  affiliateUrl: "https://example.com/hotel",
  affiliatePartner: "liteapi",
  images: [],
  starRating: 4,
};

const sampleActivity: ActivityResult = {
  id: "act-1",
  name: "Fushimi Inari Dawn Walk",
  description: "Early walk through torii gates",
  category: "cultural",
  duration: 120,
  price: 45,
  currency: "USD",
  rating: 4.9,
  reviewCount: 320,
  location: {
    name: "Kyoto",
    neighborhood: "Fushimi",
    address: "",
    lat: 34.96,
    lng: 135.77,
  },
  images: [],
  affiliateUrl: "https://example.com/act",
  affiliatePartner: "viator",
  bestTimeOfDay: "morning",
  vibeScore: 95,
  vibeMatch: ["culture"],
  bookingRequired: true,
};

const sampleDining: DiningResult = {
  id: "din-1",
  name: "Nishiki Soba Kitchen",
  description: "Handmade buckwheat noodles",
  cuisineTypes: ["Japanese"],
  priceLevel: 2,
  dietaryOptions: ["gluten-free"],
  mealTypes: ["lunch"],
  location: {
    name: "Kyoto",
    neighborhood: "Nakagyo",
    address: "",
    lat: 35.0,
    lng: 135.76,
  },
  images: [],
  reservationUrl: "https://example.com/din",
  vibeScore: 88,
  vibeMatch: ["foodie"],
  rating: 4.6,
  reviewCount: 180,
};

const sampleTransport: TransportResult = {
  id: "tr-1",
  source: "duffel",
  provider: "ANA",
  type: "flight",
  departure: {
    airport: "SFO",
    city: "San Francisco",
    dateTime: "2026-10-01T10:00:00Z",
  },
  arrival: {
    airport: "KIX",
    city: "Osaka",
    dateTime: "2026-10-02T14:00:00Z",
  },
  duration: 690,
  stops: 0,
  price: 1050,
  currency: "USD",
  vibeScore: 80,
  vibeMatch: [],
  airlines: ["ANA"],
  segments: [],
  affiliateUrl: "https://example.com/flight",
  affiliatePartner: "duffel",
};

const sampleDayOne: TripDay = {
  dayNumber: 1,
  date: "2026-10-01",
  title: "Lanterns & Temples in Gion",
  summary: "Ease into Kyoto with an afternoon temple stroll and local soba.",
  morning: {
    activities: [
      {
        id: "act-1",
        name: "Fushimi Inari Dawn Walk",
        description: "Early walk through torii gates",
        duration: 120,
        estimatedCost: { amount: 45, currency: "USD" },
        timeOfDay: "morning",
        category: "cultural",
        location: { name: "Fushimi" },
        vibeMatch: {
          matchedVibes: ["culture"],
          reasoning: "Matches your culture style",
        },
      },
    ],
    meals: [],
  },
  afternoon: {
    activities: [],
    meals: [
      {
        id: "din-1",
        name: "Nishiki Soba Kitchen",
        cuisineType: ["Japanese"],
        description: "Handmade buckwheat noodles",
        estimatedCost: { amount: 25, currency: "USD", perPerson: true },
        mealType: "lunch",
        location: { name: "Nakagyo" },
        dietaryOptions: ["gluten-free"],
        vibeMatch: {
          matchedVibes: ["foodie"],
          reasoning: "Matches your foodie style",
        },
      },
    ],
  },
  evening: { activities: [], meals: [] },
  tips: [],
};

const samplePlan: SearchPlan = {
  destination: "Kyoto",
  country: "Japan",
  dates: { start: "2026-10-01", end: "2026-10-05", nights: 4 },
  searchPriorities: ["hotels", "activities", "dining", "transport"],
  vibeInterpretation: {
    vibes: ["foodie", "culture"],
    searchKeywords: ["temples", "soba"],
    avoidKeywords: [],
  },
  hotelCriteria: {
    priceRange: { min: 150, max: 350 },
    starRating: [4],
    amenities: ["Wi-Fi"],
    neighborhoods: ["Gion"],
  },
  activityCriteria: {
    categories: ["cultural"],
    mustSee: ["Fushimi Inari"],
    interests: ["temples"],
    pacePreference: "moderate",
  },
  diningCriteria: {
    cuisineTypes: ["Japanese"],
    priceRange: "moderate",
    dietaryNeeds: ["gluten-free"],
    mealPriorities: ["lunch", "dinner"],
  },
  requirements: {
    dietaryPreferences: ["gluten-free"],
    allergies: ["peanuts"],
    accessibility: ["step_free_entrance"],
    mobilityNotes: "Prefer elevators",
  },
  transportCriteria: {
    originAirport: "SFO",
    destinationAirport: "KIX",
    cabinClass: "economy",
    maxStops: 1,
  },
};

describe("mergeDiscoveries", () => {
  it("deduplicates by id and bounds list length to max 12 items", () => {
    const initial: AgentDiscovery[] = Array.from({ length: 10 }, (_, idx) => ({
      id: `item-${idx}`,
      agent: "activities",
      headline: `Find ${idx}`,
      timestamp: 1000 + idx,
    }));

    const incoming: AgentDiscovery[] = [
      {
        id: "item-2",
        agent: "activities",
        headline: "Updated Find 2",
        detail: "Richer detail",
        timestamp: 2000,
      },
      {
        id: "item-10",
        agent: "dining",
        headline: "Find 10",
        timestamp: 2001,
      },
      {
        id: "item-11",
        agent: "dining",
        headline: "Find 11",
        timestamp: 2002,
      },
      {
        id: "item-12",
        agent: "aggregator",
        headline: "Find 12",
        timestamp: 2003,
      },
    ];

    const merged = mergeDiscoveries(initial, incoming);
    expect(merged).toHaveLength(MAX_AGENT_DISCOVERIES);
    // item-0 rolled off because 13 unique items were bounded to the latest 12.
    expect(merged.some((item) => item.id === "item-0")).toBe(false);
    expect(merged.find((item) => item.id === "item-2")?.headline).toBe(
      "Updated Find 2",
    );
    expect(merged.at(-1)?.id).toBe("item-12");
  });

  it("preserves existing entries when preferExisting is enabled", () => {
    const existing: AgentDiscovery[] = [
      {
        id: "hotels:top",
        agent: "hotels",
        headline: "Scouted 8 stays — top pick: Hotel Grand Kyoto",
        detail: "Gion · 4.8★",
        badge: "Stays",
        timestamp: 1000,
      },
    ];
    const synthetic: AgentDiscovery[] = [
      {
        id: "hotels:top",
        agent: "hotels",
        headline: "Top stay found: Hotel Grand Kyoto",
        timestamp: 2000,
      },
    ];

    const merged = mergeDiscoveries(existing, synthetic, 12, {
      preferExisting: true,
    });
    expect(merged).toHaveLength(1);
    expect(merged[0].headline).toBe(
      "Scouted 8 stays — top pick: Hotel Grand Kyoto",
    );
  });
});

describe("extractAgentDiscoveries and workflow builders", () => {
  it("synthesizes grounded finds from legacy stream fields without fabricating empty results", () => {
    const empty = extractAgentDiscoveries({
      searchProgress: { hotels: "searching", activities: "error" },
      topHotel: null,
      activitiesCount: 0,
      diningCount: 0,
      transportCount: 0,
      days: null,
    });
    expect(empty).toEqual([]);

    const grounded = extractAgentDiscoveries({
      searchProgress: { orchestrator: "done", enrichment: "done" },
      topHotel: sampleHotel,
      activitiesCount: 9,
      diningCount: 6,
      transportCount: 3,
      days: [sampleDayOne],
      now: 5000,
    });

    expect(grounded.map((item) => item.id)).toEqual([
      "orchestrator:plan",
      "hotels:top",
      "activities:summary",
      "dining:summary",
      "transport:summary",
      "enrichment:summary",
      "aggregator:day-1",
    ]);
    expect(grounded.find((item) => item.id === "hotels:top")).toMatchObject({
      headline: "Top stay found: Hotel Grand Kyoto",
      detail: "Gion · 4.8★",
    });
    expect(
      grounded.find((item) => item.id === "aggregator:day-1"),
    ).toMatchObject({
      headline: "Day 1 ready: Lanterns & Temples in Gion",
      detail: "2 stops arranged",
      badge: "Day 1 ready",
    });
  });

  it("builds factual specialist discoveries and honest safety notes", () => {
    expect(buildOrchestratorDiscovery(samplePlan, 100)).toMatchObject({
      id: "orchestrator:plan",
      headline: "Mapped 5-day brief for Kyoto",
      detail: "Focus: foodie, culture",
    });
    expect(buildHotelsDiscovery([sampleHotel], 0, 100)).toBeNull();
    expect(buildHotelsDiscovery([], 4, 100)).toBeNull();
    expect(buildHotelsDiscovery([sampleHotel], 4, 100)).toMatchObject({
      id: "hotels:top",
      headline: "Top stay: Hotel Grand Kyoto",
      detail: "Gion · 4.8★",
    });
    expect(buildActivitiesDiscovery([sampleActivity], 100)).toMatchObject({
      id: "activities:summary",
      headline: "Found 1 experience",
      detail: "Includes Fushimi Inari Dawn Walk · Notable area: Fushimi",
    });

    const diningWithSafety = buildDiningDiscoveries(
      [sampleDining],
      samplePlan,
      100,
    );
    expect(diningWithSafety).toHaveLength(2);
    expect(diningWithSafety[1]).toMatchObject({
      id: "dining:safety",
      badge: "Safety filter",
    });
    expect(diningWithSafety[1].detail).toContain("confirm directly");

    const diningNoSafety = buildDiningDiscoveries(
      [sampleDining],
      undefined,
      100,
    );
    expect(diningNoSafety).toHaveLength(1);

    expect(buildTransportDiscovery([sampleTransport], 100)).toMatchObject({
      id: "transport:summary",
      detail: "SFO → KIX · Nonstop available",
    });
    expect(
      buildEnrichmentDiscovery({ activities: [], dining: [], notes: [] }, 100),
    ).toBeNull();
    expect(
      buildEnrichmentDiscovery(
        { activities: [sampleActivity], dining: [], notes: [] },
        100,
      ),
    ).toMatchObject({
      id: "enrichment:summary",
      headline: "Added 1 local gem",
      detail: "Includes Fushimi Inari Dawn Walk",
    });
    expect(buildDayOneDiscovery(sampleDayOne, 5, 100)).toMatchObject({
      id: "aggregator:day-1",
      detail: "2 stops arranged · finishing 4 remaining days",
    });
    expect(buildAccessibilityDiscovery(samplePlan, 100)).toMatchObject({
      id: "aggregator:accessibility",
      badge: "Accessibility",
    });
  });
});

describe("useTripGeneration discoveries and Day-1 reveal", () => {
  it("streams explicit discoveries, synthesizes legacy events, unlocks day_ready, and resets on new tripId", async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const sources: Array<{
      listeners: Map<string, (event: { data?: string }) => void>;
    }> = [];
    vi.stubGlobal(
      "EventSource",
      class {
        listeners = new Map<string, (event: { data?: string }) => void>();
        constructor() {
          sources.push(this);
        }
        addEventListener(
          name: string,
          listener: (event: { data?: string }) => void,
        ) {
          this.listeners.set(name, listener);
        }
        close() {}
      },
    );

    let state!: ReturnType<typeof useTripGeneration>;
    function Probe({ tripId }: { tripId: string }) {
      const current = useTripGeneration({
        tripId,
        generationId: `gen-${tripId}`,
      });
      React.useEffect(() => {
        state = current;
      }, [current]);
      return null;
    }

    let renderer: ReturnType<typeof create> | undefined;
    try {
      await act(async () => {
        renderer = create(React.createElement(Probe, { tripId: "trip-a" }));
      });
      expect(state.discoveries).toEqual([]);

      await act(async () => {
        sources[0].listeners.get("open")!({});
        sources[0].listeners.get("discovery")!({
          data: JSON.stringify({
            id: "hotels:top",
            agent: "hotels",
            headline: "Scouted 6 stays — top pick: Hotel Grand Kyoto",
            detail: "Gion · 4.8★",
            badge: "Stays",
            timestamp: 100,
          }),
        });
        // Legacy top_hotel event with the same canonical ID should not downgrade explicit discovery.
        sources[0].listeners.get("top_hotel")!({
          data: JSON.stringify({ topHotel: sampleHotel }),
        });
        sources[0].listeners.get("activities")!({
          data: JSON.stringify({ count: 7 }),
        });
        sources[0].listeners.get("day_ready")!({
          data: JSON.stringify({ day: sampleDayOne }),
        });
      });

      expect(state.days).toHaveLength(1);
      expect(state.days?.[0].dayNumber).toBe(1);
      expect(state.discoveries.map((d) => d.id)).toEqual([
        "hotels:top",
        "activities:summary",
        "aggregator:day-1",
      ]);
      expect(state.discoveries[0].headline).toBe(
        "Scouted 6 stays — top pick: Hotel Grand Kyoto",
      );

      // Switching to a new tripId resets discoveries cleanly.
      await act(async () => {
        renderer!.update(React.createElement(Probe, { tripId: "trip-b" }));
      });
      expect(state.discoveries).toEqual([]);
      expect(state.days).toBeNull();
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      vi.unstubAllGlobals();
    }
  });
});

describe("ItineraryGenerationLoader Pillar C UI", () => {
  it("renders the Live Agent Scout Feed and Day 1 preview panel while generating", () => {
    const html = renderToStaticMarkup(
      React.createElement(ItineraryGenerationLoader, {
        destination: "Kyoto",
        nights: 4,
        travelers: 2,
        phase: "composing",
        progress: 85,
        message: "Finishing remaining days...",
        searchProgress: {
          orchestrator: "done",
          hotels: "done",
          activities: "done",
          dining: "done",
          transport: "done",
          enrichment: "done",
          aggregator: "searching",
        },
        activitiesCount: 8,
        diningCount: 6,
        transportCount: 2,
        days: [sampleDayOne],
        discoveries: [
          {
            id: "hotels:top",
            agent: "hotels",
            headline: "Scouted 6 stays — top pick: Hotel Grand Kyoto",
            detail: "Gion · 4.8★",
            badge: "Stays",
            timestamp: 100,
          },
          {
            id: "dining:safety",
            agent: "dining",
            headline: "Dietary & allergen preferences applied",
            detail:
              "Prioritizing gluten-free, peanuts — confirm directly with venues",
            badge: "Safety filter",
            timestamp: 200,
          },
        ],
      }),
    );

    expect(html).toContain("Live Agent Scout Feed");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Scouted 6 stays — top pick: Hotel Grand Kyoto");
    expect(html).toContain("Safety filter");
    expect(html).toContain("Day 1 is ready — preview now");
    expect(html).toContain("Preview Day 1");
  });

  it("invokes onPeekDayOne and expands inline Day 1 stops on click, and hides banner when complete", async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const onPeekDayOne = vi.fn();
    let renderer: ReturnType<typeof create> | undefined;

    try {
      await act(async () => {
        renderer = create(
          React.createElement(ItineraryGenerationLoader, {
            destination: "Kyoto",
            nights: 4,
            travelers: 2,
            phase: "composing",
            progress: 85,
            message: "Finishing remaining days...",
            searchProgress: { aggregator: "searching" },
            activitiesCount: 5,
            diningCount: 4,
            transportCount: 1,
            days: [sampleDayOne],
            onPeekDayOne,
          }),
        );
      });

      const button = renderer!.root.findByProps({
        "data-testid": "peek-day-one-button",
      });
      await act(async () => {
        button.props.onClick();
      });

      const panelText = JSON.stringify(renderer!.toJSON());
      expect(panelText).toContain("Fushimi Inari Dawn Walk");
      expect(panelText).toContain("Nishiki Soba Kitchen");
      expect(onPeekDayOne).toHaveBeenCalledTimes(0);

      const openViewButton = renderer!.root.findByProps({
        "data-testid": "open-day-one-view-button",
      });
      await act(async () => {
        openViewButton.props.onClick();
      });
      expect(onPeekDayOne).toHaveBeenCalledTimes(1);

      const completeHtml = renderToStaticMarkup(
        React.createElement(ItineraryGenerationLoader, {
          destination: "Kyoto",
          nights: 4,
          travelers: 2,
          phase: "complete",
          progress: 100,
          message: "Your itinerary is ready!",
          searchProgress: { aggregator: "done" },
          activitiesCount: 5,
          diningCount: 4,
          transportCount: 1,
          days: [sampleDayOne],
        }),
      );
      expect(completeHtml).not.toContain("Day 1 is ready — preview now");
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
    }
  });
});
