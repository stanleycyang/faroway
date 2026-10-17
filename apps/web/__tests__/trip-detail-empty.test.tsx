import { act, create } from "react-test-renderer";
import type { GeneratedItinerary } from "@/lib/ai/types";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { TripDetailClient } from "../app/(app)/trips/[id]/TripDetailClient";
const actionFixture = vi.hoisted(() => ({
  complete: true,
  realDayCards: false,
  consent: vi.fn(),
  onComplete: (() => {}) as () => void,
}));
vi.mock("@/lib/ai/planning-consent-client", () => ({
  requestPlanningConsent: actionFixture.consent,
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
  useTripGeneration: (options: { onComplete: () => void }) => {
    actionFixture.onComplete = options.onComplete;
    return {
      days: null,
      topHotel: null,
      specBlocks: [],
      phase: "complete",
      isComplete: actionFixture.complete,
      isStreaming: false,
      error: null,
    };
  },
}));
vi.mock("@/components/trips/BookingChecklist", () => ({
  BookingChecklist: () => null,
}));
vi.mock("@/components/trips/PlanEditor", () => ({ PlanEditor: () => null }));
vi.mock("@/components/trips/TripBriefEditor", () => ({
  TripBriefEditor: ({ onReload }: { onReload: () => void }) => (
    <button data-refresh onClick={onReload}>
      Reload brief
    </button>
  ),
}));
vi.mock("@/components/trips/FeaturedHotelCard", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/trips/FeaturedHotelCard")
    >();
  return {
    FeaturedHotelCard: (
      props: React.ComponentProps<typeof actual.FeaturedHotelCard>,
    ) =>
      actionFixture.realDayCards ? (
        <actual.FeaturedHotelCard {...props} />
      ) : null,
  };
});
vi.mock("@/components/trips/ShareConsentDialog", () => ({
  ShareConsentDialog: ({ onConfirm }: { onConfirm: () => void }) => (
    <button data-confirm-share onClick={onConfirm}>
      Confirm public sharing
    </button>
  ),
}));
vi.mock("@/components/trips/TripBudget", () => ({ TripBudget: () => null }));
vi.mock("@/components/trips/TripDayNavigation", () => ({
  TripDayNavigation: () => null,
}));
vi.mock("@/components/trips/TripHeader", () => ({ TripHeader: () => null }));
vi.mock("@/components/trips/ItineraryDay", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/trips/ItineraryDay")>();
  return {
    ItineraryDay: (props: React.ComponentProps<typeof actual.ItineraryDay>) =>
      actionFixture.realDayCards ? <actual.ItineraryDay {...props} /> : null,
  };
});
vi.mock("@/components/trips/ItineraryGenerationLoader", () => ({
  ItineraryGenerationLoader: ({
    children,
    phase,
    onOpenTrip,
  }: {
    children: React.ReactNode;
    phase: string;
    onOpenTrip: () => void;
  }) => (
    <section data-loader-phase={phase}>
      {children}
      {phase === "complete" && (
        <button onClick={onOpenTrip}>Open completed trip</button>
      )}
    </section>
  ),
}));
vi.mock("@/components/trips/StreamedSpecPreview", () => ({
  StreamedSpecPreview: () => null,
}));
vi.mock("@/components/trips/TripWeather", () => ({ TripWeather: () => null }));
vi.mock("@/components/places/PlacesExplorer", () => ({
  PlacesExplorer: () => null,
}));
vi.mock("@/components/trips/TripCheckout", () => ({
  TripCheckout: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/components/trips/TripFeedback", () => ({
  TripFeedback: () => null,
}));
vi.mock("@/components/ShareButtons", () => ({
  ShareButtons: ({ url }: { url: string }) => <output data-share-url={url} />,
}));
test("completed trip without a saved itinerary renders one recovery panel", () => {
  const html = renderToStaticMarkup(
    <TripDetailClient
      tripId="trip-a"
      initialShareUrl={null}
      initialData={{
        itinerary: null,
        trip: {
          id: "trip-a",
          user_id: "owner-a",
          destination: "Tokyo",
          start_date: "2026-11-01",
          end_date: "2026-11-04",
          travelers: 2,
          status: "completed",
          created_at: "2026-10-01",
          updated_at: "2026-10-01",
        },
      }}
    />,
  );
  expect(html.match(/No Itinerary Yet/g)).toHaveLength(1);
  expect(html).toContain("/create?destination=Tokyo");
});

