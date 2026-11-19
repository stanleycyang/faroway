import { dayTimingBasis } from "../../packages/types/src/day-timing";
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { IMAGE_PATHS } from "../../packages/constants/src/images";
import { runSmoke } from "../uat/lib/smoke-runner";
import { evaluateSavedPlan } from "../uat/lib/plan-quality";
import deployedNarrationFallback from "../fixtures/agentic-deployed-narration-fallback.json";
import liveLisbonMealGaps from "../fixtures/live-lisbon-meal-gaps.json";
import liveTokyoBackup from "../fixtures/live-tokyo-backup-draft.json";
import { buildLiteApiFlightRequest } from "../../apps/web/lib/affiliates/liteapi-flight-request";
import {
  PRODUCTION_PROJECT_REF,
  STAGING_PREVIEW_API_URL,
  STAGING_PROJECT_REF,
} from "../uat/lib/staging-project";

const root = resolve(import.meta.dirname, "../..");
const stagingUrl = `https://${STAGING_PROJECT_REF}.supabase.co`;
const apiUrl = STAGING_PREVIEW_API_URL;

test("rejects the retained Tokyo backup draft despite complete dates and meal slots", () => {
  const result = evaluateSavedPlan(liveTokyoBackup.body, {
    startDate: "2026-12-07",
    endDate: "2026-12-09",
    requireFullDayMeals: true,
  });
  expect(result.ok).toBe(false);
  expect(result.failures).toContain(
    "3 day(s) use an aggregator fallback template or unavailable narration",
  );
});

