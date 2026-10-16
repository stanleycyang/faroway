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
  it("preserves filters and sorting in the return path through sign-in", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/dashboard?filter=upcoming&sort=date-asc",
      ),
    );
    expect(
      new URL(response.headers.get("location")!).searchParams.get("redirectTo"),
    ).toBe("/dashboard?filter=upcoming&sort=date-asc");
  });
  it("keeps the selected destination when canonicalizing a legacy trip link", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/trips/new?destination=paris"),
    );
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/create?destination=paris",
    );
  });
});
