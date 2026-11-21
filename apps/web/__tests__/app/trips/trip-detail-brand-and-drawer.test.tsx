import React from "react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TripDetailClient } from "@/app/(app)/trips/[id]/TripDetailClient";
import type { GeneratedItinerary } from "@/lib/ai/types";

vi.mock("@/lib/ai/planning-consent-client", () => ({
  requestPlanningConsent: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/hooks/useTripGeneration", () => ({
  ITINERARY_STREAMING_ENABLED: true,
  useTripGeneration: () => ({
    days: null,
    topHotel: null,
    specBlocks: [],
    phase: "complete",
    isComplete: true,
    isStreaming: false,
    error: null,
  }),
}));
vi.mock("@/hooks/useModalFocusTrap", () => ({
  useModalFocusTrap: () => undefined,
}));
vi.mock("@/lib/affiliates/viator-link", () => ({
  buildViatorHandoffUrl: (url: string) => url,
}));
vi.mock("@/components/trips/BookingChecklist", () => ({
  BookingChecklist: () => null,
}));
vi.mock("@/components/trips/PlanEditor", () => ({ PlanEditor: () => null }));
vi.mock("@/components/trips/TripBriefEditor", () => ({
  TripBriefEditor: () => null,
}));
vi.mock("@/components/trips/HotelQuotePanel", () => ({
  HotelQuotePanel: () => null,
}));
vi.mock("@/components/trips/TripWeather", () => ({ TripWeather: () => null }));
vi.mock("@/components/places/PlacesExplorer", () => ({
  PlacesExplorer: () => null,
}));
vi.mock("@/components/trips/TripFeedback", () => ({
  TripFeedback: () => null,
}));
vi.mock("@/components/trips/VenueEvidencePanel", () => ({
  VenueEvidencePanel: () => null,
}));
vi.mock("@/components/ShareButtons", () => ({
  ShareButtons: () => null,
}));
vi.mock("@/components/trips/TripHeader", () => ({ TripHeader: () => null }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function textOf(node: unknown): string {
  const collect = (value: unknown): string => {
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    if (Array.isArray(value)) return value.map(collect).join("");
    if (value && typeof value === "object" && "children" in value) {
      return collect((value as { children: unknown }).children);
    }
    return "";
  };
  return collect(node).replace(/\s+/g, " ").trim();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function walkTsxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkTsxFiles(full));
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

describe("TripDetailClient BookingsSheet drawer and Brand/Contrast compliance", () => {
  it("opens BookingsSheet drawer when clicking Review & book on the sticky bar", async () => {
    let onScroll!: () => void;
    const browser = {
      scrollY: 0,
      addEventListener: vi.fn((name: string, listener: () => void) => {
        if (name === "scroll") onScroll = listener;
      }),
      removeEventListener: vi.fn(),
      location: { origin: "http://localhost" },
    };
    vi.stubGlobal("window", browser);
    vi.stubGlobal("document", { body: { style: { overflow: "auto" } } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ enabled: false, attempts: [] }),
      }),
    );

    const itinerary = {
      tripId: "11111111-1111-4111-8111-111111111111",
      destination: "Tokyo",
      startDate: "2026-11-01",
      endDate: "2026-11-04",
      overview: "Tokyo highlights",
      totalEstimatedCost: { amount: 1200, currency: "USD" },
      generatedAt: "2026-10-01T00:00:00Z",
      days: [
        {
          dayNumber: 1,
          date: "2026-11-01",
          title: "Asakusa",
          summary: "Explore",
          morning: {
            activities: [
              {
                id: "activity_gyg_55",
                name: "Asakusa Rickshaw Tour",
                description: "Tour",
                duration: 60,
                estimatedCost: { amount: 55, currency: "USD" },
                category: "sightseeing",
                timeOfDay: "morning",
                location: { name: "Asakusa" },
                bookingInfo: {
                  requiresReservation: true,
                  bookingUrl:
                    "https://www.getyourguide.com/tokyo-l193/rickshaw-t55/",
                  affiliateId: "getyourguide",
                },
              },
            ],
            meals: [],
          },
          afternoon: { activities: [], meals: [] },
          evening: { activities: [], meals: [] },
          tips: [],
        },
      ],
    } as unknown as GeneratedItinerary;

    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <TripDetailClient
            tripId="11111111-1111-4111-8111-111111111111"
            initialShareUrl={null}
            initialData={{
              itinerary,
              trip: {
                id: "11111111-1111-4111-8111-111111111111",
                user_id: "owner-1",
                destination: "Tokyo",
                start_date: "2026-11-01",
                end_date: "2026-11-04",
                travelers: 2,
                budget_tier: "moderate",
                status: "completed",
                vibes: [],
                preferences: {},
                created_at: "2026-10-01T00:00:00Z",
                updated_at: "2026-10-01T00:00:00Z",
                is_shared: false,
                share_token: null,
              },
            }}
          />,
        );
      });

      await act(async () => {
        browser.scrollY = 500;
        onScroll();
      });

      const stickyBtn = renderer.root
        .findByProps({ "aria-label": "Booking options" })
        .findByType("button");
      expect(textOf(stickyBtn)).toContain("Review & book");

      await act(async () => {
        stickyBtn.props.onClick();
      });

      const dialog = renderer.root.findByProps({ role: "dialog" });
      expect(textOf(dialog)).toContain("Book your Tokyo trip");
      expect(textOf(dialog)).toContain("Asakusa Rickshaw Tour");
    } finally {
      await act(async () => renderer?.unmount());
    }
  });

  it("routes FeaturedFlights Book return leg through TripCheckout modal", async () => {
    vi.stubGlobal("window", {
      scrollY: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { origin: "http://localhost" },
    });
    vi.stubGlobal("document", { body: { style: { overflow: "auto" } } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ enabled: false, attempts: [] }),
      }),
    );

    const itinerary = {
      tripId: "11111111-1111-4111-8111-111111111111",
      destination: "Tokyo",
      startDate: "2026-11-01",
      endDate: "2026-11-05",
      overview: "Tokyo highlights",
      totalEstimatedCost: { amount: 2200, currency: "USD" },
      generatedAt: "2026-10-01T00:00:00Z",
      days: [
        {
          dayNumber: 1,
          date: "2026-11-01",
          title: "Arrival",
          summary: "Fly in",
          morning: { activities: [], meals: [] },
          afternoon: { activities: [], meals: [] },
          evening: { activities: [], meals: [] },
          transport: {
            id: "transport_duffel_out",
            type: "flight",
            provider: "JAL",
            departure: {
              airport: "SFO",
              city: "San Francisco",
              dateTime: "2026-11-01T10:00:00-08:00",
            },
            arrival: {
              airport: "HND",
              city: "Tokyo",
              dateTime: "2026-11-02T14:00:00+09:00",
            },
            duration: 660,
            stops: 0,
            price: 900,
            currency: "USD",
            affiliatePartner: "duffel",
            affiliateUrl: "https://links.duffel.com/outbound",
            expiresAt: "2099-01-01T00:00:00Z",
          },
          tips: [],
        },
        {
          dayNumber: 2,
          date: "2026-11-05",
          title: "Departure",
          summary: "Fly home",
          morning: { activities: [], meals: [] },
          afternoon: { activities: [], meals: [] },
          evening: { activities: [], meals: [] },
          transport: {
            id: "transport_duffel_ret",
            type: "flight",
            provider: "ANA",
            departure: {
              airport: "HND",
              city: "Tokyo",
              dateTime: "2026-11-05T16:00:00+09:00",
            },
            arrival: {
              airport: "SFO",
              city: "San Francisco",
              dateTime: "2026-11-05T09:00:00-08:00",
            },
            duration: 540,
            stops: 0,
            price: 850,
            currency: "USD",
            affiliatePartner: "duffel",
            affiliateUrl: "https://links.duffel.com/return-leg",
            expiresAt: "2099-01-01T00:00:00Z",
          },
          tips: [],
        },
      ],
    } as unknown as GeneratedItinerary;

    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <TripDetailClient
            tripId="11111111-1111-4111-8111-111111111111"
            initialShareUrl={null}
            initialData={{
              itinerary,
              trip: {
                id: "11111111-1111-4111-8111-111111111111",
                user_id: "owner-1",
                destination: "Tokyo",
                start_date: "2026-11-01",
                end_date: "2026-11-05",
                travelers: 2,
                budget_tier: "moderate",
                status: "completed",
                vibes: [],
                preferences: {},
                created_at: "2026-10-01T00:00:00Z",
                updated_at: "2026-10-01T00:00:00Z",
                is_shared: false,
                share_token: null,
              },
            }}
          />,
        );
      });

      const returnBtn = renderer.root
        .findAllByType("button")
        .find((b) => textOf(b).includes("Book return leg"))!;
      expect(returnBtn).toBeTruthy();

      await act(async () => {
        returnBtn.props.onClick({ currentTarget: { focus: vi.fn() } });
      });

      const dialog = renderer.root.findByProps({ role: "dialog" });
      expect(textOf(dialog)).toContain("Your next step, with Duffel");
      expect(textOf(dialog)).toContain("ANA (HND → SFO)");
      expect(textOf(dialog)).toContain("Continue to Duffel");
    } finally {
      await act(async () => renderer?.unmount());
    }
  });

  it("enforces Brand 2.0 palette, WCAG AA tokens, <Logo />, and zero raw OS emojis across M3B trip surfaces", () => {
    const files = [
      ...walkTsxFiles(path.resolve("components/trips")),
      ...walkTsxFiles(path.resolve("app/s")),
      path.resolve("app/(app)/trips/[id]/TripDetailClient.tsx"),
    ];

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(/<Compass[\s\S]*faroway\./);
      expect(content).not.toContain("bg-[#f7f8fa]");
      expect(content).not.toMatch(/from-blue-|to-indigo-/);
      expect(content).not.toMatch(/from-primary-50 to-amber-50/);
      expect(content).not.toMatch(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u);
      if (file.endsWith("ActivityCard.tsx")) {
        expect(content).not.toContain("text-slate-400");
      }
    }
  });
});
