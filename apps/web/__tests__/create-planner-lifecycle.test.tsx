import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  owner: "owner-a",
  accountRevision: 0,
  push: vi.fn(),
  consent: vi.fn(),
}));
vi.mock("@/hooks/useUser", () => ({
  useUser: () => ({
    session: { user: { id: mocks.owner } },
    loading: false,
    accountRevision: mocks.accountRevision,
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) =>
    React.createElement("a", props),
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/create/PlacesAutocompleteInput", () => ({
  PlacesAutocompleteInput: () => null,
}));
vi.mock("@/components/trips/DatePicker", () => ({ DatePicker: () => null }));
vi.mock("@/lib/ai/planning-consent-client", () => ({
  requestPlanningConsent: (...args: unknown[]) => mocks.consent(...args),
}));
import CreateTripPage from "../app/create/page";
import { saveEditorDraft } from "../lib/create-draft";
import { HotelSearchFields } from "../components/trips/HotelSearchFields";
import { hotelGuestCounts, type HotelSearchDetails } from "@faroway/constants";

test("hotel setup preserves the saved adult count in a family brief", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const changed = vi.fn();
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <HotelSearchFields
          value={null}
          travelers={3}
          adults={2}
          onChange={changed}
        />,
      );
    });
    await act(async () => {
      renderer.root
        .findByProps({ type: "checkbox" })
        .props.onChange({ target: { checked: true } });
    });
    const details = changed.mock.calls[0][0] as HotelSearchDetails;
    expect(details.rooms).toEqual([{ adults: 2, children: [] }]);
    await act(async () => {
      renderer.update(
        <HotelSearchFields
          value={details}
          travelers={3}
          adults={2}
          onChange={changed}
        />,
      );
    });
    await act(async () => {
      renderer.root
        .findByProps({ placeholder: "For example: 6, 10" })
        .props.onChange({ target: { value: "7" } });
    });
    expect(hotelGuestCounts(changed.mock.calls[1][0])).toEqual({
      adults: 2,
      children: 1,
      travelers: 3,
    });
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});

test("hotel preferences survive a same-tab planner reload", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubEnv("NEXT_PUBLIC_HOTEL_SEARCH_ENABLED", "true");
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  saveEditorDraft(storage, {
    travelers: 3,
    hotelSearch: {
      countryCode: "FR",
      guestNationality: "CA",
      rooms: [{ adults: 2, children: [7] }],
      consentVersion: "hotel-search-nuitee-v1",
    },
  });
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal("window", {
    location: { search: "" },
    history: { replaceState: vi.fn() },
  });
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<CreateTripPage />);
    });
    expect(
      renderer.root.findAllByType("input").map((node) => node.props.value),
    ).toEqual(expect.arrayContaining(["FR", "CA", "7", 2]));
    const retained = JSON.parse(values.get("faroway-create-editor-draft")!);
    expect(retained.draft.hotelSearch.rooms).toEqual([
      { adults: 2, children: [7] },
    ]);
    expect(retained.draft.travelers).toBe(3);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

