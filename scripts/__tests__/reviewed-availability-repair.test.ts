import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import rome from "../fixtures/agentic-rome-overload.json";
import type { ActivityResult, SearchPlan } from "../../packages/types/src";
import { repairWithReviewedHours } from "../uat/lib/reviewed-availability-repair";
import {
  availabilityCandidateSha256,
  evidenceTextSha256,
  type AdjudicatedHoursEvidence,
} from "../uat/lib/activity-hours-evidence";

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
  proposedVisitType: "ordinary_entry",
});
const inventory = [
  activity("closed-choice", 100),
  activity("reviewed-alternative", 60),
];
const receipt = (
  a: ActivityResult,
  excerpt: string,
): AdjudicatedHoursEvidence => ({
  sourceUrl: "https://example.org/synthetic-hours",
  excerpt,
  excerptSha256: evidenceTextSha256(excerpt),
  candidateSha256: availabilityCandidateSha256({
    key: "unused",
    destination: plan.destination,
    date: "2027-01-11",
    slot: "evening",
    activity: a,
  }),
  hoursQuote: excerpt,
  visitType: "ordinary_entry",
  observedAt: "2026-11-01",
  reviewAfter: "2026-12-01",
  appliesFrom: "2027-01-11",
  appliesThrough: "2027-01-11",
  identityAndScopeReview:
    "Synthetic fixture only, not external venue evidence.",
});
const evidence = [
  receipt(inventory[0], "Open daily 8am–5pm, last entry 4pm."),
  receipt(inventory[1], "Open daily 6pm–10pm, last entry 9pm."),
];
const input = { plan, activities: inventory, dining: [] };

test("source-bound conflict triggers a second round and a checked alternative", async () => {
  const before = structuredClone({ input, evidence });
  const result = await repairWithReviewedHours(input, evidence, "2026-11-02");
  expect(result.outcome).toBe("checked");
  expect(result.rounds).toBe(2);
  expect(result.schedule.days[0].evening.activities.map((a) => a.id)).toEqual([
    "reviewed-alternative",
  ]);
  expect(result.assessments.map((a) => a.status)).toEqual([
    "conflict",
    "ordinary_hours_compatible",
  ]);
  expect(result.qualityAccepted).toBe(false);
  expect({ input, evidence }).toEqual(before);
});
test("stale, mismatched and partial-window receipts do not authorize replacements", async () => {
  for (const replacement of [
    { ...evidence[1], reviewAfter: "2026-11-01" },
    { ...evidence[1], candidateSha256: "0".repeat(64) },
    { ...evidence[1], excerpt: "tampered" },
    receipt(inventory[1], "Open daily 7pm–10pm, last entry 9pm."),
  ]) {
    const result = await repairWithReviewedHours(
      input,
      [evidence[0], replacement],
      "2026-11-02",
    );
    expect(result.selectedVisits).toBe(0);
    expect(result.unresolvedDayCount).toBe(1);
    expect(result.qualityAccepted).toBe(false);
  }
});
test("rejects invalid replay dates before interpreting evidence", async () => {
  await expect(
    repairWithReviewedHours(input, evidence, "2026-02-30"),
  ).rejects.toThrow("Valid review date");
});

test("CLI retains inconclusive results and refuses to overwrite an existing receipt", () => {
  const folder = mkdtempSync(join(tmpdir(), "faroway-repair-"));
  try {
    const trace = join(folder, "trace.json"),
      evidence = join(folder, "evidence.json"),
      output = join(folder, "output.json");
    writeFileSync(trace, JSON.stringify(rome));
    writeFileSync(evidence, "[]");
    const args = [
      "--no-env-file",
      resolve("scripts/uat/repair-reviewed-availability.ts"),
      trace,
      evidence,
      "2026-11-02",
      output,
    ];
    const run = spawnSync("bun", args, { encoding: "utf8" });
    expect(run.status).toBe(2);
    const bytes = readFileSync(output, "utf8");
    const report = JSON.parse(bytes);
    expect(report.result.selectedVisits).toBe(0);
    expect(report.result.qualityAccepted).toBe(false);
    expect(report.traceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(spawnSync("bun", args, { encoding: "utf8" }).status).toBe(1);
    expect(readFileSync(output, "utf8")).toBe(bytes);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
