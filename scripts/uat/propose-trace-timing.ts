import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { SuggestedDay } from "../../packages/types/src";
import { evaluateAgenticTrace, type AgenticTrace } from "./lib/agentic-eval";
import { proposeTiming, type TimingEvent } from "./lib/timing-proposal";

// Deliberately explicit experimental assumptions, not extracted traveler facts.
const [directory, restBrief = ""] = process.argv.slice(2);
if (!directory)
  throw new Error(
    "Usage: propose-trace-timing.ts TRACE_DIR [MIDDAY_REST_BRIEF_ID]",
  );
const policy = {
  mealMinutes: { breakfast: 45, lunch: 60, dinner: 60 },
  travelBufferMinutes: 30,
  middayRestMinutes: 60,
  restWindow: [13 * 60, 15 * 60],
  dayPartWindows: {
    morning: [9 * 60, 13 * 60],
    afternoon: [14 * 60, 18 * 60],
    evening: [18 * 60, 22 * 60],
  },
};
const files = readdirSync(directory)
  .filter((f) => f.endsWith(".json"))
  .sort();
if (!files.length) throw new Error("Nonempty trace set required");
let restBriefFound = !restBrief;
const results = files.map((file) => {
  const bytes = readFileSync(join(directory, file));
  const { trace, status } = JSON.parse(bytes.toString()) as {
    trace: AgenticTrace;
    status?: string;
  };
  if (
    (status && status !== "completed") ||
    !evaluateAgenticTrace(trace).contractPass
  )
    throw new Error(`${file}: completed passing trace required`);
  const rest = trace.brief.id === restBrief;
  restBriefFound ||= rest;
  const days = (
    trace.steps.find((s) => s.step === "aggregator")!.output as {
      days: SuggestedDay[];
    }
  ).days;
  return {
    briefId: trace.brief.id,
    inputSha256: createHash("sha256").update(bytes).digest("hex"),
    restPolicyApplied: rest,
    days: days.map((day) => {
      const events: TimingEvent[] = [];
      const add = (
        id: string,
        kind: TimingEvent["kind"],
        durationMinutes: number,
        window: number[],
      ) => {
        events.push({
          id,
          kind,
          durationMinutes,
          earliestStart: window[0],
          latestEnd: window[1],
          bufferBeforeMinutes:
            events.length && kind !== "rest" ? policy.travelBufferMinutes : 0,
        });
      };
      const meal = (
        slot: "morning" | "afternoon" | "evening",
        name: keyof typeof policy.mealMinutes,
        window: number[],
      ) => {
        if (day[slot].meal)
          add(
            `meal:${slot}:${day[slot].meal.id}`,
            "meal",
            policy.mealMinutes[name],
            window,
          );
      };
      const visits = (slot: keyof typeof policy.dayPartWindows) => {
        for (const visit of day[slot].activities)
          add(
            `activity:${visit.id}`,
            "activity",
            visit.duration,
            policy.dayPartWindows[slot],
          );
      };
      meal("morning", "breakfast", [8 * 60, 10 * 60]);
      visits("morning");
      meal("afternoon", "lunch", [12 * 60, 14 * 60]);
      if (rest)
        add("rest:midday", "rest", policy.middayRestMinutes, policy.restWindow);
      visits("afternoon");
      visits("evening");
      meal("evening", "dinner", [18 * 60, 22 * 60]);
      return {
        date: day.date,
        inputEventIds: events.map((e) => e.id),
        ...proposeTiming(events),
      };
    }),
  };
});
if (!restBriefFound)
  throw new Error("Requested rest brief not found; refusing silent omission");
console.log(
  JSON.stringify(
    {
      qualityAccepted: false,
      implementationSha256: createHash("sha256")
        .update(readFileSync(import.meta.filename))
        .update(
          readFileSync(join(import.meta.dirname, "lib/timing-proposal.ts")),
        )
        .digest("hex"),
      policy,
      limitations:
        "Explicit assumptions only. Buffers are not travel estimates; rest location and hotel return are unresolved. No opening hours, reservations, timezone/DST feasibility or suitability verified. Original trace is unchanged. Meal-overlap warnings still require review.",
      results,
    },
    null,
    2,
  ),
);
