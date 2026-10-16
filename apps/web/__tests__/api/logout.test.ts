import { afterEach, expect, it, vi } from "vitest";

const { signOut } = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { signOut } }),
}));

import { POST } from "@/app/auth/logout/route";

it("signs out before redirecting a form submission to the existing login page", async () => {
  const response = await POST(
    new Request("https://staging.example.com/auth/logout", { method: "POST" }),
  );

  expect(signOut).toHaveBeenCalledOnce();
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(
    "https://staging.example.com/auth/login",
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
it.each(["error", "rejection", "timeout"])(
  "offers honest sign-out recovery after %s",
  async (kind) => {
    vi.useFakeTimers();
    if (kind === "error")
      signOut.mockResolvedValueOnce({
        error: new Error("Provider unavailable"),
      });
    if (kind === "rejection")
      signOut.mockRejectedValueOnce(new Error("Offline"));
    if (kind === "timeout") signOut.mockReturnValueOnce(new Promise(() => {}));
    const pending = POST(
      new Request("https://staging.example.com/auth/logout", {
        method: "POST",
      }),
    );
    await vi.advanceTimersByTimeAsync(20000);
    const response = await pending;
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://staging.example.com/auth/logout-error",
    );
  },
);
