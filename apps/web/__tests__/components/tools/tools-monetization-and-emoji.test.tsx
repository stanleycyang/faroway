import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AFFILIATE_DISCLOSURE_SHORT } from "@faroway/constants";
import { VisaCheckerClient } from "@/components/tools/visa/VisaCheckerClient";
import { CostEstimatorClient } from "@/components/tools/cost/CostEstimatorClient";
import { CostBreakdown } from "@/components/tools/cost/CostBreakdown";
import { PackingListClient } from "@/components/tools/packing/PackingListClient";
import { PackingChecklist } from "@/components/tools/packing/PackingChecklist";
import { CurrencyConverterClient } from "@/components/tools/currency/CurrencyConverterClient";
import { TravelQuizClient } from "@/components/tools/quiz/TravelQuizClient";
import { QuizQuestion } from "@/components/tools/quiz/QuizQuestion";
import { QuizResults } from "@/components/tools/quiz/QuizResults";
import { CountryDetailDrawer } from "@/components/tools/world-map/CountryDetailDrawer";
import { MilestoneToast } from "@/components/tools/world-map/MilestoneToast";
import { StatsHeader } from "@/components/tools/world-map/StatsHeader";
import { WorldMapView } from "@/components/tools/world-map/WorldMapView";
import { getCostProfile } from "@/lib/tools/cost-data";
import { quizQuestions } from "@/lib/tools/quiz-questions";
import { getAllGuides } from "@/lib/destination-guides";
import { encodeProfileToUrl } from "@/lib/tools/world-map/share";

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

vi.mock("next/navigation", () => ({
  usePathname: () => "/tools/currency-converter",
}));

vi.mock("@/hooks/useModalFocusTrap", () => ({
  useModalFocusTrap: () => undefined,
}));

vi.mock("@/components/tools/world-map/WorldMap", () => ({
  WorldMap: () => <div data-testid="world-map-stub" />,
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function textOf(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "children" in node) {
    return textOf((node as { children: unknown }).children);
  }
  return "";
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setupClickMocks(
  trackedUrl = "https://www.ivisa.com/apply-online?sub_id=clk",
) {
  const popupMock = {
    opener: {} as unknown,
    closed: false,
    location: { replace: vi.fn() },
    close: vi.fn(),
  };
  const openSpy = vi.fn(() => popupMock);
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      clickId: "33333333-3333-4333-8333-333333333333",
      trackedUrl,
    }),
  });
  vi.stubGlobal("open", openSpy);
  vi.stubGlobal("window", { open: openSpy, location: { assign: vi.fn() } });
  vi.stubGlobal("fetch", fetchMock);
  return { popupMock, openSpy, fetchMock };
}

