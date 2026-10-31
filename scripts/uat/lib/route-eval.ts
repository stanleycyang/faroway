/** Screening on supplied coordinates, not verified route or travel-time evidence. */
export function suppliedDistanceKm(a: unknown, b: unknown): number | null {
  function point(value: unknown): { lat: number; lng: number } | null {
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
  const x = point(a),
    y = point(b);
  if (!x || !y) return null;
  const rad = Math.PI / 180;
  const h =
    Math.sin(((y.lat - x.lat) * rad) / 2) ** 2 +
    Math.cos(x.lat * rad) *
      Math.cos(y.lat * rad) *
      Math.sin(((y.lng - x.lng) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
