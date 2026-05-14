import { describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/affiliate/click/route";

describe("/api/affiliate/click legacy route", () => {
  it("returns a deprecated response for POST requests", async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toEqual({
      error: "Deprecated endpoint",
      code: "DEPRECATED_ENDPOINT",
      replacement: "/api/track/click",
    });
  });

  it("returns a deprecated response for GET requests", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body).toEqual({
      error: "Deprecated endpoint",
      code: "DEPRECATED_ENDPOINT",
      replacement: "/api/track/click",
    });
  });
});