test("a structural pass cannot certify an invented itinerary as traveler quality", () => {
  const date = "2027-01-11";
  const result = evaluateSavedPlan(
    {
      trip: { status: "planned" },
      itinerary: {
        days: [
          {
            date,
            title: "A wonderful day",
            morning: {
              activities: [{ name: "Invented Museum on Mars" }],
              meal: { name: "Imaginary Restaurant" },
            },
            afternoon: { meal: { name: "Imaginary Restaurant" } },
            evening: { meal: { name: "Imaginary Restaurant" } },
          },
        ],
      },
    },
    { startDate: date, endDate: date, requireFullDayMeals: true },
  );
  // Names cannot prove existence. Keep this limitation visible rather than
  // teaching the grader to reject only this particular fictional venue name.
  expect(result.ok).toBe(true);
  expect(result.scope).toBe("saved-plan-contracts");
  expect(result.travelerQuality).toBe("not_evaluated");
  expect(result.notes.join(" ")).toContain("traveler usefulness");
});

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
    await expect(
      runSmoke({
        tiers: [0],
        target: { supabaseUrl: stagingUrl, apiUrl: "https://www.faroway.ai" },
        fetchImpl,
      }),
    ).rejects.toThrow(/production app/);
    await expect(
      runSmoke({
        tiers: [0],
        target: { supabaseUrl: stagingUrl, apiUrl: "https://faroway.ai/api" },
        fetchImpl,
      }),
    ).rejects.toThrow(/production app/);
    await expect(
      runSmoke({
        tiers: [0],
        target: { supabaseUrl: stagingUrl, apiUrl: "https://evil.example" },
        fetchImpl,
      }),
    ).rejects.toThrow(/not a staging deployment/);
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

  test.each([false, true])(
    "tier 0 isolates requests and reports cleanup once (foreign share: %s)",
    async (foreignShare) => {
      const urls: string[] = [];
      let patches = 0;
      let shared = true;
      const owner = "Bearer a@faroway-test.invalid";
      const fetchImpl = async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => {
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
          return response(200, {
            shareUrl: `${foreignShare ? "https://www.faroway.ai" : apiUrl}/share/token`,
          });
        if (url.endsWith("/share") && init?.method === "DELETE") {
          shared = false;
          return response(200, {});
        }
        if (url.endsWith("/share/token"))
          return response(shared ? 200 : 404, {});
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
      expect(failed.map((item) => item.name)).toEqual(
        foreignShare ? ["share-revoke"] : [],
      );
      expect(report.ok).toBe(!foreignShare);
      expect(report.checks.filter((item) => item.name === "cleanup")).toEqual([
        expect.objectContaining({ name: "cleanup", status: "passed" }),
      ]);
      expect(urls.some((url) => url.startsWith("https://www.faroway.ai"))).toBe(
        false,
      );
      expect(urls.some((url) => url.includes(STAGING_PROJECT_REF))).toBe(true);
    },
  );

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

  test("HTTP 5xx fails the check", async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/health")) return response(500, { status: "ok" });
      if (url.includes("/api/destinations/popular"))
        return response(200, { destinations: [] });
      if (url.endsWith("/api/trips")) return response(401, {});
      if (url.endsWith("/api/cron/cleanup")) return response(401, {});
      if (url.includes("/api/places/venues"))
        return response(500, { error: "upstream" });
      if (url.includes("/api/weather"))
        return response(503, { status: "available" });
      return response(200, null, "image/jpeg");
    };
    const report = await runSmoke({
      tiers: [0],
      target: {
        supabaseUrl: stagingUrl,
        apiUrl,
        anonKey: anon(STAGING_PROJECT_REF),
      },
      env: {
        FAROWAY_UAT_PLACES_LIVE: "1",
        FAROWAY_UAT_MET_ENABLED: "1",
      },
      fetchImpl: fetchImpl as typeof fetch,
      imagePaths: ["destinations/lisbon.jpg"],
      expectedImageCount: 1,
      repoRoot: root,
    });
    expect(report.ok).toBe(false);
    for (const name of ["health", "places", "weather"]) {
      const item = report.checks.find((check) => check.name === name);
      expect(item?.status).toBe("failed");
      expect(item?.detail).toMatch(/^HTTP 5/);
    }
    expect(
      report.checks.find((check) => check.name === "places")?.status,
    ).not.toBe("skipped");
  });

  test("LiteAPI flight probe posts legs and does not treat a sandbox flag as success", async () => {
    let body: Record<string, unknown> | undefined;
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/flights/rates")) {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return response(200, { sandbox: true });
      }
      if (url.endsWith("/hotels/rates"))
        return response(500, { sandbox: true });
      return response(200, { data: [] });
    };
    const failed = await runSmoke({
      tiers: [1],
      target: { projectRef: STAGING_PROJECT_REF },
      env: {
        LITEAPI_SANDBOX_ENABLED: "true",
        LITEAPI_FLIGHTS_SANDBOX_ENABLED: "true",
        LITEAPI_API_KEY: "sand_uat_test_key",
      },
      fetchImpl: fetchImpl as typeof fetch,
    });
    const legs = body?.legs as Array<Record<string, unknown>> | undefined;
    expect(legs?.[0]).toMatchObject({
      origin: "LIS",
      destination: "OPO",
      direction: "OUTBOUND",
    });
    expect(body).not.toHaveProperty("origin");
    expect(body).not.toHaveProperty("departureDate");
    expect(body).toEqual(
      buildLiteApiFlightRequest({
        origin: "LIS",
        destination: "OPO",
        departureDate: String(legs?.[0]?.date),
        adults: 1,
        childAges: [],
        currency: "USD",
      }),
    );
    expect(
      failed.checks.find((item) => item.name === "liteapi-flights-sandbox")
        ?.status,
    ).toBe("failed");
    expect(
      failed.checks.find((item) => item.name === "liteapi-hotels-sandbox"),
    ).toMatchObject({ status: "failed", detail: "HTTP 500" });

    const passed = await runSmoke({
      tiers: [1],
      target: { projectRef: STAGING_PROJECT_REF },
      env: {
        LITEAPI_FLIGHTS_SANDBOX_ENABLED: "true",
        LITEAPI_API_KEY: "sand_uat_test_key",
      },
      fetchImpl: (async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/flights/rates"))
          return response(502, { data: [] });
        return response(200, { data: [{ journeys: [] }] });
      }) as typeof fetch,
    });
    expect(
      passed.checks.find((item) => item.name === "liteapi-flights-sandbox"),
    ).toMatchObject({ status: "failed", detail: "HTTP 502" });
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

  test("rejects the deployed compiled-narration failure that previously passed smoke", () => {
    const dates = { startDate: "2026-12-07", endDate: "2026-12-09" };
    const result = evaluateSavedPlan(deployedNarrationFallback.body, dates);
    expect(result.ok).toBe(false);
    expect(result.failures).toContain(
      "3 day(s) use an aggregator fallback template or unavailable narration",
    );
    const mixed = structuredClone(deployedNarrationFallback.body);
    for (const day of mixed.itinerary.days) {
      day.title = "A specific cultural day";
      day.summary = "Visit the stops selected for this date.";
    }
    // A failure tip must still fail even if other titles are customized.
    expect(evaluateSavedPlan(mixed, dates).ok).toBe(false);
    for (const day of mixed.itinerary.days) {
      day.tips = day.tips.filter(
        (tip) =>
          !tip.startsWith("The day descriptions could not be generated."),
      );
    }
    // Ordinary uncertainty tips do not by themselves mean model fallback.
    expect(evaluateSavedPlan(mixed, dates).ok).toBe(true);
    mixed.itinerary.days[1] = structuredClone(
      deployedNarrationFallback.body.itinerary.days[1],
    );
    expect(evaluateSavedPlan(mixed, dates).ok).toBe(false);
  });

  test("rejects saved timing notes when persistence dropped the structured proposal", () => {
    const body = structuredClone(deployedNarrationFallback.body);
    body.itinerary.days[0].tips = [
      "The selected visits do not fit the proposed meal and buffer windows. No times are published.",
    ];
    expect(
      evaluateSavedPlan(body, {
        startDate: "2026-12-07",
        endDate: "2026-12-09",
      }).failures,
    ).toContain(
      `${body.itinerary.days[0].title} has timing notes without a timing proposal`,
    );
  });

  test("live batches stop after a failed workflow or saved fallback until spend is reconciled", async () => {
    for (const failure of ["workflow", "fallback", "transport"] as const) {
      let created = 0;
      let dispatched = 0;
      let removed = 0;
      const fetchImpl = async (
        input: RequestInfo | URL,
        init?: RequestInit,
      ) => {
        const url = String(input);
        if (url.includes("/auth/v1/token"))
          return response(200, { access_token: "synthetic-test-token" });
        if (url.endsWith("/api/trips") && init?.method === "POST") {
          created += 1;
          return response(201, { trip: { id: "synthetic-trip" } });
        }
        if (url.endsWith("/generate") && init?.method === "POST") {
          dispatched += 1;
          return response(200, {});
        }
        if (url.endsWith("/generate")) {
          if (failure === "transport")
            throw new Error("Polling connection lost");
          return response(200, {
            status: failure === "workflow" ? "failed" : "completed",
          });
        }
        if (init?.method === "DELETE") {
          removed += 1;
          return response(200, {});
        }
        if (url.endsWith("/api/trips/synthetic-trip"))
          return response(200, deployedNarrationFallback.body);
        throw new Error(`Unexpected mocked request: ${url}`);
      };
      const report = await runSmoke({
        tiers: [2],
        liveAi: true,
        briefIds: ["lisbon-city-break", "copenhagen-family"],
        target: {
          supabaseUrl: stagingUrl,
          apiUrl,
          anonKey: anon(STAGING_PROJECT_REF),
        },
        accounts: [{ email: "qa@example.invalid", password: "synthetic" }],
        pollIntervalMs: 0,
        fetchImpl: fetchImpl as typeof fetch,
      });
      expect(report.ok).toBe(false);
      expect(report.checks[0]).toMatchObject({
        name: "live-plan:lisbon-city-break",
        status: "failed",
      });
      expect(report.checks[1]).toMatchObject({
        name: "live-plan:copenhagen-family",
        status: "blocked",
      });
      expect(report.checks[1]?.detail).toContain("reconcile");
      expect({ created, dispatched, removed }).toEqual({
        created: 1,
        dispatched: 1,
        removed: failure === "transport" ? 0 : 1,
      });
    }
  });

  test("saved-plan quality rejects later outbound transport even with a reused day-one label", () => {
    const dates = { startDate: "2026-12-07", endDate: "2026-12-08" };
    const days = [dates.startDate, dates.endDate].map((date) => ({
      date,
      dayNumber: 1,
      title: "Museum and market",
      summary: "Explore the museum and nearby market.",
      morning: { activities: [{ name: "Museum" }], meal: { name: "Cafe" } },
    }));
    const evaluate = (transportIndex: number) =>
      evaluateSavedPlan(
        {
          trip: { status: "planned" },
          itinerary: {
            days: days.map((day, index) => ({
              ...day,
              ...(index === transportIndex
                ? { transport: { type: "flight" } }
                : {}),
            })),
          },
        },
        dates,
      );
    expect(evaluate(0).ok).toBe(true);
    expect(evaluate(1).failures).toContain("transport is present after day 1");
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
        "--no-env-file",
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
        "--no-env-file",
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

test("live reservation probes refuse lookalike hosts and redirects", async () => {
  for (const reservationUrl of [
    "https://opentable.com.evil.example/r/fake",
    "https://www.opentable.com/r/redirect",
  ]) {
    const requested: string[] = [];
    const report = await runSmoke({
      tiers: [2],
      liveAi: true,
      briefIds: ["lisbon-city-break"],
      pollIntervalMs: 0,
      target: {
        supabaseUrl: stagingUrl,
        apiUrl,
        anonKey: anon(STAGING_PROJECT_REF),
      },
      accounts: [{ email: "a@faroway-test.invalid", password: "test" }],
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        requested.push(url);
        if (url.includes("/auth/v1/token"))
          return response(200, { access_token: "qa" });
        if (url.endsWith("/api/trips"))
          return response(201, { trip: { id: "qa" } });
        if (url.endsWith("/generate"))
          return response(200, { status: "completed" });
        if (init?.method === "DELETE") return response(200, {});
        if (init?.method === "HEAD")
          return new Response(null, {
            status: 302,
            headers: { location: "https://evil.example" },
          });
        return response(200, {
          trip: { status: "planned" },
          itinerary: {
            days: ["2026-12-07", "2026-12-08", "2026-12-09"].map((date) => ({
              date,
              title: "Specific day",
              morning: {
                activities: [{ name: "Walk" }],
                meal: { name: "Dinner", reservationUrl },
              },
            })),
          },
        });
      }) as typeof fetch,
    });
    expect(report.ok).toBe(false);
    expect(requested.some((url) => url.includes("evil.example"))).toBe(false);
  }
});

