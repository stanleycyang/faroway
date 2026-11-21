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
    }
  });
});
