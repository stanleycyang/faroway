import { test, expect } from "bun:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// Resolve from the runtime itself so this exercises its actual dependency,
// including overrides, rather than an unrelated top-level serializer copy.
const require = createRequire(import.meta.url);
const runtimeEntry = require.resolve("@workflow/core");
const runtimeRequire = createRequire(runtimeEntry);
const serializer = await import(
  pathToFileURL(runtimeRequire.resolve("devalue")).href
);
const { getWorkflowReducers, getCommonRevivers } = await import(
  pathToFileURL(join(dirname(runtimeEntry), "serialization.js")).href
);
const nanoid = await import(
  pathToFileURL(runtimeRequire.resolve("nanoid")).href
);

test("workflow ID generation retains the existing deterministic replay sequence", () => {
  let offset = 0;
  const generate = nanoid.customRandom(nanoid.urlAlphabet, 21, (size) =>
    Uint8Array.from({ length: size }, () => (offset++ * 73 + 17) % 256),
  );
  // Compatibility fixture for the pinned runtime, not random production IDs.
  // Same-major nanoid upgrades can change byte consumption and replay output.
  expect([generate(), generate(), generate()]).toEqual([
    "yfWYp9nzgOMx8drhLIJ3o",
    "_DC0-tlGBKP2uqQUVX6sv",
    "R51ayfWYp9nzgOMx8drhL",
  ]);
});

test("workflow serializer preserves trip metadata and supported binary values", () => {
  const values = [
    {
      tripId: "synthetic",
      days: [
        {
          date: "2026-12-07",
          timingProposal: { fitsPolicy: false, events: [], verified: false },
        },
      ],
    },
    new Uint8Array([0, 127, 255]),
    new ArrayBuffer(0),
    new Map([["date", new Date("2026-12-07")]]),
    new Set(["a", "b"]),
    42n,
    { absent: undefined, invalid: NaN },
  ];
  for (const value of values) {
    const wire = serializer.stringify(value, getWorkflowReducers());
    assert.deepEqual(serializer.parse(wire, getCommonRevivers()), value);
  }
});

test("typed-array decoding rejects an invalid custom buffer reviver", () => {
  // Tiny malformed input: no large allocation or hostile resource exhaustion.
  expect(() =>
    serializer.parse('[["Uint8Array",1],["ArrayBuffer",2],"AA=="]', {
      ArrayBuffer: () => ({}),
    }),
  ).toThrow();
});