test("saved-plan smoke fails timing conflicts and stale or truncated proposals", () => {
  const day = {
    dayNumber: 1,
    date: "2027-01-11",
    title: "Evening museum",
    summary: "A museum and dinner",
    morning: { activities: [] },
    afternoon: { activities: [] },
    evening: {
      activities: [{ id: "museum", name: "Museum", duration: 120 }],
      meals: [{ id: "dinner", name: "Dinner" }],
    },
  };
  const proposal = {
    policy: "day-timing-v1",
    basis: dayTimingBasis(day),
    fitsPolicy: true,
    verified: false,
    conflict: null,
    events: [
      {
        id: "activity:museum",
        kind: "activity",
        durationMinutes: 120,
        startMinute: 1080,
        endMinute: 1200,
        bufferBeforeMinutes: 0,
      },
      {
        id: "meal:evening:dinner",
        kind: "meal",
        durationMinutes: 60,
        startMinute: 1230,
        endMinute: 1290,
        bufferBeforeMinutes: 30,
      },
    ],
  };
  const evaluate = (timingProposal: unknown) =>
    evaluateSavedPlan(
      {
        trip: { status: "planned" },
        itinerary: { days: [{ ...day, timingProposal }] },
      },
      { startDate: day.date, endDate: day.date },
    );
  expect(evaluate(proposal).ok).toBe(true);
  expect(
    evaluate({
      ...proposal,
      fitsPolicy: false,
      events: [],
      conflict: { eventId: "meal:evening:dinner", overrunMinutes: 30 },
    }).failures,
  ).toContain("Evening museum has an unresolved timing conflict");
  for (const invalid of [
    null,
    {},
    { ...proposal, basis: "old" },
    { ...proposal, events: proposal.events.slice(0, 1) },
  ]) {
    expect(evaluate(invalid).failures).toContain(
      "Evening museum has an invalid or stale timing proposal",
    );
  }
});

