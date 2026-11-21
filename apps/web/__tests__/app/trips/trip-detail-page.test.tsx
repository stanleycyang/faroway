import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUserMock, loadTripForUserMock, capturedClientProps } = vi.hoisted(
  () => ({
    getUserMock: vi.fn(),
    loadTripForUserMock: vi.fn(),
    capturedClientProps: [] as Array<Record<string, unknown>>,
  }),
);

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: getUserMock,
    },
  })),
}));

vi.mock("@/lib/trips/load-trip", () => ({
  loadTripForUser: loadTripForUserMock,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("@/app/(app)/trips/[id]/TripDetailClient", () => ({
  TripDetailClient: (props: Record<string, unknown>) => {
    capturedClientProps.push(props);
    return null;
  },
}));

import TripDetailPage from "@/app/(app)/trips/[id]/page";

describe("TripDetailPage server-computed affiliate props", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    capturedClientProps.length = 0;
    process.env = {
      ...originalEnv,
      STAY22_AID: "stay22-server-aid",
      SAFETYWING_REFERENCE_ID: "sw-server-ref",
      SKYSCANNER_ASSOCIATE_ID: "sky-server-assoc",
      NEXT_PUBLIC_BASE_URL: "https://www.faroway.ai",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("computes and passes server essentials, hotelPartnerLinks, and flightFallbackLinks to TripDetailClient", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    loadTripForUserMock.mockResolvedValue({
      trip: {
        id: "trip-123",
        user_id: "user-1",
        destination: "Tokyo, Japan",
        start_date: "2099-07-10",
        end_date: "2099-07-15",
        travelers: 2,
        budget_tier: "moderate",
        status: "planned",
        is_shared: true,
        share_token: "share-abc",
        preferences: { originAirport: "SFO" },
        created_at: "2026-10-01T00:00:00Z",
        updated_at: "2026-10-01T00:00:00Z",
      },
      itinerary: {
        overview: "Tokyo trip",
        days: [
          {
            dayNumber: 1,
            date: "2099-07-10",
            title: "Arrival",
            summary: "Arrive in Tokyo",
            morning: { activities: [], meals: [] },
            afternoon: { activities: [], meals: [] },
            evening: { activities: [], meals: [] },
            transport: {
              type: "flight",
              provider: "ANA",
              departure: {
                airport: "SFO",
                city: "San Francisco",
                dateTime: "2099-07-10T10:00:00Z",
              },
              arrival: {
                airport: "HND",
                city: "Tokyo",
                dateTime: "2099-07-11T14:00:00Z",
              },
              duration: 660,
              stops: 0,
            },
            tips: [],
          },
        ],
      },
    });

    const element = (await TripDetailPage({
      params: Promise.resolve({ id: "trip-123" }),
    })) as React.ReactElement<Record<string, unknown>>;

    expect(element.props.tripId).toBe("trip-123");
    expect(element.props.initialShareUrl).toBe(
      "https://www.faroway.ai/s/share-abc",
    );

    const essentials = element.props.essentials as Record<
      string,
      { url: string | null; partner: string }
    >;
    expect(essentials.insurance?.partner).toBe("safetywing");
    expect(essentials.insurance?.url).toContain("referenceID=sw-server-ref");
    expect(essentials.esim?.partner).toBe("airalo");

    const hotelLinks = element.props.hotelPartnerLinks as {
      primary: { partner: string; url: string | null } | null;
      alternatives: Array<{ partner: string; url: string | null }>;
    };
    expect(hotelLinks.primary?.partner).toBe("stay22");
    expect(hotelLinks.primary?.url).toContain("aid=stay22-server-aid");
    expect(hotelLinks.alternatives.length).toBeGreaterThan(0);

    const flightLinks = element.props.flightFallbackLinks as Array<{
      partner: string;
      url: string | null;
    }>;
    expect(flightLinks[0]?.partner).toBe("skyscanner");
    expect(flightLinks[0]?.url).toContain("/sfo/hnd/990710/990715/");
    expect(flightLinks[0]?.url).toContain("associateid=sky-server-assoc");
  });
});