test.each(["account replacement", "same-owner reauthentication"])(
  "an old creation response cannot continue after %s",
  async (change) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.owner = "owner-a";
    mocks.accountRevision = 0;
    mocks.push.mockClear();
    const requestId = "11111111-1111-4111-8111-111111111111";
    const saved = JSON.stringify({
      requestId,
      destination: "Tokyo",
      start_date: "2026-11-01",
      end_date: "2026-11-05",
      travelers: 2,
      budget: "moderate",
      preferences: { travelerType: "couple", vibes: [] },
    });
    const storage = new Map([["faroway:pending-create:owner-a", saved]]);
    const remove = vi.fn((key: string) => storage.delete(key));
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: remove,
    });
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal("window", {
      location: { search: "" },
      history: { replaceState: vi.fn() },
    });
    mocks.consent.mockResolvedValue(async () => ({
      Authorization: "Bearer fixture",
    }));
    let release!: (response: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<CreateTripPage />);
      });
      const button = renderer.root
        .findAllByType("button")
        .find((node) => node.children.includes("Resume saved trip"))!;
      let work!: Promise<void>;
      await act(async () => {
        work = button.props.onClick();
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(mocks.consent).toHaveBeenCalledWith("owner-a");
      await act(async () => {
        if (change === "account replacement") mocks.owner = "owner-b";
        else mocks.accountRevision += 2;
        renderer.update(<CreateTripPage />);
      });
      await act(async () => {
        release(
          new Response(
            JSON.stringify({ trip: { id: requestId, user_id: "owner-a" } }),
          ),
        );
        await work;
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(mocks.push).not.toHaveBeenCalled();
      expect(storage.has("faroway:pending-create:owner-a")).toBe(true);
      expect(remove).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      vi.unstubAllGlobals();
    }
  },
);

test.each(["confirmed", "wrong owner", "wrong identity", "missing trip"])(
  "creation response: %s",
  async (outcome) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.owner = "owner-a";
    mocks.push.mockClear();
    mocks.consent.mockClear();
    const requestId = "11111111-1111-4111-8111-111111111111";
    const payload = {
      requestId,
      destination: "Tokyo",
      start_date: "2026-11-01",
      end_date: "2026-11-05",
      travelers: 2,
      budget: "moderate",
      preferences: { travelerType: "couple", vibes: [] },
    };
    const storage = new Map([
      ["faroway:pending-create:owner-a", JSON.stringify(payload)],
    ]);
    const remove = vi.fn((key: string) => storage.delete(key));
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: remove,
    });
    const clearEditor = vi.fn();
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: clearEditor,
    });
    vi.stubGlobal("window", {
      location: { search: "" },
      history: { replaceState: vi.fn() },
    });
    mocks.consent.mockResolvedValue(async () => ({
      Authorization: "Bearer fixture",
    }));
    const trip =
      outcome === "missing trip"
        ? undefined
        : {
            id:
              outcome === "wrong identity"
                ? "22222222-2222-4222-8222-222222222222"
                : requestId,
            user_id: outcome === "wrong owner" ? "owner-b" : "owner-a",
          };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ trip })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
    vi.stubGlobal("fetch", fetchMock);
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<CreateTripPage />);
      });
      await act(async () => {
        await renderer.root
          .findAllByType("button")
          .find((node) => node.children.includes("Resume saved trip"))!
          .props.onClick();
      });
      if (outcome === "confirmed") {
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[1][0]).toBe(
          `/api/trips/${requestId}/generate`,
        );
        expect(mocks.push).toHaveBeenCalledWith(`/trips/${requestId}`);
        expect(storage.has("faroway:pending-create:owner-a")).toBe(false);
        expect(clearEditor).toHaveBeenCalled();
      } else {
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(mocks.push).not.toHaveBeenCalled();
        expect(storage.has("faroway:pending-create:owner-a")).toBe(true);
        expect(clearEditor).not.toHaveBeenCalled();
        expect(JSON.stringify(renderer.toJSON())).toContain(
          "could not be confirmed",
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

test("restored draft ignores invalid choices and deduplicates supported vibes", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.owner = "owner-a";
  mocks.accountRevision = 0;
  const draft = {
    selectedPlace: { name: "Kyoto", source: "user" },
    travelers: 1.5,
    travelerType: "invalid",
    selectedVibes: ["foodie", "foodie", {}, "invalid", "nature"],
    showAdvanced: "false",
    startDate: "2026-11-04",
    endDate: "2026-11-01",
  };
  vi.stubGlobal("window", {
    location: { search: "" },
    history: { replaceState: vi.fn() },
  });
  const storedDraft = JSON.stringify({
    version: 1,
    savedAt: Date.now(),
    draft,
  });
  vi.stubGlobal("sessionStorage", {
    getItem: () => storedDraft,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<CreateTripPage />);
    });
    const output = JSON.stringify(renderer.toJSON());
    expect(output).toContain("2 of 5 interests selected");
    expect(
      renderer.root
        .findByProps({ "aria-label": "Travelers" })
        .findAllByType("span")
        .some((span) => span.children.includes("2")),
    ).toBe(true);
    const couple = renderer.root
      .findAllByType("button")
      .find(
        (button) =>
          button.findAll((node) => node.children.includes("Couple")).length > 0,
      )!;
    expect(couple.props["aria-pressed"]).toBe(true);
    await act(async () => {
      const increase = renderer.root.findByProps({
        "aria-label": "Increase travelers",
      }).props.onClick;
      increase();
      increase();
    });
    expect(
      renderer.root
        .findByProps({ "aria-label": "Travelers" })
        .findAllByType("span")
        .some((span) => span.children.includes("4")),
    ).toBe(true);
    expect(
      renderer.root
        .findAllByType("button")
        .find((button) =>
          button.children.some(
            (child) => typeof child === "string" && child.includes("Generate"),
          ),
        )!.props.disabled,
    ).toBe(true);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
  }
});

