import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createServerClient } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient,
}));

import { proxy } from "../proxy";

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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

  it("does not create a Supabase client when public env is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/destinations/popular",
    );

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("still protects authenticated pages when public env is missing", async () => {
    const request = new NextRequest("http://localhost:3000/dashboard");

    const response = await proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/login?redirectTo=%2Fdashboard",
    );
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("preserves protected-route search parameters through login", async () => {
    const request = new NextRequest(
      "http://localhost:3000/dashboard?filter=past&sort=date-asc",
    );

    const response = await proxy(request);

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/auth/login?redirectTo=%2Fdashboard%3Ffilter%3Dpast%26sort%3Ddate-asc",
    );
  });

  it("does not protect an unrelated route with the same prefix", async () => {
    const request = new NextRequest("http://localhost:3000/dashboard-preview");

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
