import { afterEach, beforeEach, expect, it, vi } from "vitest";
import rome from "../../../../scripts/fixtures/agentic-rome-overload.json";
const mocks = vi.hoisted(() => ({ generateObject: vi.fn() }));
vi.mock("@/lib/ai/sdk", () => ({
  generateObject: mocks.generateObject,
  gateway: (model: string) => ({ model }),
  createGateway: () => (model: string) => ({ model }),
}));
import {
  compiledScheduleExperimentEnabled,
  runStagingCompiledSchedule,
} from "@/lib/search/staging-schedule-experiment";
import { runAggregatorAgent } from "@/lib/search/agents/aggregator";
import { narrationContext } from "@/lib/search/schedule-narration";
import { compileSchedule } from "@/lib/search/schedule-compiler";
import { onPlanningFallback } from "@/lib/ai/planning-step";
import type {
  SearchPlan,
  ActivityResult,
  DiningResult,
  HotelResult,
} from "@/lib/search/types";
const plan = rome.trace.steps[0].output as unknown as SearchPlan;
const activities = rome.trace.steps[2].output as unknown as ActivityResult[];
const dining = rome.trace.steps[3].output as unknown as DiningResult[];
const env = {
  FAROWAY_SCHEDULE_EXPERIMENT: "compiled-narrated-v1",
  VERCEL_ENV: "preview",
  NEXT_PUBLIC_SUPABASE_URL: "https://omovikloadpvzijoaqus.supabase.co",
  PLANNING_THINKING_AGGREGATOR: "low",
};
const compiled = () => {
  const days = compileSchedule(plan, activities, dining).days;
  days[0].tips.push(
    "No hotel has been selected. Check suitable accommodation and room availability before arranging this trip.",
  );
  return days;
};
const narration = () => ({
  object: {
    days: narrationContext(compiled()).map((day) => ({
      date: day.date,
      title: "Selected visits",
      summary: "Explore the selected visits.",
      activityIds: day.slots.flatMap((slot) =>
        slot.activities.map((a) => a.id),
      ),
    })),
  },
  usage: { inputTokens: 100, outputTokens: 100 },
});
beforeEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  vi.stubEnv("VIATOR_CONTENT_ENABLED", "false");
  mocks.generateObject.mockResolvedValue(narration());
});
afterEach(() => vi.unstubAllEnvs());
it("requires exact staging project, explicit opt-in and measured model settings", () => {
  expect(compiledScheduleExperimentEnabled(env)).toBe(true);
  expect(
    compiledScheduleExperimentEnabled({
      ...env,
      PLANNING_THINKING_AGGREGATOR: "minimal",
    }),
  ).toBe(true);
  for (const patch of [
    { FAROWAY_SCHEDULE_EXPERIMENT: undefined },
    { VERCEL_ENV: "production" },
    { VERCEL_ENV: undefined, NODE_ENV: "production" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://jcnephijkxgtprsutgsf.supabase.co" },
    {
      NEXT_PUBLIC_SUPABASE_URL:
        "https://omovikloadpvzijoaqus.supabase.co.evil.example",
    },
    { PLANNING_THINKING_AGGREGATOR: "high" },
    { PLANNING_MODEL_AGGREGATOR: "other/model" },
    { PLANNING_MAX_OUTPUT_TOKENS_AGGREGATOR: "8000" },
  ])
    expect(compiledScheduleExperimentEnabled({ ...env, ...patch })).toBe(false);
  expect(
    compiledScheduleExperimentEnabled({
      ...env,
      VERCEL_ENV: undefined,
      NODE_ENV: "development",
    }),
  ).toBe(true);
});
it("passes the measured minimal thinking setting through the app boundary", async () => {
  vi.stubEnv("PLANNING_THINKING_AGGREGATOR", "minimal");
  await runAggregatorAgent(plan, [], activities, dining);
  expect(mocks.generateObject).toHaveBeenCalledTimes(1);
  expect(
    mocks.generateObject.mock.calls[0][0].providerOptions.google.thinkingConfig
      .thinkingLevel,
  ).toBe("minimal");
  expect(
    mocks.generateObject.mock.calls[0][0].providerOptions.vertex.thinkingConfig
      .thinkingLevel,
  ).toBe("minimal");
});
it("routes the app aggregator through one guarded narration call and preserves the draft", async () => {
  const result = await runAggregatorAgent(plan, [], activities, dining);
  expect(mocks.generateObject).toHaveBeenCalledTimes(1);
  const args = mocks.generateObject.mock.calls[0][0];
  expect(args.maxRetries).toBe(0);
  expect(args.maxOutputTokens).toBe(2000);
  expect(args.providerOptions.google.thinkingConfig.thinkingLevel).toBe("low");
  expect(result.days[0].title).toBe("Selected visits");
  expect(
    result.days.map((day) =>
      Object.fromEntries(
        Object.entries(day).filter(
          ([key]) => !["title", "summary", "hotel"].includes(key),
        ),
      ),
    ),
  ).toEqual(
    compiled().map((day) =>
      Object.fromEntries(
        Object.entries(day).filter(
          ([key]) => !["title", "summary"].includes(key),
        ),
      ),
    ),
  );
});
it("returns the compiled draft on bad references, with an observable fallback and no second AI call", async () => {
  const generated = narration();
  generated.object.days[0].activityIds = ["invented"];
  mocks.generateObject.mockResolvedValue(generated);
  const events: unknown[] = [];
  const stop = onPlanningFallback((event) => events.push(event));
  try {
    const result = await runAggregatorAgent(plan, [], activities, dining);
    expect(result.days[0].title).toBe(compiled()[0].title);
    expect(result.days[0].tips.join(" ")).toContain("could not be generated");
    expect(events).toEqual([
      expect.objectContaining({
        step: "aggregator",
        outcome: "compiled_schedule",
      }),
    ]);
    expect(mocks.generateObject).toHaveBeenCalledTimes(1);
  } finally {
    stop();
  }
});
it("does not send unapproved supplier content to narration", async () => {
  await runAggregatorAgent(
    plan,
    [],
    [
      ...activities,
      {
        ...activities[0],
        id: "activity_v_restricted",
        name: "Restricted supplier title",
      },
    ],
    dining,
  );
  expect(mocks.generateObject.mock.calls[0][0].prompt).not.toContain(
    "Restricted supplier title",
  );
});
it("does not call AI when no activity fits, and cannot be invoked in production", async () => {
  const result = await runStagingCompiledSchedule(plan, [], [], dining);
  expect(result.days[0].tips.join(" ")).toContain("No suitable unused visits");
  expect(mocks.generateObject).not.toHaveBeenCalled();
  vi.stubEnv("VERCEL_ENV", "production");
  await expect(
    runStagingCompiledSchedule(plan, [], activities, dining),
  ).rejects.toThrow("not enabled");
  expect(mocks.generateObject).not.toHaveBeenCalled();
});
it("selects the highest supplied hotel score without mutating inventory or inventing a quote", async () => {
  const hotels = [
    { id: "low", vibeScore: 1 },
    { id: "high", vibeScore: 90 },
  ] as HotelResult[];
  const result = await runStagingCompiledSchedule(
    plan,
    hotels,
    activities,
    dining,
  );
  expect(result.topHotel?.id).toBe("high");
  expect(hotels[0].id).toBe("low");
  expect(result.topHotel).not.toHaveProperty("pricePerNight");
});

it("keeps the existing aggregator path when the experiment is disabled or the trip exceeds seven days", async () => {
  mocks.generateObject.mockResolvedValue({
    object: { days: [], topHotelId: "" },
  });
  vi.stubEnv("FAROWAY_SCHEDULE_EXPERIMENT", "");
  await runAggregatorAgent(plan, [], activities, []);
  expect(mocks.generateObject.mock.calls.at(-1)![0].prompt).not.toContain(
    "fixed travel draft",
  );
  vi.stubEnv("FAROWAY_SCHEDULE_EXPERIMENT", "compiled-narrated-v1");
  await runAggregatorAgent(
    {
      ...plan,
      dates: { ...plan.dates, start: "2027-01-11", end: "2027-01-18" },
    },
    [],
    activities,
    [],
  );
  expect(mocks.generateObject.mock.calls.at(-1)![0].prompt).not.toContain(
    "fixed travel draft",
  );
});

it("aborts stalled narration and returns the same draft without retrying", async () => {
  vi.useFakeTimers();
  mocks.generateObject.mockImplementation(() => new Promise(() => {}));
  const events: unknown[] = [];
  const stop = onPlanningFallback((event) => events.push(event));
  try {
    const pending = runAggregatorAgent(plan, [], activities, dining);
    await vi.advanceTimersByTimeAsync(30000);
    const result = await pending;
    expect(result.days[0].title).toBe(compiled()[0].title);
    expect(mocks.generateObject.mock.calls[0][0].abortSignal.aborted).toBe(
      true,
    );
    expect(mocks.generateObject).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      expect.objectContaining({
        reason: "timeout",
        outcome: "compiled_schedule",
      }),
    ]);
  } finally {
    stop();
    vi.useRealTimers();
  }
});

it("keeps published dining alternatives in staging notes through narration without selecting them", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
  try {
    const localPlan = {
      ...plan,
      destination: "Singapore",
      dates: { start: "2027-01-11", end: "2027-01-11", nights: 0 },
    };
    const visit = {
      ...activities[0],
      name: "Singapore Botanic Gardens & National Orchid Garden",
      duration: 60,
      bestTimeOfDay: "morning" as const,
    };
    mocks.generateObject.mockResolvedValueOnce({
      object: {
        days: [
          {
            date: "2027-01-11",
            title: "Garden day",
            summary: "Explore the garden.",
            activityIds: [visit.id],
          },
        ],
      },
      usage: { inputTokens: 100, outputTokens: 100 },
    });
    const result = await runStagingCompiledSchedule(localPlan, [], [visit], []);
    expect(
      result.days[0].tips.some(
        (tip) =>
          tip.includes("The Bloomhouse by Little Farms") &&
          tip.includes("not a scheduled meal"),
      ),
    ).toBe(true);
    expect(result.days[0].morning.meal).toBeUndefined();
    expect(result.days[0].morning.activities.map((item) => item.id)).toEqual([
      visit.id,
    ]);
  } finally {
    vi.useRealTimers();
  }
});
