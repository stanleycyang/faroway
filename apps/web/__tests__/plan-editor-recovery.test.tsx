import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";
import { PlanEditor } from "../components/trips/PlanEditor";
const validCommand = {
  requestId: "11111111-1111-4111-8111-111111111111",
  expectedUpdatedAt: "2026-10-13T00:00:00Z",
  expectedPlanRevision: null,
  action: "lock",
  itemId: "item_" + "a".repeat(32),
};
test.each([
  { value: { action: "delete", requestId: "invalid" }, retry: false },
  { value: validCommand, retry: true },
])(
  "stored command recovery validates before offering retry: %j",
  async ({ value, retry }) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const getItem = vi.fn().mockReturnValue(JSON.stringify(value));
    vi.stubGlobal("localStorage", {
      getItem,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          revision: "2026-10-13T00:00:00Z",
          planRevision: null,
          editable: true,
          items: [],
          history: [],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <PlanEditor tripId="trip-a" userId="owner-a" onSaved={vi.fn()} />,
        );
      });
      expect(getItem).toHaveBeenCalledWith(
        "faroway:plan-change:owner-a:trip-a",
      );
      const output = JSON.stringify(renderer.toJSON());
      if (retry) {
        expect(output).toContain("Retry saved change");
        expect(output).not.toContain("saved retry could not be read");
      } else {
        expect(output).not.toContain("Retry saved change");
        expect(output).toContain("saved retry could not be read");
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
    } finally {
      await act(async () => renderer?.unmount());
      vi.unstubAllGlobals();
    }
  },
);

test("slow initial plan read cannot overwrite a newer saved-plan check", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("localStorage", {
    getItem: vi.fn().mockReturnValue(JSON.stringify(validCommand)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  let resolveOld!: (r: Response) => void;
  const plan = (name: string) => ({
    revision: "2026-10-13T00:00:00Z",
    planRevision: null,
    editable: true,
    items: [
      {
        id: "item_" + "a".repeat(32),
        name,
        date: "2026-11-01",
        period: "morning",
        locked: false,
      },
    ],
    history: [],
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(plan("Latest plan")), { status: 200 }),
      ),
  );
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <PlanEditor tripId="trip-a" userId="owner-a" onSaved={vi.fn()} />,
      );
    });
    await act(async () => {
      renderer.root
        .findAllByType("button")
        .find((b) => b.children.includes("Check saved plan"))!
        .props.onClick();
    });
    expect(JSON.stringify(renderer.toJSON())).toContain("Latest plan");
    await act(async () => {
      resolveOld(
        new Response(JSON.stringify(plan("Stale plan")), { status: 200 }),
      );
    });
    expect(JSON.stringify(renderer.toJSON())).toContain("Latest plan");
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Stale plan");
  } finally {
    await act(async () => renderer?.unmount());
    vi.unstubAllGlobals();
  }
});

test.each([
  {},
  { state: "applied" },
  {
    state: "replayed",
    requestId: "22222222-2222-4222-8222-222222222222",
    planRevision: "33333333-3333-4333-8333-333333333333",
    revision: "2026-10-14T00:00:00Z",
  },
])(
  "unconfirmed HTTP success preserves the pending command for receipt recovery: %j",
  async (receipt) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const removeItem = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(JSON.stringify(validCommand)),
      setItem: vi.fn(),
      removeItem,
    });
    const plan = {
      revision: validCommand.expectedUpdatedAt,
      planRevision: null,
      editable: true,
      items: [],
      history: [],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(plan), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(receipt), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const onSaved = vi.fn();
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <PlanEditor tripId="trip-a" userId="owner-a" onSaved={onSaved} />,
        );
      });
      await act(async () => {
        renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("Retry saved change"))!
          .props.onClick();
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][1].method).toBe("POST");
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(validCommand);
      expect(removeItem).not.toHaveBeenCalled();
      expect(onSaved).not.toHaveBeenCalled();
      expect(JSON.stringify(renderer.toJSON())).toContain(
        "Check the saved plan before retrying",
      );
      expect(JSON.stringify(renderer.toJSON())).toContain("Retry saved change");
    } finally {
      await act(async () => renderer?.unmount());
      vi.unstubAllGlobals();
    }
  },
);

