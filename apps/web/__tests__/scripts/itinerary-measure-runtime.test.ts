import { createServer, type Server } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { PLANNING_DISCLOSURE } from "../../lib/ai/planning-disclosure";
const run = promisify(execFile);
let server: Server | undefined;
let directory: string | undefined;
afterEach(async () => {
  server?.closeAllConnections();
  await new Promise<void>((resolve) =>
    server ? server.close(() => resolve()) : resolve(),
  );
  server = undefined;
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});
function environment() {
  return {
    NODE_ENV: "test" as const,
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    FAROWAY_PERF_ACCESS_TOKEN: "fixture-session-token",
    FAROWAY_PERF_AI_DISCLOSURE: PLANNING_DISCLOSURE.version,
  };
}

test("the CLI measures authenticated creation, disclosed planning, and a read-only stream without leaking credentials", async () => {
  const calls: {
    method?: string;
    path?: string;
    authorization?: string;
    disclosure?: string;
    body: string;
  }[] = [];
  server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    calls.push({
      method: request.method,
      path: request.url,
      authorization: request.headers.authorization,
      disclosure: request.headers["x-faroway-ai-disclosure"] as string,
      body,
    });
    if (request.url === "/api/trips") {
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          trip: { id: "11111111-1111-4111-8111-111111111111" },
        }),
      );
    } else if (request.url?.endsWith("/generate")) {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ success: true }));
    } else if (request.url?.endsWith("/stream")) {
      response.setHeader("Content-Type", "text/event-stream");
      response.end(
        'event: itinerary\ndata: {"days":[]}\n\nevent: complete\ndata: {}\n\n',
      );
    } else {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture address");
  directory = await mkdtemp(join(tmpdir(), "faroway-perf-qa-"));
  const output = join(directory, "metrics.json");
  const result = await run(
    "bun",
    [
      "scripts/measure-itinerary-stream.ts",
      "--base-url",
      `http://127.0.0.1:${address.port}`,
      "--samples",
      "1",
      "--json-output",
      output,
    ],
    { env: environment(), timeout: 10_000 },
  );
  expect(
    calls.map(({ method, path }) => [method, path?.split("/").at(-1)]),
  ).toEqual([
    ["POST", "trips"],
    ["POST", "generate"],
    ["GET", "stream"],
  ]);
  expect(
    calls.every(
      (call) =>
        call.authorization === "Bearer fixture-session-token" &&
        call.disclosure === PLANNING_DISCLOSURE.version,
    ),
  ).toBe(true);
  expect(JSON.parse(calls[0].body).requestId).toMatch(/^[a-f0-9-]{36}$/);
  const report = await readFile(output, "utf8");
  expect(JSON.parse(report).summaries[0].successfulSamples).toBe(1);
  expect(
    JSON.parse(report).streamSamples[0].metrics.firstItineraryMs,
  ).not.toBeNull();
  expect(report + result.stdout + result.stderr).not.toContain(
    "fixture-session-token",
  );
});

test("missing session configuration fails before any request", async () => {
  const env = environment();
  delete (env as Partial<typeof env>).FAROWAY_PERF_ACCESS_TOKEN;
  await expect(
    run("bun", ["scripts/measure-itinerary-stream.ts"], {
      env,
      timeout: 10_000,
    }),
  ).rejects.toMatchObject({ code: 1 });
});

test("a rejected planning dispatch is a failed sample and never opens the stream", async () => {
  const paths: string[] = [];
  server = createServer((request, response) => {
    paths.push(request.url!);
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/api/trips")
      response.end(
        JSON.stringify({
          trip: { id: "11111111-1111-4111-8111-111111111111" },
        }),
      );
    else {
      response.statusCode = 409;
      response.end(
        JSON.stringify({
          code: "ai_consent_required",
          error: "Review sharing details",
        }),
      );
    }
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture address");
  directory = await mkdtemp(join(tmpdir(), "faroway-perf-failure-"));
  const output = join(directory, "metrics.json");
  await expect(
    run(
      "bun",
      [
        "scripts/measure-itinerary-stream.ts",
        "--base-url",
        `http://127.0.0.1:${address.port}`,
        "--samples",
        "1",
        "--json-output",
        output,
      ],
      { env: environment(), timeout: 10_000 },
    ),
  ).rejects.toMatchObject({ code: 1 });
  expect(paths).toHaveLength(2);
  expect(paths.some((path) => path.endsWith("/stream"))).toBe(false);
  const report = JSON.parse(await readFile(output, "utf8"));
  expect(report.summaries[0].failedSamples).toBe(1);
  expect(report.summaries[0].successfulSamples).toBe(0);
  expect(report.streamSamples[0].status).toBe(409);
});

test.each([
  ["--samples", "0"],
  ["--timeout-ms", "NaN"],
  ["--mode", "invalid"],
])("invalid option %s %s fails before dispatch", async (option, value) => {
  let calls = 0;
  server = createServer((_request, response) => {
    calls++;
    response.statusCode = 500;
    response.end();
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture address");
  await expect(
    run(
      "bun",
      [
        "scripts/measure-itinerary-stream.ts",
        "--base-url",
        `http://127.0.0.1:${address.port}`,
        option,
        value,
      ],
      { env: environment(), timeout: 10_000 },
    ),
  ).rejects.toMatchObject({ code: 1 });
  expect(calls).toBe(0);
});
