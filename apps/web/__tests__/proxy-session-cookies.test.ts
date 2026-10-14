import { NextRequest } from "next/server";
import { afterEach, expect, test, vi } from "vitest";
const state = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { setAll: (cookies: unknown[]) => void } },
  ) => ({
    auth: {
      getUser: async () => {
        options.cookies.setAll([
          {
            name: "fixture-session",
            value: state.user ? "refreshed" : "",
            options: {
              httpOnly: true,
              secure: true,
              sameSite: "lax",
              path: "/",
              maxAge: state.user ? 3600 : 0,
            },
          },
        ]);
        return { data: { user: state.user }, error: null };
      },
    },
  }),
}));
import { proxy } from "../proxy";
afterEach(() => {
  vi.unstubAllEnvs();
  state.user = null;
});
test.each([
  {
    user: { id: "owner-a" },
    path: "/auth/login?redirectTo=%2Fcreate",
    destination: "/create",
    value: "refreshed",
  },
  {
    user: null,
    path: "/trips/trip-a?view=days",
    destination: "/auth/login",
    value: "",
  },
])(
  "auth redirect retains refreshed cookie: $path",
  async ({ user, path, destination, value }) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.example.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fixture-anonymous");
    state.user = user;
    const response = await proxy(
      new NextRequest(`https://faroway.example.test${path}`),
    );
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe(destination);
    if (!user)
      expect(location.searchParams.get("redirectTo")).toBe(
        "/trips/trip-a?view=days",
      );
    expect(response.cookies.get("fixture-session")?.value).toBe(value);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  },
);