test.each(["missing", "damaged"])(
  "refresh reconciles a %s saved itinerary without losing verified content",
  async (outcome) => {
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { origin: "http://localhost" },
    });
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const trip = {
      id: "trip-a",
      user_id: "owner-a",
      destination: "Tokyo",
      start_date: "2026-11-01",
      end_date: "2026-11-04",
      travelers: 2,
      status: "completed" as const,
      created_at: "2026-10-01",
      updated_at: "2026-10-01",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            trip,
            itinerary: outcome === "missing" ? null : { days: [null] },
          }),
          {
            status: 200,
          },
        ),
      ),
    );
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <TripDetailClient
            tripId="trip-a"
            initialShareUrl={null}
            initialData={{
              trip,
              itinerary: {
                days: [],
                packingList: ["Old packing item"],
              } as unknown as GeneratedItinerary,
            }}
          />,
        );
      });
      expect(JSON.stringify(renderer.toJSON())).toContain("Old packing item");
      await act(async () => {
        renderer.root
          .findAllByType("button")
          .find((b) => b.props["data-refresh"] !== undefined)!
          .props.onClick();
      });
      const output = JSON.stringify(renderer.toJSON());
      if (outcome === "missing")
        expect(output).not.toContain("Old packing item");
      else {
        expect(output).toContain("Old packing item");
        expect(output).toContain("Your saved itinerary could not be read");
      }
    } finally {
      await act(async () => renderer?.unmount());
      vi.unstubAllGlobals();
    }
  },
);

test("an older refresh cannot restore packing content after the latest refresh clears it", async () => {
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    location: { origin: "http://localhost" },
  });
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const trip = {
    id: "trip-a",
    user_id: "owner-a",
    destination: "Tokyo",
    start_date: "2026-11-01",
    end_date: "2026-11-04",
    travelers: 2,
    status: "completed" as const,
    created_at: "2026-10-01",
    updated_at: "2026-10-01",
  };
  let resolveOld!: (value: Response) => void;
  const oldResponse = new Promise<Response>((resolve) => {
    resolveOld = resolve;
  });
  const fetchMock = vi
    .fn()
    .mockReturnValueOnce(oldResponse)
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ trip, itinerary: null }), { status: 200 }),
    );
  vi.stubGlobal("fetch", fetchMock);
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <TripDetailClient
          tripId="trip-a"
          initialShareUrl={null}
          initialData={{ trip, itinerary: null }}
        />,
      );
    });
    const refresh = () =>
      renderer.root
        .findAllByType("button")
        .find((b) => b.props["data-refresh"] !== undefined)!
        .props.onClick();
    await act(async () => {
      refresh();
      refresh();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolveOld(
        new Response(
          JSON.stringify({
            trip,
            itinerary: { days: [], packingList: ["Stale packing content"] },
          }),
          { status: 200 },
        ),
      );
    });
    expect(JSON.stringify(renderer.toJSON())).not.toContain(
      "Stale packing content",
    );
  } finally {
    await act(async () => renderer?.unmount());
    vi.unstubAllGlobals();
  }
});

test.each([
  { id: "different-trip", user_id: "owner-a" },
  { id: "trip-a", user_id: "different-owner" },
])("refresh rejects mismatched trip identity %j", async (identity) => {
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    location: { origin: "http://localhost" },
  });
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const trip = {
    id: "trip-a",
    user_id: "owner-a",
    destination: "Tokyo",
    start_date: "2026-11-01",
    end_date: "2026-11-04",
    travelers: 2,
    status: "completed" as const,
    created_at: "2026-10-01",
    updated_at: "2026-10-01",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          trip: { ...trip, ...identity },
          itinerary: { days: [], packingList: ["Foreign packing content"] },
        }),
        { status: 200 },
      ),
    ),
  );
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <TripDetailClient
          tripId="trip-a"
          initialShareUrl={null}
          initialData={{
            trip,
            itinerary: {
              days: [],
              packingList: ["Valid packing content"],
            } as unknown as GeneratedItinerary,
          }}
        />,
      );
    });
    await act(async () => {
      renderer.root
        .findAllByType("button")
        .find((b) => b.props["data-refresh"] !== undefined)!
        .props.onClick();
    });
    const output = JSON.stringify(renderer.toJSON());
    expect(output).toContain("Valid packing content");
    expect(output).not.toContain("Foreign packing content");
    expect(output).toContain("did not match your saved trip");
  } finally {
    await act(async () => renderer?.unmount());
    vi.unstubAllGlobals();
  }
});

