import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  owner: "owner-a",
  authenticated: true,
  loading: false,
  accountRevision: 0,
  push: vi.fn(),
  consent: vi.fn(),
}));
vi.mock("@/hooks/useUser", () => ({
  useUser: () => ({
    session: mocks.authenticated ? { user: { id: mocks.owner } } : null,
    loading: mocks.loading,
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
vi.mock("@/components/trips/DatePicker", () => ({
  DatePicker: (props: {
    startDate?: Date;
    endDate?: Date;
    startError?: string;
    onStartDateChange?: (date: Date | undefined) => void;
    onEndDateChange?: (date: Date | undefined) => void;
  }) => React.createElement("div", { "data-testid": "date-picker", ...props }),
}));
vi.mock("@/lib/ai/planning-consent-client", () => ({
  requestPlanningConsent: (...args: unknown[]) => mocks.consent(...args),
}));
import CreateTripPage from "../app/create/page";
import {
  editorDraftStorageKey,
  saveCreateDraft,
  saveEditorDraft,
} from "../lib/create-draft";
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
  saveEditorDraft(
    storage,
    {
      travelers: 3,
      hotelSearch: {
        countryCode: "FR",
        guestNationality: "CA",
        rooms: [{ adults: 2, children: [7] }],
        consentVersion: "hotel-search-nuitee-v1",
      },
    },
    Date.now(),
    "owner-a",
  );
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
    const retained = JSON.parse(values.get(editorDraftStorageKey("owner-a"))!);
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
    saveEditorDraft(
      storage,
      {
        selectedPlace: { name: "Paris", source: "catalog", placeId: "paris" },
        startDate: "2099-06-01",
        endDate: "2099-06-03",
        travelers,
        travelerType: "family",
        selectedVibes: [],
        budget: "moderate",
        hotelSearch,
      },
      Date.now(),
      "owner-a",
    );
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
          values.get(editorDraftStorageKey("owner-a"))!,
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

test.each(["6,", "abc"])(
  "raw hotel age text %j survives typing, autosave and repeated reload",
  async (raw) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.owner = "owner-a";
    mocks.accountRevision = 0;
    vi.stubEnv("NEXT_PUBLIC_HOTEL_SEARCH_ENABLED", "true");
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    saveEditorDraft(
      storage,
      {
        selectedPlace: { name: "Paris", source: "catalog", placeId: "paris" },
        startDate: "2099-06-01",
        endDate: "2099-06-03",
        travelers: 5,
        travelerType: "family",
        budget: "moderate",
        selectedVibes: [],
        hotelSearch: {
          countryCode: "FR",
          guestNationality: "CA",
          consentVersion: "hotel-search-nuitee-v1",
          rooms: [
            { adults: 2, children: [6] },
            { adults: 1, children: [8] },
          ],
        },
      },
      Date.now(),
      "owner-a",
    );
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
    const inputs = () =>
      renderer.root.findAllByProps({ placeholder: "For example: 6, 10" });
    const submit = () =>
      renderer.root
        .findAllByType("button")
        .find((button) => button.children.includes("Generate itinerary"))!;
    const saved = () =>
      JSON.parse(values.get(editorDraftStorageKey("owner-a"))!).draft;
    try {
      await act(async () => {
        renderer = create(<CreateTripPage />);
      });
      // Invoke the real rendered inputs' onChange for each typed prefix.
      for (let i = 1; i <= raw.length; i++) {
        await act(async () => {
          inputs()[0].props.onChange({ target: { value: raw.slice(0, i) } });
        });
      }
      await act(async () => {
        inputs()[1].props.onChange({ target: { value: " 8 , 9 " } });
      });
      expect(inputs().map((input) => input.props.value)).toEqual([
        raw,
        " 8 , 9 ",
      ]);
      expect(submit().props.disabled).toBe(true);
      for (let reload = 0; reload < 2; reload++) {
        await act(async () => {
          renderer.unmount();
        });
        await act(async () => {
          renderer = create(<CreateTripPage />);
        });
        expect(inputs().map((input) => input.props.value)).toEqual([
          raw,
          " 8 , 9 ",
        ]);
        expect(submit().props.disabled).toBe(true);
        expect(saved().hotelAgeText).toEqual([raw, " 8 , 9 "]);
      }
      await act(async () => {
        inputs()[0].props.onChange({ target: { value: "6, 10" } });
      });
      expect(submit().props.disabled).toBe(false);
      expect(saved().hotelSearch.rooms[0].children).toEqual([6, 10]);
      await act(async () => {
        renderer.unmount();
      });
      await act(async () => {
        renderer = create(<CreateTripPage />);
      });
      expect(inputs().map((input) => input.props.value)).toEqual([
        "6, 10",
        " 8 , 9 ",
      ]);
      expect(submit().props.disabled).toBe(false);
      // Removing and re-adding a room must not recover its stale raw text.
      await act(async () => {
        renderer.root
          .findAllByType("button")
          .find((button) => button.children.includes("Remove last room"))!
          .props.onClick();
      });
      await act(async () => {
        renderer.root
          .findAllByType("button")
          .find((button) => button.children.includes("Add room"))!
          .props.onClick();
      });
      expect(inputs()[1].props.value).toBe("");
      await act(async () => {
        renderer.unmount();
      });
      vi.stubEnv("NEXT_PUBLIC_HOTEL_SEARCH_ENABLED", "false");
      await act(async () => {
        renderer = create(<CreateTripPage />);
      });
      expect(inputs()).toHaveLength(0);
      expect(saved().hotelSearch).toBeNull();
      expect(saved().hotelAgeText).toEqual([]);
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

test("guide deep link keeps destination across sign-in handoff and gates restore on authLoading", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.authenticated = false;
  mocks.loading = false;
  mocks.owner = "owner-a";
  mocks.accountRevision = 0;
  mocks.push.mockClear();
  const localValues = new Map<string, string>();
  const localStorageMock = {
    get length() {
      return localValues.size;
    },
    key: (index: number) => Array.from(localValues.keys())[index] ?? null,
    getItem: (key: string) => localValues.get(key) ?? null,
    setItem: (key: string, value: string) => localValues.set(key, value),
    removeItem: (key: string) => localValues.delete(key),
  };
  const sessionValues = new Map<string, string>();
  const sessionStorageMock = {
    get length() {
      return sessionValues.size;
    },
    key: (index: number) => Array.from(sessionValues.keys())[index] ?? null,
    getItem: (key: string) => sessionValues.get(key) ?? null,
    setItem: (key: string, value: string) => sessionValues.set(key, value),
    removeItem: (key: string) => sessionValues.delete(key),
  };
  const replaceState = vi.fn();
  const windowMock = {
    location: { search: "?destination=maldives" },
    history: { replaceState },
  };
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("sessionStorage", sessionStorageMock);
  vi.stubGlobal("window", windowMock);
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<CreateTripPage />);
    });
    expect(JSON.stringify(renderer.toJSON())).toContain("Maldives");
    const datePicker = renderer.root.findByProps({
      "data-testid": "date-picker",
    });
    await act(async () => {
      datePicker.props.onStartDateChange(new Date(2099, 5, 1));
      datePicker.props.onEndDateChange(new Date(2099, 5, 5));
    });
    const signInGenerate = renderer.root
      .findAllByType("button")
      .find((b) => b.children.includes("Sign in & generate itinerary"))!;
    expect(signInGenerate.props.disabled).toBe(false);
    await act(async () => {
      await signInGenerate.props.onClick();
    });
    expect(mocks.push).toHaveBeenCalledTimes(1);
    const pushedUrl = String(mocks.push.mock.calls[0][0]);
    const redirectParam = decodeURIComponent(pushedUrl.split("redirectTo=")[1]);
    expect(redirectParam).toContain("/create?draft=");
    const draftId = redirectParam.split("draft=")[1];
    const handoffKey = `faroway-create-draft:${draftId}`;
    expect(localValues.has(handoffKey)).toBe(true);

    // Simulate returning from login while auth is still loading: guest:0 must NOT consume ?draft!
    await act(async () => {
      renderer.unmount();
    });
    windowMock.location.search = `?draft=${draftId}`;
    mocks.authenticated = false;
    mocks.loading = true;
    await act(async () => {
      renderer = create(<CreateTripPage />);
    });
    expect(localValues.has(handoffKey)).toBe(true);

    // Auth resolves for owner-a: keyed remount consumes ?draft and restores Maldives + dates.
    mocks.authenticated = true;
    mocks.loading = false;
    mocks.accountRevision = 1;
    await act(async () => {
      renderer.update(<CreateTripPage />);
    });
    expect(localValues.has(handoffKey)).toBe(false);
    const output = JSON.stringify(renderer.toJSON());
    expect(output).toContain("Maldives");
    expect(output).toContain("Jun 1");
    expect(output).toContain("Jun 5, 2099");
  } finally {
    mocks.authenticated = true;
    mocks.loading = false;
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
  }
});

test("keeps submission lock and isGenerating active across pending router.push", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.authenticated = true;
  mocks.loading = false;
  mocks.owner = "owner-a";
  mocks.accountRevision = 0;
  mocks.push.mockClear();
  mocks.consent.mockResolvedValue(async () => ({
    Authorization: "Bearer fixture",
  }));
  const requestId = "33333333-3333-4333-8333-333333333333";
  const sessionStorageMock = {
    getItem: () =>
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        draft: {
          selectedPlace: { name: "Paris", source: "catalog", placeId: "paris" },
          startDate: "2099-06-01",
          endDate: "2099-06-04",
          travelers: 2,
          travelerType: "couple",
          selectedVibes: [],
          budget: "moderate",
        },
      }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  const localValues = new Map<string, string>();
  vi.stubGlobal("sessionStorage", sessionStorageMock);
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => localValues.get(k) ?? null,
    setItem: (k: string, v: string) => localValues.set(k, v),
    removeItem: (k: string) => localValues.delete(k),
  });
  vi.stubGlobal("window", {
    location: { search: "" },
    history: { replaceState: vi.fn() },
  });
  vi.stubGlobal("crypto", { randomUUID: () => requestId });
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ trip: { id: requestId, user_id: "owner-a" } }),
      ),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
  vi.stubGlobal("fetch", fetchMock);
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<CreateTripPage />);
    });
    const submitButton = () =>
      renderer.root
        .findAllByType("button")
        .find((b) =>
          b.children.some(
            (c) =>
              typeof c === "string" &&
              (c.includes("Generate itinerary") ||
                c.includes("Starting AI trip planner") ||
                c.includes("Creating your trip")),
          ),
        )!;
    await act(async () => {
      await submitButton().props.onClick();
    });
    expect(mocks.push).toHaveBeenCalledWith(`/trips/${requestId}`);
    expect(submitButton().props.disabled).toBe(true);
    await act(async () => {
      await submitButton().props.onClick();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
  }
});

