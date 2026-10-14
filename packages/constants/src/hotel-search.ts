export const HOTEL_SEARCH_CONSENT_VERSION = "hotel-search-nuitee-v1" as const;
export const HOTEL_SEARCH_DISCLOSURE =
  "Hotel search shares your destination, stay dates, nationality, adults and children’s ages per room with Nuitee (LiteAPI). Quotes are subject to supplier price and cancellation terms. This does not make a booking.";

export interface HotelSearchDetails {
  countryCode: string;
  guestNationality: string;
  rooms: Array<{ adults: number; children: number[] }>;
  consentVersion: typeof HOTEL_SEARCH_CONSENT_VERSION;
}

export function parseHotelChildrenAges(text: string): number[] {
  return text.trim()
    ? text
        .split(",")
        .map((age) => (/^\d{1,2}$/.test(age.trim()) ? Number(age.trim()) : NaN))
    : [];
}

export function hotelChildrenAgeText(children: number[], raw?: string): string {
  return raw !== undefined &&
    JSON.stringify(parseHotelChildrenAges(raw)) === JSON.stringify(children)
    ? raw
    : children.join(", ");
}

export function hotelGuestCounts(details: HotelSearchDetails) {
  const adults = details.rooms.reduce((sum, room) => sum + room.adults, 0);
  const children = details.rooms.reduce(
    (sum, room) => sum + room.children.length,
    0,
  );
  return { adults, children, travelers: adults + children };
}

/** Reject incomplete or inconsistent party details instead of guessing guests. */
export function validateHotelSearchDetails(
  value: unknown,
  travelers?: number,
): value is HotelSearchDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (
    Object.keys(item).some(
      (key) =>
        ![
          "countryCode",
          "guestNationality",
          "rooms",
          "consentVersion",
        ].includes(key),
    )
  )
    return false;
  if (
    typeof item.countryCode !== "string" ||
    !/^[A-Z]{2}$/.test(item.countryCode) ||
    typeof item.guestNationality !== "string" ||
    !/^[A-Z]{2}$/.test(item.guestNationality) ||
    item.consentVersion !== HOTEL_SEARCH_CONSENT_VERSION ||
    !Array.isArray(item.rooms) ||
    item.rooms.length < 1 ||
    item.rooms.length > 4
  )
    return false;
  let guests = 0;
  for (const room of item.rooms) {
    if (!room || typeof room !== "object" || Array.isArray(room)) return false;
    if (Object.keys(room).some((key) => !["adults", "children"].includes(key)))
      return false;
    if (
      !Number.isInteger(room.adults) ||
      room.adults < 1 ||
      room.adults > 8 ||
      !Array.isArray(room.children) ||
      room.children.length > 6 ||
      !room.children.every(
        (age: unknown) =>
          typeof age === "number" &&
          Number.isInteger(age) &&
          age >= 0 &&
          age <= 17,
      )
    )
      return false;
    guests += room.adults + room.children.length;
  }
  return guests <= 50 && (travelers === undefined || guests === travelers);
}
