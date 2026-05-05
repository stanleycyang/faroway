#!/usr/bin/env bun

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type Mode = "stream" | "baseline" | "both";

interface Args {
  baseUrl: string;
  baselineBaseUrl: string;
  streamBaseUrl: string;
  samples: number;
  mode: Mode;
  destination: string;
  startDate: string;
  endDate: string;
  profile: string;
  timeoutMs: number;
  simulatedRttMs: number;
  simulatedDownKbps: number;
  jsonOutput?: string;
}

interface StreamMetrics {
  tripCreateMs: number;
  generateAckMs: number;
  streamHeadersMs: number;
  firstByteMs: number | null;
  firstSpecBlockMs: number | null;
  firstItineraryMs: number | null;
  completeMs: number | null;
  submitToFirstByteMs: number | null;
  submitToFirstSpecBlockMs: number | null;
  submitToFirstItineraryMs: number | null;
  submitToCompleteMs: number | null;
  events: string[];
}

interface BaselineMetrics {
  headersMs: number;
  completeMs: number;
}

interface SuccessfulSample<T> {
  ok: true;
  elapsedMs: number;
  metrics: T;
}

interface FailedSample {
  ok: false;
  elapsedMs: number;
  timedOut: boolean;
  error: string;
  status?: number;
  events?: string[];
}

type Sample<T> = SuccessfulSample<T> | FailedSample;

interface SummaryMetric {
  label: string;
  p50: number | null;
  p95: number | null;
}

interface RunSummary {
  label: string;
  totalSamples: number;
  successfulSamples: number;
  failedSamples: number;
  errorRatePct: number;
  timeoutRatePct: number;
  metrics: SummaryMetric[];
}

class SampleError extends Error {
  status?: number;
  events?: string[];

  constructor(
    message: string,
    options: { status?: number; events?: string[] } = {},
  ) {
    super(message);
    this.name = "SampleError";
    this.status = options.status;
    this.events = options.events;
  }
}

const args = parseArgs(process.argv.slice(2));

console.log(
  `Measuring itinerary latency: mode=${args.mode}, samples=${args.samples}, profile=${args.profile}, baselineBase=${args.baselineBaseUrl}, streamBase=${args.streamBaseUrl}`,
);
console.log(`Per-sample timeout: ${args.timeoutMs}ms`);
console.log(
  `Network simulation: rtt=${args.simulatedRttMs}ms downstream=${args.simulatedDownKbps}kbps`,
);

const streamSamples: Array<Sample<StreamMetrics>> = [];
const baselineSamples: Array<Sample<BaselineMetrics>> = [];

for (let i = 0; i < args.samples; i++) {
  if (args.mode === "stream" || args.mode === "both") {
    streamSamples.push(
      await runSample(
        (signal) => measureStream(args, i, signal),
        args.timeoutMs,
      ),
    );
  }
  if (args.mode === "baseline" || args.mode === "both") {
    baselineSamples.push(
      await runSample(
        (signal) => measureBaseline(args, signal),
        args.timeoutMs,
      ),
    );
  }
}

const summaries: RunSummary[] = [];

if (streamSamples.length > 0) {
  summaries.push(printStreamSummary(streamSamples));
}
if (baselineSamples.length > 0) {
  summaries.push(printBaselineSummary(baselineSamples));
}
if (streamSamples.length > 0 && baselineSamples.length > 0) {
  printCompletionDelta(streamSamples, baselineSamples);
}