test.each([409, 410])(
  "clears dead pending request on HTTP %i and shows recovery copy",
  async (status) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.authenticated = true;
    mocks.loading = false;
    mocks.owner = "owner-a";
    mocks.push.mockClear();
    mocks.consent.mockResolvedValue(async () => ({
      Authorization: "Bearer fixture",
    }));
    const requestId = "44444444-4444-4444-8444-444444444444";
    const key = "faroway:pending-create:owner-a";
    const localValues = new Map([
      [
        key,
        JSON.stringify({
          requestId,
          destination: "Tokyo",
          start_date: "2099-06-01",
          end_date: "2099-06-04",
          travelers: 2,
          budget: "moderate",
        }),
      ],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => localValues.get(k) ?? null,
      setItem: (k: string, v: string) => localValues.set(k, v),
      removeItem: (k: string) => localValues.delete(k),
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
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: "dead" }), { status }),
        ),
    );
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<CreateTripPage />);
      });
      await act(async () => {
        await renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("Resume saved trip"))!
          .props.onClick();
      });
      expect(localValues.has(key)).toBe(false);
      const output = JSON.stringify(renderer.toJSON());
      expect(output).toContain("can’t be reused");
      expect(output).not.toContain("Resume saved trip");
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      vi.unstubAllGlobals();
    }
  },
);