test("a refresh finishing after unmount does not read or reconcile its response body", async () => {
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    location: { origin: "http://localhost" },
  });
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const trip = {
    id: "trip-a",
    user_id: "owner-a",
    destination: "Tokyo",
    start_date: "2026-11-01",
    end_date: "2026-11-04",
    travelers: 2,
    status: "completed" as const,
    created_at: "2026-10-01",
    updated_at: "2026-10-01",
  };
  let resolveResponse!: (value: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      }),
    ),
  );
  let renderer!: ReturnType<typeof create>;
  let unmounted = false;
  try {
    await act(async () => {
      renderer = create(
        <TripDetailClient
          tripId="trip-a"
          initialShareUrl={null}
          initialData={{ trip, itinerary: null }}
        />,
      );
    });
    await act(async () => {
      renderer.root
        .findAllByType("button")
        .find((b) => b.props["data-refresh"] !== undefined)!
        .props.onClick();
    });
    await act(async () => {
      renderer.unmount();
      unmounted = true;
    });
    const response = new Response(JSON.stringify({ trip, itinerary: null }), {
      status: 200,
    });
    const readBody = vi.spyOn(response, "json");
    await act(async () => {
      resolveResponse(response);
    });
    expect(readBody).not.toHaveBeenCalled();
  } finally {
    if (!unmounted) await act(async () => renderer?.unmount());
    vi.unstubAllGlobals();
  }
});

test("late share creation after exit cannot open a share sheet or read its body", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    location: { origin: "http://localhost" },
  });
  const share = vi.fn();
  vi.stubGlobal("navigator", { share });
  let release!: (r: unknown) => void;
  const fetchMock = vi.fn(
    () =>
      new Promise((yes) => {
        release = yes;
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <TripDetailClient
          tripId="trip-a"
          initialShareUrl={null}
          initialData={{
            itinerary: null,
            trip: {
              id: "trip-a",
              user_id: "owner-a",
              destination: "Tokyo",
              start_date: "2026-11-01",
              end_date: "2026-11-04",
              travelers: 2,
              status: "completed",
              created_at: "2026-10-01",
              updated_at: "2026-10-01",
            },
          }}
        />,
      );
    });
    await act(async () => {
      renderer.root.findByProps({ "data-confirm-share": true }).props.onClick();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      renderer.unmount();
    });
    const body = vi.fn(async () => ({
      shareToken: "token-a",
      shareUrl: "https://example.test/s/token-a",
    }));
    await act(async () => {
      release({ ok: true, json: body });
    });
    expect(body).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
  }
});

test.each([
  {
    shareToken: "token-a",
    shareUrl: "https://example.test/s/token-a",
    valid: true,
  },
  {
    shareToken: "token-a",
    shareUrl: "https://example.test/s/token-b",
    valid: false,
  },
  { shareToken: "token-a", shareUrl: "javascript:alert(1)", valid: false },
  {
    shareToken: "token-a",
    shareUrl: "https://user:secret@example.test/s/token-a",
    valid: false,
  },
  {
    shareToken: "token-a",
    shareUrl: "https://example.test/s/token-a?extra=1",
    valid: false,
  },
])(
  "share response is validated before handoff: %j",
  async ({ valid, ...payload }) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { origin: "http://localhost" },
    });
    const share = vi.fn(async () => {});
    vi.stubGlobal("navigator", { share });
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <TripDetailClient
            tripId="trip-a"
            initialShareUrl={null}
            initialData={{
              itinerary: null,
              trip: {
                id: "trip-a",
                user_id: "owner-a",
                destination: "Tokyo",
                start_date: "2026-11-01",
                end_date: "2026-11-04",
                travelers: 2,
                status: "completed",
                created_at: "2026-10-01",
                updated_at: "2026-10-01",
              },
            }}
          />,
        );
      });
      await act(async () => {
        const confirm = renderer.root.findByProps({
          "data-confirm-share": true,
        }).props.onClick;
        void confirm();
        void confirm();
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      if (valid)
        expect(share).toHaveBeenCalledWith({
          title: "Trip to Tokyo",
          text: "Check out my trip itinerary to Tokyo!",
          url: payload.shareUrl,
        });
      else {
        expect(share).not.toHaveBeenCalled();
        expect(JSON.stringify(renderer.toJSON())).toContain(
          "Sharing did not finish",
        );
      }
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      vi.unstubAllGlobals();
    }
  },
);

