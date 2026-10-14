import { z } from "zod";

export const TRIP_PAGE_SIZE = 100;
const cursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
});

export function readTripCursor(value: string) {
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(value)) return null;
  try {
    const result = cursorSchema.safeParse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function writeTripCursor(trip: { created_at: string; id: string }) {
  const cursor = cursorSchema.parse({
    // PostgreSQL timestamps carry microseconds; Date would truncate the boundary.
    createdAt: trip.created_at,
    id: trip.id,
  });
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}
