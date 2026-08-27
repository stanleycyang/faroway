import { describe, expect, it } from "vitest";
import {
  buildCreateResumePath,
  consumeCreateResume,
  createDraftFromQuery,
  createDraftToQuery,
  isCreateDraftReady,
  loadCreateDraft,
  markCreateResume,
  mergeCreateDrafts,
  parseCreateDraft,
  saveCreateDraft,
} from "@/lib/trips/create-draft";

describe("create draft persistence", () => {
  const draft = {
    destination: {
      name: "Tokyo",
      lat: 35.6762,
      lng: 139.6503,
      placeId: "tokyo",
      isRecommended: true,
    },
    startDate: "2026-09-01",
    endDate: "2026-09-08",
    travelers: 2,
    travelerType: "couple",
    vibes: ["foodie", "culture"],
  };

  it("round-trips JSON and treats destination + dates as ready", () => {
    expect(isCreateDraftReady(draft)).toBe(true);
    expect(parseCreateDraft(JSON.stringify(draft))).toEqual(draft);
    expect(isCreateDraftReady({ destination: draft.destination })).toBe(false);
  });

  it("serializes to query params and restores destination, dates, travelers, type, and vibes", () => {
    const params = createDraftToQuery(draft);
    expect(params.get("destination")).toBe("Tokyo");
    expect(params.get("startDate")).toBe("2026-09-01");
    expect(params.get("vibes")).toBe("foodie,culture");

    const restored = createDraftFromQuery(params);
    expect(restored.destination?.name).toBe("Tokyo");
    expect(restored.startDate).toBe("2026-09-01");
    expect(restored.endDate).toBe("2026-09-08");
    expect(restored.travelers).toBe(2);
    expect(restored.travelerType).toBe("couple");
    expect(restored.vibes).toEqual(["foodie", "culture"]);
  });

  it("builds a resume path that login can redirect back to", () => {
    expect(buildCreateResumePath(draft)).toContain("/create?");
    expect(buildCreateResumePath(draft)).toContain("resume=1");
    expect(buildCreateResumePath(draft)).toContain("destination=Tokyo");
  });

  it("merges query + storage drafts without dropping vibes", () => {
    const merged = mergeCreateDrafts(
      { destination: draft.destination, startDate: "2026-09-01" },
      { endDate: "2026-09-08", vibes: ["foodie"] },
    );
    expect(isCreateDraftReady(merged)).toBe(true);
    expect(merged.vibes).toEqual(["foodie"]);
  });

  it("saves and restores from sessionStorage-like storage", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    };

    saveCreateDraft(draft, storage);
    expect(loadCreateDraft(storage)?.destination?.name).toBe("Tokyo");
    markCreateResume(storage);
    expect(consumeCreateResume(storage)).toBe(true);
    expect(consumeCreateResume(storage)).toBe(false);
  });
});
