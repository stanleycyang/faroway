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
  sourceNote: string;
}

const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

export function evaluateHotelConstraints(
  plan: { destination: string; children?: number; childAges?: number[] },
  hotels: Array<{ name: string; amenities: string[] }>,
  evidence: readonly HotelConstraint[],
) {
  const findings: Array<{
    hotelName: string;
    evidenceId: string;
    finding: string;
    sourceUrl: string;
    observedAt: string;
  }> = [];
  let matchedHotels = 0;
  for (const hotel of hotels) {
    const facts = evidence.filter(
      (fact) =>
        normalize(plan.destination.split(",")[0]) ===
          normalize(fact.destination) &&
        normalize(hotel.name) === normalize(fact.name),
    );
    if (facts.length) matchedHotels++;
    for (const fact of facts) {
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
  }
  return {
    findings,
    matchedHotels,
    uncheckedHotels: hotels.length - matchedHotels,
    qualityAccepted: false,
    coverage:
      "Exact reviewed property names only. Other names, branches and amenities remain unknown. Current published policies do not establish future availability or suitability.",
  };
}