test("saved-plan smoke does not count ideas or malformed placeholders as usable supply", () => {
  const evaluate = (morning: unknown) =>
    evaluateSavedPlan(
      {
        trip: { status: "planned" },
        itinerary: {
          days: [{ date: "2026-12-07", title: "Lisbon", morning }],
        },
      },
      { startDate: "2026-12-07", endDate: "2026-12-07" },
    );
  for (const placeholder of [
    null,
    {},
    { name: " " },
    { name: "Local spot", planningIdea: true },
  ]) {
    const result = evaluate({
      activities: [placeholder],
      meals: [placeholder],
    });
    expect(result.failures).toContain("Lisbon has no activities");
    expect(result.failures).toContain("Lisbon has no meals");
  }
  expect(
    evaluate({
      activities: [{ name: "Museum" }],
      meal: { name: "Local spot", planningIdea: true },
    }).failures,
  ).toContain("Lisbon has no meals");
  expect(
    evaluate({
      activities: [{ name: "Museum" }],
      meals: [{ name: "Cafe" }, { name: "Idea", planningIdea: true }],
    }).ok,
  ).toBe(true);
});

test("full-day live acceptance rejects a dinner-only day even with valid activities", () => {
  const body = {
    trip: { status: "planned" },
    itinerary: {
      days: [
        {
          date: "2026-12-07",
          title: "Lisbon",
          morning: { activities: [{ name: "Museum" }], meals: [] },
          afternoon: { meals: [] },
          evening: { meals: [{ name: "Restaurant" }] },
        },
      ],
    },
  };
  const dates = {
    startDate: "2026-12-07",
    endDate: "2026-12-07",
    requireFullDayMeals: true,
  };
  expect(evaluateSavedPlan(body, dates).failures).toEqual([
    "Lisbon has no usable breakfast suggestion",
    "Lisbon has no usable lunch suggestion",
  ]);
  const day = body.itinerary.days[0];
  Object.assign(day.morning, { meals: [{ name: "Cafe" }] });
  Object.assign(day.afternoon, { meals: [{ name: "Market lunch" }] });
  expect(evaluateSavedPlan(body, dates).ok).toBe(true);
});

