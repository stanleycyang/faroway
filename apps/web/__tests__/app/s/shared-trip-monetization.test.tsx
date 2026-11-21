import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AFFILIATE_DISCLOSURE_SHORT } from "@faroway/constants";
import { SharedTripView } from "@/components/trips/SharedTripView";
import type { TripDay } from "@/lib/ai/types";

vi.mock("@/hooks/useModalFocusTrap", () => ({
  useModalFocusTrap: () => undefined,
}));
vi.mock("@/lib/affiliates/viator-link", () => ({
  buildViatorHandoffUrl: (url: string) => url,
}));
vi.mock("@/components/trips/ViatorContentPolicy", () => ({
  useViatorContentEnabled: () => true,
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

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

const sharedDay: TripDay = {
  dayNumber: 1,
  date: "2026-11-01",
  title: "Tokyo Highlights",
  summary: "Explore Shibuya & Asakusa",
  morning: {
    activities: [
      {
        id: "activity_gyg_77",
        name: "Senso-ji Walking Tour",
        description: "Historic temple walk",
        duration: 120,
        estimatedCost: { amount: 45, currency: "USD" },
        category: "cultural",
        timeOfDay: "morning",
        location: { name: "Asakusa" },
        vibeMatch: { matchedVibes: ["culture"], reasoning: "Historic temple" },
        bookingInfo: {
          requiresReservation: true,
          bookingUrl: "https://www.getyourguide.com/tokyo-l193/sensoji-t77/",
          affiliateId: "getyourguide",
        },
      },
    ],
    meals: [],
  },
  afternoon: { activities: [], meals: [] },
  evening: { activities: [], meals: [] },
  tips: [],
};

describe("SharedTripView monetization and brand polish (Feature #15)", () => {
  it("renders <Logo />, Lucide reactions (no OS emojis), Customize & book + Clone & customize CTAs, and partner CTAs", () => {
    const html = renderToStaticMarkup(
      <SharedTripView
        destination="Tokyo"
        startDate="2026-11-01"
        endDate="2026-11-04"
        travelers={2}
        budgetTier="moderate"
        vibes={["culture"]}
        shareToken="tok_shared_1"
        shareUrl="https://www.faroway.ai/s/tok_shared_1"
        itinerary={{
          days: [sharedDay],
          overview: "Four days in Tokyo",
          generalTips: ["Get a Suica card"],
          packingList: ["Walking shoes"],
          generatedAt: "2026-10-01T00:00:00Z",
        }}
        essentials={{
          esim: {
            partner: "airalo",
            label: "Japan eSIM data via Airalo",
            vertical: "esim",
            url: "https://www.airalo.com/japan-esim",
            configured: true,
            isSearchFallback: true,
            disclosure: AFFILIATE_DISCLOSURE_SHORT,
          },
        }}
      />,
    );

    expect(html).toContain('aria-label="Faroway home"');
    expect(html).toContain("Customize &amp; book");
    expect(html).toContain("Clone &amp; customize this trip");
    expect(html).toContain("Report this itinerary");
    expect(html).toContain("/report?type=shared_trip&amp;token=tok_shared_1");
    expect(html).toContain("Book on GetYourGuide");
    expect(html).toContain("Japan eSIM data via Airalo");
    expect(html).toContain(AFFILIATE_DISCLOSURE_SHORT);
    expect(html).toContain("#FAF8F3");
    expect(html).toContain("#143D46");
    expect(html).not.toContain("faroway.");
    for (const emoji of ["👍", "❤️", "💡", "🧳", "📤", "⚡", "★", "✕"]) {
      expect(html).not.toContain(emoji);
    }
  });

  it("never calls owner /api/trips/[id]/checkout and tracks shared clicks via /api/track/click", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes("/reactions")) {
        return new Response(JSON.stringify({ counts: {}, persisted: true }), {
          status: 200,
        });
      }
      if (url === "/api/track/click") {
        return new Response(
          JSON.stringify({
            clickId: "shared-click-99",
            partner: "getyourguide",
            redirectUrl:
              "https://www.getyourguide.com/tokyo-l193/sensoji-t77/?cmp=shared-click-99",
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });

    const openMock = vi.fn().mockReturnValue({ closed: false });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      open: openMock,
      location: { assign: vi.fn() },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      localStorage: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
      },
    });
    vi.stubGlobal("document", { body: { style: { overflow: "auto" } } });

    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <SharedTripView
            destination="Tokyo"
            startDate="2026-11-01"
            endDate="2026-11-04"
            travelers={2}
            shareToken="tok_shared_1"
            shareUrl="https://www.faroway.ai/s/tok_shared_1"
            itinerary={{
              days: [sharedDay],
              overview: "Four days in Tokyo",
              generatedAt: "2026-10-01T00:00:00Z",
            }}
          />,
        );
      });

      expect(
        fetchMock.mock.calls.some(([u]) => String(u).includes("/checkout")),
      ).toBe(false);

      const bookBtn = renderer.root
        .findAllByType("button")
        .find((b) => textOf(b).includes("Book on GetYourGuide"))!;

      await act(async () => {
        bookBtn.props.onClick({ currentTarget: { focus: vi.fn() } });
      });

      const continueBtn = renderer.root
        .findAllByType("button")
        .find((b) => textOf(b).includes("Continue to GetYourGuide"))!;
      await act(async () => {
        await continueBtn.props.onClick();
      });

      const clickCalls = fetchMock.mock.calls.filter(
        ([u]) => u === "/api/track/click",
      );
      expect(clickCalls).toHaveLength(1);
      expect(JSON.parse(clickCalls[0][1]!.body as string)).toMatchObject({
        affiliatePartner: "getyourguide",
        source: "shared_trip",
        itemId: "activity_gyg_77",
      });
      expect(openMock).toHaveBeenCalledWith(
        "https://www.getyourguide.com/tokyo-l193/sensoji-t77/?cmp=shared-click-99",
        "_blank",
        "noopener,noreferrer",
      );
    } finally {
      await act(async () => renderer?.unmount());
    }
  });
});
