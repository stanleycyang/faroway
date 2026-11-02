import { expect, it, vi } from "vitest";
import rome from "../../../../scripts/fixtures/agentic-rome-overload.json";
import {
  repairActivityAvailability,
  type ActivityAvailabilityAssessment,
  type ActivityAvailabilityRequest,
} from "@/lib/search/activity-availability-repair";
import type { ActivityResult, SearchPlan } from "@/lib/search/types";

// Synthetic checker receipts exercise orchestration, never source truth.
const plan: SearchPlan = {
  ...(rome.trace.steps[0].output as unknown as SearchPlan),
  dates: { start: "2027-01-11", end: "2027-01-11", nights: 0 },
  mobilityNeeds: "only evening visits",
  requirements: undefined,
  activityCriteria: {
    ...(rome.trace.steps[0].output as unknown as SearchPlan).activityCriteria,
    mustSee: [],
  },
};
const activity = (id: string, score: number): ActivityResult => ({
  ...(rome.trace.steps[2].output as unknown as ActivityResult[])[0],
  id,
  name: id,
  duration: 180,
  bestTimeOfDay: "evening",
  vibeScore: score,
});
const input = {
  plan,
  activities: [activity("first-choice", 100), activity("alternative", 60)],
  dining: [],
};
const verdict = (
  request: ActivityAvailabilityRequest,
  status: ActivityAvailabilityAssessment["status"],
): ActivityAvailabilityAssessment => ({
  key: request.key,
  status,
  reason: "Synthetic checker fixture",
  evidenceSha256: "a".repeat(64),
  sourceUrls: ["https://example.org/fixture"],
});
const names = (
  result: Awaited<ReturnType<typeof repairActivityAvailability>>,
) =>
  result.schedule.days.flatMap((day) =>
    day.evening.activities.map((a) => a.id),
  );

it.each(["Melbourne, Australia", "Paris, France", "New York, USA"])(
  "repairs a checked conflict while retaining useful coverage in %s",
  async (destination) => {
    const check = vi.fn(
      async (requests: readonly ActivityAvailabilityRequest[]) =>
        requests.map((request) =>
          verdict(
            request,
            request.activity.id === "first-choice"
              ? "conflict"
              : "ordinary_hours_compatible",
          ),
        ),
    );
    const result = await repairActivityAvailability(
      { ...input, plan: { ...plan, destination } },
      check,
    );
    expect(names(result)).toEqual(["alternative"]);
    expect(result).toMatchObject({
      rounds: 2,
      checks: 2,
      initialDaysCovered: 1,
      daysCovered: 1,
      unresolvedDayCount: 0,
      outcome: "checked",
      qualityAccepted: false,
    });
    expect(check).toHaveBeenCalledTimes(2);
    expect(result.schedule.verified).toBe(false);
  },
);

it("does not promote an unchecked replacement when rounds or check budget run out", async () => {
  for (const limits of [
    { maxRounds: 1, maxChecks: 12, timeoutMs: 1000 },
    { maxRounds: 3, maxChecks: 1, timeoutMs: 1000 },
  ]) {
    const result = await repairActivityAvailability(
      input,
      async (requests) =>
        requests.map((request) => verdict(request, "conflict")),
      limits,
    );
    expect(names(result)).toEqual([]);
    expect(result).toMatchObject({
      checks: 1,
      rounds: 1,
      daysCovered: 0,
      unresolvedDayCount: 1,
      outcome: "limit_reached",
      qualityAccepted: false,
    });
  }
});

it("distinguishes unknown availability from a confirmed conflict and does not retry it", async () => {
  const result = await repairActivityAvailability(input, async (requests) =>
    requests.map((request) => verdict(request, "unknown")),
  );
  expect(names(result)).toEqual([]);
  expect(result.assessments.map((assessment) => assessment.status)).toEqual([
    "unknown",
    "unknown",
  ]);
  expect(result.unresolvedRequests).toHaveLength(2);
  expect(result.outcome).toBe("coverage_gap");
  expect(result.unresolvedDayCount).toBe(1);
});

it("rejects incomplete, duplicate, unbound and evidence-free batches atomically", async () => {
  for (const corrupt of [
    () => [],
    (request: ActivityAvailabilityRequest) => [
      verdict(request, "ordinary_hours_compatible"),
      verdict(request, "conflict"),
    ],
    (request: ActivityAvailabilityRequest) => [
      {
        ...verdict(request, "ordinary_hours_compatible"),
        key: "another-date-or-id",
      },
    ],
    (request: ActivityAvailabilityRequest) => [
      {
        ...verdict(request, "ordinary_hours_compatible"),
        evidenceSha256: undefined,
      },
    ],
    (request: ActivityAvailabilityRequest) => [
      { ...verdict(request, "ordinary_hours_compatible"), sourceUrls: [] },
    ],
  ]) {
    const result = await repairActivityAvailability(input, async (requests) =>
      corrupt(requests[0]),
    );
    expect(names(result)).toEqual([]);
    expect(result).toMatchObject({
      outcome: "checker_unavailable",
      rounds: 1,
      assessments: [],
    });
  }
});

it("aborts a stalled checker without redispatching or selecting unchecked visits", async () => {
  let received: AbortSignal | undefined;
  const check = vi.fn(
    (
      _requests: readonly ActivityAvailabilityRequest[],
      signal: AbortSignal,
    ) => {
      received = signal;
      return new Promise<readonly ActivityAvailabilityAssessment[]>(() => {});
    },
  );
  const result = await repairActivityAvailability(input, check, {
    maxRounds: 3,
    maxChecks: 24,
    timeoutMs: 10,
  });
  expect(received?.aborted).toBe(true);
  expect(check).toHaveBeenCalledTimes(1);
  expect(names(result)).toEqual([]);
  expect(result.outcome).toBe("checker_unavailable");
});

it("does not let a checker mutate the caller's inventory or change the scheduled visit", async () => {
  const before = structuredClone(input);
  const result = await repairActivityAvailability(input, async (requests) => {
    requests[0].activity.name = "Injected replacement";
    requests[0].activity.duration = 1;
    return requests.map((request) =>
      verdict(request, "ordinary_hours_compatible"),
    );
  });
  expect(input).toEqual(before);
  expect(result.schedule.days[0].evening.activities[0].name).toBe(
    "first-choice",
  );
  expect(result.schedule.days[0].evening.activities[0].duration).toBe(180);
});

it("keeps explicit exclusions and does not transfer an accepted slot to another day", async () => {
  const result = await repairActivityAvailability(
    {
      ...input,
      plan: {
        ...plan,
        dates: { start: "2027-01-11", end: "2027-01-12", nights: 1 },
      },
      exclusions: [
        {
          activityId: "first-choice",
          date: "2027-01-11",
          reason: "closed",
          sourceUrl: "https://example.org",
          observedAt: "2026-11-02",
        },
      ],
    },
    async (requests) =>
      requests.map((request) =>
        verdict(
          request,
          request.date === "2027-01-11"
            ? "ordinary_hours_compatible"
            : "unknown",
        ),
      ),
  );
  expect(result.schedule.days[0].evening.activities.map((a) => a.id)).toEqual([
    "alternative",
  ]);
  expect(result.schedule.days[1].evening.activities).toEqual([]);
  expect(result.unresolvedDayCount).toBe(1);
});

it("rejects unbounded budgets before invoking the checker", async () => {
  const check = vi.fn();
  await expect(
    repairActivityAvailability(input, check, {
      maxRounds: 99,
      maxChecks: 999,
      timeoutMs: 0,
    }),
  ).rejects.toThrow();
  expect(check).not.toHaveBeenCalled();
});
