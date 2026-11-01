import {
  evaluateHotelConstraints,
  type HotelConstraint,
} from "../../../../scripts/uat/lib/hotel-constraints";
import type { HotelResult, SearchPlan } from "./types";

/** Negative evidence can withhold an AI idea; absence of a finding never verifies it. */
export function screenHotelCandidates(
  plan: SearchPlan,
  hotels: readonly HotelResult[],
  evidence: readonly HotelConstraint[],
) {
  const candidates: HotelResult[] = [];
  const withheld: Array<{
    hotelId: string;
    hotelName: string;
    findings: ReturnType<typeof evaluateHotelConstraints>["findings"];
  }> = [];
  for (const hotel of hotels) {
    // This experiment does not alter consented provider quotes or legacy records
    // whose provenance is unknown. It screens generated planning ideas only.
    const review =
      hotel.dataSource === "ai"
        ? evaluateHotelConstraints(plan, [hotel], evidence)
        : null;
    if (review?.findings.length)
      withheld.push({
        hotelId: hotel.id,
        hotelName: hotel.name,
        findings: review.findings,
      });
    else candidates.push(hotel);
  }
  return { candidates, withheld, suitabilityVerified: false as const };
}
