/** Only independent catalog facts or traveler-entered text can enter a plan. */
export interface PlannerDestination {
  name: string;
  lat: number;
  lng: number;
  placeId: string; // Internal catalog ID, never a Google resource payload.
  isRecommended: boolean;
  source: "catalog" | "user";
}
interface CatalogDestination {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export function plannerDestination(
  value: unknown,
  catalog: CatalogDestination[],
): PlannerDestination | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<PlannerDestination>;
  if (
    input.source === "catalog" ||
    (input.source === undefined && input.isRecommended)
  ) {
    const entry = catalog.find(
      (d) => d.id === input.placeId && d.name === input.name,
    );
    return entry
      ? {
          name: entry.name,
          lat: entry.lat,
          lng: entry.lng,
          placeId: entry.id,
          isRecommended: true,
          source: "catalog",
        }
      : null;
  }
  if (input.source !== "user" || typeof input.name !== "string") return null;
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) return null;
  return {
    name,
    lat: 0,
    lng: 0,
    placeId: "",
    isRecommended: false,
    source: "user",
  };
}
