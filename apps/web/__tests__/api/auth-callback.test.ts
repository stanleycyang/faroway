import { afterEach, expect, test, vi } from "vitest";
const { exchange } = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: exchange } }),
}));
import { GET } from "../../app/auth/callback/route";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
test("successful callback keeps the request origin despite an untrusted forwarded host", async () => {
  vi.stubEnv("NODE_ENV", "production");
  exchange.mockResolvedValue({ error: null });
  const response = await GET(
    new Request(
      "https://faroway.example/auth/callback?code=synthetic&next=%2Fcreate%3Fdestination%3Dparis",
      { headers: { "x-forwarded-host": "untrusted.example" } },
    ),
  );
  expect(response.headers.get("location")).toBe(
    "https://faroway.example/create?destination=paris",
  );
});
test("cancelled callback keeps the safe destination for retry", async () => {
  const response = await GET(
    new Request(
      "https://faroway.example/auth/callback?error=access_denied&next=%2Ftrips%2Fsynthetic",
    ),
  );
  const url = new URL(response.headers.get("location")!);
  expect(url.origin).toBe("https://faroway.example");
  expect(url.searchParams.get("error")).toBe("auth_cancelled");
  expect(url.searchParams.get("redirectTo")).toBe("/trips/synthetic");
  expect(exchange).not.toHaveBeenCalled();
});

test("stalled callback recovers at the auth deadline and keeps its destination", async () => {
  vi.useFakeTimers();
  let release!: (value: { error: null }) => void;
  exchange.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  let response: Response | undefined;
  const pending = GET(
    new Request(
      "https://faroway.example/auth/callback?code=synthetic&next=%2Fcreate%3Fdestination%3Dparis",
    ),
  ).then((value) => {
    response = value;
  });
  await vi.advanceTimersByTimeAsync(20_001);
  expect(response).toBeDefined();
  const location = response!.headers.get("location");
  const url = new URL(location!);
  expect(url.pathname).toBe("/auth/login");
  expect(url.searchParams.get("error")).toBe("auth_timeout");
  expect(url.searchParams.get("redirectTo")).toBe("/create?destination=paris");
  await pending;
  release({ error: null });
  await Promise.resolve();
  expect(response!.headers.get("location")).toBe(location);
});
