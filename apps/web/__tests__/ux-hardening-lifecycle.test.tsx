import React, { useRef } from "react";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, test, vi } from "vitest";

const refreshMock = vi.fn();
const captureExceptionMock = vi.fn();
const useUserMock = vi.fn(() => ({
  user: null as { id: string } | null,
  session: null,
  loading: false,
  accountRevision: 0,
  error: null,
  refresh: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: refreshMock,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

vi.mock("@/hooks/useUser", () => ({
  useUser: () => useUserMock(),
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children?: React.ReactNode;
  }) => React.createElement("a", props, children),
}));

vi.mock("@/lib/affiliates/viator-link", () => ({
  buildViatorHandoffUrl: (url: string) => url,
}));

import { TripRecovery } from "@/components/trips/TripRecovery";
import { SharedTripView } from "@/components/trips/SharedTripView";
import { TripCheckout, useTripCheckout } from "@/components/trips/TripCheckout";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { Breadcrumbs } from "@/components/blog/Breadcrumbs";
import { Header } from "@/components/Header";
import { PlacesExplorer } from "@/components/places/PlacesExplorer";
import { TripBriefEditor } from "@/components/trips/TripBriefEditor";

afterEach(() => {
  vi.unstubAllGlobals();
  refreshMock.mockReset();
  captureExceptionMock.mockReset();
  useUserMock.mockReturnValue({
    user: null,
    session: null,
    loading: false,
    accountRevision: 0,
    error: null,
    refresh: vi.fn(),
    signOut: vi.fn(),
  });
});

describe("UX & client hardening regressions", () => {
  test("TripRecovery refreshes the router before resetting and reports errors to Sentry", async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const reset = vi.fn();
    const err = new Error("RSC load failed");
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <TripRecovery
          eyebrow="Test"
          title="Load error"
          description="Try again"
          error={err}
          reset={reset}
        >
          <span>Exit</span>
        </TripRecovery>,
      );
    });
    expect(captureExceptionMock).toHaveBeenCalledWith(err);
    const btn = renderer.root
      .findAllByType("button")
      .find((b) => b.children.includes("Try again"))!;
    await act(async () => {
      btn.props.onClick();
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledTimes(1);
    await act(async () => {
      renderer.unmount();
    });
  });

  test("SharedTripView hydrates stored votes before GET resolves so an early tap toggles remove instead of add", async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const storage = new Map<string, string>([
      [
        "faroway:shared-votes:tok-1",
        JSON.stringify({ "d1-morning-a-0-museum": { thumbs_up: true } }),
      ],
    ]);
    const windowMock = {
      localStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => storage.set(k, v),
      },
    };
    vi.stubGlobal("window", windowMock);
    let resolveGet!: (v: unknown) => void;
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveGet = resolve;
        }),
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          persisted: true,
          counts: { "d1-morning-a-0-museum": { thumbs_up: 0, heart: 0 } },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <SharedTripView
          destination="Kyoto"
          startDate="2026-10-01"
          endDate="2026-10-03"
          travelers={2}
          shareToken="tok-1"
          shareUrl="https://www.faroway.ai/s/tok-1"
          itinerary={{
            overview: "Kyoto trip",
            generatedAt: "2026-09-01T00:00:00Z",
            days: [
              {
                dayNumber: 1,
                date: "2026-10-01",
                title: "Day 1",
                summary: "Arrival",
                morning: {
                  activities: [
                    {
                      id: "museum",
                      name: "Museum",
                      description: "Art",
                      duration: 120,
                      category: "cultural",
                      estimatedCost: { amount: 15, currency: "USD" },
                      timeOfDay: "morning",
                      location: { name: "Museum", address: "Kyoto" },
                      vibeMatch: { matchedVibes: [], reasoning: "" },
                    },
                  ],
                  meals: [],
                },
                afternoon: { activities: [], meals: [] },
                evening: { activities: [], meals: [] },
                tips: [],
              },
            ],
          }}
        />,
      );
    });

    const thumbBtn = renderer.root.findByProps({
      "aria-label": "Thumbs up Museum",
    });
    expect(thumbBtn.props["aria-pressed"]).toBe(true);

    // Tap before the initial GET resolves
    await act(async () => {
      thumbBtn.props.onClick();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const postInit = fetchMock.mock.calls[1][1] as { body: string };
    expect(JSON.parse(postInit.body).action).toBe("remove");

    await act(async () => {
      resolveGet({
        ok: true,
        json: async () => ({
          counts: { "d1-morning-a-0-museum": { thumbs_up: 1, heart: 0 } },
        }),
      });
      await Promise.resolve();
    });

    await act(async () => {
      renderer.unmount();
    });
  });

  test("TripCheckout shows friendly error on non-JSON 502 and keeps booking enabled on focus refresh failure", async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    let focusHandler!: () => void;
    vi.stubGlobal("window", {
      addEventListener: (name: string, fn: () => void) => {
        if (name === "focus") focusHandler = fn;
      },
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("document", { body: { style: { overflow: "" } } });

    const fetchMock = vi
      .fn()
      // Initial GET succeeds with enabled: true
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true, attempts: [] }),
      })
      // Window focus refresh fails transiently
      .mockRejectedValueOnce(new Error("offline"))
      // Checkout POST returns 502 HTML (json() rejects)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new SyntaxError("Unexpected token '<'");
        },
      })
      // Refresh triggered after failed POST
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ enabled: true, attempts: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    function Consumer() {
      const checkout = useTripCheckout();
      return (
        <button
          disabled={!checkout?.enabled}
          onClick={() =>
            checkout?.review({
              id: "act-1",
              name: "Food Tour",
              date: "2026-11-01",
            })
          }
        >
          Review option
        </button>
      );
    }

    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <TripCheckout tripId="trip-1" travelers={2}>
          <Consumer />
        </TripCheckout>,
      );
    });

    // Transient focus refresh error must not disable checkout
    await act(async () => {
      focusHandler();
    });
    const reviewBtn = renderer.root
      .findAllByType("button")
      .find((b) => b.children.includes("Review option"))!;
    expect(reviewBtn.props.disabled).toBe(false);

    await act(async () => {
      reviewBtn.props.onClick();
    });
    await act(async () => {
      await renderer.root
        .findAllByType("button")
        .find((b) => b.children.includes("Continue to Viator"))!
        .props.onClick();
    });
    const alertText = JSON.stringify(
      renderer.root.findByProps({ role: "alert" }).children,
    );
    expect(alertText).toContain("Could not prepare checkout.");
    expect(alertText).not.toContain("Unexpected token");

    await act(async () => {
      renderer.unmount();
    });
  });

  test("useModalFocusTrap locks body scroll cleanly and preserves pre-existing hidden locks", async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const bodyStyle = { overflow: "" };
    vi.stubGlobal("document", {
      activeElement: null,
      body: { style: bodyStyle },
    });
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    function Modal({ open }: { open: boolean }) {
      const ref = useRef<HTMLDivElement>(null);
      useModalFocusTrap({ open, dialogRef: ref, onClose: vi.fn() });
      return open ? <div ref={ref} tabIndex={-1} /> : null;
    }

    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<Modal open={true} />);
    });
    expect(bodyStyle.overflow).toBe("hidden");

    await act(async () => {
      renderer.update(<Modal open={false} />);
    });
    expect(bodyStyle.overflow).toBe("");

    // Pre-existing hidden lock owned by outer component must not be cleared
    bodyStyle.overflow = "hidden";
    await act(async () => {
      renderer.update(<Modal open={true} />);
    });
    await act(async () => {
      renderer.update(<Modal open={false} />);
    });
    expect(bodyStyle.overflow).toBe("hidden");

    await act(async () => {
      renderer.unmount();
    });
  });

  test("Breadcrumbs escapes < in JSON-LD script", async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <Breadcrumbs
          items={[{ label: "</script><script>alert(1)", href: "/" }]}
        />,
      );
    });
    const script = renderer.root.findByType("script");
    const html = script.props.dangerouslySetInnerHTML.__html as string;
    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c/script>");
    await act(async () => {
      renderer.unmount();
    });
  });

  test("Header hides Sign in when user is authenticated", async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    useUserMock.mockReturnValue({
      user: { id: "user-1" },
      session: null,
      loading: false,
      accountRevision: 1,
      error: null,
      refresh: vi.fn(),
      signOut: vi.fn(),
    });
    vi.stubGlobal("window", {
      scrollY: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      matchMedia: () => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<Header />);
    });
    const links = renderer.root.findAllByType("a");
    expect(links.some((l) => l.props.href === "/auth/login")).toBe(false);
    expect(links.some((l) => l.props.href === "/dashboard")).toBe(true);
    await act(async () => {
      renderer.unmount();
    });
  });

  test("PlacesExplorer surfaces sign-in prompt on 401", async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("document", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
      }),
    );
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<PlacesExplorer initialPlaceId="place-1" />);
    });
    await act(async () => {
      await renderer.root.findByType("button").props.onClick();
    });
    const alertText = JSON.stringify(renderer.toJSON());
    expect(alertText).toContain("Sign in to view live place details");
    await act(async () => {
      renderer.unmount();
    });
  });

  test("TripBriefEditor allows editing an in-progress trip whose start_date is already in the past", async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    let renderer!: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <TripBriefEditor
          trip={{
            id: "trip-past-start",
            user_id: "user-1",
            destination: "Lisbon",
            start_date: "2020-01-01",
            end_date: "2099-01-05",
            travelers: 2,
            status: "planned",
            created_at: "2020-01-01T00:00:00Z",
            updated_at: "2020-01-01T00:00:00Z",
          }}
          onSaved={vi.fn()}
          onReload={vi.fn(async () => null)}
        />,
      );
    });
    const dateInputs = renderer.root
      .findAllByType("input")
      .filter((input) => input.props.type === "date");
    expect(dateInputs[0].props.min).toBe("2020-01-01");
    await act(async () => {
      renderer.unmount();
    });
  });
});
