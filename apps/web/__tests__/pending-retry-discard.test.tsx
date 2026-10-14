import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";
import { PlanEditor } from "../components/trips/PlanEditor";
import { BookingChecklist } from "../components/trips/BookingChecklist";

test.each([
  { kind: "plan", removalFails: false },
  { kind: "plan", removalFails: true },
  { kind: "report", removalFails: false },
  { kind: "report", removalFails: true },
])(
  "pending $kind discard retains recovery when removal fails: $removalFails",
  async ({ kind, removalFails }) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const generationId = "22222222-2222-4222-8222-222222222222";
    const command = {
      requestId: "11111111-1111-4111-8111-111111111111",
      expectedUpdatedAt: "2026-10-13T00:00:00Z",
      itemId: "item_" + "a".repeat(32),
      ...(kind === "plan"
        ? { expectedPlanRevision: null, action: "lock" }
        : {
            generationId,
            expectedReportId: null,
            status: "needed",
          }),
    };
    const saved = JSON.stringify(command);
    let stored: string | null = saved;
    vi.stubGlobal("localStorage", {
      getItem: () => stored,
      setItem: vi.fn(),
      removeItem: () => {
        if (removalFails) throw new Error("Unavailable");
        stored = null;
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          revision: command.expectedUpdatedAt,
          editable: true,
          items: [],
          ...(kind === "plan"
            ? { planRevision: null, history: [] }
            : {
                generationId,
                receipt: false,
                earlier: [],
              }),
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          kind === "plan" ? (
            <PlanEditor tripId="trip-a" userId="owner-a" onSaved={vi.fn()} />
          ) : (
            <BookingChecklist tripId="trip-a" userId="owner-a" />
          ),
        );
      });
      const discard =
        kind === "plan" ? "Discard pending change" : "Discard pending retry";
      await act(async () => {
        renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes(discard))!
          .props.onClick();
      });
      const output = JSON.stringify(renderer.toJSON());
      expect(
        output.includes(
          kind === "plan" ? "Retry saved change" : "Retry same report",
        ),
      ).toBe(removalFails);
      expect(stored).toBe(removalFails ? saved : null);
      if (kind === "plan")
        expect(renderer.root.findByType("fieldset").props.disabled).toBe(
          removalFails,
        );
      if (removalFails) {
        expect(output).toContain("couldn’t discard");
        expect(output).not.toContain("Pending retry discarded");
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => renderer?.unmount());
      vi.unstubAllGlobals();
    }
  },
);
