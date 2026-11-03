import { describe, expect, it, vi, afterEach } from "vitest";
import {
  stampPlanItems,
  planItems,
  editPlan,
  PlanCommand,
} from "@/lib/trips/plan-edits";
const trip = "00000000-0000-4000-8000-000000000001";
const initial = [
  {
    dayNumber: 1,
    date: "2099-06-01",
    title: "Old schedule",
    summary: "Walk first",
    totalEstimatedCost: { amount: 100, currency: "USD" },
    morning: { activities: [{ id: "walk", name: "Walk" }] },
    afternoon: { activities: [{ id: "museum", name: "Museum" }] },
  },
];
const command = () => {
  const items = planItems(stampPlanItems(trip, initial), []);
  return {
    requestId: "00000000-0000-4000-8000-000000000002",
    expectedUpdatedAt: "2026-10-03T00:00:00.000Z",
    expectedPlanRevision: null,
    action: "swap" as const,
    itemId: items[0].id,
    otherItemId: items[1].id,
  };
};
afterEach(() => vi.unstubAllEnvs());
describe("revision-bound plan commands", () => {
  it("keeps item identities stable across reloads and swaps", () => {
    const days = stampPlanItems(trip, initial);
    expect(stampPlanItems(trip, days)).toEqual(days);
    const changed = editPlan(days, [], command());
    expect(planItems(changed.days, []).map((item) => item.name)).toEqual([
      "Museum",
      "Walk",
    ]);
    expect(planItems(changed.days, [])[1].id).toBe(command().itemId);
    expect(stampPlanItems(trip, changed.days)).toEqual(changed.days);
    expect(initial[0].morning.activities[0].name).toBe("Walk");
    expect(changed.days[0]).not.toHaveProperty("totalEstimatedCost");
    expect(changed.days[0].summary).not.toBe("Walk first");
  });
  it("does not swap either locked activity", () => {
    for (const id of [command().itemId, command().otherItemId]) {
      expect(() =>
        editPlan(stampPlanItems(trip, initial), [id], command()),
      ).toThrow("Unlock");
    }
  });
  it("locks and unlocks without rewriting the schedule", () => {
    const input: Omit<ReturnType<typeof command>, "otherItemId"> & {
      otherItemId?: string;
    } = command();
    delete input.otherItemId;
    const days = stampPlanItems(trip, initial);
    const locked = editPlan(days, [], { ...input, action: "lock" });
    expect(locked.days).toEqual(days);
    expect(locked.locked).toEqual([input.itemId]);
    expect(
      editPlan(days, locked.locked, { ...input, action: "unlock" }).locked,
    ).toEqual([]);
  });
  it("rejects IDs outside the current plan and hidden provider content", () => {
    expect(() =>
      editPlan(stampPlanItems(trip, initial), [], {
        ...command(),
        itemId: `item_${"0".repeat(32)}`,
      }),
    ).toThrow("unavailable");
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "false");
    const days = stampPlanItems(trip, initial);
    const item = planItems(days, [])[0].item;
    item.source = "viator";
    expect(() => editPlan(days, [], command())).toThrow("unavailable");
  });
  it("rejects arbitrary replacement payloads and missing revision tokens", () => {
    expect(PlanCommand.safeParse(command()).success).toBe(true);
    expect(PlanCommand.safeParse({ ...command(), days: [] }).success).toBe(
      false,
    );
    expect(
      PlanCommand.safeParse({ ...command(), expectedUpdatedAt: undefined })
        .success,
    ).toBe(false);
    expect(
      PlanCommand.safeParse({ ...command(), otherItemId: command().itemId })
        .success,
    ).toBe(false);
  });
});

it("invalidates structured timing on swaps but preserves it on a lock", () => {
  const days = stampPlanItems(trip, initial);
  days[0].timingProposal = { policy: "midday-rest-v1", basis: "frozen" };
  days[0].tips = ["Proposed local timing: old positions"];
  expect(
    editPlan(days, [], { ...command(), action: "lock" }).days[0].timingProposal,
  ).toEqual(days[0].timingProposal);
  const changed = editPlan(days, [], command());
  expect(changed.days[0]).not.toHaveProperty("timingProposal");
  expect(changed.days[0].tips).toEqual([]);
  expect(days[0]).toHaveProperty("timingProposal");
});
