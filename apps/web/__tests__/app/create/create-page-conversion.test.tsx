import fs from "node:fs";
import path from "node:path";
import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { FLIGHT_SEARCH_CONSENT_VERSION, travelVibes } from "@faroway/constants";
import { CreateTripSchema } from "@/lib/trips/create-trip-command";
import { validBriefComposition } from "@/lib/trips/brief";

const mocks = vi.hoisted(() => ({
  owner: "owner-a",
  push: vi.fn(),
  back: vi.fn(),
  consent: vi.fn(),
}));

vi.mock("@/hooks/useUser", () => ({
  useUser: () => ({
    session: mocks.owner ? { user: { id: mocks.owner } } : null,
    loading: false,
    accountRevision: 0,
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: mocks.back }),
}));
vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) =>
    React.createElement("a", props),
}));
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) =>
    React.createElement("img", props),
}));
vi.mock("@/components/create/PlacesAutocompleteInput", () => ({
  PlacesAutocompleteInput: () => null,
}));
vi.mock("@/components/trips/DatePicker", () => ({ DatePicker: () => null }));
vi.mock("@/lib/ai/planning-consent-client", () => ({
  requestPlanningConsent: (...args: unknown[]) => mocks.consent(...args),
}));

import CreateTripPage from "@/app/create/page";
import { saveEditorDraft } from "@/lib/create-draft";

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.owner = "owner-a";
  mocks.push.mockClear();
  mocks.consent.mockResolvedValue(async () => ({
    Authorization: "Bearer fixture",
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function stubPlannerGlobals(
  search = "",
  initialDraft?: Record<string, unknown>,
) {
  const sessionMap = new Map<string, string>();
  const sessionStorageMock = {
    getItem: (k: string) => sessionMap.get(k) ?? null,
    setItem: (k: string, v: string) => sessionMap.set(k, v),
    removeItem: (k: string) => sessionMap.delete(k),
  };
  if (initialDraft) {
    saveEditorDraft(sessionStorageMock, initialDraft);
  }
  const localMap = new Map<string, string>();
  const localStorageMock = {
    getItem: (k: string) => localMap.get(k) ?? null,
    setItem: (k: string, v: string) => localMap.set(k, v),
    removeItem: (k: string) => localMap.delete(k),
  };
  vi.stubGlobal("sessionStorage", sessionStorageMock);
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("window", {
    location: { search },
    history: { replaceState: vi.fn(), length: 1 },
  });
  return { sessionMap, localMap };
}

describe("/create conversion & origin/flight consent", () => {
  test("renders single visible editorial <h1>, <Logo />, all 14 canonical vibes, Moderate budget, and softened copy", async () => {
    stubPlannerGlobals("?vibes=cultural,foodie&budget=Comfort");
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<CreateTripPage />);
      });

      const h1s = renderer.root.findAllByType("h1");
      expect(h1s).toHaveLength(1);
      expect(h1s[0].props.className).toContain("font-editorial");
      expect(h1s[0].props.className).not.toContain("hidden");

      const html = JSON.stringify(renderer.toJSON());
      expect(html).toContain("/icon.png");
      expect(html).toContain("Faroway");
      expect(html).not.toContain("faroway.");
      expect(html).not.toContain("No bookings or payments are made");
      expect(html).not.toContain("No booking is made");

      for (const vibe of travelVibes) {
        const btn = renderer.root
          .findAllByType("button")
          .find(
            (b) => b.findAll((n) => n.children.includes(vibe.label)).length > 0,
          );
        expect(btn, `Expected vibe button for ${vibe.label}`).toBeDefined();
      }

      const cultureBtn = renderer.root
        .findAllByType("button")
        .find(
          (b) => b.findAll((n) => n.children.includes("Culture")).length > 0,
        )!;
      expect(cultureBtn.props["aria-pressed"]).toBe(true);

      const moderateBtn = renderer.root
        .findAllByType("button")
        .find(
          (b) => b.findAll((n) => n.children.includes("Moderate")).length > 0,
        )!;
      expect(moderateBtn.props["aria-pressed"]).toBe(true);
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
    }
  });

  test("restores legacy drafts with cultural -> culture and sends originCity, originAirport, and flightSearch=null when unchecked", async () => {
    stubPlannerGlobals("", {
      selectedPlace: { name: "Paris", source: "catalog", placeId: "paris" },
      startDate: "2099-07-01",
      endDate: "2099-07-05",
      travelers: 2,
      travelerType: "couple",
      selectedVibes: ["cultural"],
      budget: "moderate",
      originCity: "San Francisco",
      originAirport: "sfo",
      flightConsent: false,
    });

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            trip: { id: body.requestId, user_id: "owner-a" },
          }),
        );
      })
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
    vi.stubGlobal("fetch", fetchMock);

    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<CreateTripPage />);
      });

      const generateBtn = renderer.root
        .findAllByType("button")
        .find((b) =>
          b.children.some(
            (c) => typeof c === "string" && c.includes("Generate itinerary"),
          ),
        )!;
      expect(generateBtn.props.disabled).toBe(false);

      await act(async () => {
        await generateBtn.props.onClick();
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const createBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(CreateTripSchema.safeParse(createBody).success).toBe(true);
      expect(
        validBriefComposition(createBody.travelers, createBody.preferences),
      ).toBe(true);
      expect(createBody.preferences.originCity).toBe("San Francisco");
      expect(createBody.preferences.originAirport).toBe("SFO");
      expect(createBody.preferences.vibes).toEqual(["culture"]);
      expect(createBody.preferences.flightSearch).toBeNull();

      const genBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
      expect(genBody.preferences.originCity).toBe("San Francisco");
      expect(genBody.preferences.originAirport).toBe("SFO");
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
    }
  });

  test("validates family flight consent child ages and emits valid FlightSearchDetails + adults/children", async () => {
    stubPlannerGlobals("", {
      selectedPlace: { name: "Tokyo", source: "catalog", placeId: "tokyo" },
      startDate: "2099-08-01",
      endDate: "2099-08-06",
      travelers: 3,
      travelerType: "family",
      selectedVibes: ["culture"],
      budget: "moderate",
    });

    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            trip: { id: body.requestId, user_id: "owner-a" },
          }),
        );
      })
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
    vi.stubGlobal("fetch", fetchMock);

    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<CreateTripPage />);
      });

      await act(async () => {
        renderer.root
          .findByProps({ id: "create-origin-city" })
          .props.onChange({ target: { value: "Seattle" } });
        renderer.root
          .findByProps({ id: "create-origin-airport" })
          .props.onChange({ target: { value: "sea" } });
        renderer.root
          .findByProps({ id: "create-flight-consent" })
          .props.onChange({ target: { checked: true } });
      });

      await act(async () => {
        renderer.root
          .findByProps({ id: "create-flight-children" })
          .props.onChange({ target: { value: "1" } });
      });

      const generateBtn = () =>
        renderer.root
          .findAllByType("button")
          .find((b) =>
            b.children.some(
              (c) => typeof c === "string" && c.includes("Generate itinerary"),
            ),
          )!;

      // Missing child age disables generate
      expect(generateBtn().props.disabled).toBe(true);

      await act(async () => {
        renderer.root
          .findByProps({ id: "create-flight-child-ages" })
          .props.onChange({ target: { value: "7" } });
      });

      expect(generateBtn().props.disabled).toBe(false);

      await act(async () => {
        await generateBtn().props.onClick();
      });

      const createBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
      expect(CreateTripSchema.safeParse(createBody).success).toBe(true);
      expect(
        validBriefComposition(createBody.travelers, createBody.preferences),
      ).toBe(true);
      expect(createBody.preferences).toMatchObject({
        originCity: "Seattle",
        originAirport: "SEA",
        adults: 2,
        children: 1,
        flightSearch: {
          childAges: [7],
          consentVersion: FLIGHT_SEARCH_CONSENT_VERSION,
        },
      });
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
    }
  });

  test("create/layout.tsx uses benefit-first metadata without premature sign-in copy", () => {
    const layoutSource = fs.readFileSync(
      path.resolve(process.cwd(), "app/create/layout.tsx"),
      "utf8",
    );
    expect(layoutSource).not.toContain("then sign in");
  });
});
