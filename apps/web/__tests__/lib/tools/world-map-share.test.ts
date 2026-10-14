import { describe, it, expect } from "vitest";
import LZString from "lz-string";
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
        status: "visited",
        firstVisit: "2015-03-01",
        visitCount: 4,
        pinnedCity: "Kyoto",
        notes: "secret notes",
        photoDataUrl: "data:image/jpeg;base64,AAA",
      },
      FRA: { iso: "FRA", status: "visited" },
      ESP: { iso: "ESP", status: "visited" },
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
    expect(decoded!.visits.JPN.firstVisit).toBe("2015-03-01");
    expect(decoded!.visits.JPN.visitCount).toBe(4);
    expect(decoded!.visits.JPN.pinnedCity).toBe("Kyoto");
    expect(decoded!.visits.FRA.status).toBe("visited");
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

  it("decodes legacy v=1 share links (with statusIdx)", () => {
    // Hand-craft a v1 payload as the old encoder would have produced.
    const legacy = {
      v: 1,
      n: "Old",
      e: "🌍",
      d: [
        // [iso, statusIdx, firstVisit?, visitCount?, pinnedCity?]
        ["JPN", 0, "2015-03-01", 4, "Kyoto"], // statusIdx 0 = "lived" in old order
        ["FRA", 1], // statusIdx 1 = "visited"
        ["XXX", 4], // statusIdx 4 = "wishlist" — still decodes (we collapse to visited)
      ],
    };
    const encoded = LZString.compressToEncodedURIComponent(
      JSON.stringify(legacy),
    );
    const decoded = decodeProfileFromUrl(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe("Old");
    expect(decoded!.visits.JPN.status).toBe("visited");
    expect(decoded!.visits.JPN.firstVisit).toBe("2015-03-01");
    expect(decoded!.visits.JPN.visitCount).toBe(4);
    expect(decoded!.visits.JPN.pinnedCity).toBe("Kyoto");
    expect(decoded!.visits.FRA.status).toBe("visited");
  });
});

it("ignores unknown and prototype country keys and invalid visit counts", () => {
  const encoded = LZString.compressToEncodedURIComponent(
    JSON.stringify({
      v: 2,
      d: [
        ["XXX"],
        ["__proto__"],
        ["constructor"],
        ["JPN", "", -2],
        ["FRA", "", 1.5],
        ["ITA", "", 3],
      ],
    }),
  );
  const decoded = decodeProfileFromUrl(encoded)!;
  expect(Object.keys(decoded.visits)).toEqual(["JPN", "FRA", "ITA"]);
  expect(decoded.visits.JPN.visitCount).toBeUndefined();
  expect(decoded.visits.FRA.visitCount).toBeUndefined();
  expect(decoded.visits.ITA.visitCount).toBe(3);
});
it("rejects unsupported share versions", () => {
  expect(
    decodeProfileFromUrl(
      LZString.compressToEncodedURIComponent(
        JSON.stringify({ v: 99, d: [["JPN"]] }),
      ),
    ),
  ).toBeNull();
});