test.each([
  {
    name: "TimeoutError",
    mockFetch: () => {
      const err = new Error("signal timed out");
      err.name = "TimeoutError";
      return Promise.reject(err);
    },
    expected: "took too long",
  },
  {
    name: "TypeError",
    mockFetch: () => Promise.reject(new TypeError("Failed to fetch")),
    expected: "couldn’t reach Faroway",
  },
  {
    name: "401",
    mockFetch: () =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
      ),
    expected: "Your session expired",
  },
  {
    name: "400",
    mockFetch: () =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
        }),
      ),
    expected: "Please check your destination, dates, and traveler details",
  },
])("maps $name errors to friendly copy", async ({ mockFetch, expected }) => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.authenticated = true;
  mocks.loading = false;
  mocks.owner = "owner-a";
  mocks.consent.mockResolvedValue(async () => ({
    Authorization: "Bearer fixture",
  }));
  const sessionValues = new Map([
    [
      editorDraftStorageKey("owner-a"),
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        draft: {
          selectedPlace: { name: "Paris", source: "catalog", placeId: "paris" },
          startDate: "2099-06-01",
          endDate: "2099-06-04",
          travelers: 2,
          travelerType: "couple",
          selectedVibes: [],
          budget: "moderate",
        },
      }),
    ],
  ]);
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => sessionValues.get(k) ?? null,
    setItem: (k: string, v: string) => sessionValues.set(k, v),
    removeItem: (k: string) => sessionValues.delete(k),
  });
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal("window", {
    location: { search: "" },
    history: { replaceState: vi.fn() },
  });
  vi.stubGlobal("fetch", vi.fn(mockFetch));
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<CreateTripPage />);
    });
    await act(async () => {
      await renderer.root
        .findAllByType("button")
        .find((b) => b.children.includes("Generate itinerary"))!
        .props.onClick();
    });
    expect(JSON.stringify(renderer.toJSON())).toContain(expected);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
  }
});

