import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { HOTEL_SEARCH_CONSENT_VERSION } from "@faroway/constants";
import type { Trip } from "@/lib/trips/load-trip";
const mock = vi.hoisted(() => ({
  owner: "owner-a",
  revision: 0,
  session: vi.fn(),
}));
vi.mock("@/hooks/useUser", () => ({
  useUser: () => ({
    session: { user: { id: mock.owner } },
    accountRevision: mock.revision,
    loading: false,
  }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession: mock.session } }),
}));
import { HotelQuotePanel } from "@/components/trips/HotelQuotePanel";
const trip: Trip = {
  id: "trip-a",
  user_id: "owner-a",
  destination: "Paris",
  start_date: "2026-11-01",
  end_date: "2026-11-03",
  travelers: 3,
  status: "planned",
  created_at: "2026-01-01",
  updated_at: "2026-10-14T00:00:00Z",
  preferences: {
    hotelSearch: {
      countryCode: "FR",
      guestNationality: "US",
      rooms: [{ adults: 2, children: [8] }],
      consentVersion: HOTEL_SEARCH_CONSENT_VERSION,
    },
  },
};
const payload = {
  tripId: trip.id,
  tripUpdatedAt: trip.updated_at,
  observedAt: "2026-10-14T00:00:00Z",
  sandbox: true,
  hotels: [
    {
      id: "h",
      name: "Saved Hotel",
      offers: [
        {
          id: "o",
          currency: "USD",
          stayAmount: 300,
          roomCount: 1,
          additionalTaxes: [],
          cancellationNote: "Check supplier terms",
        },
      ],
    },
  ],
};
let renderer: ReturnType<typeof create> | undefined;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubEnv("NEXT_PUBLIC_HOTEL_SEARCH_ENABLED", "true");
  mock.owner = "owner-a";
  mock.revision = 0;
  mock.session.mockReset().mockResolvedValue({
    data: { session: { user: { id: "owner-a" }, access_token: "fixture" } },
    error: null,
  });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
async function mount() {
  await act(async () => {
    renderer = create(<HotelQuotePanel trip={trip} />);
  });
}
const button = () => renderer!.root.findByType("button");
test.each(["success", "nested malformed", "wrong identity", "live response"])(
  "quote response: %s",
  async (scenario) => {
    const data =
      scenario === "nested malformed"
        ? { ...payload, hotels: [{ id: "h", name: "Bad", offers: {} }] }
        : scenario === "wrong identity"
          ? { ...payload, tripId: "foreign" }
          : scenario === "live response"
            ? { ...payload, sandbox: false }
            : payload;
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(data)));
    vi.stubGlobal("fetch", fetcher);
    await mount();
    await act(async () => {
      const click = button().props.onClick;
      void click();
      void click();
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer fixture",
    );
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      expectedUpdatedAt: trip.updated_at,
    });
    const text = JSON.stringify(renderer!.toJSON());
    if (scenario === "success") {
      expect(text).toContain("Saved Hotel");
      expect(text).toContain("cannot be booked");
    } else {
      expect(text).toContain("could not be verified");
      expect(text).not.toContain("Saved Hotel");
    }
  },
);
test.each(["unmount", "same-owner reauthentication", "account replacement"])(
  "late quote after %s is discarded",
  async (scenario) => {
    let release!: (value: unknown) => void;
    const fetcher = vi.fn<
      (input: RequestInfo | URL, options?: RequestInit) => Promise<unknown>
    >(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    await mount();
    await act(async () => {
      void button().props.onClick();
    });
    await act(async () => {
      if (scenario === "unmount") renderer!.unmount();
      else {
        mock.revision += 2;
        if (scenario === "account replacement") mock.owner = "owner-b";
        renderer!.update(<HotelQuotePanel trip={trip} />);
      }
    });
    const body = vi.fn(async () => payload);
    await act(async () => {
      release({ ok: true, json: body });
    });
    expect(body).not.toHaveBeenCalled();
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  },
);
test("stalled response body settles, releases the button and cannot publish late quotes", async () => {
  vi.useFakeTimers();
  let release!: (value: unknown) => void;
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  vi.stubGlobal("fetch", fetcher);
  await mount();
  await act(async () => {
    void button().props.onClick();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15_001);
  });
  expect(button().props.disabled).toBe(false);
  expect(JSON.stringify(renderer!.toJSON())).toContain("took too long");
  await act(async () => {
    release(payload);
  });
  expect(JSON.stringify(renderer!.toJSON())).not.toContain("Saved Hotel");
  expect(vi.getTimerCount()).toBe(0);
});
test("SDK owner mismatch prevents sharing room data", async () => {
  mock.session.mockResolvedValue({
    data: { session: { user: { id: "owner-b" }, access_token: "other" } },
    error: null,
  });
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await mount();
  await act(async () => {
    await button().props.onClick();
  });
  expect(fetcher).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer!.toJSON())).toContain("account changed");
});
