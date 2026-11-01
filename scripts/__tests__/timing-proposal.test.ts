import { expect, test } from "bun:test";
import { proposeTiming, type TimingEvent } from "../uat/lib/timing-proposal";
const event = (id: string, patch: Partial<TimingEvent> = {}): TimingEvent => ({
  id,
  kind: "activity",
  durationMinutes: 60,
  earliestStart: 9 * 60,
  latestEnd: 18 * 60,
  bufferBeforeMinutes: 0,
  ...patch,
});
test("proposes explicit non-overlapping rest and buffers without claiming verification", () => {
  const input = [
    event("visit", { durationMinutes: 180 }),
    event("lunch", { kind: "meal", bufferBeforeMinutes: 30 }),
    event("rest", { kind: "rest", earliestStart: 13 * 60, latestEnd: 15 * 60 }),
    event("museum", { bufferBeforeMinutes: 30 }),
  ];
  const copy = structuredClone(input);
  const result = proposeTiming(input);
  expect(result.fitsPolicy).toBe(true);
  expect(result.verified).toBe(false);
  expect(result.events.map((e) => [e.id, e.startMinute, e.endMinute])).toEqual([
    ["visit", 540, 720],
    ["lunch", 750, 810],
    ["rest", 810, 870],
    ["museum", 900, 960],
  ]);
  expect(input).toEqual(copy);
});
test("does not present a partial plan when a rest window cannot fit", () => {
  const result = proposeTiming([
    event("tour", { durationMinutes: 300 }),
    event("rest", { kind: "rest", latestEnd: 14 * 60 }),
  ]);
  expect(result.fitsPolicy).toBe(false);
  expect(result.events).toEqual([]);
  expect(result.conflict).toMatchObject({
    eventId: "rest",
    overrunMinutes: 60,
  });
});
test("rejects malformed constraints rather than hiding overlaps with negative transfers", () => {
  for (const patch of [
    { bufferBeforeMinutes: -1 },
    { durationMinutes: 0 },
    { durationMinutes: NaN },
    { earliestStart: -1 },
    { latestEnd: 1441 },
    { earliestStart: 1000, latestEnd: 900 },
    { bufferBeforeMinutes: 1.5 },
  ])
    expect(() => proposeTiming([event("invalid", patch)])).toThrow();
  expect(() => proposeTiming([event("same"), event("same")])).toThrow();
});
test("retains fixed ordering and exact duration at boundary times", () => {
  const result = proposeTiming([
    event("first", { durationMinutes: 240, latestEnd: 13 * 60 }),
    event("second", { earliestStart: 14 * 60, latestEnd: 15 * 60 }),
  ]);
  expect(result.fitsPolicy).toBe(true);
  expect(result.events[0].endMinute).toBe(780);
  expect(result.events[1].startMinute).toBe(840);
});

test("rejects empty proposals instead of presenting them as successful days", () => {
  expect(() => proposeTiming([])).toThrow();
  expect(() => proposeTiming([event(" ")])).toThrow();
});