test.each(["confirmed", "unconfirmed", "after exit"])(
  "public access revocation handles %s",
  async (scenario) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { origin: "http://localhost" },
    });
    let release!: (r: unknown) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise((yes) => {
          release = yes;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <TripDetailClient
            tripId="trip-a"
            initialShareUrl="https://example.test/s/token-a"
            initialData={{
              itinerary: null,
              trip: {
                id: "trip-a",
                user_id: "owner-a",
                destination: "Tokyo",
                start_date: "2026-11-01",
                end_date: "2026-11-04",
                travelers: 2,
                status: "completed",
                created_at: "2026-10-01",
                updated_at: "2026-10-01",
              },
            }}
          />,
        );
      });
      await act(async () => {
        const revoke = renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("Turn off public access"))!.props
          .onClick;
        void revoke();
        void revoke();
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      if (scenario === "after exit")
        await act(async () => {
          renderer.unmount();
        });
      const body = vi.fn(async () => ({ success: scenario === "confirmed" }));
      await act(async () => {
        release({ ok: true, json: body });
      });
      if (scenario === "after exit") expect(body).not.toHaveBeenCalled();
      else if (scenario === "confirmed") {
        expect(JSON.stringify(renderer.toJSON())).not.toContain(
          "https://example.test/s/token-a",
        );
        expect(JSON.stringify(renderer.toJSON())).toContain(
          "Public access has been turned off",
        );
      } else {
        expect(JSON.stringify(renderer.toJSON())).toContain(
          "https://example.test/s/token-a",
        );
        expect(JSON.stringify(renderer.toJSON())).toContain(
          "We couldn’t turn off public access",
        );
      }
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      vi.unstubAllGlobals();
    }
  },
);

test.each(["consent", "session headers"])(
  "leaving during %s prevents planning dispatch",
  async (phase) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    actionFixture.complete = false;
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { origin: "http://localhost" },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    let release!: (value: unknown) => void;
    const delayed = new Promise((yes) => {
      release = yes;
    });
    const headers = vi.fn(() =>
      phase === "session headers"
        ? delayed
        : Promise.resolve({ Authorization: "Bearer fixture" }),
    );
    actionFixture.consent
      .mockReset()
      .mockImplementation(() =>
        phase === "consent" ? delayed : Promise.resolve(headers),
      );
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <TripDetailClient
            tripId="trip-a"
            initialShareUrl={null}
            initialData={{
              itinerary: null,
              trip: {
                id: "trip-a",
                user_id: "owner-a",
                destination: "Tokyo",
                start_date: "2026-11-01",
                end_date: "2026-11-04",
                travelers: 2,
                status: "failed",
                created_at: "2026-10-01",
                updated_at: "2026-10-01",
              },
            }}
          />,
        );
      });
      await act(async () => {
        const retry = renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("Try Again"))!.props.onClick;
        void retry();
        void retry();
      });
      expect(actionFixture.consent).toHaveBeenCalledTimes(1);
      expect(actionFixture.consent).toHaveBeenCalledWith("owner-a");
      await act(async () => {
        renderer.unmount();
      });
      await act(async () => {
        release(
          phase === "consent" ? headers : { Authorization: "Bearer fixture" },
        );
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(headers).toHaveBeenCalledTimes(phase === "consent" ? 0 : 1);
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      actionFixture.complete = true;
      vi.unstubAllGlobals();
    }
  },
);

