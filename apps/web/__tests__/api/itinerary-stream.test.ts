import { describe, expect, it, vi } from "vitest";
const dispatch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/search/workflow", () => ({ executeTravelSearch: dispatch }));
import { POST } from "@/app/api/itinerary/stream/route";
describe("retired legacy stream", () => {
  it.each([undefined, "Bearer synthetic"])(
    "never dispatches billable planning (%s)",
    async (authorization) => {
      const response = await POST(
        new Request("https://test.invalid/api/itinerary/stream", {
          method: "POST",
          headers: authorization ? { authorization } : {},
          body: JSON.stringify({ destination: "Paris" }),
        }),
      );
      expect(response.status).toBe(410);
      expect(dispatch).not.toHaveBeenCalled();
    },
  );
});