describe("All 7 tools UI contrast, emoji removal & monetization", () => {
  it("renders zero raw OS emojis or banned contrast classes across tool components", () => {
    const tokyo = getAllGuides().find((g) => g.slug === "tokyo")!;
    const costProfile = getCostProfile("tokyo")!;
    const encoded = encodeProfileToUrl({
      id: "p1",
      name: "Alex",
      emoji: "🌍",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      visits: {
        JPN: { iso: "JPN", status: "visited", pinnedCity: "Tokyo" },
      },
    });

    const html = renderToStaticMarkup(
      <div>
        <VisaCheckerClient />
        <CostEstimatorClient />
        <CostBreakdown
          profile={costProfile}
          dailyBudget={150}
          days={5}
          travelers={2}
          budgetLabel="Mid-Range"
          destinationName="Tokyo"
        />
        <PackingListClient />
        <PackingChecklist
          categories={[
            {
              category: "Essentials",
              emoji: "🎒",
              items: [{ name: "Passport", essential: true }],
            },
          ]}
          storageKey="packing-test"
        />
        <CurrencyConverterClient />
        <TravelQuizClient />
        <QuizQuestion
          question={quizQuestions[0]}
          questionIndex={0}
          totalQuestions={6}
          selected={[]}
          onSelect={vi.fn()}
          onAdvance={vi.fn()}
          onBack={vi.fn()}
        />
        <QuizResults
          results={[
            {
              destination: tokyo,
              score: 95,
              matchPercent: 95,
              matchReasons: ["Foodie paradise"],
            },
          ]}
          onRestart={vi.fn()}
        />
        <CountryDetailDrawer iso="JPN" name="Japan" onClose={vi.fn()} />
        <MilestoneToast milestone={10} onShare={vi.fn()} onDismiss={vi.fn()} />
        <StatsHeader
          profileName="Alex"
          profileEmoji="🌍"
          stats={{
            totalVisited: 10,
            totalCountries: 195,
            continentsVisited: 3,
            continentsTotal: 6,
          }}
        />
        <WorldMapView encoded={encoded} />
      </div>,
    );

    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(html).not.toContain("★");
    expect(html).not.toContain("▾");
    expect(html).not.toContain("text-slate-400");
    expect(html).not.toMatch(/text-primary(?![-\w])/);
    expect(html).not.toMatch(/bg-primary(?![-\w])/);
    expect(html).not.toContain("from-primary to-amber-500");
  });

  it("VisaCheckerClient enriches iVisa nationality, omits null SafetyWing, and tracks clicks with source=tool", async () => {
    const { fetchMock, openSpy, popupMock } = setupClickMocks();

    let root!: ReturnType<typeof create>;
    await act(async () => {
      root = create(
        <VisaCheckerClient
          visaLinksByDest={{
            tokyo: {
              partner: "ivisa",
              label: "Check entry & visa requirements on iVisa",
              vertical: "visas",
              url: "https://www.ivisa.com/apply-online?destination=Japan",
              configured: true,
              isSearchFallback: true,
              disclosure: AFFILIATE_DISCLOSURE_SHORT,
            },
          }}
          insuranceLinksByDest={{
            tokyo: {
              partner: "safetywing",
              label: "Get travel medical insurance with SafetyWing",
              vertical: "insurance",
              url: null,
              configured: false,
              isSearchFallback: false,
              disclosure: AFFILIATE_DISCLOSURE_SHORT,
            },
          }}
        />,
      );
    });

    await act(async () => {
      root.root.findByProps({ id: "visa-passport" }).props.onChange({
        target: { value: "US" },
      });
      root.root.findByProps({ id: "visa-destination" }).props.onChange({
        target: { value: "tokyo" },
      });
    });

    const buttons = root.root.findAllByType("button");
    const ivisaBtn = buttons.find((b) => textOf(b).includes("iVisa"));
    expect(ivisaBtn).toBeDefined();
    expect(buttons.some((b) => textOf(b).includes("SafetyWing"))).toBe(false);

    await act(async () => {
      await ivisaBtn!.props.onClick({ currentTarget: { focus: vi.fn() } });
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.source).toBe("tool");
    expect(payload.placement).toBe("visa_checker_result");
    expect(payload.affiliateUrl).toContain("nationality=United+States");
    expect(openSpy).toHaveBeenCalledWith("", "_blank");
    expect(popupMock.opener).toBeNull();
  });

  it("CurrencyConverterClient swaps currencies and updates Wise pair URL", async () => {
    const { fetchMock } = setupClickMocks(
      "https://wise.com/us/currency-converter/usd-to-jpy-rate",
    );

    let root!: ReturnType<typeof create>;
    await act(async () => {
      root = create(
        <CurrencyConverterClient
          wisePairLinks={{
            "USD-EUR": {
              partner: "wise",
              label: "Wise EUR",
              vertical: "finance",
              url: "https://wise.com/us/currency-converter/usd-to-eur-rate",
              configured: true,
              isSearchFallback: true,
              disclosure: AFFILIATE_DISCLOSURE_SHORT,
            },
            "USD-JPY": {
              partner: "wise",
              label: "Wise JPY",
              vertical: "finance",
              url: "https://wise.com/us/currency-converter/usd-to-jpy-rate",
              configured: true,
              isSearchFallback: true,
              disclosure: AFFILIATE_DISCLOSURE_SHORT,
            },
          }}
        />,
      );
    });

    await act(async () => {
      root.root.findByProps({ id: "currency-to" }).props.onChange({
        target: { value: "JPY" },
      });
    });

    const wiseBtn = root.root
      .findAllByType("button")
      .find((b) => textOf(b).includes("Wise"));
    expect(wiseBtn).toBeDefined();
    await act(async () => {
      await wiseBtn!.props.onClick({ currentTarget: { focus: vi.fn() } });
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.source).toBe("tool");
    expect(payload.affiliateUrl).toContain("usd-to-jpy-rate");
  });

  it("CostEstimatorClient and PackingListClient render affiliate blocks after calculation/generation", async () => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const stayLink = {
      partner: "booking" as const,
      label: "Check availability on Booking.com",
      vertical: "hotels" as const,
      url: "https://www.booking.com/searchresults.html?ss=Tokyo",
      configured: true,
      isSearchFallback: true,
      disclosure: AFFILIATE_DISCLOSURE_SHORT,
    };
    const flightLink = {
      partner: "skyscanner" as const,
      label: "Compare flights on Skyscanner",
      vertical: "flights" as const,
      url: "https://www.skyscanner.com/flights",
      configured: true,
      isSearchFallback: true,
      disclosure: AFFILIATE_DISCLOSURE_SHORT,
    };

    let costRoot!: ReturnType<typeof create>;
    await act(async () => {
      costRoot = create(
        <CostEstimatorClient
          affiliateLinksBySlug={{
            tokyo: {
              staysByTier: {
                budget: [stayLink],
                moderate: [stayLink],
                luxury: [stayLink],
              },
              flights: [flightLink],
              fx: null,
            },
          }}
        />,
      );
    });

    await act(async () => {
      costRoot.root.findByProps({ id: "cost-destination" }).props.onChange({
        target: { value: "tokyo" },
      });
    });
    await act(async () => {
      const calcBtn = costRoot.root
        .findAllByType("button")
        .find((b) => textOf(b).includes("Calculate My Trip Cost"));
      calcBtn!.props.onClick();
    });
    expect(textOf(costRoot.toJSON())).toContain("Booking.com");
    expect(textOf(costRoot.toJSON())).toContain(AFFILIATE_DISCLOSURE_SHORT);

    let packRoot!: ReturnType<typeof create>;
    await act(async () => {
      packRoot = create(
        <PackingListClient
          essentialsBySlug={{
            tokyo: {
              esim: {
                partner: "airalo",
                label: "Get Japan eSIM data on Airalo",
                vertical: "esim",
                url: "https://www.airalo.com/japan-esim",
                configured: true,
                isSearchFallback: true,
                disclosure: AFFILIATE_DISCLOSURE_SHORT,
              },
              insurance: {
                partner: "safetywing",
                label: "SafetyWing",
                vertical: "insurance",
                url: null,
                configured: false,
                isSearchFallback: false,
                disclosure: AFFILIATE_DISCLOSURE_SHORT,
              },
              carRental: {
                partner: "discovercars",
                label: "DiscoverCars",
                vertical: "cars",
                url: "https://www.discovercars.com/?location=Tokyo",
                configured: false,
                isSearchFallback: true,
                disclosure: AFFILIATE_DISCLOSURE_SHORT,
              },
              visa: {
                partner: "ivisa",
                label: "iVisa",
                vertical: "visas",
                url: "https://www.ivisa.com/apply-online?destination=Japan",
                configured: false,
                isSearchFallback: true,
                disclosure: AFFILIATE_DISCLOSURE_SHORT,
              },
            },
          }}
        />,
      );
    });

    await act(async () => {
      packRoot.root.findByProps({ id: "packing-destination" }).props.onChange({
        target: { value: "tokyo" },
      });
      const beachBtn = packRoot.root
        .findAllByType("button")
        .find((b) => textOf(b).includes("Beach"));
      beachBtn!.props.onClick();
    });
    await act(async () => {
      const genBtn = packRoot.root
        .findAllByType("button")
        .find((b) => textOf(b).includes("Generate My Packing List"));
      genBtn!.props.onClick();
    });

    const packText = textOf(packRoot.toJSON());
    expect(packText).toContain("Get Japan eSIM data on Airalo");
    expect(JSON.stringify(packRoot.toJSON())).toContain("print-hidden");
  });

  it("QuizResults and CountryDetailDrawer render contextual CTAs and track clicks", async () => {
    const tokyo = getAllGuides().find((g) => g.slug === "tokyo")!;
    const { fetchMock } = setupClickMocks(
      "https://www.booking.com/searchresults.html?label=clk",
    );

    let quizRoot!: ReturnType<typeof create>;
    await act(async () => {
      quizRoot = create(
        <QuizResults
          results={[
            {
              destination: tokyo,
              score: 96,
              matchPercent: 96,
              matchReasons: ["Foodie"],
            },
          ]}
          onRestart={vi.fn()}
          affiliateBundlesBySlug={{
            tokyo: {
              stay: {
                partner: "booking",
                label: "Check availability on Booking.com",
                vertical: "hotels",
                url: "https://www.booking.com/searchresults.html?ss=Tokyo",
                configured: true,
                isSearchFallback: true,
                disclosure: AFFILIATE_DISCLOSURE_SHORT,
              },
              activity: null,
              esim: null,
              insurance: null,
            },
          }}
        />,
      );
    });

    const stayBtn = quizRoot.root
      .findAllByType("button")
      .find((b) => textOf(b).includes("Booking.com"));
    expect(stayBtn).toBeDefined();

    await act(async () => {
      await stayBtn!.props.onClick({ currentTarget: { focus: vi.fn() } });
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).source).toBe("tool");

    let drawerRoot!: ReturnType<typeof create>;
    await act(async () => {
      drawerRoot = create(
        <CountryDetailDrawer iso="MNE" name="Montenegro" onClose={vi.fn()} />,
      );
    });
    expect(textOf(drawerRoot.toJSON())).toContain(
      "Explore stays in Montenegro",
    );
  });
});
