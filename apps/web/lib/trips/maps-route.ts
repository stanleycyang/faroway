import type { TripDay } from "@faroway/types";

export interface DayClusteringSummary {
  neighborhoods: string[];
  estimatedDistanceKm: number | null;
  stopCount: number;
  summaryLabel: string | null;
}

interface ExtractedStop {
  name: string;
  address?: string;
  locationName?: string;
  neighborhood?: string;
  lat?: number;
  lng?: number;
}

const EARTH_RADIUS_KM = 6371;
const MAX_GOOGLE_WAYPOINTS = 9;
const MAX_APPLE_DESTINATIONS = 9;
const WALKING_THRESHOLD_KM = 12;

export function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractLocationFields(rawLocation: unknown): {
  address?: string;
  locationName?: string;
  neighborhood?: string;
  lat?: number;
  lng?: number;
} {
  const loc = asRecord(rawLocation);
  if (!loc) return {};

  const address =
    typeof loc.address === "string" && loc.address.trim()
      ? loc.address.trim()
      : undefined;
  const locationName =
    typeof loc.name === "string" && loc.name.trim()
      ? loc.name.trim()
      : undefined;
  const neighborhood =
    typeof loc.neighborhood === "string" && loc.neighborhood.trim()
      ? loc.neighborhood.trim()
      : undefined;

  const coords = asRecord(loc.coordinates);
  const rawLat = coords ? coords.lat : loc.lat;
  const rawLng = coords ? coords.lng : loc.lng;

  if (isValidCoordinate(rawLat, rawLng)) {
    return {
      address,
      locationName,
      neighborhood,
      lat: rawLat,
      lng: rawLng as number,
    };
  }

  return { address, locationName, neighborhood };
}

function readSlotItems(
  slot: unknown,
  order: "meals-first" | "activities-first",
): ExtractedStop[] {
  const block = asRecord(slot);
  if (!block) return [];

  const rawActivities = Array.isArray(block.activities) ? block.activities : [];
  const rawMeals = Array.isArray(block.meals)
    ? block.meals
    : asRecord(block.meal)
      ? [block.meal]
      : [];

  const ordered =
    order === "meals-first"
      ? [...rawMeals, ...rawActivities]
      : [...rawActivities, ...rawMeals];

  const stops: ExtractedStop[] = [];
  for (const raw of ordered) {
    const item = asRecord(raw);
    if (!item || typeof item.name !== "string" || !item.name.trim()) continue;
    const loc = extractLocationFields(item.location);
    stops.push({
      name: item.name.trim(),
      ...loc,
    });
  }
  return stops;
}

function extractOrderedDayStops(
  day: TripDay | null | undefined,
): ExtractedStop[] {
  if (!day || typeof day !== "object") return [];
  const rawStops = [
    ...readSlotItems(day.morning, "meals-first"),
    ...readSlotItems(day.afternoon, "meals-first"),
    ...readSlotItems(day.evening, "activities-first"),
  ];

  // Collapse immediate duplicates by normalized name so routing doesn't loop A -> A.
  const deduped: ExtractedStop[] = [];
  for (const stop of rawStops) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.name.toLowerCase() === stop.name.toLowerCase()) {
      continue;
    }
    deduped.push(stop);
  }
  return deduped;
}

function formatStopQuery(stop: ExtractedStop, destination?: string): string {
  const dest = destination?.trim();
  const baseParts: string[] = [];

  if (stop.name) {
    baseParts.push(stop.name);
  }

  if (stop.address) {
    const normalizedAddr = stop.address.toLowerCase();
    const normalizedName = stop.name.toLowerCase();
    if (!normalizedAddr.includes(normalizedName)) {
      baseParts.push(stop.address);
    } else {
      baseParts[0] = stop.address;
    }
  } else if (
    stop.locationName &&
    stop.locationName.toLowerCase() !== stop.name.toLowerCase()
  ) {
    baseParts.push(stop.locationName);
  }

  const combined = baseParts.join(", ");
  if (combined) {
    if (dest && !combined.toLowerCase().includes(dest.toLowerCase())) {
      return `${combined}, ${dest}`;
    }
    return combined;
  }

  if (isValidCoordinate(stop.lat, stop.lng)) {
    return `${stop.lat.toFixed(6)},${(stop.lng as number).toFixed(6)}`;
  }

  return dest || "";
}