test.each([{ items: "invalid" }, { history: [{ action: "" }] }])(
  "invalid saved-plan response preserves retry recovery: %j",
  async (invalid) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const remove = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify(validCommand),
      setItem: vi.fn(),
      removeItem: remove,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            revision: "2026-10-13T00:00:00Z",
            planRevision: null,
            editable: true,
            items: [],
            history: [],
            ...invalid,
          }),
          { status: 200 },
        ),
      ),
    );
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <PlanEditor tripId="trip-a" userId="owner-a" onSaved={vi.fn()} />,
        );
      });
      expect(JSON.stringify(renderer.toJSON())).toContain(
        "saved plan could not be verified",
      );
      expect(JSON.stringify(renderer.toJSON())).toContain(
        "A plan change needs confirmation",
      );
      expect(remove).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      vi.unstubAllGlobals();
    }
  },
);

test.each([false, true])(
  "unreadable retry blocks new changes until successful local discard (removal fails: %s)",
  async (removalFails) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const setItem = vi.fn();
    const removeItem = vi.fn(() => {
      if (removalFails) throw new Error("Storage unavailable");
    });
    vi.stubGlobal("localStorage", {
      getItem: () => "{broken",
      setItem,
      removeItem,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          revision: "2026-10-13T00:00:00Z",
          planRevision: null,
          editable: true,
          items: [
            {
              id: validCommand.itemId,
              name: "Museum",
              date: "2026-11-01",
              period: "morning",
              locked: false,
            },
          ],
          history: [],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <PlanEditor tripId="trip-a" userId="owner-a" onSaved={vi.fn()} />,
        );
      });
      expect(renderer.root.findByType("fieldset").props.disabled).toBe(true);
      await act(async () => {
        renderer.root
          .findAllByType("button")
          .find((b) => b.props["aria-label"] === "Lock Museum")!
          .props.onClick();
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(setItem).not.toHaveBeenCalled();
      await act(async () => {
        renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("Discard unreadable retry"))!
          .props.onClick();
      });
      expect(removeItem).toHaveBeenCalledWith(
        "faroway:plan-change:owner-a:trip-a",
      );
      expect(renderer.root.findByType("fieldset").props.disabled).toBe(
        removalFails,
      );
      if (removalFails)
        expect(JSON.stringify(renderer.toJSON())).toContain("could not clear");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => renderer?.unmount());
      vi.unstubAllGlobals();
    }
  },
);

test("a verified matching receipt clears recovery and loads the saved revision", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const remove = vi.fn();
  vi.stubGlobal("localStorage", {
    getItem: () => JSON.stringify(validCommand),
    setItem: vi.fn(),
    removeItem: remove,
  });
  const plan = {
    revision: validCommand.expectedUpdatedAt,
    planRevision: null,
    editable: true,
    items: [],
    history: [],
  };
  const receipt = {
    state: "applied",
    requestId: validCommand.requestId,
    planRevision: "33333333-3333-4333-8333-333333333333",
    revision: "2026-10-14T00:00:00Z",
  };
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(plan)))
    .mockResolvedValueOnce(new Response(JSON.stringify(receipt)))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...plan,
          revision: receipt.revision,
          planRevision: receipt.planRevision,
        }),
      ),
    );
  vi.stubGlobal("fetch", fetchMock);
  const saved = vi.fn();
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => {
      renderer = create(
        <PlanEditor tripId="trip-a" userId="owner-a" onSaved={saved} />,
      );
    });
    await act(async () => {
      await renderer!.root
        .findAllByType("button")
        .find((button) => button.children.includes("Retry saved change"))!
        .props.onClick();
    });
    expect(remove).toHaveBeenCalledWith("faroway:plan-change:owner-a:trip-a");
    expect(saved).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(renderer!.toJSON())).toContain("Your plan is saved");
    expect(JSON.stringify(renderer!.toJSON())).not.toContain(
      "Retry saved change",
    );
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
  }
});
