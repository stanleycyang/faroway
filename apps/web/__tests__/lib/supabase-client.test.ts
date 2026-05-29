import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserClient } = vi.hoisted(() => ({
  createBrowserClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient,
}));

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe("browser Supabase client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalSupabaseUrl) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }

    if (originalSupabaseAnonKey) {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
  });

  it("returns unauthenticated auth methods when public env is missing", async () => {
    const { createClient } = await import("@faroway/supabase/client");

    const supabase = createClient();
    const session = await supabase.auth.getSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {});

    expect(session).toEqual({ data: { session: null }, error: null });
    expect(subscription).toHaveProperty("unsubscribe");
    expect(createBrowserClient).not.toHaveBeenCalled();
  });

  it("creates a browser client when public env is configured", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const browserClient = { auth: {} };
    createBrowserClient.mockReturnValueOnce(browserClient);

    const { createClient } = await import("@faroway/supabase/client");

    expect(createClient()).toBe(browserClient);
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://supabase.test",
      "anon-key",
    );
  });
});