test("normal retry sends verified headers once and refreshes the saved trip", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  actionFixture.complete = false;
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    location: { origin: "http://localhost" },
  });
  const trip = {
    id: "trip-a",
    user_id: "owner-a",
    destination: "Tokyo",
    start_date: "2026-11-01",
    end_date: "2026-11-04",
    travelers: 2,
    status: "failed" as const,
    created_at: "2026-10-01",
    updated_at: "2026-10-01",
  };
  const headers = vi.fn(async () => ({
    Authorization: "Bearer verified-fixture",
  }));
  actionFixture.consent.mockReset().mockResolvedValue(headers);
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, status: 202 })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        trip: { ...trip, status: "generating", search_id: "search-new" },
        itinerary: null,
      }),
    });
  vi.stubGlobal("fetch", fetchMock);
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <TripDetailClient
          tripId="trip-a"
          initialShareUrl={null}
          initialData={{ trip, itinerary: null }}
        />,
      );
    });
    await act(async () => {
      const retry = renderer.root
        .findAllByType("button")
        .find((b) => b.children.includes("Try Again"))!.props.onClick;
      void retry();
      void retry();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/trips/trip-a/generate");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: { Authorization: "Bearer verified-fixture" },
    });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/trips/trip-a");
    expect(headers).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    actionFixture.complete = true;
    vi.unstubAllGlobals();
  }
});

test.each(["current", "after exit"])(
  "manual planning status suppresses duplicates and handles %s response",
  async (scenario) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    actionFixture.complete = false;
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { origin: "http://localhost" },
    });
    let release!: (r: unknown) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise((yes) => {
          release = yes;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <TripDetailClient
            tripId="trip-a"
            initialShareUrl={null}
            initialData={{
              itinerary: null,
              trip: {
                id: "trip-a",
                user_id: "owner-a",
                destination: "Tokyo",
                start_date: "2026-11-01",
                end_date: "2026-11-04",
                travelers: 2,
                status: "generating",
                search_id: "search-a",
                created_at: "2026-10-01",
                updated_at: "2026-10-01",
              },
            }}
          />,
        );
      });
      await act(async () => {
        const check = renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("Check planning status"))!.props
          .onClick;
        void check();
        void check();
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      if (scenario === "after exit")
        await act(async () => {
          renderer.unmount();
        });
      const body = vi.fn(async () => ({
        status: "running",
        message: "Still assembling your itinerary",
      }));
      await act(async () => {
        release({ ok: true, json: body });
      });
      if (scenario === "after exit") expect(body).not.toHaveBeenCalled();
      else
        expect(JSON.stringify(renderer.toJSON())).toContain(
          "Still assembling your itinerary",
        );
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      actionFixture.complete = true;
      vi.unstubAllGlobals();
    }
  },
);

test.each(["mixed currencies", "unknown price"])(
  "flight estimates preserve %s without inventing a total",
  (scenario) => {
    const transport = (price: number, currency: string) => ({
      price,
      currency,
      provider: "Fixture airline",
      duration: 120,
      stops: 0,
      departure: { airport: "AAA", dateTime: "2026-11-01T10:00:00Z" },
      arrival: { airport: "BBB", dateTime: "2026-11-01T12:00:00Z" },
    });
    const itinerary = {
      days: [
        { dayNumber: 1, date: "2026-11-01", transport: transport(100, "USD") },
        {
          dayNumber: 2,
          date: "2026-11-02",
          transport: transport(
            scenario === "mixed currencies" ? 200 : Number.NaN,
            scenario === "mixed currencies" ? "EUR" : "INVALID",
          ),
        },
      ],
    } as unknown as GeneratedItinerary;
    const html = renderToStaticMarkup(
      <TripDetailClient
        tripId="trip-a"
        initialShareUrl={null}
        initialData={{
          itinerary,
          trip: {
            id: "trip-a",
            user_id: "owner-a",
            destination: "Tokyo",
            start_date: "2026-11-01",
            end_date: "2026-11-04",
            travelers: 2,
            status: "completed",
            created_at: "2026-10-01",
            updated_at: "2026-10-01",
          },
        }}
      />,
    );
    expect(html).not.toContain("One way");
    expect(html).not.toContain("Round trip");
    expect(html).toContain("Estimates by flight");
    expect(html).toContain("USD");
    expect(html).not.toContain("total round trip");
    expect(html).not.toContain("per person");
    if (scenario === "mixed currencies") expect(html).toContain("EUR");
    else expect(html).toContain("Price unknown");
  },
);

