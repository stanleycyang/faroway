import { expect, it, vi } from "vitest";
const dispatch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/search/workflow", () => ({ executeTravelSearch: dispatch }));
import { POST } from "@/app/api/itinerary/route";
it("retires unauthenticated synchronous planning without provider dispatch", async () => {
  expect(
    (
      await POST(
        new Request("https://test.invalid/api/itinerary", { method: "POST" }),
      )
    ).status,
  ).toBe(410);
  expect(dispatch).not.toHaveBeenCalled();
});
