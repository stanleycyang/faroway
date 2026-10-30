import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { IMAGE_PATHS } from "../../packages/constants/src/images";
import { runSmoke } from "../uat/lib/smoke-runner";
import { evaluateSavedPlan } from "../uat/lib/plan-quality";
import {
  PRODUCTION_PROJECT_REF,
  STAGING_PROJECT_REF,
} from "../uat/lib/staging-project";

const root = resolve(import.meta.dirname, "../..");
const stagingUrl = `https://${STAGING_PROJECT_REF}.supabase.co`;
const apiUrl = "https://staging.example";

function anon(ref: string): string {
  const payload = Buffer.from(JSON.stringify({ ref, role: "anon" })).toString(
    "base64url",
  );
  return `header.${payload}.sig`;
}

function response(
  status: number,
  data: unknown,
  contentType = "application/json",
) {
  return new Response(data == null ? null : JSON.stringify(data), {
    status,
    headers: { "content-type": contentType },
  });
}

describe("UAT smoke suite", () => {
  test("catalog still has the 79 public images", () => {
    const paths = [
      ...new Set(
        Object.values(IMAGE_PATHS).flatMap((group) => Object.values(group)),
      ),
    ];
    expect(paths).toHaveLength(79);
  });

  test("refuses production and unknown projects before any request", async () => {
    const fetchImpl = () => {
      throw new Error("network");
    };
    await expect(
      runSmoke({
        tiers: [0],
        target: {
          supabaseUrl: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
        },
        fetchImpl,
      }),
    ).rejects.toThrow(/production/);
    await expect(
      runSmoke({
        tiers: [0],
        target: { supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co" },
        fetchImpl,
      }),
    ).rejects.toThrow(/not staging/);
    await expect(
      runSmoke({ tiers: [0], target: {}, fetchImpl }),
    ).rejects.toThrow(/no Supabase project ref/);
  });

  test("dry-run does not call the network", async () => {
    const report = await runSmoke({
      tiers: [0, 1, 2],
      dryRun: true,
      target: { supabaseUrl: stagingUrl },
      fetchImpl: () => {
        throw new Error("network");
      },
    });
    expect(report.ok).toBe(true);
    expect(report.projectRef).toBe(STAGING_PROJECT_REF);
    expect(
      report.checks.some(
        (item) => item.name === "health" && item.status === "planned",
      ),
    ).toBe(true);
    expect(
      report.checks.some(
        (item) => item.name === "getyourguide" && item.status === "skipped",
      ),
    ).toBe(true);
  });

  test("tier 0 uses the injected fetch and only the staging host", async () => {
    const urls: string[] = [];
    let patches = 0;
    let shared = true;
    const owner = "Bearer a@faroway-test.invalid";
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      urls.push(url);
      expect(url).not.toContain(PRODUCTION_PROJECT_REF);
      if (url.endsWith("/api/health")) return response(200, { status: "ok" });
      if (url.includes("/api/destinations/popular"))
        return response(200, { destinations: [{ name: "Lisbon" }] });
      if (
        url.endsWith("/api/trips") &&
        (!init?.method || init.method === "GET")
      )
        return response(401, { error: "unauthorized" });
      if (url.endsWith("/api/cron/cleanup")) return response(401, {});
      if (url.includes("/api/places/venues"))
        return response(501, {
          error: "Live place references are not available yet.",
        });
      if (url.includes("/api/weather"))
        return response(200, { status: "disabled" });
      if (url.includes("/storage/v1/object/public/images/"))
        return response(200, null, "image/jpeg");
      if (url.includes("tile.openstreetmap.org"))
        return response(200, null, "image/png");
      if (url.includes("/auth/v1/token")) {
        const body = JSON.parse(String(init?.body)) as { email: string };
        return response(200, { access_token: body.email });
      }
      if (url.includes("/generate"))
        return response(409, { code: "ai_consent_required" });
      if (url.endsWith("/api/trips") && init?.method === "POST")
        return response(201, { trip: { id: "trip-1", updated_at: "t0" } });
      if (url.includes("/rest/v1/trips")) return response(200, []);
      if (url.endsWith("/share") && init?.method === "POST")
        return response(200, { shareUrl: `${apiUrl}/share/token` });
      if (url.endsWith("/share") && init?.method === "DELETE") {
        shared = false;
        return response(200, {});
      }
      if (url.endsWith("/share/token")) return response(shared ? 200 : 404, {});
      if (url.includes("/api/trips/trip-1")) {
        if (headers.get("authorization") !== owner) return response(404, {});
        if (init?.method === "PATCH") {
          patches += 1;
          return response(patches === 1 ? 200 : 409, {
            trip: { updated_at: "t1" },
          });
        }
        if (init?.method === "DELETE") return response(200, {});
        return response(200, { trip: { id: "trip-1", updated_at: "t0" } });
      }
      return response(404, {});
    };
    const report = await runSmoke({
      tiers: [0],
      target: {
        supabaseUrl: stagingUrl,
        apiUrl,
        anonKey: anon(STAGING_PROJECT_REF),
      },
      accounts: [
        { email: "a@faroway-test.invalid", password: "secret-a" },
        { email: "b@faroway-test.invalid", password: "secret-b" },
      ],
      fetchImpl: fetchImpl as typeof fetch,
      imagePaths: ["destinations/lisbon.jpg"],
      expectedImageCount: 1,
      repoRoot: root,
    });
    const failed = report.checks.filter(
      (item) => item.status === "failed" || item.status === "blocked",
    );
    expect(failed).toEqual([]);
    expect(report.ok).toBe(true);
    expect(urls.some((url) => url.includes(STAGING_PROJECT_REF))).toBe(true);
  });

  test("tier 1 blocks sandbox checks without sandbox credentials", async () => {
    const report = await runSmoke({
      tiers: [1],
      target: { projectRef: STAGING_PROJECT_REF },
      env: { DUFFEL_API_TOKEN: "duffel_live_secret" },
      fetchImpl: () => {
        throw new Error("network");
      },
    });
    expect(
      report.checks.find((item) => item.name === "duffel-test")?.status,
    ).toBe("blocked");
    expect(
      report.checks.find((item) => item.name === "viator-sandbox")?.status,
    ).toBe("blocked");
    expect(
      report.checks.find((item) => item.name === "getyourguide")?.status,
    ).toBe("skipped");
  });

  test("tier 2 is not dispatched unless --live is set", async () => {
    const report = await runSmoke({
      tiers: [2],
      target: { supabaseUrl: stagingUrl },
      fetchImpl: () => {
        throw new Error("network");
      },
    });
    expect(report.ok).toBe(false);
    expect(report.checks[0]?.detail).toContain("--live");
  });

  test("saved-plan quality rejects the aggregator fallback template and invented links", () => {
    const good = evaluateSavedPlan(
      {
        trip: { status: "planned" },
        itinerary: {
          days: ["2026-12-07", "2026-12-08", "2026-12-09"].map(
            (date, index) => ({
              dayNumber: index + 1,
              date,
              title: `Lisbon ${index + 1}`,
              summary: "A specific day",
              morning: {
                activities: [{ name: "Market" }],
                meal: { name: "Coffee" },
              },
              afternoon: { activities: [{ name: "Castle" }] },
              evening: { meal: { name: "Dinner" } },
            }),
          ),
        },
      },
      { startDate: "2026-12-07", endDate: "2026-12-09" },
    );
    expect(good.ok).toBe(true);
    const fallback = evaluateSavedPlan(
      {
        trip: { status: "planned" },
        itinerary: {
          days: [
            {
              dayNumber: 1,
              date: "2026-12-07",
              title: "Day 1 in Lisbon",
              summary: "Explore Lisbon with a mix of activities and dining.",
              morning: {
                activities: [{ name: "Walk" }],
                meal: { name: "Cafe" },
              },
              afternoon: { activities: [] },
              evening: {
                meal: {
                  name: "Dinner",
                  reservationUrl: "https://opentable.com/r/invented",
                },
              },
            },
          ],
        },
      },
      { startDate: "2026-12-07", endDate: "2026-12-07" },
    );
    expect(fallback.ok).toBe(false);
    expect(fallback.reservationUrls).toHaveLength(1);
    expect(fallback.failures.join(" ")).toContain("fallback template");
  });
});

describe("UAT smoke CLI", () => {
  test("dry-run against staging exits 0 and production exits non-zero", () => {
    const dry = spawnSync(
      process.execPath,
      [
        "scripts/uat/smoke.ts",
        "--dry-run",
        "--tier",
        "0,1,2",
        "--supabase-url",
        stagingUrl,
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: { PATH: process.env.PATH, HOME: process.env.HOME },
      },
    );
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain("PLANNED T0 health");
    const prod = spawnSync(
      process.execPath,
      [
        "scripts/uat/smoke.ts",
        "--dry-run",
        "--supabase-url",
        `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: { PATH: process.env.PATH, HOME: process.env.HOME },
      },
    );
    expect(prod.status).not.toBe(0);
    expect(`${prod.stdout}\n${prod.stderr}`).toContain("production");
  });
});
