import { suppliedCoordinates } from "../location-coordinates";

/** Screening on supplied coordinates, not verified route or travel-time evidence. */
export function suppliedDistanceKm(a: unknown, b: unknown): number | null {
  const x = suppliedCoordinates(a),
    y = suppliedCoordinates(b);
  if (!x || !y) return null;
  const rad = Math.PI / 180;
  const h =
    Math.sin(((y.lat - x.lat) * rad) / 2) ** 2 +
    Math.cos(x.lat * rad) *
      Math.cos(y.lat * rad) *
      Math.sin(((y.lng - x.lng) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