if (args.jsonOutput) {
  await mkdir(dirname(args.jsonOutput), { recursive: true });
  await writeFile(
    args.jsonOutput,
    JSON.stringify(
      {
        args,
        generatedAt: new Date().toISOString(),
        summaries,
        streamSamples,
        baselineSamples,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\nWrote JSON results to ${args.jsonOutput}`);
}

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    values.set(arg.slice(2), argv[i + 1] || "");
    i++;
  }

  const baseUrl = (values.get("base-url") || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const baselineBaseUrl = (values.get("baseline-base-url") || baseUrl).replace(
    /\/$/,
    "",
  );
  const streamBaseUrl = (values.get("stream-base-url") || baseUrl).replace(
    /\/$/,
    "",
  );

  return {
    baseUrl,
    baselineBaseUrl,
    streamBaseUrl,
    samples: Number(values.get("samples") || "5"),
    mode: ((values.get("mode") || "both") as Mode) || "both",
    destination: values.get("destination") || "Tokyo",
    startDate: values.get("start-date") || dateOffset(45),
    endDate: values.get("end-date") || dateOffset(49),
    profile: values.get("profile") || "broadband",
    timeoutMs: Number(values.get("timeout-ms") || "120000"),
    simulatedRttMs: Number(values.get("simulated-rtt-ms") || "0"),
    simulatedDownKbps: Number(values.get("simulated-down-kbps") || "0"),
    jsonOutput: values.get("json-output") || undefined,
  };
}

async function runSample<T>(
  measure: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<Sample<T>> {
  const start = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const metrics = await measure(controller.signal);
    return {
      ok: true,
      elapsedMs: performance.now() - start,
      metrics,
    };
  } catch (error) {
    const timedOut =
      controller.signal.aborted ||
      (error instanceof Error && error.name === "AbortError");
    const sampleError = error instanceof SampleError ? error : null;
    return {
      ok: false,
      elapsedMs: performance.now() - start,
      timedOut,
      error: timedOut ? `Timed out after ${timeoutMs}ms` : formatError(error),
      status: sampleError?.status,
      events: sampleError?.events,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function measureStream(
  args: Args,
  index: number,
  signal: AbortSignal,
): Promise<StreamMetrics> {
  const input = {
    destination: args.destination,
    start_date: args.startDate,
    end_date: args.endDate,
    travelers: 2,
    budget: "moderate",
    preferences: {
      travelerType: "couple",
      vibes: ["foodie"],
    },
  };

  const submitStart = performance.now();
  const createStart = performance.now();
  await simulateRequestTransit(args, signal);
  const tripRes = await fetch(`${args.streamBaseUrl}/api/trips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  await simulateResponseTransit(args, signal);
  const tripCreateMs = performance.now() - createStart;
  if (!tripRes.ok) {
    throw new SampleError(
      await httpFailureMessage("Trip create failed", tripRes),
      {
        status: tripRes.status,
      },
    );
  }
  const { trip } = (await readJsonWithSimulation(args, tripRes, signal)) as {
    trip: { id: string };
  };

  const generateStart = performance.now();
  await simulateRequestTransit(args, signal);
  const generateRes = await fetch(
    `${args.streamBaseUrl}/api/trips/${trip.id}/generate`,
    { method: "POST", headers: { "Content-Type": "application/json" }, signal },
  );
  await simulateResponseTransit(args, signal);
  const generateAckMs = performance.now() - generateStart;
  if (!generateRes.ok && generateRes.status !== 409) {
    throw new SampleError(
      await httpFailureMessage("Generate kickoff failed", generateRes),
      {
        status: generateRes.status,
      },
    );
  }

  const streamStart = performance.now();
  await simulateRequestTransit(args, signal);
  const streamRes = await fetch(
    `${args.streamBaseUrl}/api/trips/${trip.id}/stream`,
    {
      method: "POST",
      headers: { Accept: "text/event-stream" },
      signal,
    },
  );
  await simulateResponseTransit(args, signal);
  const streamHeadersMs = performance.now() - streamStart;
  if (!streamRes.ok || !streamRes.body) {
    throw new SampleError(
      await httpFailureMessage("Stream failed", streamRes),
      {
        status: streamRes.status,
      },
    );
  }

  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let firstByteMs: number | null = null;
  let firstSpecBlockMs: number | null = null;
  let firstItineraryMs: number | null = null;
  let completeMs: number | null = null;
  const events: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    await simulateDownload(args, value.byteLength, signal);
    if (firstByteMs == null) firstByteMs = performance.now() - streamStart;

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSse(buffer);
    buffer = parsed.remaining;

    for (const event of parsed.events) {
      events.push(event.type);
      if (event.type === "spec-block" && firstSpecBlockMs == null) {
        firstSpecBlockMs = performance.now() - streamStart;
      }
      if (event.type === "itinerary" && firstItineraryMs == null) {
        firstItineraryMs = performance.now() - streamStart;
      }
      if (event.type === "error") {
        await reader.cancel().catch(() => undefined);
        throw new SampleError(`Stream emitted error: ${event.data}`, {
          events,
        });
      }
      if (event.type === "complete") {
        completeMs = performance.now() - streamStart;
        await reader.cancel().catch(() => undefined);
        const elapsedBeforeStreamMs = streamStart - submitStart;
        const metrics = {
          tripCreateMs,
          generateAckMs,
          streamHeadersMs,
          firstByteMs,
          firstSpecBlockMs,
          firstItineraryMs,
          completeMs,
          submitToFirstByteMs: addNullable(elapsedBeforeStreamMs, firstByteMs),
          submitToFirstSpecBlockMs: addNullable(
            elapsedBeforeStreamMs,
            firstSpecBlockMs,
          ),
          submitToFirstItineraryMs: addNullable(
            elapsedBeforeStreamMs,
            firstItineraryMs,
          ),
          submitToCompleteMs: addNullable(elapsedBeforeStreamMs, completeMs),
          events,
        };
        console.log(`stream sample ${index + 1}:`, roundMetrics(metrics));
        return metrics;
      }
    }
  }

  throw new SampleError("Stream ended before complete event", { events });
}

async function measureBaseline(
  args: Args,
  signal: AbortSignal,
): Promise<BaselineMetrics> {
  const start = performance.now();
  await simulateRequestTransit(args, signal);
  const res = await fetch(`${args.baselineBaseUrl}/api/itinerary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      destination: args.destination,
      startDate: args.startDate,
      endDate: args.endDate,
      travelers: 2,
      travelerType: "couple",
      vibes: ["foodie"],
      budget: "moderate",
      save: false,
    }),
    signal,
  });
  await simulateResponseTransit(args, signal);
  const headersMs = performance.now() - start;
  const bodyText = await readTextWithSimulation(args, res, signal);
  const completeMs = performance.now() - start;
  if (!res.ok) {
    throw new SampleError(
      formatHttpFailure("Baseline itinerary failed", res.status, bodyText),
      {
        status: res.status,
      },
    );
  }
  return { headersMs, completeMs };
}

async function readJsonWithSimulation(
  args: Args,
  res: Response,
  signal: AbortSignal,
): Promise<unknown> {
  const text = await readTextWithSimulation(args, res, signal);
  return JSON.parse(text);
}

async function readTextWithSimulation(
  args: Args,
  res: Response,
  signal: AbortSignal,
): Promise<string> {
  const text = await res.text();
  await simulateDownload(
    args,
    new TextEncoder().encode(text).byteLength,
    signal,
  );
  return text;
}

async function simulateRequestTransit(args: Args, signal: AbortSignal) {
  await delay(args.simulatedRttMs / 2, signal);
}

async function simulateResponseTransit(args: Args, signal: AbortSignal) {
  await delay(args.simulatedRttMs / 2, signal);
}

async function simulateDownload(
  args: Args,
  byteLength: number,
  signal: AbortSignal,
) {
  if (args.simulatedDownKbps <= 0 || byteLength <= 0) return;
  await delay((byteLength * 8) / args.simulatedDownKbps, signal);
}

async function delay(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (signal.aborted) throwAbortError();

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    };
    const onTimeout = () => {
      cleanup();
      resolve();
    };
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    const timeout = setTimeout(onTimeout, ms);
    signal.addEventListener("abort", onAbort, { once: true });
    if (typeof timeout === "object" && "unref" in timeout) {
      timeout.unref();
    }
  });
}

function throwAbortError(): never {
  throw abortError();
}

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

async function httpFailureMessage(
  prefix: string,
  res: Response,
): Promise<string> {
  return formatHttpFailure(prefix, res.status, await res.text());
}

function formatHttpFailure(
  prefix: string,
  status: number,
  bodyText: string,
): string {
  const body = formatResponseBody(bodyText);
  return body
    ? `${prefix}: HTTP ${status} body=${body}`
    : `${prefix}: HTTP ${status}`;
}

function formatResponseBody(bodyText: string): string {
  const compact = bodyText.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact.length > 240 ? `${compact.slice(0, 237)}...` : compact;
}

function parseSse(buffer: string): {
  events: Array<{ type: string; data: string }>;
  remaining: string;
} {
  const events: Array<{ type: string; data: string }> = [];
  const blocks = buffer.split("\n\n");
  const remaining = blocks.pop() || "";

  for (const block of blocks) {
    let type = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) type = line.slice(7).trim();
      if (line.startsWith("data: ")) {
        data += (data ? "\n" : "") + line.slice(6);
      }
    }
    if (data) events.push({ type, data });
  }

  return { events, remaining };
}

function printStreamSummary(samples: Array<Sample<StreamMetrics>>): RunSummary {
  return printSummary("Streaming summary", samples, [
    ["Stream TTFB", (metrics) => metrics.firstByteMs],
    ["First spec block", (metrics) => metrics.firstSpecBlockMs],
    ["First itinerary", (metrics) => metrics.firstItineraryMs],
    ["Stream complete", (metrics) => metrics.completeMs],
    ["Submit to first byte", (metrics) => metrics.submitToFirstByteMs],
    [
      "Submit to first spec block",
      (metrics) => metrics.submitToFirstSpecBlockMs,
    ],
    [
      "Submit to first itinerary",
      (metrics) => metrics.submitToFirstItineraryMs,
    ],
    ["Submit to complete", (metrics) => metrics.submitToCompleteMs],
  ]);
}

function printBaselineSummary(
  samples: Array<Sample<BaselineMetrics>>,
): RunSummary {
  return printSummary("Baseline summary", samples, [
    ["TTFB / headers", (metrics) => metrics.headersMs],
    ["Complete", (metrics) => metrics.completeMs],
  ]);
}

function printSummary<T>(
  label: string,
  samples: Array<Sample<T>>,
  metrics: Array<[string, (metrics: T) => number | null]>,
): RunSummary {
  const success = samples.filter((sample): sample is SuccessfulSample<T> => {
    return sample.ok;
  });
  const failures = samples.filter((sample): sample is FailedSample => {
    return !sample.ok;
  });
  const timeoutCount = failures.filter((sample) => sample.timedOut).length;

  console.log(`\n${label}`);
  console.log(
    `samples=${samples.length} success=${success.length} failed=${failures.length} errorRate=${formatPct(failures.length, samples.length)} timeoutRate=${formatPct(timeoutCount, samples.length)}`,
  );
  for (const failure of failures) {
    console.log(
      `failure: elapsed=${round(failure.elapsedMs)}ms status=${failure.status ?? "n/a"} timeout=${failure.timedOut} error=${failure.error}`,
    );
  }

  const summaryMetrics = metrics.map(([metricLabel, selector]) => {
    const values = success
      .map((sample) => selector(sample.metrics))
      .filter((value): value is number => value != null)
      .sort((a, b) => a - b);
    const metric = {
      label: metricLabel,
      p50: values.length > 0 ? round(percentile(values, 50)) : null,
      p95: values.length > 0 ? round(percentile(values, 95)) : null,
    };
    console.log(
      `${metric.label}: p50=${formatMaybeMs(metric.p50)} p95=${formatMaybeMs(metric.p95)}`,
    );
    return metric;
  });

  return {
    label,
    totalSamples: samples.length,
    successfulSamples: success.length,
    failedSamples: failures.length,
    errorRatePct: pct(failures.length, samples.length),
    timeoutRatePct: pct(timeoutCount, samples.length),
    metrics: summaryMetrics,
  };
}

function printCompletionDelta(
  streamSamples: Array<Sample<StreamMetrics>>,
  baselineSamples: Array<Sample<BaselineMetrics>>,
) {
  const baselineValues = successfulMetrics(baselineSamples)
    .map((metrics) => metrics.completeMs)
    .sort((a, b) => a - b);
  const streamValues = successfulMetrics(streamSamples)
    .map((metrics) => metrics.submitToCompleteMs)
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);

  if (baselineValues.length === 0 || streamValues.length === 0) {
    console.log("\nCompletion delta: unavailable");
    return;
  }

  const baselineP50 = percentile(baselineValues, 50);
  const streamP50 = percentile(streamValues, 50);
  const improvementPct = ((baselineP50 - streamP50) / baselineP50) * 100;
  console.log(
    `\nCompletion p50 delta: baseline=${round(baselineP50)}ms streaming=${round(streamP50)}ms improvement=${round(improvementPct)}%`,
  );
}

function successfulMetrics<T>(samples: Array<Sample<T>>): T[] {
  return samples
    .filter((sample): sample is SuccessfulSample<T> => sample.ok)
    .map((sample) => sample.metrics);
}

function percentile(values: number[], p: number): number {
  const index = Math.min(
    values.length - 1,
    Math.ceil((p / 100) * values.length) - 1,
  );
  return values[index];
}

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addNullable(left: number, right: number | null): number | null {
  return right == null ? null : left + right;
}

function round(value: number | null): number | null {
  return value == null ? null : Math.round(value);
}

function roundMetrics(metrics: StreamMetrics): Record<string, unknown> {
  return {
    firstByteMs: round(metrics.firstByteMs),
    firstSpecBlockMs: round(metrics.firstSpecBlockMs),
    firstItineraryMs: round(metrics.firstItineraryMs),
    completeMs: round(metrics.completeMs),
    submitToFirstSpecBlockMs: round(metrics.submitToFirstSpecBlockMs),
    submitToCompleteMs: round(metrics.submitToCompleteMs),
  };
}

function pct(count: number, total: number): number {
  return total === 0 ? 0 : Number(((count / total) * 100).toFixed(2));
}

function formatPct(count: number, total: number): string {
  return `${pct(count, total).toFixed(2)}%`;
}

function formatMaybeMs(value: number | null): string {
  return value == null ? "n/a" : `${value}ms`;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export {};
