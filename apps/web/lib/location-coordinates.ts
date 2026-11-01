/** Reject malformed coordinates and the pipeline's (0, 0) unknown sentinel. */
export function suppliedCoordinates(
  value: unknown,
): { lat: number; lng: number } | null {
  if (!value || typeof value !== "object") return null;
  const { lat, lng } = value as { lat?: unknown; lng?: unknown };
  return typeof lat === "number" &&
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    typeof lng === "number" &&
    Number.isFinite(lng) &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
    ? { lat, lng }
    : null;
}
