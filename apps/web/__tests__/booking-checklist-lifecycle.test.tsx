import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";
import { BookingChecklist } from "../components/trips/BookingChecklist";
test.each(["success", "failure"])(
  "a slow initial %s cannot replace newer booking progress",
  async (outcome) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    let resolveOld!: (r: Response) => void;
    let rejectOld!: (error: Error) => void;
    const checklist = (name: string) => ({
      revision: "revision-a",
      generationId: "generation-a",
      editable: true,
      receipt: false,
      earlier: [],
      items: [
        {
          id: "item-a",
          name,
          date: "2026-11-01",
          status: "needed",
          reportId: null,
          needsReview: false,
        },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockReturnValueOnce(
          new Promise<Response>((resolve, reject) => {
            resolveOld = resolve;
            rejectOld = reject;
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(checklist("Latest progress")), {
            status: 200,
          }),
        ),
    );
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <BookingChecklist tripId="trip-a" userId="owner-a" />,
        );
      });
      await act(async () => {
        const click = renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("Refresh saved progress"))!.props
          .onClick;
        click();
        click();
      });
      expect(JSON.stringify(renderer.toJSON())).toContain("Latest progress");
      await act(async () => {
        if (outcome === "failure") rejectOld(new Error("Stale read failed"));
        else
          resolveOld(
            new Response(JSON.stringify(checklist("Stale progress")), {
              status: 200,
            }),
          );
      });
      expect(JSON.stringify(renderer.toJSON())).toContain("Latest progress");
      expect(JSON.stringify(renderer.toJSON())).not.toContain("Stale progress");
      expect(JSON.stringify(renderer.toJSON())).not.toContain(
        "Stale read failed",
      );
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    } finally {
      await act(async () => renderer?.unmount());
      vi.unstubAllGlobals();
    }
  },
);

test.each([
  {},
  { state: "applied" },
  {
    state: "applied",
    reportId: "33333333-3333-4333-8333-333333333333",
    requestId: "22222222-2222-4222-8222-222222222222",
  },
  { state: "replayed", reportId: "invalid" },
])(
  "unconfirmed booking response %j keeps the same pending report",
  async (receipt) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const command = {
      requestId: "11111111-1111-4111-8111-111111111111",
      expectedUpdatedAt: "2026-10-13T00:00:00Z",
      generationId: "22222222-2222-4222-8222-222222222222",
      itemId: "item_" + "a".repeat(32),
      expectedReportId: null,
      status: "needed",
    };
    const removeItem = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(JSON.stringify(command)),
      setItem: vi.fn(),
      removeItem,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            revision: command.expectedUpdatedAt,
            generationId: command.generationId,
            editable: true,
            receipt: false,
            items: [],
            earlier: [],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(receipt), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <BookingChecklist tripId="trip-a" userId="owner-a" />,
        );
      });
      await act(async () => {
        renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("Retry same report"))!
          .props.onClick();
      });
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(command);
      expect(removeItem).not.toHaveBeenCalled();
      expect(JSON.stringify(renderer.toJSON())).toContain(
        "Check saved progress before retrying",
      );
      expect(JSON.stringify(renderer.toJSON())).toContain("Retry same report");
    } finally {
      await act(async () => renderer?.unmount());
      vi.unstubAllGlobals();
    }
  },
);

test.each([
  { items: "invalid" },
  {
    items: [
      {
        id: "a",
        name: "Museum",
        date: "2026-11-01",
        status: "unverified",
        reportId: null,
        needsReview: false,
      },
    ],
  },
])(
  "invalid checklist response offers recovery without clearing storage: %j",
  async (invalid) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const remove = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      removeItem: remove,
      setItem: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            revision: "revision-a",
            generationId: "generation-a",
            editable: true,
            receipt: false,
            earlier: [],
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
          <BookingChecklist tripId="trip-a" userId="owner-a" />,
        );
      });
      expect(JSON.stringify(renderer.toJSON())).toContain(
        "Saved booking progress could not be verified",
      );
      expect(JSON.stringify(renderer.toJSON())).toContain(
        "Refresh saved progress",
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

test.each([
  ["{broken", false],
  [JSON.stringify({ status: "booked" }), false],
  ["{broken", true],
] as const)(
  "unreadable pending report stays visible until deliberately discarded: %s (storage fails: %s)",
  async (stored, storageFails) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const removeItem = vi.fn(() => {
      if (storageFails) throw new Error("Storage blocked");
    });
    vi.stubGlobal("localStorage", {
      getItem: () => stored,
      removeItem,
      setItem: vi.fn(),
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          revision: "revision-a",
          generationId: "generation-a",
          editable: true,
          receipt: false,
          earlier: [],
          items: [
            {
              id: "item-a",
              name: "Museum",
              date: "2026-11-01",
              status: "needed",
              reportId: null,
              needsReview: false,
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <BookingChecklist tripId="trip-a" userId="owner-a" />,
        );
      });
      expect(JSON.stringify(renderer.toJSON())).toContain(
        "could not read your interrupted report",
      );
      const booked = () =>
        renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("I booked this"))!;
      expect(booked().props.disabled).toBe(true);
      expect(removeItem).not.toHaveBeenCalled();
      await act(async () => {
        renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("Discard unreadable retry"))!
          .props.onClick();
      });
      expect(removeItem).toHaveBeenCalledWith(
        "faroway:booking-report:owner-a:trip-a",
      );
      expect(booked().props.disabled).toBe(storageFails);
      if (storageFails) {
        expect(JSON.stringify(renderer.toJSON())).toContain(
          "could not clear the interrupted retry",
        );
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => renderer?.unmount());
      vi.unstubAllGlobals();
    }
  },
);
