import { describe, expect, test } from "bun:test";
import {
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
  StagingGuardError,
  assertStagingTarget,
  projectRefFromAnonKey,
} from "../uat/lib/staging-project";

const stagingUrl = `https://${STAGING_PROJECT_REF}.supabase.co`;
const productionUrl = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;

function anon(ref: string): string {
  const payload = Buffer.from(JSON.stringify({ ref, role: "anon" })).toString(
    "base64url",
  );
  return `header.${payload}.sig`;
}

describe("staging project guard", () => {
  test("accepts the staging project ref, URL and anon key together", () => {
    expect(
      assertStagingTarget({
        supabaseUrl: stagingUrl,
        projectRef: STAGING_PROJECT_REF,
        anonKey: anon(STAGING_PROJECT_REF),
        apiUrl: "https://staging.example",
      }).projectRef,
    ).toBe(STAGING_PROJECT_REF);
  });

  test("refuses production from the URL", () => {
    expect(() => assertStagingTarget({ supabaseUrl: productionUrl })).toThrow(
      /production/,
    );
  });

  test("refuses a production ref hidden in the anon key", () => {
    try {
      assertStagingTarget({
        supabaseUrl: stagingUrl,
        anonKey: anon(PRODUCTION_PROJECT_REF),
      });
      throw new Error("expected refusal");
    } catch (error) {
      expect(error).toBeInstanceOf(StagingGuardError);
      expect((error as StagingGuardError).code).toBe("production");
    }
  });

  test("refuses an unknown project and a missing target", () => {
    expect(() =>
      assertStagingTarget({
        supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co",
      }),
    ).toThrow(/not staging/);
    expect(() => assertStagingTarget({})).toThrow(/no Supabase project ref/);
    expect(projectRefFromAnonKey("not-a-jwt")).toBe(null);
  });

  test("refuses a non-supabase host", () => {
    expect(() =>
      assertStagingTarget({ supabaseUrl: "https://example.com" }),
    ).toThrow(/not a recognized project host/);
  });
});
