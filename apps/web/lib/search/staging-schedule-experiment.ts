import { z } from "zod";
import { gateway, createGateway } from "../ai/sdk";
import {
  generatePlanningObject,
  logPlanningFallback,
  planningModel,
} from "../ai/planning-step";
import { PLANNING_PROVIDER_OPTIONS } from "../ai/planning-disclosure";
import { compileSchedule, type ScheduleExclusion } from "./schedule-compiler";
import {
  applyScheduleNarration,
  type DayNarration,
} from "./schedule-narration";
import { scheduleNarrationPrompt } from "./narration-prompt";
import { canProcessViatorContent } from "../affiliates/viator-policy";
import { withAbortTimeout, isOperationTimeoutError } from "./runtime";
import type {
  SearchPlan,
  ActivityResult,
  DiningResult,
  HotelResult,
} from "./types";
import { venueConstraintsForDate } from "../../../../scripts/uat/lib/venue-constraints";
import reviewedFacts from "../../../../scripts/fixtures/agentic-venue-constraints.json";
import reviewedHotelFacts from "../../../../scripts/fixtures/agentic-hotel-constraints.json";
import { screenHotelCandidates } from "./hotel-policy-screen";

/** Explicit staging-only integration. The small reviewed fixture is not general grounding. */
export function compiledScheduleExperimentEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (
    env.FAROWAY_SCHEDULE_EXPERIMENT !== "compiled-narrated-v1" ||
    !["low", "minimal"].includes(env.PLANNING_THINKING_AGGREGATOR ?? "")
  )
    return false;
  if (
    env.VERCEL_ENV !== "preview" &&
    !(env.NODE_ENV === "development" && !env.VERCEL_ENV)
  )
    return false;
  if (
    env.PLANNING_MODEL_AGGREGATOR &&
    env.PLANNING_MODEL_AGGREGATOR !== "google/gemini-3-flash"
  )
    return false;
  if (
    env.PLANNING_MAX_OUTPUT_TOKENS_AGGREGATOR &&
    env.PLANNING_MAX_OUTPUT_TOKENS_AGGREGATOR !== "2000"
  )
    return false;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return (
      url.origin === "https://omovikloadpvzijoaqus.supabase.co" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export async function runStagingCompiledSchedule(
  plan: SearchPlan,
  hotels: HotelResult[],
  inventory: ActivityResult[],
  dining: DiningResult[],
) {
  if (!compiledScheduleExperimentEnabled())
    throw new Error(
      "Compiled schedule experiment is not enabled for this staging environment",
    );
  const start = Date.parse(`${plan.dates.start}T00:00:00Z`),
    end = Date.parse(`${plan.dates.end}T00:00:00Z`);
  const count = (end - start) / 86400000 + 1;
  if (!Number.isInteger(count) || count < 1 || count > 7)
    throw new Error("Staging schedule experiment requires 1–7 days");
  const activities = inventory.filter(canProcessViatorContent);
  const exclusions: ScheduleExclusion[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(start + i * 86400000).toISOString().slice(0, 10);
    for (const activity of activities)
      for (const finding of venueConstraintsForDate(
        plan.destination,
        activity.name,
        date,
        reviewedFacts,
      ))
        exclusions.push({
          activityId: activity.id,
          date,
          reason: finding.finding,
          sourceUrl: finding.sourceUrl,
          observedAt: finding.observedAt,
        });
  }
  const compiled = compileSchedule(plan, activities, dining, exclusions);
  const score = (hotel: HotelResult) =>
    Number.isFinite(hotel.vibeScore) ? hotel.vibeScore : 0;
  const hotelReview = screenHotelCandidates(plan, hotels, reviewedHotelFacts);
  const topHotel =
    [...hotelReview.selectionCandidates].sort(
      (a, b) => score(b) - score(a),
    )[0] ?? null;
  const days = compiled.days.map((day) => ({
    ...day,
    hotel: topHotel ?? undefined,
  }));
  for (const item of hotelReview.withheld) {
    const sources = [
      ...new Set(
        item.findings.map(
          (finding) => `${finding.sourceUrl} (reviewed ${finding.observedAt})`,
        ),
      ),
    ];
    days[0].tips.push(
      `Hotel review: ${item.hotelName} was left out because published information conflicts with the party or generated amenities. ${sources.join("; ")}. Other hotel ideas still need suitability and availability checks.`,
    );
  }
  for (const item of hotelReview.reviewRequired) {
    const action =
      item.reason === "age_policy_requires_room_or_check_in_review"
        ? "Check the age rules for the exact room and check-in arrangement before choosing this hotel."
        : "Previously reviewed policy information needs checking again before choosing this hotel.";
    days[0].tips.push(
      `Hotel review: ${item.hotelName}. ${action} Source: ${item.sourceUrl} (recorded review ${item.observedAt}). Suitability and availability remain unverified.`,
    );
  }
  if (!topHotel)
    days[0].tips.push(
      "No hotel has been selected. Check suitable accommodation and room availability before arranging this trip.",
    );
  console.info(
    JSON.stringify({
      event: "planning.schedule.experiment",
      version: "compiled-narrated-v1",
      days: days.length,
      excludedCandidateDates: exclusions.length,
      issueCount: compiled.issues.length,
      verified: false,
    }),
  );
  const draft = () => ({ days, topHotel });
  if (
    days.some(
      (day) =>
        ![
          ...day.morning.activities,
          ...day.afternoon.activities,
          ...day.evening.activities,
        ].length,
    )
  ) {
    logPlanningFallback(
      "aggregator",
      "activity_supply_gap",
      "compiled_schedule",
    );
    return draft();
  }
  try {
    const modelGateway = process.env.AI_GATEWAY_API_KEY
      ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
      : gateway;
    const result = await withAbortTimeout(
      (signal) =>
        generatePlanningObject<{ days: DayNarration[] }>("aggregator", {
          model: modelGateway(planningModel("aggregator")),
          providerOptions: PLANNING_PROVIDER_OPTIONS,
          schema: z.object({
            days: z
              .array(
                z.object({
                  date: z.string(),
                  title: z.string().min(1).max(100),
                  summary: z.string().min(1).max(600),
                  activityIds: z.array(z.string()),
                }),
              )
              .length(days.length),
          }),
          prompt: scheduleNarrationPrompt(plan, days),
          maxOutputTokens: 2000,
          maxRetries: 0,
          abortSignal: signal,
        }),
      30000,
      "schedule narration",
    );
    return { days: applyScheduleNarration(days, result.object.days), topHotel };
  } catch (error) {
    logPlanningFallback(
      "aggregator",
      isOperationTimeoutError(error) ? "timeout" : "error",
      "compiled_schedule",
      error instanceof Error ? error.message : "Narration unavailable",
    );
    days[0].tips.push(
      "The day descriptions could not be generated. This draft keeps the selected visits and planning cautions for your review.",
    );
    return draft();
  }
}
