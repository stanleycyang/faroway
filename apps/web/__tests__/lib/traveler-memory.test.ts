import { describe, expect, it } from "vitest";
import {
  applyLearnedSuggestion,
  clearTravelerMemory,
  computeLearnedSuggestions,
  createEmptyTravelerMemory,
  hasTravelerMemoryValues,
  mergeTravelerMemoryIntoCreateState,
  readTravelerMemory,
  readTripPreferenceHistory,
  recordTripPreferenceSignal,
  saveTravelerMemory,
  summarizeTravelerMemory,
  type StorageLike,
} from "@/lib/trips/traveler-memory";

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}

describe("traveler-memory", () => {
  it("scopes saved defaults by userId and supports clean one-click clearing", () => {
    const storage = createMemoryStorage();

    saveTravelerMemory(
      "user-a",
      {
        homeAirport: "SFO",
        defaultBudget: "luxury",
        defaultPace: "relaxed",
        defaultVibes: ["foodie", "cultural"],
        dietaryPreferences: ["Vegetarian"],
        allergies: ["peanuts"],
        accessibility: ["step_free_entrance"],
        mobilityNotes: "Prefer elevator access",
        avoidEarlyStarts: true,
      },
      storage,
    );

    const a = readTravelerMemory("user-a", storage);
    const b = readTravelerMemory("user-b", storage);

    expect(a.homeAirport).toBe("SFO");
    expect(a.defaultBudget).toBe("luxury");
    expect(a.dietaryPreferences).toEqual(["Vegetarian"]);
    expect(a.allergies).toEqual(["peanuts"]);
    expect(a.accessibility).toEqual(["step_free_entrance"]);
    expect(a.avoidEarlyStarts).toBe(true);
    expect(hasTravelerMemoryValues(a)).toBe(true);

    // User B must never see User A's defaults
    expect(hasTravelerMemoryValues(b)).toBe(false);
    expect(b.homeAirport).toBe("");

    clearTravelerMemory("user-a", storage);
    expect(hasTravelerMemoryValues(readTravelerMemory("user-a", storage))).toBe(
      false,
    );
  });

  it("handles malformed storage payloads gracefully without throwing", () => {
    const storage = createMemoryStorage();
    storage.setItem("faroway:traveler-memory:user-a", "{not-valid-json");
    expect(readTravelerMemory("user-a", storage)).toEqual(
      createEmptyTravelerMemory(),
    );

    storage.setItem(
      "faroway:traveler-memory:user-a",
      JSON.stringify({
        defaultBudget: "invalid-tier",
        defaultVibes: ["foodie", "foodie", "not-a-vibe", "nature"],
        dietaryPreferences: ["Vegetarian", "Bogus"],
        accessibility: ["step_free_entrance", "bogus"],
      }),
    );
    const sanitized = readTravelerMemory("user-a", storage);
    expect(sanitized.defaultBudget).toBeNull();
    expect(sanitized.defaultVibes).toEqual(["foodie", "nature"]);
    expect(sanitized.dietaryPreferences).toEqual(["Vegetarian"]);
    expect(sanitized.accessibility).toEqual(["step_free_entrance"]);
  });

  it("merges defaults into /create without clobbering restored drafts or explicit URL params", () => {
    const memory = saveTravelerMemory(
      "user-a",
      {
        defaultBudget: "luxury",
        defaultPace: "relaxed",
        defaultVibes: ["foodie", "wellness"],
        dietaryPreferences: ["Halal"],
        allergies: ["shellfish"],
        accessibility: ["accessible_seating"],
        avoidEarlyStarts: true,
      },
      createMemoryStorage(),
    );

    // 1. Restored draft: NEVER clobber anything
    const withDraft = mergeTravelerMemoryIntoCreateState(
      {
        budget: "budget",
        selectedVibes: ["adventure"],
        dietaryPreferences: [],
        allergiesText: "",
        accessibility: [],
        mobilityNotes: "",
      },
      memory,
      { hasDraft: true, urlHasBudget: false, urlHasVibes: false },
    );
    expect(withDraft.appliedFields).toEqual([]);
    expect(withDraft.merged.budget).toBe("budget");
    expect(withDraft.merged.selectedVibes).toEqual(["adventure"]);
    expect(withDraft.merged.dietaryPreferences).toEqual([]);

    // 2. Explicit URL params: preserve URL budget and vibes, apply remaining defaults
    const withUrl = mergeTravelerMemoryIntoCreateState(
      {
        budget: "budget",
        selectedVibes: ["nature"],
        dietaryPreferences: [],
        allergiesText: "",
        accessibility: [],
        mobilityNotes: "",
      },
      memory,
      { hasDraft: false, urlHasBudget: true, urlHasVibes: true },
    );
    expect(withUrl.merged.budget).toBe("budget");
    expect(withUrl.merged.selectedVibes).toEqual(["nature"]);
    expect(withUrl.merged.dietaryPreferences).toEqual(["Halal"]);
    expect(withUrl.merged.allergiesText).toBe("shellfish");
    expect(withUrl.merged.accessibility).toEqual(["accessible_seating"]);
    expect(withUrl.merged.mobilityNotes).toContain("Avoid early starts");
    expect(withUrl.merged.mobilityNotes).toContain("Relaxed pace");

    // 3. Fresh /create with no draft or URL overrides: apply all saved defaults
    const fresh = mergeTravelerMemoryIntoCreateState(
      {
        budget: "moderate",
        selectedVibes: [],
        dietaryPreferences: [],
        allergiesText: "",
        accessibility: [],
        mobilityNotes: "",
      },
      memory,
      { hasDraft: false, urlHasBudget: false, urlHasVibes: false },
    );
    expect(fresh.merged.budget).toBe("luxury");
    expect(fresh.merged.selectedVibes).toEqual(["foodie", "wellness"]);
    expect(fresh.appliedFields.length).toBeGreaterThanOrEqual(4);
  });

  it("computes transparent 'Learned from your trips' suggestions from repeated history", () => {
    const storage = createMemoryStorage();
    recordTripPreferenceSignal(
      "user-a",
      {
        budget: "luxury",
        vibes: ["foodie", "cultural"],
        dietaryPreferences: ["Vegan"],
        avoidEarlyStarts: true,
      },
      storage,
    );
    recordTripPreferenceSignal(
      "user-a",
      {
        budget: "luxury",
        vibes: ["foodie", "nature"],
        dietaryPreferences: ["Vegan"],
        avoidEarlyStarts: true,
      },
      storage,
    );

    const history = readTripPreferenceHistory("user-a", storage);
    expect(history).toHaveLength(2);

    const emptyMemory = createEmptyTravelerMemory();
    const suggestions = computeLearnedSuggestions(history, emptyMemory);
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
    expect(suggestions.some((s) => s.id === "dietary:Vegan")).toBe(true);
    expect(suggestions.some((s) => s.id === "budget:luxury")).toBe(true);

    // Accepting a learned suggestion updates memory and removes it from future suggestions
    const veganSuggestion = suggestions.find((s) => s.id === "dietary:Vegan")!;
    const updated = applyLearnedSuggestion(emptyMemory, veganSuggestion);
    expect(updated.dietaryPreferences).toEqual(["Vegan"]);
    expect(
      computeLearnedSuggestions(history, updated).some(
        (s) => s.id === "dietary:Vegan",
      ),
    ).toBe(false);

    expect(summarizeTravelerMemory(updated)).toContain("Vegan");
  });
});
