import {
  HOTEL_SEARCH_CONSENT_VERSION,
  validateHotelSearchDetails,
} from "@faroway/constants";
import { describe, expect, it } from "vitest";
import {
  saveCreateDraft,
  takeCreateDraft,
  saveEditorDraft,
  readEditorDraft,
  clearEditorDraft,
  restoreHotelSearchDraft,
  restoreHotelAgeTextDraft,
} from "@/lib/create-draft";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("create draft handoff", () => {
  it("restores a draft once from storage shared across tabs", () => {
    const storage = createStorage();
    const draft = { destination: "Kyoto", travelers: 2 };
    const draftId = saveCreateDraft(storage, draft, 1_000);

    expect(takeCreateDraft(storage, draftId, 2_000)).toEqual(draft);
    expect(takeCreateDraft(storage, draftId, 2_000)).toBeNull();
  });

  it("rejects expired and malformed draft references", () => {
    const storage = createStorage();
    const draftId = saveCreateDraft(storage, { destination: "Rome" }, 1_000);

    expect(takeCreateDraft(storage, "../untrusted", 2_000)).toBeNull();
    expect(takeCreateDraft(storage, draftId, 86_402_000)).toBeNull();
  });
});

describe("same-tab setup draft", () => {
  it("keeps the draft across reads and clears it separately from the sign-in handoff", () => {
    const storage = createStorage();
    const draft = { destination: "Paris", travelers: 3 };
    const handoff = saveCreateDraft(storage, draft, 1000);
    saveEditorDraft(storage, draft, 1000);
    expect(readEditorDraft(storage, 2000)).toEqual(draft);
    expect(readEditorDraft(storage, 2000)).toEqual(draft);
    clearEditorDraft(storage);
    expect(readEditorDraft(storage, 2000)).toBeNull();
    expect(takeCreateDraft(storage, handoff, 2000)).toEqual(draft);
  });
  it("ignores expired, future and corrupt drafts", () => {
    const storage = createStorage();
    saveEditorDraft(storage, { destination: "Paris" }, 1000);
    expect(readEditorDraft(storage, 999)).toBeNull();
    expect(readEditorDraft(storage, 86_402_000)).toBeNull();
    storage.setItem("faroway-create-editor-draft", "invalid json");
    expect(readEditorDraft(storage, 2000)).toBeNull();
  });
});

describe("hotel editor draft restoration", () => {
  const details = {
    countryCode: "FR",
    guestNationality: "US",
    consentVersion: HOTEL_SEARCH_CONSENT_VERSION,
    rooms: [{ adults: 2, children: [6] }],
  };
  it("restores matching raw text but rejects stale or malformed editor metadata", () => {
    expect(restoreHotelAgeTextDraft([" 6 "], details)).toEqual([" 6 "]);
    for (const raw of [undefined, null, {}, [42], ["7"], ["abc"]]) {
      expect(restoreHotelAgeTextDraft(raw, details)).toEqual(["6"]);
    }
    expect(restoreHotelAgeTextDraft(["6"], null)).toEqual([]);
    const invalid = restoreHotelSearchDraft(
      JSON.parse(
        JSON.stringify({
          ...details,
          rooms: [{ adults: 2, children: [6, NaN] }],
        }),
      ),
    );
    expect(restoreHotelAgeTextDraft(["6,"], invalid)).toEqual(["6,"]);
    expect(validateHotelSearchDetails(invalid)).toBe(false);
  });
  it("preserves incomplete nationality and room work without making it valid", () => {
    const incomplete = { ...details, guestNationality: "" };
    const restored = restoreHotelSearchDraft(
      JSON.parse(JSON.stringify(incomplete)),
    );
    expect(restored).toEqual(incomplete);
    expect(validateHotelSearchDetails(restored, 3)).toBe(false);
    expect(restoreHotelSearchDraft(details)).toEqual(details);
  });
  it("does not turn invalid numeric input into valid guests after JSON autosave", () => {
    for (const rooms of [
      [{ adults: 2, children: [NaN] }],
      [{ adults: 0, children: [18] }],
      [{ adults: NaN, children: [] }],
    ]) {
      const restored = restoreHotelSearchDraft(
        JSON.parse(JSON.stringify({ ...details, rooms })),
      );
      expect(restored?.rooms).toEqual(rooms);
      expect(validateHotelSearchDetails(restored)).toBe(false);
    }
  });
  it.each([6, 7, 8])(
    "restores %i child ages without relaxing submission limits",
    (count) => {
      const draft = {
        ...details,
        rooms: [
          {
            adults: 2,
            children: Array.from({ length: count }, (_, index) => index + 1),
          },
        ],
      };
      const restored = restoreHotelSearchDraft(
        JSON.parse(JSON.stringify(draft)),
      );
      expect(restored).toEqual(draft);
      expect(validateHotelSearchDetails(restored, count + 2)).toBe(count <= 6);
    },
  );
  it("requires explicit versioned consent and safe room structure", () => {
    for (const value of [
      null,
      {},
      { ...details, consentVersion: undefined },
      { ...details, rooms: [{ adults: 2, children: "6" }] },
      { ...details, rooms: [null] },
      { ...details, rooms: [] },
    ])
      expect(restoreHotelSearchDraft(value)).toBeNull();
  });
});