test("rejects the retained live Lisbon meal gaps that previously passed structural smoke", () => {
  const result = evaluateSavedPlan(liveLisbonMealGaps.body, {
    startDate: "2026-12-07",
    endDate: "2026-12-09",
    requireFullDayMeals: true,
  });
  expect(result.ok).toBe(false);
  expect(result.failures).toHaveLength(4);
  expect(
    result.failures.filter((failure) => failure.includes("breakfast")),
  ).toHaveLength(2);
  expect(
    result.failures.filter((failure) => failure.includes("lunch")),
  ).toHaveLength(2);
});

test("Tokyo vendor acceptance rejects fallback-only, missing photos, attribution and repeated products", () => {
  const product = {
    id: "activity_v_123P1",
    name: "Tokyo food tour",
    affiliatePartner: "viator",
    affiliateUrl:
      "https://www.viator.com/tours/Tokyo/Food/d334-123P1?pid=P123&mcid=42383&medium=api",
    images: [
      "https://media.tacdn.com/media/attractions-splice-spp-674x446/tokyo.jpg",
    ],
  };
  const evaluate = (activities: unknown[]) =>
    evaluateSavedPlan(
      {
        trip: { status: "planned" },
        itinerary: {
          days: [
            {
              date: "2026-12-07",
              title: "Tokyo",
              morning: { activities, meals: [{ name: "Cafe" }] },
            },
          ],
        },
      },
      {
        startDate: "2026-12-07",
        endDate: "2026-12-07",
        vendorExpectation: {
          partner: "viator",
          minimumExperiences: 2,
          partnerId: "P123",
        },
      },
    );
  const second = {
    ...product,
    id: "activity_v_456P2",
    affiliateUrl: product.affiliateUrl.replace("123P1", "456P2"),
  };
  expect(evaluate([product, second]).ok).toBe(true);
  for (const invalid of [
    { ...second, affiliateUrl: product.affiliateUrl + "&campaign=other" },
    { ...second, planningIdea: true },
    { ...second, images: [] },
    { ...second, affiliateUrl: "https://www.viator.com/tours/Tokyo/Food" },
    {
      ...second,
      affiliateUrl: product.affiliateUrl.replace("pid=P123", "pid=P999"),
    },
    {
      ...second,
      affiliateUrl: product.affiliateUrl.replace(
        "viator.com",
        "viator.com.evil.test",
      ),
    },
    { ...second, id: "generated" },
    product,
  ])
    expect(evaluate([product, invalid]).ok).toBe(false);
});

test("vendor brief is opt-in and missing configured attribution blocks before requests", async () => {
  const base = {
    tiers: [2] as Array<2>,
    target: {
      supabaseUrl: stagingUrl,
      apiUrl,
      anonKey: anon(STAGING_PROJECT_REF),
    },
    accounts: [{ email: "qa@example.test", password: "fixture" }],
    env: {},
    fetchImpl: (() => {
      throw new Error("unexpected network request");
    }) as typeof fetch,
  };
  const defaultRun = await runSmoke({ ...base, dryRun: true, liveAi: true });
  expect(defaultRun.checks.some((c) => c.name.includes("tokyo-vendor"))).toBe(
    false,
  );
  const explicit = await runSmoke({
    ...base,
    dryRun: true,
    liveAi: true,
    briefIds: ["tokyo-vendor-experiences"],
  });
  expect(explicit.checks.map((c) => c.name)).toEqual([
    "live-plan:tokyo-vendor-experiences",
  ]);
  const blocked = await runSmoke({
    ...base,
    liveAi: true,
    briefIds: ["tokyo-vendor-experiences"],
  });
  expect(blocked.checks[0].status).toBe("blocked");
  expect(blocked.checks[0].name).toBe("vendor-attribution");
});
