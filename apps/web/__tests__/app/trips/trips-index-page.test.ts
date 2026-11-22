import { beforeEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((target: string) => {
    throw new Error(`NEXT_REDIRECT:${target}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import TripsIndexPage from "@/app/(app)/trips/page";

describe("TripsIndexPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects /trips without query params to /dashboard", async () => {
    await expect(
      TripsIndexPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("preserves single and repeated query params such as ?duffel=return", async () => {
    await expect(
      TripsIndexPage({
        searchParams: Promise.resolve({
          duffel: "return",
          click_id: "clk_123",
          tag: ["a", "b"],
        }),
      }),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard?duffel=return&click_id=clk_123&tag=a&tag=b",
    );
  });
});
