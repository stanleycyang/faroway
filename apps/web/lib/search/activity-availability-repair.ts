import { compileSchedule, type ScheduleExclusion } from "./schedule-compiler";
import { withAbortTimeout } from "./runtime";
import type { ActivityResult, DiningResult, SearchPlan } from "./types";

const slots = ["morning", "afternoon", "evening"] as const;
export interface ActivityAvailabilityRequest {
  key: string;
  destination: string;
  date: string;
  slot: (typeof slots)[number];
  activity: ActivityResult;
}
export interface ActivityAvailabilityAssessment {
  key: string;
  status: "ordinary_hours_compatible" | "conflict" | "unknown";
  reason: string;
  /** References to checker receipts, not model-authored assertions of authority. */
  evidenceSha256?: string;
  sourceUrls: string[];
}
const keyFor = (activity: ActivityResult, date: string, slot: string) =>
  JSON.stringify([
    activity.id,
    date,
    slot,
    activity.duration,
    activity.proposedVisitType ?? "unknown",
  ]);
const validUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

/** Experimental orchestration only; not connected to production or paid tools.
 * The checker must independently establish identity, source freshness, visit type
 * and date/slot scope, including last entry over the entire possible start range
 * in that slot. Partial-window evidence needs exact-time scheduling or stays
 * unknown. Never wire raw model output directly to this interface.
 * Source receipt references here prove neither truth nor a reservation.
 * A future external-search adapter must project only authorized public fields.
 */
export async function repairActivityAvailability(
  input: {
    plan: SearchPlan;
    activities: ActivityResult[];
    dining: DiningResult[];
    exclusions?: readonly ScheduleExclusion[];
    reviewedActivityIds?: readonly string[];
  },
  check: (
    requests: readonly ActivityAvailabilityRequest[],
    signal: AbortSignal,
  ) => Promise<readonly ActivityAvailabilityAssessment[]>,
  limits = { maxRounds: 2, maxChecks: 12, timeoutMs: 30000 },
) {
  if (
    !Number.isInteger(limits.maxRounds) ||
    limits.maxRounds < 1 ||
    limits.maxRounds > 3 ||
    !Number.isInteger(limits.maxChecks) ||
    limits.maxChecks < 1 ||
    limits.maxChecks > 24 ||
    !Number.isInteger(limits.timeoutMs) ||
    limits.timeoutMs < 1 ||
    limits.timeoutMs > 60000
  )
    throw Error("Repair requires bounded round, check and time limits");
  const started = Date.now();
  const snapshot = structuredClone(input);
  const { plan, activities, dining } = snapshot;
  const baseExclusions = [...(snapshot.exclusions ?? [])];
  const assessments = new Map<string, ActivityAvailabilityAssessment>();
  const requested = new Map<string, ActivityAvailabilityRequest>();
  const options = { reviewedActivityIds: snapshot.reviewedActivityIds };
  const compile = (extra: ScheduleExclusion[] = []) =>
    compileSchedule(
      plan,
      activities,
      dining,
      [...baseExclusions, ...extra],
      options,
    );
  const initial = compile();
  const dates = initial.days.map((day) => day.date);
  const selections = (schedule: typeof initial) =>
    schedule.days.flatMap((day) =>
      slots.flatMap((slot) =>
        day[slot].activities.map((activity) => ({
          key: keyFor(activity, day.date, slot),
          destination: plan.destination,
          date: day.date,
          slot,
          activity,
        })),
      ),
    );
  const exclusions = (final: boolean) =>
    dates.flatMap((date) =>
      slots.flatMap((slot) =>
        activities.flatMap((activity): ScheduleExclusion[] => {
          const assessment = assessments.get(keyFor(activity, date, slot));
          if (
            assessment?.status === "ordinary_hours_compatible" ||
            (!assessment && !final)
          )
            return [];
          return [
            {
              activityId: activity.id,
              date,
              slot,
              reason:
                assessment?.status === "conflict"
                  ? "availability_conflict"
                  : "availability_unresolved",
              sourceUrl: assessment?.sourceUrls[0] ?? "",
              observedAt: "",
            },
          ];
        }),
      ),
    );
  let rounds = 0;
  let checks = 0;
  let outcome: "checked" | "limit_reached" | "checker_unavailable" =
    "limit_reached";
  let proposal = initial;
  while (rounds < limits.maxRounds && checks < limits.maxChecks) {
    const pending = selections(proposal).filter(
      (request) => !assessments.has(request.key),
    );
    if (!pending.length) {
      outcome = "checked";
      break;
    }
    const batch = pending.slice(0, limits.maxChecks - checks);
    const remaining = limits.timeoutMs - (Date.now() - started);
    if (remaining <= 0) break;
    rounds++;
    checks += batch.length;
    for (const request of batch) requested.set(request.key, request);
    try {
      const results = await withAbortTimeout(
        (signal) => check(structuredClone(batch), signal),
        remaining,
        "activity availability check",
      );
      // Atomic batch validation prevents duplicate/unexpected verdicts from
      // silently authorizing a different candidate or visit date.
      if (
        !Array.isArray(results) ||
        results.length !== batch.length ||
        new Set(results.map((result) => result.key)).size !== results.length ||
        results.some(
          (result) =>
            !batch.some((request) => request.key === result.key) ||
            !["ordinary_hours_compatible", "conflict", "unknown"].includes(
              result.status,
            ) ||
            typeof result.reason !== "string" ||
            !result.reason.trim() ||
            result.reason.length > 1000 ||
            !Array.isArray(result.sourceUrls) ||
            result.sourceUrls.length > 6 ||
            result.sourceUrls.some(
              (url: unknown) => typeof url !== "string" || !validUrl(url),
            ) ||
            (result.status !== "unknown" &&
              (!result.sourceUrls.length ||
                !/^[a-f0-9]{64}$/.test(result.evidenceSha256 ?? ""))),
        )
      )
        throw Error("Malformed availability-check batch");
      for (const result of results)
        assessments.set(result.key, structuredClone(result));
    } catch {
      outcome = "checker_unavailable";
      break;
    }
    proposal = compile(exclusions(false));
  }
  if (
    outcome !== "checker_unavailable" &&
    selections(proposal).every(
      (request) =>
        assessments.get(request.key)?.status === "ordinary_hours_compatible",
    )
  )
    outcome = "checked";
  // Recompilation can introduce alternatives. Restrict the final result to exact
  // date/slot checks; never let the last repair round smuggle in unchecked visits.
  const schedule = compile(exclusions(true));
  const covered = (value: typeof initial) =>
    value.days.filter((day) =>
      slots.some((slot) => day[slot].activities.length),
    ).length;
  return {
    schedule,
    outcome:
      outcome === "checked" && covered(schedule) < covered(initial)
        ? ("coverage_gap" as const)
        : outcome,
    rounds,
    checks,
    elapsedMs: Date.now() - started,
    initialVisits: selections(initial).length,
    selectedVisits: selections(schedule).length,
    initialDaysCovered: covered(initial),
    daysCovered: covered(schedule),
    unresolvedDayCount: schedule.days.length - covered(schedule),
    assessments: [...assessments.values()],
    unresolvedRequests: [...requested.values()].filter(
      (request) =>
        !assessments.has(request.key) ||
        assessments.get(request.key)?.status === "unknown",
    ),
    qualityAccepted: false as const,
  };
}
