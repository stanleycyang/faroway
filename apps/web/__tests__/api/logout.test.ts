import { expect, it, vi } from "vitest";

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
