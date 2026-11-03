import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { GET } from "@/app/api/ai/disclosure/route";
import {
  PLANNING_DISCLOSURE,
  PLANNING_MODEL,
  PLANNING_PROVIDER_OPTIONS,
  currentPlanningDisclosure,
  isStalePlanningDisclosure,
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
  afterEach(() => vi.unstubAllEnvs());
  it("discloses Parallel and rejects Google-only consent when the source experiment is enabled", async () => {
    const env = {
      FAROWAY_DINING_SOURCE_EXPERIMENT: "public-review-v1",
      FAROWAY_SCHEDULE_EXPERIMENT: "compiled-narrated-v1",
      PLANNING_THINKING_AGGREGATOR: "minimal",
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: "https://omovikloadpvzijoaqus.supabase.co",
      AI_GATEWAY_API_KEY: "synthetic-key",
    };
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const disclosure = await (await GET()).json();
    expect(disclosure.version).toBe("planning-google-parallel-v1");
    expect(disclosure.message).toContain(
      "meal type to Parallel through Vercel AI Gateway",
    );
    expect(disclosure.message).toContain(
      "Retrieved pages are processed by Google",
    );
    const request = () =>
      new NextRequest("https://example.test/api", {
        method: "POST",
        headers: { "x-faroway-ai-disclosure": "planning-google-v1" },
      });
    expect((await search(request())).status).toBe(409);
    expect(
      (await generate(request(), { params: Promise.resolve({ id: "trip" }) }))
        .status,
    ).toBe(409);
    expect(database).not.toHaveBeenCalled();
    expect(workflow).not.toHaveBeenCalled();
    expect(
      isStalePlanningDisclosure(
        new Headers({ "x-faroway-ai-disclosure": disclosure.version }),
      ),
    ).toBe(false);
    expect(
      currentPlanningDisclosure({ ...env, VERCEL_ENV: "production" }),
    ).toEqual(PLANNING_DISCLOSURE);
    expect(
      currentPlanningDisclosure({ ...env, AI_GATEWAY_API_KEY: "" }),
    ).toEqual(PLANNING_DISCLOSURE);
    expect(
      currentPlanningDisclosure({
        ...env,
        FAROWAY_DINING_SOURCE_EXPERIMENT: "",
      }),
    ).toEqual(PLANNING_DISCLOSURE);
  });
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
