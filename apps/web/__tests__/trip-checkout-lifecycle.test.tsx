import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";
vi.mock("@/hooks/useModalFocusTrap", () => ({
  useModalFocusTrap: () => undefined,
}));
vi.mock("@/lib/affiliates/viator-link", () => ({
  buildViatorHandoffUrl: (url: string) => url,
}));
import {
  TripCheckout,
  useTripCheckout,
} from "../components/trips/TripCheckout";
function ReviewButton() {
  const checkout = useTripCheckout();
  return (
    <button
      onClick={() =>
        checkout?.review({
          id: "activity-a",
          name: "Museum",
          date: "2026-11-01",
        })
      }
    >
      Review option
    </button>
  );
}

test.each(["unmount", "trip change"])(
  "a checkout response after %s cannot navigate",
  async (change) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const assign = vi.fn();
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { assign },
    });
    vi.stubGlobal("document", { body: { style: { overflow: "auto" } } });
    let release!: (response: unknown) => void;
    const body = vi.fn(async () => ({
      redirectUrl: "https://www.viator.com/fixture",
    }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true, attempts: [] }),
      })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          release = resolve;
        }),
      );
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ enabled: false, attempts: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <TripCheckout tripId="trip-a" travelers={2}>
            <ReviewButton />
          </TripCheckout>,
        );
      });
      await act(async () => {
        renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("Review option"))!
          .props.onClick();
      });
      await act(async () => {
        renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("Continue to Viator"))!
          .props.onClick();
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await act(async () => {
        if (change === "unmount") renderer.unmount();
        else
          renderer.update(
            <TripCheckout tripId="trip-b" travelers={2}>
              <ReviewButton />
            </TripCheckout>,
          );
      });
      await act(async () => {
        release({ ok: true, json: body });
        await Promise.resolve();
      });
      expect(body).not.toHaveBeenCalled();
      expect(assign).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      vi.unstubAllGlobals();
    }
  },
);

test.each(["success", "failure"])(
  "stale history %s cannot replace a newer focus refresh",
  async (outcome) => {
    let focus!: () => void;
    vi.stubGlobal("window", {
      addEventListener: (name: string, fn: () => void) => {
        if (name === "focus") focus = fn;
      },
      removeEventListener: vi.fn(),
    });
    let release!: (response: unknown) => void;
    const attempt = (name: string) => ({
      id: "checkout-11111111-1111-4111-8111-111111111111",
      item_id: "activity-a@2026-11-01",
      item_name: name,
      clicked_at: "2026-10-13T00:00:00Z",
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          release = resolve;
        }),
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          enabled: true,
          attempts: [attempt("Current museum")],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <TripCheckout tripId="trip-a" travelers={2}>
            <ReviewButton />
          </TripCheckout>,
        );
      });
      await act(async () => {
        focus();
      });
      expect(JSON.stringify(renderer.toJSON())).toContain("Current museum");
      await act(async () => {
        release({
          ok: outcome === "success",
          json: async () => ({
            enabled: true,
            attempts: [attempt("Old museum")],
          }),
        });
        await Promise.resolve();
      });
      expect(JSON.stringify(renderer.toJSON())).toContain("Current museum");
      expect(JSON.stringify(renderer.toJSON())).not.toContain("Old museum");
      expect(JSON.stringify(renderer.toJSON())).not.toContain(
        "could not be loaded",
      );
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      vi.unstubAllGlobals();
    }
  },
);

test("malformed handoff history becomes recoverable instead of crashing the itinerary", async () => {
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, attempts: "malformed" }),
    }),
  );
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <TripCheckout tripId="trip-a" travelers={2}>
          <ReviewButton />
        </TripCheckout>,
      );
    });
    expect(JSON.stringify(renderer.toJSON())).toContain("could not be loaded");
    expect(
      renderer.root
        .findAllByType("button")
        .some((b) => b.children.includes("Try again")),
    ).toBe(true);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
  }
});

test.each([
  { item_id: "activity-a@2026-02-30" },
  { id: "unverified-history" },
  { clicked_at: "invalid" },
  { id: "checkout-not-a-uuid" },
])(
  "invalid handoff history offers recovery instead of resume: %j",
  async (invalid) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          enabled: true,
          attempts: [
            {
              id: "checkout-11111111-1111-4111-8111-111111111111",
              item_id: "activity-a@2026-11-01",
              item_name: "Museum",
              clicked_at: "2026-10-13T00:00:00Z",
              ...invalid,
            },
          ],
        }),
      }),
    );
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <TripCheckout tripId="trip-a" travelers={2}>
            <ReviewButton />
          </TripCheckout>,
        );
      });
      expect(JSON.stringify(renderer.toJSON())).toContain(
        "Your booking steps could not be loaded",
      );
      expect(JSON.stringify(renderer.toJSON())).not.toContain("Review step");
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      vi.unstubAllGlobals();
    }
  },
);

test("opening checkout review does not rerender unrelated itinerary context consumers", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("document", { body: { style: { overflow: "auto" } } });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, attempts: [] }),
    }),
  );
  let renders = 0;
  function ItineraryConsumer() {
    const checkout = useTripCheckout();
    renders++;
    return (
      <button
        onClick={() =>
          checkout?.review({ id: "a", name: "Museum", date: "2026-11-01" })
        }
      >
        Review museum
      </button>
    );
  }
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <TripCheckout tripId="trip-a" travelers={2}>
          <ItineraryConsumer />
        </TripCheckout>,
      );
    });
    const before = renders;
    await act(async () => {
      renderer.root.findByType("button").props.onClick();
    });
    expect(renderer.root.findByProps({ role: "dialog" })).toBeTruthy();
    expect(renders).toBe(before);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
  }
});

test.each(["matching", "wrong attempt", "missing receipt", "wrong status"])(
  "provider navigation requires a confirmed matching handoff: %s",
  async (receipt) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const assign = vi.fn();
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { assign },
    });
    vi.stubGlobal("document", { body: { style: { overflow: "auto" } } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, options) => ({
        ok: true,
        json: async () =>
          options?.method === "POST"
            ? {
                redirectUrl: "https://www.viator.com/fixture",
                ...(receipt === "missing receipt"
                  ? {}
                  : {
                      attemptId:
                        receipt === "wrong attempt"
                          ? "different"
                          : JSON.parse(options.body).attemptId,
                      status:
                        receipt === "wrong status"
                          ? "booked"
                          : "handoff_prepared",
                    }),
              }
            : { enabled: true, attempts: [] },
      })),
    );
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <TripCheckout tripId="trip-a" travelers={2}>
            <ReviewButton />
          </TripCheckout>,
        );
      });
      await act(async () => {
        renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("Review option"))!
          .props.onClick();
      });
      await act(async () => {
        await renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("Continue to Viator"))!
          .props.onClick();
      });
      if (receipt === "matching") expect(assign).toHaveBeenCalledOnce();
      else {
        expect(assign).not.toHaveBeenCalled();
        expect(JSON.stringify(renderer.toJSON())).toContain(
          "booking step could not be confirmed",
        );
      }
    } finally {
      await act(async () => renderer?.unmount());
      vi.unstubAllGlobals();
    }
  },
);
