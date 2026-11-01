/** Independently reviewed, date-specific reference windows. Never model output.
 * The byte hash binds reviewer-adjudicated candidate IDs to one immutable receipt.
 */
export interface HoursReview {
  traceSha256: string;
  activityId: string;
  date: string;
  intervals: Array<[number, number]>;
  sourceUrl: string;
  sourceSha256: string;
  observedAt: string;
  reviewAfter: string;
  identityReview: string;
}
const dateValid = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  Number.isFinite(Date.parse(`${s}T00:00:00Z`)) &&
  new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const sha = (s: string) => /^[a-f0-9]{64}$/.test(s);
function usable(f: HoursReview, asOf: string) {
  try {
    const url = new URL(f.sourceUrl);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      sha(f.sourceSha256) &&
      !!f.identityReview.trim() &&
      dateValid(f.observedAt) &&
      dateValid(f.reviewAfter) &&
      f.observedAt <= asOf &&
      asOf <= f.reviewAfter &&
      Array.isArray(f.intervals) &&
      f.intervals.every(
        (interval) =>
          interval.length === 2 &&
          interval.every(Number.isInteger) &&
          interval[0] >= 0 &&
          interval[1] <= 1440 &&
          interval[0] < interval[1],
      )
    );
  } catch {
    return false;
  }
}

/** Does not import runtime matching, calendar expansion or exclusion logic.
 * A compatible ordinary window is not a verified appointment or route.
 */
export function evaluateReviewedHours(
  trace: unknown,
  traceSha256: string,
  reviews: readonly HoursReview[],
  asOf: string,
) {
  if (!sha(traceSha256) || !dateValid(asOf))
    throw Error("Valid receipt hash and review date required");
  const steps = record(trace).steps;
  if (!Array.isArray(steps)) throw Error("Trace steps required");
  const aggregators = steps.filter((s) => record(s).step === "aggregator");
  if (aggregators.length !== 1)
    throw Error("Exactly one aggregator output required");
  const days = record(record(aggregators[0]).output).days;
  if (!Array.isArray(days) || !days.length)
    throw Error("Nonempty itinerary required");
  const results: Array<{
    date: string;
    slot: string;
    activityId: string;
    name: string;
    status: "conflict" | "ordinary_hours_compatible" | "unreviewed";
    reason: string;
    sourceUrl?: string;
  }> = [];
  for (const dayValue of days) {
    const day = record(dayValue);
    if (typeof day.date !== "string" || !dateValid(day.date))
      throw Error("Valid itinerary date required");
    for (const [slot, start, end] of [
      ["morning", 480, 720],
      ["afternoon", 720, 1080],
      ["evening", 1080, 1320],
    ] as const) {
      const activities = record(day[slot]).activities;
      if (!Array.isArray(activities))
        throw Error("Activity arrays required for every slot");
      for (const value of activities) {
        const a = record(value);
        const id = typeof a.id === "string" ? a.id : "";
        const matches = reviews.filter(
          (f) =>
            f.traceSha256 === traceSha256 &&
            f.activityId === id &&
            f.date === day.date,
        );
        const f = matches[0];
        const result: (typeof results)[number] = {
          date: day.date,
          slot,
          activityId: id,
          name: typeof a.name === "string" ? a.name : "",
          status: "unreviewed",
          reason: "no_receipt_bound_review",
        };
        if (
          !id ||
          !Number.isInteger(a.duration) ||
          (a.duration as number) <= 0
        ) {
          result.reason = "invalid_visit_identity_or_duration";
        } else if (matches.length > 1) {
          result.reason = "ambiguous_review";
        } else if (f && !usable(f, asOf)) {
          result.reason = "invalid_or_stale_review";
        } else if (f) {
          const fits = f.intervals.some(
            ([opens, closes]) =>
              Math.min(closes, end) - Math.max(opens, start) >=
              (a.duration as number),
          );
          result.status = fits ? "ordinary_hours_compatible" : "conflict";
          result.reason = fits
            ? "duration_fits_one_ordinary_window"
            : "duration_cannot_fit_ordinary_window";
          result.sourceUrl = f.sourceUrl;
        }
        results.push(result);
      }
    }
  }
  const count = (status: (typeof results)[number]["status"]) =>
    results.filter((r) => r.status === status).length;
  return {
    rubric: "receipt-bound-ordinary-hours-v1",
    selectedVisits: results.length,
    conflicts: count("conflict"),
    compatible: count("ordinary_hours_compatible"),
    unreviewed: count("unreviewed"),
    evidenceComplete: results.length > 0 && count("unreviewed") === 0,
    qualityAccepted: false,
    limitation:
      "Ordinary day-part windows only; special openings, traveler windows, exact start times, queues, tickets and routes are not verified.",
    results,
  };
}