test.each(["missing details", "airport-local clock"])(
  "flight detail renders %s honestly",
  (scenario) => {
    const flight =
      scenario === "missing details"
        ? {}
        : {
            duration: 120,
            stops: 0,
            price: 100,
            currency: "USD",
            departure: {
              airport: "AAA",
              dateTime: "2026-11-01T10:15:00+09:00",
            },
            arrival: { airport: "BBB", dateTime: "2026-11-01T12:15:00+09:00" },
          };
    const itinerary = {
      days: [{ dayNumber: 1, date: "2026-11-01", transport: flight }],
    } as unknown as GeneratedItinerary;
    const html = renderToStaticMarkup(
      <TripDetailClient
        tripId="trip-a"
        initialShareUrl={null}
        initialData={{
          itinerary,
          trip: {
            id: "trip-a",
            user_id: "owner-a",
            destination: "Tokyo",
            start_date: "2026-11-01",
            end_date: "2026-11-04",
            travelers: 2,
            status: "completed",
            created_at: "2026-10-01",
            updated_at: "2026-10-01",
          },
        }}
      />,
    );
    expect(html).not.toContain("Invalid Date");
    expect(html).not.toContain("NaN");
    if (scenario === "missing details") {
      for (const label of [
        "Airport unavailable",
        "Time unavailable",
        "Duration unavailable",
        "Stops unavailable",
      ])
        expect(html).toContain(label);
    } else {
      expect(html).toContain("10:15");
      expect(html).toContain("12:15");
      expect(html).toContain("Direct");
    }
  },
);

test("hidden booking bar is inert until its scroll threshold is reached", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
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
  const itinerary = {
    days: [
      {
        dayNumber: 1,
        date: "2026-11-01",
        morning: {
          activities: [
            {
              name: "Museum",
              bookingInfo: { bookingUrl: "https://example.test/museum" },
            },
          ],
        },
      },
    ],
  } as unknown as GeneratedItinerary;
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <TripDetailClient
          tripId="trip-a"
          initialShareUrl={null}
          initialData={{
            itinerary,
            trip: {
              id: "trip-a",
              user_id: "owner-a",
              destination: "Tokyo",
              start_date: "2026-11-01",
              end_date: "2026-11-04",
              travelers: 2,
              status: "completed",
              created_at: "2026-10-01",
              updated_at: "2026-10-01",
            },
          }}
        />,
      );
    });
    const region = () =>
      renderer.root.findByProps({ "aria-label": "Booking options" });
    expect(region().props.inert).toBe(true);
    expect(region().props["aria-hidden"]).toBe(true);
    expect(region().findByType("button").props.disabled).toBe(true);
    await act(async () => {
      browser.scrollY = 500;
      onScroll();
    });
    expect(region().props.inert).toBe(false);
    expect(region().findByType("button").props.disabled).toBe(false);
    await act(async () => {
      browser.scrollY = 0;
      onScroll();
    });
    expect(region().props.inert).toBe(true);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
  }
});

test("confirmed planning completion reveals a dossier that opens the saved itinerary", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  actionFixture.complete = false;
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    location: { origin: "http://localhost" },
  });
  const trip = {
    id: "trip-a",
    user_id: "owner-a",
    destination: "Tokyo",
    start_date: "2026-11-01",
    end_date: "2026-11-04",
    travelers: 2,
    status: "generating" as const,
    search_id: "search-a",
    created_at: "2026-10-01",
    updated_at: "2026-10-01",
  };
  const itinerary = {
    days: [{ dayNumber: 1, date: "2026-11-01", title: "Arrival" }],
  } as unknown as GeneratedItinerary;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        trip: { ...trip, status: "completed" },
        itinerary,
      }),
    }),
  );
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <TripDetailClient
          tripId="trip-a"
          initialShareUrl={null}
          initialData={{ trip, itinerary: null }}
        />,
      );
    });
    await act(async () => {
      actionFixture.complete = true;
      actionFixture.onComplete();
    });
    expect(
      renderer.root.findByProps({ "data-loader-phase": "complete" }),
    ).toBeTruthy();
    await act(async () => {
      renderer.root
        .findAllByType("button")
        .find((b) => b.children.includes("Open completed trip"))!
        .props.onClick();
    });
    expect(
      renderer.root.findAllByProps({ "data-loader-phase": "complete" }),
    ).toHaveLength(0);
    expect(JSON.stringify(renderer.toJSON())).toContain("Your itinerary");
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    actionFixture.complete = true;
    vi.unstubAllGlobals();
  }
});