function inferNeighborhood(stop: ExtractedStop): string | null {
  if (stop.neighborhood) return stop.neighborhood;
  if (!stop.locationName) return null;

  const candidate = stop.locationName.split(",")[0]?.trim() || "";
  if (!candidate || candidate.length < 2 || candidate.length > 40) return null;
  if (candidate.toLowerCase() === stop.name.toLowerCase()) return null;
  // Skip street addresses starting with numbers or postal-like tokens
  if (/^\d/.test(candidate)) return null;
  if (
    /\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way)\b/i.test(
      candidate,
    )
  ) {
    return null;
  }
  return candidate;
}

function computeTotalDistanceKm(stops: ExtractedStop[]): number | null {
  const withCoords = stops.filter(
    (s): s is ExtractedStop & { lat: number; lng: number } =>
      isValidCoordinate(s.lat, s.lng),
  );
  if (withCoords.length < 2) return null;

  let total = 0;
  for (let i = 1; i < withCoords.length; i++) {
    total += haversineDistanceKm(
      withCoords[i - 1].lat,
      withCoords[i - 1].lng,
      withCoords[i].lat,
      withCoords[i].lng,
    );
  }
  return Math.round(total * 10) / 10;
}

export function summarizeDayClustering(day: TripDay): DayClusteringSummary {
  const stops = extractOrderedDayStops(day);
  const stopCount = stops.length;

  if (stopCount === 0) {
    return {
      neighborhoods: [],
      estimatedDistanceKm: null,
      stopCount: 0,
      summaryLabel: null,
    };
  }

  const neighborhoods: string[] = [];
  const seen = new Set<string>();
  for (const stop of stops) {
    const area = inferNeighborhood(stop);
    if (!area) continue;
    const key = area.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      neighborhoods.push(area);
    }
  }

  const estimatedDistanceKm = computeTotalDistanceKm(stops);
  const parts: string[] = [];

  if (neighborhoods.length === 1) {
    parts.push(neighborhoods[0]);
  } else if (neighborhoods.length === 2) {
    parts.push(`${neighborhoods[0]} & ${neighborhoods[1]}`);
  } else if (neighborhoods.length > 2) {
    parts.push(`${neighborhoods[0]} + ${neighborhoods.length - 1} areas`);
  }

  const stopLabel = `${stopCount} ${stopCount === 1 ? "stop" : "stops"}`;
  if (estimatedDistanceKm !== null) {
    parts.push(`~${estimatedDistanceKm.toFixed(1)} km across ${stopLabel}`);
  } else {
    parts.push(stopLabel);
  }

  return {
    neighborhoods,
    estimatedDistanceKm,
    stopCount,
    summaryLabel: parts.join(" · "),
  };
}

export function buildGoogleMapsDayRouteUrl(
  day: TripDay,
  destination?: string,
): string | null {
  const stops = extractOrderedDayStops(day);
  if (stops.length === 0) return null;

  const queries = stops
    .map((stop) => formatStopQuery(stop, destination))
    .filter(Boolean);
  if (queries.length === 0) return null;

  const estimatedKm = computeTotalDistanceKm(stops);
  const travelMode =
    estimatedKm !== null && estimatedKm > WALKING_THRESHOLD_KM
      ? "transit"
      : "walking";

  const params = new URLSearchParams();
  params.set("api", "1");

  if (queries.length === 1) {
    params.set("destination", queries[0]);
    params.set("travelmode", travelMode);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  const origin = queries[0];
  const finalStop = queries[queries.length - 1];
  const intermediate = queries.slice(1, -1).slice(0, MAX_GOOGLE_WAYPOINTS);

  params.set("origin", origin);
  params.set("destination", finalStop);
  if (intermediate.length > 0) {
    params.set("waypoints", intermediate.join("|"));
  }
  params.set("travelmode", travelMode);

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildAppleMapsDayRouteUrl(
  day: TripDay,
  destination?: string,
): string | null {
  const stops = extractOrderedDayStops(day);
  if (stops.length === 0) return null;

  const queries = stops
    .map((stop) => formatStopQuery(stop, destination))
    .filter(Boolean);
  if (queries.length === 0) return null;

  const estimatedKm = computeTotalDistanceKm(stops);
  const dirflg =
    estimatedKm !== null && estimatedKm > WALKING_THRESHOLD_KM ? "r" : "w";

  const params = new URLSearchParams();
  if (queries.length === 1) {
    params.set("daddr", queries[0]);
    params.set("dirflg", dirflg);
    return `https://maps.apple.com/?${params.toString()}`;
  }

  params.set("saddr", queries[0]);
  const destinations = queries.slice(1, 1 + MAX_APPLE_DESTINATIONS);
  for (const dest of destinations) {
    params.append("daddr", dest);
  }
  params.set("dirflg", dirflg);

  return `https://maps.apple.com/?${params.toString()}`;
}
