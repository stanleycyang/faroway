import { dayTimingTips, readProposedVisitType } from "@faroway/types";
import { viatorContentMetadata } from "@/lib/affiliates/viator-policy";
import type {
  ActivityInput,
  ItineraryDayInput,
  RestaurantInput,
} from "./build-spec";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown) =>
  typeof value === "string" ? value : undefined;
const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const strings = (value: unknown) =>
  list(value).filter((v): v is string => typeof v === "string");
const priceStatus = (value: unknown) =>
  value === "unknown" || value === "estimate" ? value : undefined;

/** Saved TripDay projection shared by partial and final previews. Durations are
 * converted from saved minutes to the spec's hours contract exactly once.
 * No venue, price, reservation or timing verification is performed here.
 */
export function mappedDaysToSpec(
  days: readonly unknown[],
): ItineraryDayInput[] {
  const activity = (value: unknown): ActivityInput[] => {
    const a = record(value),
      cost = record(a.estimatedCost),
      booking = record(a.bookingInfo);
    const name = text(a.name);
    if (!name) return [];
    const minutes = number(a.duration);
    return [
      {
        ...viatorContentMetadata(a),
        id: text(a.id),
        name,
        description: text(a.description),
        proposedVisitType: readProposedVisitType(a.proposedVisitType),
        duration: minutes === undefined ? undefined : minutes / 60,
        price: number(cost.amount),
        currency: text(cost.currency),
        priceStatus: priceStatus(cost.status),
        rating: number(a.rating),
        reviewCount: number(a.reviewCount),
        category: text(a.category),
        affiliateUrl: text(booking.bookingUrl),
        images: strings(a.images),
        location: { name: text(record(a.location).name) },
      },
    ];
  };
  const meal = (value: unknown): RestaurantInput[] => {
    const m = record(value),
      name = text(m.name);
    if (!name) return [];
    return [
      {
        id: text(m.id),
        name,
        cuisine: strings(m.cuisineType).join(", "),
        description: text(m.description),
        priceLevel: number(m.priceLevel),
        priceStatus: priceStatus(record(m.estimatedCost).status),
        rating: number(m.rating),
        reviewCount: number(m.reviewCount),
        reservationUrl: text(record(m.reservationInfo).url),
      },
    ];
  };
  const slot = (value: unknown) => {
    const block = record(value);
    return {
      activities: list(block.activities).flatMap(activity),
      meals: list(block.meals).flatMap(meal),
    };
  };
  return days.map((value) => {
    const day = record(value);
    const dayNumber = number(day.dayNumber),
      date = text(day.date),
      title = text(day.title);
    if (
      dayNumber === undefined ||
      !Number.isInteger(dayNumber) ||
      dayNumber < 1 ||
      !date ||
      !title
    )
      throw Error("Invalid saved itinerary day for preview");
    const cost = record(day.totalEstimatedCost);
    return {
      dayNumber,
      date,
      title,
      tips: dayTimingTips(day),
      morning: slot(day.morning),
      afternoon: slot(day.afternoon),
      evening: slot(day.evening),
      estimatedCost: number(cost.amount),
      currency: text(cost.currency),
    };
  });
}
