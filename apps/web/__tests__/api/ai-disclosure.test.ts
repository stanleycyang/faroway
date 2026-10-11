import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { GET } from "@/app/api/ai/disclosure/route";
import {
  PLANNING_DISCLOSURE,
  PLANNING_MODEL,
  PLANNING_PROVIDER_OPTIONS,
} from "@/lib/ai/planning-disclosure";
const database = vi.hoisted(() => vi.fn());
const workflow = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/middleware", () => ({
  requireUserIdFromRequest: async () => ({ userId: "owner" }),
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabase: database }));
vi.mock("@/lib/workflow/runtime", () => ({ startWorkflow: workflow }));
vi.mock("@/workflows/plan-trip", () => ({ planTripWorkflow: vi.fn() }));
import { POST as search } from "@/app/api/search/start/route";
import { POST as generate } from "@/app/api/trips/[id]/generate/route";

describe("active planning disclosure", () => {
  it("serves current recipients without caching or unsupported policy promises", async () => {
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(PLANNING_DISCLOSURE);
    expect(PLANNING_DISCLOSURE.message).toContain(
      "Vercel AI Gateway and Google",
    );
    expect(PLANNING_MODEL).toBe("google/gemini-3-flash");
    expect(PLANNING_PROVIDER_OPTIONS.gateway.only).toEqual([
      "google",
      "vertex",
    ]);
  });
  it.each(["old-version", ""])(
    "rejects missing/stale consent before dispatch (%s)",
    async (version) => {
      const request = () =>
        new NextRequest("https://example.test/api", {
          method: "POST",
          headers: version ? { "x-faroway-ai-disclosure": version } : {},
        });
      expect((await search(request())).status).toBe(409);
      expect(
        (await generate(request(), { params: Promise.resolve({ id: "trip" }) }))
          .status,
      ).toBe(409);
      expect(database).not.toHaveBeenCalled();
      expect(workflow).not.toHaveBeenCalled();
    },
  );
  it("binds every active AI agent to the disclosed model and recipient allowlist", () => {
    for (const name of [
      "orchestrator",
      "hotels",
      "activities",
      "dining",
      "aggregator",
    ]) {
      const source = readFileSync(`lib/search/agents/${name}.ts`, "utf8");
      expect(source).toContain("const MODEL = PLANNING_MODEL");
      expect(source).toContain("providerOptions: PLANNING_PROVIDER_OPTIONS");
    }
  });
});
