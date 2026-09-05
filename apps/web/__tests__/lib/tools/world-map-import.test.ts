import { describe, expect, it, vi } from "vitest";
import { parseWorldMapImport } from "@/lib/tools/world-map/import";
import { downloadBackupJson } from "@/lib/tools/world-map/backup";
import { useWorldMapStore } from "@/lib/tools/world-map/store";

const profile = {
  id: "traveler-1",
  name: "Traveler",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  visits: {
    JPN: { iso: "JPN", status: "visited" },
  },
};

describe("parseWorldMapImport", () => {
  it("round-trips an actual downloaded backup containing editor-permitted values", async () => {
    const savedState = useWorldMapStore.getState();
    const notes = "A travel memory 🌍\n".repeat(500);
    let downloaded: Blob | undefined;
    vi.stubGlobal("document", {
      createElement: () => ({ click: vi.fn(), remove: vi.fn() }),
      body: { appendChild: vi.fn() },
    });
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      downloaded = blob as Blob;
      return "blob:backup";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    try {
      useWorldMapStore.setState({ profiles: [], settings: {} });
      const id = useWorldMapStore
        .getState()
        .createProfile("Traveler".repeat(20));
      useWorldMapStore.getState().upsertVisit("JPN", {
        notes,
        pinnedCity: "City".repeat(60),
        visitCount: 0,
      });
      downloadBackupJson();
      const json = JSON.parse(await downloaded!.text());
      expect(parseWorldMapImport(json)).toEqual({ kind: "state", state: json });
      expect(json.profiles[0].id).toBe(id);
      expect(json.profiles[0].visits.JPN.notes).toBe(notes);
    } finally {
      useWorldMapStore.setState(savedState, true);
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });

  it("keeps long notes in old backups and standalone profiles without truncation", () => {
    const notes = "n".repeat(5001);
    const saved = {
      ...profile,
      visits: { JPN: { iso: "JPN", status: "visited", notes } },
    };
    expect(parseWorldMapImport(saved)).toEqual({
      kind: "profile",
      profile: saved,
    });
    const parsed = parseWorldMapImport({
      schemaVersion: 1,
      profiles: [saved],
      activeProfileId: saved.id,
      settings: {},
    });
    expect(
      parsed?.kind === "state" && parsed.state.profiles[0].visits.JPN.notes,
    ).toBe(notes);
  });

  it("accepts a valid current backup", () => {
    expect(
      parseWorldMapImport({
        schemaVersion: 2,
        profiles: [profile],
        activeProfileId: profile.id,
        settings: {},
      }),
    ).toEqual({
      kind: "state",
      state: {
        schemaVersion: 2,
        profiles: [profile],
        activeProfileId: profile.id,
        settings: {},
      },
    });
  });

  it("migrates a structurally valid version-one backup", () => {
    const parsed = parseWorldMapImport({
      schemaVersion: 1,
      profiles: [
        {
          ...profile,
          visits: {
            JPN: { iso: "JPN", status: "lived" },
            FRA: { iso: "FRA", status: "wishlist" },
          },
        },
      ],
      activeProfileId: profile.id,
      settings: {},
    });

    expect(parsed?.kind).toBe("state");
    if (parsed?.kind === "state") {
      expect(parsed.state.profiles[0].visits).toEqual({
        JPN: { iso: "JPN", status: "visited" },
      });
    }
  });

  it("rejects malformed state instead of casting it into the store", () => {
    expect(
      parseWorldMapImport({
        schemaVersion: 2,
        profiles: [null],
        activeProfileId: "missing",
        settings: {},
      }),
    ).toBeNull();
  });

  it("rejects visit keys that do not match their ISO value", () => {
    expect(
      parseWorldMapImport({
        ...profile,
        visits: { JPN: { iso: "FRA", status: "visited" } },
      }),
    ).toBeNull();
  });

  it("rejects malformed notes and unsafe photos even without text length caps", () => {
    for (const patch of [
      { notes: {} },
      { photoDataUrl: "javascript:alert(1)" },
      { visitCount: -1 },
    ]) {
      expect(
        parseWorldMapImport({
          ...profile,
          visits: { JPN: { iso: "JPN", status: "visited", ...patch } },
        }),
      ).toBeNull();
    }
  });

  it("accepts more than twenty profiles, as the profile creator permits", () => {
    const profiles = Array.from({ length: 21 }, (_, index) => ({
      ...profile,
      id: `profile-${index}`,
    }));
    expect(
      parseWorldMapImport({
        schemaVersion: 2,
        profiles,
        activeProfileId: profiles[0].id,
        settings: {},
      })?.kind,
    ).toBe("state");
  });
});
