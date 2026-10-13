import { describe, expect, it } from "vitest";
import {
  saveCreateDraft,
  takeCreateDraft,
  saveEditorDraft,
  readEditorDraft,
  clearEditorDraft,
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
