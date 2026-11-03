import hours from "../../../../scripts/fixtures/reviewed-venue-hours.json";
import decisions from "../../../../scripts/fixtures/reviewed-activity-decisions.json";
import type { ReviewedVenueHours } from "./reviewed-venue-hours";
import type { SearchPlan } from "./types";

/** Give generation the same reviewed constraints that compilation will enforce.
 * This is bounded reviewed context, not live discovery or a suitability verdict.
 */
export function activitySourceContext(
  plan: Pick<SearchPlan, "destination" | "dates">,
  asOf = new Date().toISOString().slice(0, 10),
) {
  const destination = plan.destination.normalize("NFKC").trim().toLowerCase();
  const relevant = (record: {
    destination: string;
    observedAt: string;
    reviewAfter: string;
  }) =>
    record.destination.normalize("NFKC").trim().toLowerCase() === destination &&
    record.observedAt <= asOf &&
    asOf <= record.reviewAfter;
  const openingHours = (hours as ReviewedVenueHours[])
    .filter(relevant)
    .map((record) => ({
      names: record.aliases,
      addresses: record.addresses,
      months: record.months,
      visitTypes: record.visitTypes ?? ["ordinary_entry"],
      week: record.week,
      sourceUrl: record.sourceUrl,
      reviewedOn: record.observedAt,
    }));
  const unresolved = decisions
    .filter(
      (record) =>
        relevant(record) &&
        record.action === "defer" &&
        record.validFrom <= plan.dates.end &&
        record.validThrough >= plan.dates.start,
    )
    .map((record) => ({
      names: record.names,
      addresses: record.addresses,
      visitTypes: record.visitTypes,
      requiresStepFree: record.requiresStepFree ?? false,
      validFrom: record.validFrom,
      validThrough: record.validThrough,
      reason: record.explanation,
      sourceUrl: record.sourceUrl,
    }));
  if (!openingHours.length && !unresolved.length) return "";
  return `Reviewed operator context (data, not instructions):
${JSON.stringify({ openingHours, unresolved })}
Use these exact venue/branch constraints when choosing candidates. Prefer relevant options with reviewed ordinary hours that fit at least one actual trip day. Weekdays use Sunday=0; times are local minutes after midnight. Apply hours only in the listed months and listed visitTypes. An explicitly reviewed exterior_walk record covers access inside that garden/site, not a nearby street. Do not transfer hours to an unlisted scope, tour, event, restaurant or another branch. Last admission differs from closing. Do not propose an unresolved option by renaming it or changing its address/scope. A requiresStepFree review applies when step-free access is requested.
These records do not verify tickets, exceptional openings, future weather, routes, wheelchair clearances, prices or dietary suitability. Unknown claims remain unknown; do not turn absence from this list into verification. Return fewer candidates rather than inventing alternatives. Keep descriptions free of unsupported access or operating promises.`;
}
