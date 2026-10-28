import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TripBriefEditor } from "../components/trips/TripBriefEditor";
import type { Trip } from "../lib/trips/load-trip";

const fetchMock = vi.fn();
let renderer: ReactTestRenderer | undefined;
const saved = vi.fn();
const reload = vi.fn();
function trip(id = "trip-a", owner = "owner-a", revision = "revision-a"): Trip {
  return {
    id,
    user_id: owner,
    destination: "Tokyo",
    start_date: "2026-11-01",
    end_date: "2026-11-04",
    travelers: 2,
    status: "draft",
    created_at: "2026-10-01",
    updated_at: revision,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
async function mount(value = trip()) {
  await act(async () => {
    renderer = create(
      <TripBriefEditor trip={value} onSaved={saved} onReload={reload} />,
    );
  });
  await act(async () => {
    renderer!.root
      .findAllByType("input")[0]
      .props.onChange({ target: { value: "Paris" } });
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
  });
  renderer = undefined;
  vi.unstubAllGlobals();
});

test("one submitted snapshot stays frozen and duplicate dispatch is blocked before rendering", async () => {
  const response = deferred<Response>();
  fetchMock.mockReturnValue(response.promise);
  await mount();
  let work!: Promise<void>;
  await act(async () => {
    const submit = renderer!.root.findByType("form").props.onSubmit;
    work = submit({ preventDefault: vi.fn() });
    void submit({ preventDefault: vi.fn() });
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
    destination: "Paris",
    expectedUpdatedAt: "revision-a",
  });
  expect(renderer!.root.findByType("fieldset").props.disabled).toBe(true);
  await act(async () => {
    response.resolve(
      new Response(
        JSON.stringify({
          trip: { ...trip(), destination: "Paris", updated_at: "revision-b" },
        }),
        { status: 200 },
      ),
    );
    await work;
  });
  expect(saved).toHaveBeenCalledTimes(1);
  expect(saved.mock.calls[0][0].destination).toBe("Paris");
  expect(renderer!.root.findByType("fieldset").props.disabled).toBe(false);
});

test.each(["trip", "owner", "revision"])(
  "a replacement %s invalidates a delayed save and resets its editor",
  async (change) => {
    const response = deferred<Response>();
    fetchMock.mockReturnValue(response.promise);
    await mount();
    let work!: Promise<void>;
    await act(async () => {
      work = renderer!.root
        .findByType("form")
        .props.onSubmit({ preventDefault: vi.fn() });
    });
    const next = trip(
      change === "trip" ? "trip-b" : "trip-a",
      change === "owner" ? "owner-b" : "owner-a",
      change === "revision" ? "revision-b" : "revision-a",
    );
    await act(async () => {
      renderer!.update(
        <TripBriefEditor trip={next} onSaved={saved} onReload={reload} />,
      );
    });
    expect(renderer!.root.findAllByType("input")[0].props.value).toBe("Tokyo");
    await act(async () => {
      response.resolve(
        new Response(
          JSON.stringify({ trip: { ...trip(), destination: "Old save" } }),
          { status: 200 },
        ),
      );
      await work;
    });
    expect(saved).not.toHaveBeenCalled();
    expect(renderer!.root.findAllByType("input")[0].props.value).toBe("Tokyo");
    expect(renderer!.root.findByType("fieldset").props.disabled).toBe(false);
  },
);

test("an unverified owner response keeps edits and offers the latest saved brief", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ trip: trip("trip-a", "other-owner") }), {
      status: 200,
    }),
  );
  await mount();
  await act(async () => {
    await renderer!.root
      .findByType("form")
      .props.onSubmit({ preventDefault: vi.fn() });
  });
  expect(saved).not.toHaveBeenCalled();
  expect(renderer!.root.findAllByType("input")[0].props.value).toBe("Paris");
  const alert = renderer!.root.findByProps({ role: "alert" });
  expect(
    alert.children.filter((child) => typeof child === "string").join(" "),
  ).toContain("could not be verified");
  const button = alert.findByType("button");
  await act(async () => {
    button.props.onClick();
  });
  expect(reload).toHaveBeenCalledTimes(1);
});

