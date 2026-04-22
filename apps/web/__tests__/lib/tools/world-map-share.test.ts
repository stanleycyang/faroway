import { describe, it, expect } from "vitest";
import {
  encodeProfileToUrl,
  decodeProfileFromUrl,
} from "@/lib/tools/world-map/share";
import type { Profile } from "@/lib/tools/world-map/types";

function buildProfile(partial: Partial<Profile> = {}): Profile {
  return {
    id: "p1",
    name: "Stanley",
    emoji: "🧳",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    visits: {
      JPN: {
        iso: "JPN",
        status: "lived",
        firstVisit: "2015-03-01",
        visitCount: 4,
        pinnedCity: "Kyoto",
        notes: "secret notes",
        photoDataUrl: "data:image/jpeg;base64,AAA",
      },
      FRA: { iso: "FRA", status: "visited" },
      ESP: { iso: "ESP", status: "wishlist" },
    },
    ...partial,
  };
}

describe("encodeProfileToUrl / decodeProfileFromUrl", () => {
  it("round-trips public fields", () => {
    const profile = buildProfile();
    const encoded = encodeProfileToUrl(profile);
    const decoded = decodeProfileFromUrl(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe("Stanley");
    expect(decoded!.emoji).toBe("🧳");
    expect(decoded!.visits.JPN.status).toBe("lived");
    expect(decoded!.visits.JPN.firstVisit).toBe("2015-03-01");
    expect(decoded!.visits.JPN.visitCount).toBe(4);
    expect(decoded!.visits.JPN.pinnedCity).toBe("Kyoto");
    expect(decoded!.visits.FRA.status).toBe("visited");
    expect(decoded!.visits.ESP.status).toBe("wishlist");
  });

  it("strips private fields (notes, photos) from share payloads", () => {
    const profile = buildProfile();
    const encoded = encodeProfileToUrl(profile);
    const decoded = decodeProfileFromUrl(encoded);
    expect(decoded!.visits.JPN.notes).toBeUndefined();
    expect(decoded!.visits.JPN.photoDataUrl).toBeUndefined();
  });

  it("returns null for garbled input", () => {
    expect(decodeProfileFromUrl("this-is-not-valid")).toBeNull();
    expect(decodeProfileFromUrl("")).toBeNull();
  });

  it("is roughly URL-safe and compact", () => {
    const encoded = encodeProfileToUrl(buildProfile());
    // Encoded payload should be a reasonably short URI component.
    expect(encoded.length).toBeLessThan(400);
    expect(encoded).not.toContain(" ");
  });
});
