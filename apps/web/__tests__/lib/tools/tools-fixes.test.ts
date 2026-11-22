import { describe, it, expect } from "vitest";
import { destinationGuides } from "@/lib/destination-guides";
import { DESTINATION_TAGS } from "@/lib/tools/quiz-scoring";
import { getVisaInfo } from "@/lib/tools/visa-data";
import { parseImportPayload } from "@/components/tools/world-map/ImportDialog";

describe("ImportDialog parseImportPayload", () => {
  it("migrates v1 wishlists and sanitizes state backups", () => {
    const parsed = parseImportPayload({
      schemaVersion: 1,
      activeProfileId: "p1",
      profiles: [
        {
          id: "p1",
          name: "Alice",
          visits: {
            FRA: null,
            ARG: { iso: "ARG", status: "wishlist" },
            JPN: {
              iso: "JPN",
              status: "lived",
              photoDataUrl: "https://evil.example/track.gif",
            },
            USA: {
              iso: "USA",
              status: "visited",
              photoDataUrl: "data:image/png;base64,iVBORw0KGgo=",
            },
          },
        },
      ],
    });
    expect(parsed?.kind).toBe("state");
    if (parsed?.kind === "state") {
      const visits = parsed.state.profiles[0].visits;
      expect(visits.FRA).toBeUndefined();
      expect(visits.ARG).toBeUndefined();
      expect(visits.JPN.status).toBe("visited");
      expect(visits.JPN.photoDataUrl).toBeUndefined();
      expect(visits.USA.photoDataUrl).toBe(
        "data:image/png;base64,iVBORw0KGgo=",
      );
    }
  });

  it("migrates and sanitizes single-profile backups", () => {
    const parsed = parseImportPayload({
      id: "p2",
      name: "Bob",
      visits: {
        ARG: { iso: "ARG", status: "wishlist" },
        INVALID: { iso: "INVALID", status: "visited" },
        ITA: { iso: "ITA", status: "visited" },
      },
    });
    expect(parsed?.kind).toBe("profile");
    if (parsed?.kind === "profile") {
      expect(Object.keys(parsed.profile.visits)).toEqual(["ITA"]);
    }
  });

  it("rejects payloads whose profiles are all invalid", () => {
    const parsed = parseImportPayload({
      activeProfileId: "bad",
      profiles: [{ id: 123, visits: {} }],
    });
    expect(parsed).toBeNull();
  });
});

describe("quiz-scoring DESTINATION_TAGS coverage", () => {
  it("covers every destination guide slug with at least one tag", () => {
    const missing = destinationGuides
      .filter((g) => !(DESTINATION_TAGS[g.slug]?.length > 0))
      .map((g) => g.slug);
    expect(missing).toEqual([]);
  });
});

describe("visa-data UK (London) ETA guidance", () => {
  it.each(["US", "CA", "AU", "EU", "JP", "KR", "BR", "MX", "NZ", "SG", "AE"])(
    "%s → london requires UK ETA (e-visa)",
    (passport) => {
      const req = getVisaInfo(passport, "london");
      expect(req?.status).toBe("e-visa");
      expect(req?.notes).toContain("ETA");
    },
  );

  it("keeps GB domestic as visa-free and IN/CN/ZA as visa-required", () => {
    expect(getVisaInfo("GB", "london")?.status).toBe("visa-free");
    expect(getVisaInfo("IN", "london")?.status).toBe("visa-required");
    expect(getVisaInfo("CN", "london")?.status).toBe("visa-required");
    expect(getVisaInfo("ZA", "london")?.status).toBe("visa-required");
  });
});