test("a cancelled generation poll cannot dispatch a new trip refresh after its body resolves", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  actionFixture.complete = false;
  let release!: (value: unknown) => void;
  const body = new Promise((resolve) => {
    release = resolve;
  });
  const trip = {
    id: "trip-a",
    user_id: "owner-a",
    destination: "Tokyo",
    start_date: "2026-11-01",
    end_date: "2026-11-04",
    travelers: 2,
    status: "generating" as const,
    created_at: "2026-10-01",
    updated_at: "2026-10-01",
  };
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: () => body })
    .mockResolvedValue(new Response(JSON.stringify({ trip, itinerary: null })));
  vi.stubGlobal("fetch", fetchMock);
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => {
      renderer = create(
        <TripDetailClient
          tripId="trip-a"
          initialShareUrl={null}
          initialData={{ trip, itinerary: null }}
        />,
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      renderer!.unmount();
    });
    renderer = undefined;
    await act(async () => {
      release({ status: "completed" });
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    actionFixture.complete = true;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

test.each([{ days: [null] }, { days: "broken" }, { days: [], overview: {} }])(
  "damaged initial saved plan offers recovery instead of crashing: %j",
  (itinerary) => {
    const html = renderToStaticMarkup(
      <TripDetailClient
        tripId="trip-a"
        initialShareUrl={null}
        initialData={{
          itinerary: itinerary as unknown as GeneratedItinerary,
          trip: {
            id: "trip-a",
            user_id: "owner-a",
            destination: "Tokyo",
            start_date: "2026-11-01",
            end_date: "2026-11-04",
            travelers: 2,
            status: "completed",
            created_at: "2026-10-01",
            updated_at: "2026-10-01",
          },
        }}
      />,
    );
    expect(html).toContain("Your saved itinerary could not be read");
    expect(html).toContain("Your trip is kept");
  },
);

test.each(["creation", "share sheet"])(
  "sharing abort during %s describes the right recovery",
  async (stage) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { origin: "http://localhost" },
    });
    const aborted = Object.assign(new Error("aborted"), { name: "AbortError" });
    const share = vi.fn().mockRejectedValue(aborted);
    vi.stubGlobal("navigator", { share });
    const fetchMock =
      stage === "creation"
        ? vi.fn().mockRejectedValue(aborted)
        : vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
              shareToken: "token-a",
              shareUrl: "https://example.test/s/token-a",
            }),
          });
    vi.stubGlobal("fetch", fetchMock);
    let renderer: ReturnType<typeof create> | undefined;
    try {
      await act(async () => {
        renderer = create(
          <TripDetailClient
            tripId="trip-a"
            initialShareUrl={null}
            initialData={{
              itinerary: null,
              trip: {
                id: "trip-a",
                user_id: "owner-a",
                destination: "Tokyo",
                start_date: "2026-11-01",
                end_date: "2026-11-04",
                travelers: 2,
                status: "completed",
                created_at: "2026-10-01",
                updated_at: "2026-10-01",
              },
            }}
          />,
        );
      });
      await act(async () => {
        await renderer!.root
          .findByProps({ "data-confirm-share": true })
          .props.onClick();
      });
      const output = JSON.stringify(renderer!.toJSON());
      if (stage === "creation") {
        expect(share).not.toHaveBeenCalled();
        expect(output).toContain("Sharing did not finish");
        expect(output).not.toContain("Share sheet canceled");
      } else {
        expect(share).toHaveBeenCalledTimes(1);
        expect(output).toContain(
          "Share sheet canceled. Your public link remains active",
        );
      }
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      vi.unstubAllGlobals();
    }
  },
);

