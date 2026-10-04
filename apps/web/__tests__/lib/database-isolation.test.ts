import { describe, expect, it } from "vitest";
import { assertDatabaseIsolation } from "@/lib/config/database-isolation";
const staging = "abcdefghijklmnopqrst";
describe("Vercel database isolation", () => {
  it.each(["preview", "development"])(
    "blocks production and unapproved targets in %s",
    (VERCEL_ENV) => {
      for (const env of [
        {},
        {
          NEXT_PUBLIC_SUPABASE_URL: "https://jcnephijkxgtprsutgsf.supabase.co",
          FAROWAY_STAGING_SUPABASE_PROJECT_REF: "jcnephijkxgtprsutgsf",
        },
        { NEXT_PUBLIC_SUPABASE_URL: `https://${staging}.supabase.co` },
        {
          NEXT_PUBLIC_SUPABASE_URL: "https://jcnephijkxgtprsutgsf.supabase.co",
          FAROWAY_STAGING_SUPABASE_PROJECT_REF: staging,
        },
        {
          NEXT_PUBLIC_SUPABASE_URL: `https://${staging}.supabase.co.evil.example`,
          FAROWAY_STAGING_SUPABASE_PROJECT_REF: staging,
        },
        {
          NEXT_PUBLIC_SUPABASE_URL: `https://${staging}.supabase.co?credential=redacted`,
          FAROWAY_STAGING_SUPABASE_PROJECT_REF: staging,
        },
      ])
        expect(() => assertDatabaseIsolation({ VERCEL_ENV, ...env })).toThrow();
    },
  );
  it("accepts only an explicitly matched isolated target", () => {
    expect(() =>
      assertDatabaseIsolation({
        VERCEL_ENV: "preview",
        NEXT_PUBLIC_SUPABASE_URL: `https://${staging}.supabase.co`,
        FAROWAY_STAGING_SUPABASE_PROJECT_REF: staging,
      }),
    ).not.toThrow();
  });
  it("leaves production and local synthetic tests unchanged", () => {
    expect(() =>
      assertDatabaseIsolation({ VERCEL_ENV: "production" }),
    ).not.toThrow();
    expect(() => assertDatabaseIsolation({})).not.toThrow();
  });
});
