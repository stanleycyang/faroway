import { expect, test } from "bun:test";
import { assertQaApiReachable } from "../mobile-qa-health.mjs";

test("accepts the native app's direct healthy API response without following redirects", async () => {
  await assertQaApiReachable("https://qa.example", async (url, options) => {
    expect(url).toBe("https://qa.example/api/health");
    expect(options.redirect).toBe("manual");
    expect(options.signal).toBeInstanceOf(AbortSignal);
    return Response.json({ status: "ok" });
  });
});

test.each([
  [302, "text/plain", "Redirecting"],
  [401, "text/html", "Sign in"],
  [200, "text/html", "Sign in"],
  [503, "application/json", '{"status":"ok"}'],
  [200, "application/json", '{"status":"unhealthy"}'],
  [200, "application/json", "invalid JSON"],
])(
  "rejects unusable native API responses: %s %s %s",
  async (status, type, body) => {
    await expect(
      assertQaApiReachable(
        "https://qa.example",
        async () =>
          new Response(body, { status, headers: { "content-type": type } }),
      ),
    ).rejects.toThrow();
  },
);

test("fails closed when the API is unreachable", async () => {
  await expect(
    assertQaApiReachable("https://qa.example", async () => {
      throw new Error("network unavailable");
    }),
  ).rejects.toThrow("network unavailable");
});
