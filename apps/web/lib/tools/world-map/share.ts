import LZString from "lz-string";
import { CONTINENT_BY_ALPHA3 } from "./continents";
import type { CountryVisit, Profile } from "./types";

// v=1 (legacy): [iso, statusIdx, firstVisit?, visitCount?, pinnedCity?]
// v=2:          [iso, firstVisit?, visitCount?, pinnedCity?]
//
// We collapsed the multi-status concept — every pin is now just "visited" —
// so the wire format is one tuple slot smaller. The decoder still reads v=1
// payloads (statusIdx is silently ignored) so old shared links keep working.

type CompactTupleV1 = [string, number, string?, number?, string?];
type CompactTupleV2 = [string, string?, number?, string?];

interface CompactPayload {
  v: number;
  n?: string;
  e?: string;
  d: CompactTupleV1[] | CompactTupleV2[];
}

const PAYLOAD_VERSION = 2;

export function encodeProfileToUrl(profile: Profile): string {
  const d: CompactTupleV2[] = Object.values(profile.visits).map((v) => {
    const tuple: CompactTupleV2 = [v.iso];
    if (v.firstVisit) tuple[1] = v.firstVisit;
    if (v.visitCount) tuple[2] = v.visitCount;
    if (v.pinnedCity) tuple[3] = v.pinnedCity;
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
    if (!parsed || ![1, 2].includes(parsed.v) || !Array.isArray(parsed.d))
      return null;

    const visits: Record<string, CountryVisit> = {};
    for (const tuple of parsed.d) {
      if (!Array.isArray(tuple) || typeof tuple[0] !== "string") continue;
      const iso = tuple[0];
      if (!Object.hasOwn(CONTINENT_BY_ALPHA3, iso)) continue;
      // v=1 has a numeric status index at slot 1; v=2 has firstVisit (string)
      // or undefined there. Distinguish by type.
      const isLegacy = typeof tuple[1] === "number";
      const firstVisit = isLegacy ? tuple[2] : tuple[1];
      const visitCount = isLegacy ? tuple[3] : tuple[2];
      const pinnedCity = isLegacy ? tuple[4] : tuple[3];

      visits[iso] = {
        iso,
        status: "visited",
        firstVisit: typeof firstVisit === "string" ? firstVisit : undefined,
        visitCount:
          typeof visitCount === "number" &&
          Number.isSafeInteger(visitCount) &&
          visitCount > 0
            ? visitCount
            : undefined,
        pinnedCity: typeof pinnedCity === "string" ? pinnedCity : undefined,
      };
    }

    return {
      name: typeof parsed.n === "string" && parsed.n ? parsed.n : "Traveler",
      emoji: typeof parsed.e === "string" ? parsed.e : undefined,
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
