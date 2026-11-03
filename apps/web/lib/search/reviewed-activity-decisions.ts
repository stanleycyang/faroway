import { z } from "zod";
import type { ActivityResult, SearchPlan } from "./types";
import type { ScheduleExclusion } from "./schedule-compiler";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
  );
export const activityDecisionSchema = z
  .object({
    id: z.string().min(1),
    destination: z.string().min(1),
    names: z.array(z.string().min(1)).min(1),
    addresses: z.array(z.string().min(1)).min(1),
    visitTypes: z
      .array(
        z.enum([
          "ordinary_entry",
          "exterior_walk",
          "guided_tour",
          "event",
          "unknown",
        ]),
      )
      .min(1),
    sourceUrl: z
      .string()
      .url()
      .refine((value) => {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      }),
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
    observedAt: date,
    reviewAfter: date,
    validFrom: date,
    validThrough: date,
    requiresStepFree: z.boolean().optional(),
    action: z.enum(["defer", "replace_description"]),
    explanation: z.string().min(1),
    description: z.string().min(1).optional(),
  })
  .refine(
    (record) =>
      record.observedAt <= record.reviewAfter &&
      record.validFrom <= record.validThrough,
  )
  .refine(
    (record) => record.action !== "replace_description" || !!record.description,
  );
export type ReviewedActivityDecision = z.infer<typeof activityDecisionSchema>;
const normalize = (value: string) =>
  value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** Negative evidence and bounded copy corrections, never a suitability certificate.
 * Exact branch/scope only. Provider copy is not rewritten. Decisions apply only
 * within reviewed date bounds; ambiguous anchors are withheld for manual review.
 */
export function applyReviewedActivityDecisions(
  plan: Pick<SearchPlan, "destination" | "mobilityNeeds" | "requirements">,
  inventory: readonly ActivityResult[],
  dates: readonly string[],
  records: readonly ReviewedActivityDecision[],
  asOf = new Date().toISOString().slice(0, 10),
) {
  date.parse(asOf);
  dates.forEach((value) => date.parse(value));
  const stepFree =
    plan.requirements?.accessibility?.includes("step_free_entrance") ||
    /^(?:wheelchair access|stroller access|step[- ]free)\b/i.test(
      plan.mobilityNeeds?.trim() ?? "",
    );
  const exclusions: ScheduleExclusion[] = [];
  const notes: string[] = [];
  const activities = inventory.map((activity) => {
    const named = records.filter(
      (record) =>
        normalize(record.destination) === normalize(plan.destination) &&
        record.names.some(
          (name) => normalize(name) === normalize(activity.name),
        ) &&
        record.visitTypes.includes(activity.proposedVisitType ?? "unknown") &&
        (!record.requiresStepFree || stepFree) &&
        dates.some(
          (day) => day >= record.validFrom && day <= record.validThrough,
        ),
    );
    const matched = named.filter((record) =>
      record.addresses.some(
        (address) =>
          normalize(address) === normalize(activity.location.address),
      ),
    );
    // A known name at a new address is an unresolved identity, not evidence
    // that the reviewed closure or access restriction no longer applies.
    // Do not transfer that venue's factual verdict to the unreviewed address.
    if (named.length && !matched.length) {
      for (const day of dates.filter((day) =>
        named.some(
          (record) => day >= record.validFrom && day <= record.validThrough,
        ),
      ))
        exclusions.push({
          activityId: activity.id,
          date: day,
          reason: "venue_identity_requires_review",
          sourceUrl: named[0].sourceUrl,
          observedAt: named[0].observedAt,
        });
      notes.push(
        `${activity.name} was not scheduled: its proposed address does not match the reviewed venue. Resolve the identity before applying any opening or access evidence. Review reference: ${named[0].sourceUrl}`,
      );
      return activity;
    }
    if (!matched.length) return activity;
    // Do not erase/rewrite affiliate content or attribute our review to a vendor.
    const generated = !activity.affiliatePartner && !activity.affiliateUrl;
    let result = activity;
    for (const record of matched) {
      const fresh = record.observedAt <= asOf && asOf <= record.reviewAfter;
      const mustDefer =
        record.action === "defer" || !fresh || matched.length > 1;
      const applicableDates = dates.filter(
        (day) => day >= record.validFrom && day <= record.validThrough,
      );
      if (mustDefer) {
        for (const day of applicableDates)
          exclusions.push({
            activityId: activity.id,
            date: day,
            reason: "reviewed_activity_requires_resolution",
            sourceUrl: record.sourceUrl,
            observedAt: record.observedAt,
          });
        notes.push(
          `${activity.name} was not scheduled: ${fresh ? record.explanation : "The earlier review needs refreshing before this option can be used."} Source reviewed ${record.observedAt}: ${record.sourceUrl}`,
        );
      } else if (
        generated &&
        record.description &&
        applicableDates.length === dates.length
      ) {
        result = { ...result, description: record.description };
        notes.push(
          `${activity.name}: ${record.explanation} Source reviewed ${record.observedAt}: ${record.sourceUrl}`,
        );
      }
    }
    return result;
  });
  return { activities, exclusions, notes: [...new Set(notes)] };
}
