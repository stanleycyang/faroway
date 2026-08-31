import { describe, expect, it } from "vitest";
import { saveCreateDraft, takeCreateDraft } from "@/lib/create-draft";

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
