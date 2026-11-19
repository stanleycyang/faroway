/** Retrospective source audit of real saved receipts; no network or model calls.
 * The catalog may be newer than the candidate. Its hash is recorded explicitly.
 * Compatibility with ordinary hours never certifies a usable itinerary.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import hours from "../fixtures/reviewed-venue-hours.json";
import decisions from "../fixtures/reviewed-activity-decisions.json";
import supply from "../fixtures/reviewed-activity-supply.json";
import {
  reviewedHoursExclusions,
  reviewedHoursCoverVisitScope,
  type ReviewedVenueHours,
} from "../../apps/web/lib/search/reviewed-venue-hours";
import { resolveReviewedVenue } from "../../apps/web/lib/search/venue-identity";
import {
  activityDecisionSchema,
  applyReviewedActivityDecisions,
} from "../../apps/web/lib/search/reviewed-activity-decisions";
import type {
  ActivityResult,
  SearchPlan,
} from "../../apps/web/lib/search/types";

const base = process.argv[2];
const expectedCases = Number(process.argv[3] ?? 12);
const asOf = process.argv[4] ?? new Date().toISOString().slice(0, 10);
if (!base || !Number.isInteger(expectedCases) || expectedCases < 1)
  throw new Error(
    "Usage: audit-acceptance-sources.ts DIRECTORY [EXPECTED_CASES] [YYYY-MM-DD]",
  );
const catalogHash = createHash("sha256")
  .update(JSON.stringify({ hours, decisions, supply }))
  .digest("hex");
const facts = hours as ReviewedVenueHours[];
const reviews = activityDecisionSchema.array().parse(decisions);
const cases = [];
for (const name of readdirSync(base).sort()) {
  if (
    !/^(lisbon|copenhagen|edinburgh|new-york|melbourne|interlaken)-[12]$/.test(
      name,
    )
  )
    continue;
  const path = join(base, name, "saved.json");
  if (!existsSync(path)) continue;
  const body = JSON.parse(readFileSync(path, "utf8")).body;
  if (
    typeof body?.trip?.destination !== "string" ||
    !Array.isArray(body?.itinerary?.days)
  )
    throw new Error(`Invalid saved receipt: ${name}`);
  const plan: Pick<SearchPlan, "destination" | "requirements"> = {
    destination: body.trip.destination,
    requirements: body.trip.preferences?.requirements,
  };
  const dates: string[] = body.itinerary.days.map(
    (day: { date: string }) => day.date,
  );
  const rows = [];
  for (const day of body.itinerary.days) {
    for (const slot of ["morning", "afternoon", "evening"] as const) {
      if (
        !Array.isArray(day[slot]?.activities) ||
        !Array.isArray(day[slot]?.meals)
      )
        throw new Error(`Missing day-part arrays: ${name}/${day.date}/${slot}`);
      for (const activity of day[slot].activities as ActivityResult[]) {
        if (
          typeof activity.name !== "string" ||
          typeof activity.location?.address !== "string"
        )
          throw new Error(
            `Missing activity identity: ${name}/${day.date}/${slot}`,
          );
        const identity = resolveReviewedVenue(
          {
            destination: plan.destination,
            name: activity.name,
            address: activity.location.address,
          },
          facts,
          "ordinary_visit",
        );
        const findings = reviewedHoursExclusions(
          plan,
          [activity],
          dates,
          facts,
          asOf,
        ).filter(
          (finding) =>
            finding.date === day.date &&
            (!finding.slot || finding.slot === slot),
        );
        const decisionsForDate = applyReviewedActivityDecisions(
          plan,
          [activity],
          dates,
          reviews,
          asOf,
        ).exclusions.filter((finding) => finding.date === day.date);
        const calendar = new Date(`${day.date}T12:00:00Z`);
        const covered =
          identity.matches.length === 1 &&
          reviewedHoursCoverVisitScope(
            identity.matches[0],
            activity.proposedVisitType,
          ) &&
          identity.matches[0].months.includes(calendar.getUTCMonth() + 1) &&
          identity.matches[0].week.some(
            (entry) => entry.weekday === calendar.getUTCDay(),
          );
        const sources = identity.matches.map((fact) => ({
          id: fact.id,
          url: fact.sourceUrl,
          sha256: fact.sourceSha256,
          observedAt: fact.observedAt,
          reviewAfter: fact.reviewAfter,
        }));
        const suppliedReferences = supply
          .filter(
            (fact) =>
              fact.id === activity.id &&
              fact.destination === plan.destination &&
              fact.name === activity.name &&
              fact.address === activity.location.address,
          )
          .map((fact) => ({
            id: fact.id,
            url: fact.sourceUrl,
            sha256: fact.sourceSha256,
            observedAt: fact.observedAt,
            reviewAfter: fact.reviewAfter,
            validFrom: fact.validFrom,
            validThrough: fact.validThrough,
            scope:
              "Reviewed supplied option; not re-adjudicated by this ordinary-hours audit",
          }));
        rows.push({
          date: day.date,
          slot,
          kind: "activity",
          id: activity.id,
          name: activity.name,
          address: activity.location.address,
          visitType: activity.proposedVisitType ?? "unknown",
          durationMinutes: activity.duration,
          identityAnchor: identity.status,
          ordinaryHours: findings.some(
            (finding) =>
              finding.reason === "visit_does_not_fit_published_ordinary_hours",
          )
            ? "contradicted"
            : findings.length || !covered
              ? "unknown"
              : "compatible_not_verified",
          sources,
          suppliedReferences,
          findings: [...findings, ...decisionsForDate],
          requiredReview: decisionsForDate.length > 0,
          routeAndArrival: "unknown",
          continuousAccess: plan.requirements?.accessibility?.length
            ? "unknown"
            : "not_assessed",
          accepted: false,
        });
      }
      for (const meal of day[slot].meals) {
        rows.push({
          date: day.date,
          slot,
          kind: "meal",
          id: meal.id,
          name: meal.name,
          address: meal.location?.address ?? null,
          identityAnchor: "not_assessed",
          ordinaryHours: "unknown",
          sources: [],
          findings: [],
          routeAndArrival: "unknown",
          dietarySuitability: "unknown",
          allergyHandling: plan.requirements?.allergies?.length
            ? "requires_direct_confirmation"
            : "not_assessed",
          accepted: false,
        });
      }
    }
  }
  const result = {
    case: name,
    reviewedAsOf: asOf,
    catalogSha256: catalogHash,
    accepted: false,
    coverage:
      "Activity ordinary hours and negative reviews only; meal, access and route evidence remain incomplete.",
    rows,
  };
  writeFileSync(
    join(base, name, "source-ledger.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  cases.push({
    case: name,
    venues: rows.length,
    ordinaryHoursContradictions: rows.filter(
      (row) => row.ordinaryHours === "contradicted",
    ).length,
    unresolvedReviewedCandidates: rows.filter(
      (row) => "requiredReview" in row && row.requiredReview,
    ).length,
    ordinaryHoursUnknown: rows.filter((row) => row.ordinaryHours === "unknown")
      .length,
    accepted: false,
  });
}
const summary = {
  candidateManifest: JSON.parse(
    readFileSync(join(base, "manifest.json"), "utf8"),
  ),
  reviewedAsOf: asOf,
  catalogSha256: catalogHash,
  casesRead: cases.length,
  expectedCases,
  caseCoverageComplete: cases.length === expectedCases,
  accepted: false,
  scope:
    "Retrospective comparison against this catalog, not proof the candidate runtime screened these records. Compatible hours do not certify arrival, access, meals, tickets or weather.",
  cases,
};
writeFileSync(
  join(base, "source-ledger-summary.json"),
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(JSON.stringify(summary, null, 2));
