import { afterEach, describe, expect, it, vi } from "vitest";
import { withBlogFallback } from "@/lib/blog/availability";

describe("withBlogFallback", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function unconfigured() {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VERCEL_ENV", "");
  }

  it("returns the fallback when the blog database is not configured locally", async () => {
    unconfigured();
    const read = vi.fn(async () => ["post"]);
    await expect(withBlogFallback(read, [])).resolves.toEqual([]);
    expect(read).not.toHaveBeenCalled();
  });

  it("throws when production is missing blog credentials", async () => {
    unconfigured();
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(withBlogFallback(async () => ["post"], [])).rejects.toThrow(
      /required in production/,
    );
  });

  it("rethrows query errors instead of serving an empty result", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("VERCEL_ENV", "");
    await expect(
      withBlogFallback(async () => {
        throw new Error("getAllPostMetas failed (503)");
      }, []),
    ).rejects.toThrow("503");
  });

  it("rethrows query errors in production too", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(
      withBlogFallback(async () => {
        throw new Error("getAllCategories failed (503)");
      }, []),
    ).rejects.toThrow("503");
  });
});
