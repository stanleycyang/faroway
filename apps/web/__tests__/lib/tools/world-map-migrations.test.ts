import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  migrate,
  CURRENT_SCHEMA_VERSION,
} from "@/lib/tools/world-map/migrations";

describe("migrate", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it("is a no-op when the persisted schema matches current", () => {
    const state = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      profiles: [],
      activeProfileId: "",
      settings: { theme: "classic", showLegend: true, quickPin: false },
    };
    const result = migrate(state);
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.profiles).toEqual([]);
  });

  it("resets to an empty state (not throws) for non-object input", () => {
    const result = migrate(null);
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.profiles).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("resets to an empty state when no migration path exists", () => {
    const result = migrate({ schemaVersion: 0, profiles: [] });
    expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.profiles).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });
});
