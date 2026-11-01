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
  asOfDate = new Date().toISOString().slice(0, 10),
) {
  const candidates: HotelResult[] = [];
  const withheld: Array<{
    hotelId: string;
    hotelName: string;
    findings: ReturnType<typeof evaluateHotelConstraints>["findings"];
  }> = [];
  const reviewRequired: ReturnType<
    typeof evaluateHotelConstraints
  >["reviewRequired"] = [];
  const selectionPendingReview = new Set<string>();
  for (const hotel of hotels) {
    // This experiment does not alter consented provider quotes or legacy records
    // whose provenance is unknown. It screens generated planning ideas only.
    const review =
      hotel.dataSource === "ai"
        ? evaluateHotelConstraints(plan, [hotel], evidence, asOfDate)
        : null;
    if (review) reviewRequired.push(...review.reviewRequired);
    if (
      review?.reviewRequired.some(
        (item) => item.reason !== "age_policy_requires_room_or_check_in_review",
      )
    )
      selectionPendingReview.add(hotel.id);
    if (review?.findings.length)
      withheld.push({
        hotelId: hotel.id,
        hotelName: hotel.name,
        findings: review.findings,
      });
    else {
      const notices = [
        ...new Set(
          (review?.reviewRequired ?? []).map((item) =>
            item.reason === "age_policy_requires_room_or_check_in_review"
              ? "Confirm age rules for your exact room and check-in arrangement; accommodation suitability is unverified."
              : "Previously reviewed hotel policy information needs checking again; accommodation suitability is unverified.",
          ),
        ),
      ];
      const additions = notices.filter(
        (notice) => !hotel.description.includes(notice),
      );
      candidates.push(
        additions.length
          ? {
              ...hotel,
              description: [hotel.description, ...additions].join("\n\n"),
            }
          : hotel,
      );
    }
  }
  return {
    candidates,
    selectionCandidates: candidates.filter(
      (hotel) => !selectionPendingReview.has(hotel.id),
    ),
    selectionPendingReview: [...selectionPendingReview],
    withheld,
    reviewRequired,
    asOfDate,
    suitabilityVerified: false as const,
  };
}
