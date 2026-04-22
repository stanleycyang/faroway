import LZString from "lz-string";
import { STATUS_ORDER } from "./status";
import type { CountryVisit, Profile, Status } from "./types";

interface CompactPayload {
  v: number; // payload schema version
  n?: string;
  e?: string;
  // Array of [iso, statusIdx, firstVisit?, visitCount?, pinnedCity?].
  // We strip notes and photos — they don't belong in a URL.
  d: Array<[string, number, string?, number?, string?]>;
}

const PAYLOAD_VERSION = 1;

export function encodeProfileToUrl(profile: Profile): string {
  const d: CompactPayload["d"] = Object.values(profile.visits).map((v) => {
    const statusIdx = STATUS_ORDER.indexOf(v.status);
    const tuple: [string, number, string?, number?, string?] = [
      v.iso,
      statusIdx,
    ];
    if (v.firstVisit) tuple[2] = v.firstVisit;
    if (v.visitCount) tuple[3] = v.visitCount;
    if (v.pinnedCity) tuple[4] = v.pinnedCity;
    return tuple;
  });
  const payload: CompactPayload = {
    v: PAYLOAD_VERSION,
    n: profile.name,
    e: profile.emoji,
    d,
  };
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
}

export interface DecodedProfile {
  name: string;
  emoji?: string;
  visits: Record<string, CountryVisit>;
}

export function decodeProfileFromUrl(encoded: string): DecodedProfile | null {
  try {
    const raw = LZString.decompressFromEncodedURIComponent(encoded);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CompactPayload;
    if (!parsed || parsed.v !== PAYLOAD_VERSION || !Array.isArray(parsed.d)) {
      return null;
    }
    const visits: Record<string, CountryVisit> = {};
    for (const tuple of parsed.d) {
      if (!Array.isArray(tuple) || typeof tuple[0] !== "string") continue;
      const iso = tuple[0];
      const statusIdx = tuple[1];
      const status: Status =
        typeof statusIdx === "number" && STATUS_ORDER[statusIdx]
          ? STATUS_ORDER[statusIdx]
          : "visited";
      visits[iso] = {
        iso,
        status,
        firstVisit: tuple[2] || undefined,
        visitCount: typeof tuple[3] === "number" ? tuple[3] : undefined,
        pinnedCity: tuple[4] || undefined,
      };
    }
    return {
      name: parsed.n || "Traveler",
      emoji: parsed.e,
      visits,
    };
  } catch {
    return null;
  }
}

export function buildShareUrl(encoded: string): string {
  if (typeof window === "undefined")
    return `/tools/world-map/view?d=${encoded}`;
  return `${window.location.origin}/tools/world-map/view?d=${encoded}`;
}
