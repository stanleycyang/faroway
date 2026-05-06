import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import packageJson from "../../package.json";
import { isMissingSchemaMember } from "../../scripts/check-itinerary-streaming-schema";

describe("itinerary streaming schema diagnostics command", () => {
  it("is exposed as a package script with the web env file", () => {
    const command = packageJson.scripts["schema:itinerary-streaming"];

    expect(command).toBe(
      "bun --env-file .env scripts/check-itinerary-streaming-schema.ts",
    );
  });

  it("checks the streaming columns and merge RPC", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/check-itinerary-streaming-schema.ts"),
      "utf8",
    );

    expect(source).toContain("json_render_spec");
    expect(source).toContain("intermediate_results");
    expect(source).toContain("merge_intermediate_results");
    expect(source).toContain("randomUUID()");
  });

  it("classifies missing schema cache members", () => {
    expect(
      isMissingSchemaMember(
        {
          code: "42703",
          message:
            "column searches.intermediate_results does not exist in schema cache",
        },
        "intermediate_results",
      ),
    ).toBe(true);
    expect(
      isMissingSchemaMember(
        {
          code: "42501",
          message: "permission denied for table searches",
        },
        "intermediate_results",
      ),
    ).toBe(false);
  });
});