test.each([
  { name: "incomplete nationality", nationality: "", ages: [7], enabled: true },
  { name: "invalid child age", nationality: "CA", ages: [NaN], enabled: true },
  { name: "out-of-range age", nationality: "CA", ages: [18], enabled: true },
  {
    name: "seven child ages",
    nationality: "CA",
    ages: [1, 2, 3, 4, 5, 6, 7],
    enabled: true,
  },
  { name: "disabled feature", nationality: "CA", ages: [7], enabled: false },
])(
  "hotel editing draft survives autosave and remount: $name",
  async ({ nationality, ages, enabled }) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.owner = "owner-a";
    mocks.accountRevision = 0;
    vi.stubEnv("NEXT_PUBLIC_HOTEL_SEARCH_ENABLED", String(enabled));
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    const hotelSearch = {
      countryCode: "FR",
      guestNationality: nationality,
      rooms: [{ adults: 2, children: ages }],
      consentVersion: "hotel-search-nuitee-v1",
    };
    const travelers = 2 + ages.length;
    saveEditorDraft(storage, {
      selectedPlace: { name: "Paris", source: "catalog", placeId: "paris" },
      startDate: "2099-06-01",
      endDate: "2099-06-03",
      travelers,
      travelerType: "family",
      selectedVibes: [],
      budget: "moderate",
      hotelSearch,
    });
    vi.stubGlobal("sessionStorage", storage);
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal("window", {
      location: { search: "" },
      history: { replaceState: vi.fn() },
    });
    const fetchMock = vi.fn(() => {
      throw new Error("Unexpected network request");
    });
    vi.stubGlobal("fetch", fetchMock);
    let renderer!: ReturnType<typeof create>;
    try {
      for (let mount = 0; mount < 2; mount++) {
        await act(async () => {
          renderer = create(<CreateTripPage />);
        });
        const retained = JSON.parse(
          values.get("faroway-create-editor-draft")!,
        ).draft;
        expect(retained.hotelSearch).toEqual(
          enabled ? JSON.parse(JSON.stringify(hotelSearch)) : null,
        );
        expect(retained.travelers).toBe(travelers);
        const fields = renderer.root.findAllByType(HotelSearchFields);
        const submit = renderer.root
          .findAllByType("button")
          .find((button) =>
            button.children.some(
              (child) =>
                typeof child === "string" &&
                child.includes("Generate itinerary"),
            ),
          )!;
        if (enabled) {
          expect(fields).toHaveLength(1);
          expect(fields[0].props.value).toEqual(hotelSearch);
          expect(
            fields[0].findByProps({ type: "checkbox" }).props.checked,
          ).toBe(true);
          expect(submit.props.disabled).toBe(true);
        } else {
          expect(fields).toHaveLength(0);
          expect(submit.props.disabled).toBe(false);
        }
        await act(async () => {
          renderer.unmount();
        });
      }
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  },
);
