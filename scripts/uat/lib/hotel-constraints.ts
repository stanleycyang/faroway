/** Reviewed development evidence only; this is not a live availability service. */
export interface HotelConstraint {
  id: string;
  destination: string;
  name: string;
  minimumGuestAge?: number;
  /** Only a reviewed all-guests rule can exclude an entire property. */
  agePolicyScope?: string; // Missing or unrecognized scopes remain unresolved.
  hasLift?: boolean;
  sourceUrl: string;
  observedAt: string;
  /** Editorial review deadline, not a claim that the policy lasts until this date. */
  reviewAfter?: string;
  sourceNote: string;
}

const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

function validDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + "T00:00:00Z");
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}

export function evaluateHotelConstraints(
  plan: { destination: string; children?: number; childAges?: number[] },
  hotels: Array<{ name: string; amenities: string[] }>,
  evidence: readonly HotelConstraint[],
  asOfDate = new Date().toISOString().slice(0, 10),
) {
  if (!validDate(asOfDate))
    throw new Error("Valid evidence evaluation date required");
  const findings: Array<{
    hotelName: string;
    evidenceId: string;
    finding: string;
    sourceUrl: string;
    observedAt: string;
  }> = [];
  const reviewRequired: Array<{
    hotelName: string;
    evidenceId: string;
    reason: string;
    sourceUrl: string;
    observedAt: string;
  }> = [];
  let matchedHotels = 0;
  let currentEvidenceHotels = 0;
  for (const hotel of hotels) {
    const facts = evidence.filter(
      (fact) =>
        normalize(plan.destination.split(",")[0]) ===
          normalize(fact.destination) &&
        normalize(hotel.name) === normalize(fact.name),
    );
    if (facts.length) matchedHotels++;
    let currentEvidence = false;
    for (const fact of facts) {
      const review = (reason: string) =>
        reviewRequired.push({
          hotelName: hotel.name,
          evidenceId: fact.id,
          reason,
          sourceUrl: fact.sourceUrl,
          observedAt: fact.observedAt,
        });
      if (
        !validDate(fact.observedAt) ||
        !validDate(fact.reviewAfter) ||
        fact.reviewAfter <= fact.observedAt
      ) {
        review("invalid_or_missing_review_dates");
        continue;
      }
      if (fact.observedAt > asOfDate) {
        review("observation_is_in_the_future");
        continue;
      }
      if (asOfDate >= fact.reviewAfter) {
        review("source_review_due");
        continue;
      }
      currentEvidence = true;
      const add = (finding: string) =>
        findings.push({
          hotelName: hotel.name,
          evidenceId: fact.id,
          finding,
          sourceUrl: fact.sourceUrl,
          observedAt: fact.observedAt,
        });
      if (
        fact.minimumGuestAge != null &&
        fact.agePolicyScope === "all_guests"
      ) {
        if (!Number.isInteger(fact.minimumGuestAge) || fact.minimumGuestAge < 0)
          throw new Error("Invalid minimum guest age evidence");
        if (
          (plan.childAges ?? []).some((age) => age < fact.minimumGuestAge!) ||
          ((plan.children ?? 0) > 0 && fact.minimumGuestAge >= 18)
        )
          add("party_conflicts_with_published_minimum_guest_age");
      }
      if (
        fact.minimumGuestAge != null &&
        fact.agePolicyScope !== "all_guests" &&
        ((plan.children ?? 0) > 0 ||
          (plan.childAges ?? []).some((age) => age < fact.minimumGuestAge!))
      )
        review("age_policy_requires_room_or_check_in_review");
      // Only explicit positive amenity labels are assertions. A negated label
      // or a prose caveat is not treated as a claim that a lift exists.
      if (
        fact.hasLift === false &&
        hotel.amenities.some((amenity) =>
          ["elevator", "lift", "lift access", "elevator access"].includes(
            normalize(amenity),
          ),
        )
      )
        add("lift_amenity_contradicted_by_published_property_information");
    }
    if (currentEvidence) currentEvidenceHotels++;
  }
  return {
    findings,
    reviewRequired,
    asOfDate,
    matchedHotels,
    currentEvidenceHotels,
    uncheckedHotels: hotels.length - currentEvidenceHotels,
    qualityAccepted: false,
    coverage:
      "Exact reviewed property names only. Other names, branches and amenities remain unknown. Current published policies do not establish future availability or suitability.",
  };
}