test("public-access controls stay disabled until their client handlers are ready", () => {
  const trip = {
    id: "trip-a",
    user_id: "owner-a",
    destination: "Tokyo",
    start_date: "2026-11-01",
    end_date: "2026-11-04",
    travelers: 2,
    status: "completed" as const,
    created_at: "2026-10-01",
    updated_at: "2026-10-01",
  };
  for (const initialShareUrl of [null, "https://example.test/s/token-a"]) {
    const html = renderToStaticMarkup(
      <TripDetailClient
        tripId="trip-a"
        initialShareUrl={initialShareUrl}
        initialData={{ trip, itinerary: null }}
      />,
    );
    const revoke = html.match(
      /<button[^>]*>Turn off public access<\/button>/,
    )?.[0];
    expect(revoke).toContain('disabled=""');
    if (!initialShareUrl)
      expect(
        html.match(/<button[^>]*>Create public share link<\/button>/)?.[0],
      ).toContain('disabled=""');
  }
});

test("mounted saved trip keeps global recommendation separate from distinct day hotel cards", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  actionFixture.realDayCards = true;
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    location: { origin: "http://localhost" },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected network");
    }),
  );
  const slot = { activities: [], meals: [] };
  const itinerary = {
    topHotel: {
      id: "global",
      name: "Global recommendation",
      pricePerNight: 500,
      currency: "EUR",
    },
    days: ["First-night hotel", "Second-night hotel"].map((name, index) => ({
      dayNumber: index + 1,
      date: `2026-11-0${index + 1}`,
      title: name,
      morning: slot,
      afternoon: slot,
      evening: slot,
      hotel: {
        id: name,
        name,
        pricePerNight: 100 + index * 100,
        currency: "EUR",
      },
    })),
  } as unknown as GeneratedItinerary;
  let renderer!: ReturnType<typeof create>;
  try {
    for (let reload = 0; reload < 2; reload++) {
      await act(async () => {
        renderer = create(
          <TripDetailClient
            tripId="trip-a"
            initialShareUrl={null}
            initialData={{
              itinerary,
              trip: {
                id: "trip-a",
                user_id: "owner-a",
                destination: "Tokyo",
                start_date: "2026-11-01",
                end_date: "2026-11-03",
                travelers: 2,
                status: "completed",
                created_at: "2026-10-01",
                updated_at: "2026-10-01",
              },
            }}
          />,
        );
      });
      expect(
        renderer.root.findAllByType("h4").map((node) => node.children.join("")),
      ).toEqual(["First-night hotel", "Second-night hotel"]);
      expect(
        renderer.root.findByProps({
          "aria-label": "Suggested stay: Global recommendation",
        }),
      ).toBeTruthy();
      expect(JSON.stringify(renderer.toJSON())).not.toContain(
        "assigned nights",
      );
      await act(async () => renderer.unmount());
    }
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    await act(async () => renderer?.unmount());
    actionFixture.realDayCards = false;
    vi.unstubAllGlobals();
  }
});

test("a priced outbound offer does not assert one-way fare scope when return details are unavailable", () => {
  const itinerary = {
    days: [
      {
        dayNumber: 1,
        date: "2026-11-01",
        transport: {
          price: 900,
          currency: "USD",
          provider: "Fixture airline",
          duration: 120,
          stops: 0,
          departure: { airport: "AAA", dateTime: "2026-11-01T10:00:00Z" },
          arrival: { airport: "BBB", dateTime: "2026-11-01T12:00:00Z" },
        },
      },
    ],
  } as unknown as GeneratedItinerary;
  const html = renderToStaticMarkup(
    <TripDetailClient
      tripId="trip-a"
      initialShareUrl={null}
      initialData={{
        itinerary,
        trip: {
          id: "trip-a",
          user_id: "owner-a",
          destination: "Tokyo",
          start_date: "2026-11-01",
          end_date: "2026-11-04",
          travelers: 2,
          status: "completed",
          created_at: "2026-10-01",
          updated_at: "2026-10-01",
        },
      }}
    />,
  );
  expect(html).toContain("Outbound details");
  expect(html).toContain("Return details unavailable");
  expect(html).not.toContain("One way");
  expect(html).not.toContain("Round trip");
});