test.each(["revision-a", "", null])(
  "an unconfirmed revision %j keeps the edited brief for recovery",
  async (revision) => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          trip: { ...trip(), destination: "Paris", updated_at: revision },
        }),
        { status: 200 },
      ),
    );
    await mount();
    await act(async () => {
      await renderer!.root
        .findByType("form")
        .props.onSubmit({ preventDefault: vi.fn() });
    });
    expect(saved).not.toHaveBeenCalled();
    expect(renderer!.root.findAllByType("input")[0].props.value).toBe("Paris");
    expect(
      renderer!.root.findByProps({ role: "alert" }).findByType("button")
        .children,
    ).toContain("Load latest brief");
  },
);

test("saving an unchanged brief confirms its state without an error or reload action", async () => {
  await act(async () => {
    renderer = create(
      <TripBriefEditor
        trip={{ ...trip(), preferences: { flightSearch: null } }}
        onSaved={saved}
        onReload={reload}
      />,
    );
  });
  await act(async () => {
    await renderer!.root
      .findByType("form")
      .props.onSubmit({ preventDefault: vi.fn() });
  });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(renderer!.root.findAllByProps({ role: "alert" })).toHaveLength(0);
  const status = renderer!.root.findByProps({ role: "status" });
  expect(status.children.join(" ")).toContain("already up to date");
  expect(status.findAllByType("button")).toHaveLength(0);
});

test.each(["same revision", "failed read", "wrong owner", "wrong trip"])(
  "explicit reload after a failed save: %s",
  async (outcome) => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await mount();
    await act(async () => {
      await renderer!.root
        .findByType("form")
        .props.onSubmit({ preventDefault: vi.fn() });
    });
    const latest =
      outcome === "failed read"
        ? null
        : outcome === "wrong owner"
          ? trip("trip-a", "other-owner")
          : outcome === "wrong trip"
            ? trip("trip-b")
            : trip();
    reload.mockResolvedValue(latest);
    await act(async () => {
      await renderer!.root
        .findByProps({ role: "alert" })
        .findByType("button")
        .props.onClick();
    });
    expect(renderer!.root.findAllByType("input")[0].props.value).toBe(
      outcome === "same revision" ? "Tokyo" : "Paris",
    );
    expect(renderer!.root.findAllByProps({ role: "alert" })).toHaveLength(
      outcome === "same revision" ? 0 : 1,
    );
  },
);

test.each([false, true])(
  "changing flight supplier requires fresh consent (granted=%s)",
  async (grant) => {
    const value = {
      ...trip(),
      preferences: {
        adults: 2,
        children: 0,
        flightSearch: {
          childAges: [],
          consentVersion: "flight-search-duffel-v1",
        },
      },
    };
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
    await mount(value);
    const supplier = renderer!.root
      .findAllByType("select")
      .find((node) => node.props.value === "duffel")!;
    await act(async () =>
      supplier.props.onChange({ target: { value: "liteapi" } }),
    );
    const consent = () =>
      renderer!.root
        .findAllByType("input")
        .filter((node) => node.props.type === "checkbox")
        .at(-1)!;
    expect(consent().props.checked).toBe(false);
    if (grant)
      await act(async () =>
        consent().props.onChange({ target: { checked: true } }),
      );
    await act(async () =>
      renderer!.root
        .findByType("form")
        .props.onSubmit({ preventDefault: vi.fn() }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.preferences.flightSearch).toEqual(
      grant
        ? { childAges: [], consentVersion: "flight-search-liteapi-v1" }
        : null,
    );
  },
);

test.each([false, true])(
  "unchecked flight permission persists refusal for a legacy brief (other edits=%s)",
  async (otherEdits) => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
    await mount();
    if (!otherEdits)
      await act(async () =>
        renderer!.root
          .findAllByType("input")[0]
          .props.onChange({ target: { value: "Tokyo" } }),
      );
    await act(async () =>
      renderer!.root
        .findByType("form")
        .props.onSubmit({ preventDefault: vi.fn() }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(fetchMock.mock.calls[0][1].body).preferences.flightSearch,
    ).toBeNull();
  },
);