test("rejects past start dates in restored drafts and clears undoSnapshot on manual edit", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.authenticated = true;
  mocks.loading = false;
  mocks.owner = "owner-a";
  const sessionValues = new Map([
    [
      editorDraftStorageKey("owner-a"),
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        draft: {
          selectedPlace: { name: "Paris", source: "catalog", placeId: "paris" },
          startDate: "2024-01-10",
          endDate: "2024-01-14",
          travelers: 2,
          travelerType: "couple",
          selectedVibes: [],
          budget: "moderate",
        },
      }),
    ],
  ]);
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => sessionValues.get(k) ?? null,
    setItem: (k: string, v: string) => sessionValues.set(k, v),
    removeItem: (k: string) => sessionValues.delete(k),
  });
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal("window", {
    location: { search: "" },
    history: { replaceState: vi.fn() },
  });
  vi.stubGlobal("fetch", undefined);
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<CreateTripPage />);
    });
    const output = JSON.stringify(renderer.toJSON());
    expect(output).toContain("Choose your dates");
    const submit = () =>
      renderer.root
        .findAllByType("button")
        .find((b) => b.children.includes("Generate itinerary"))!;
    expect(submit().props.disabled).toBe(true);

    // Prompt fill makes Undo visible, and a manual edit clears it.
    const promptInput = renderer.root.findByProps({
      id: "dream-trip-prompt-input",
    });
    await act(async () => {
      promptInput.props.onChange({
        target: { value: "5 days in Tokyo, foodie, luxury" },
      });
    });
    const fillBtn = renderer.root
      .findAllByType("button")
      .find((b) =>
        b.children.some(
          (c) => typeof c === "string" && c.includes("Fill my trip"),
        ),
      )!;
    await act(async () => {
      fillBtn.props.onClick();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(
      renderer.root
        .findAllByType("button")
        .some((b) => b.children.includes("Undo")),
    ).toBe(true);

    await act(async () => {
      renderer.root
        .findByProps({ "aria-label": "Increase travelers" })
        .props.onClick();
    });
    expect(
      renderer.root
        .findAllByType("button")
        .some((b) => b.children.includes("Undo")),
    ).toBe(false);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
  }
});
