import React from "react";
import { act, create } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) => <a {...props} />,
}));
vi.mock("@/components/dashboard/TripFilters", () => ({
  TripFilters: () => null,
}));
vi.mock("@/components/dashboard/TripCard", () => ({
  TripCard: ({ trip }: { trip: { destination: string } }) => (
    <article>{trip.destination}</article>
  ),
}));
import { DashboardTripList } from "@/components/dashboard/DashboardTripList";
const listeners = new Map<string, () => void>();
let renderer: ReturnType<typeof create> | undefined;
const fixture = (
  <DashboardTripList
    trips={[
      {
        id: "trip",
        destination: "Your Kyoto journey",
        start_date: "2026-10-13",
        end_date: "2026-10-13",
        travelers: 1,
      },
    ]}
    filter="past"
    sort="date-desc"
    serverDay="2026-10-14"
  />
);
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 13, 23, 59));
  listeners.clear();
  const events = {
    addEventListener: (key: string, callback: () => void) =>
      listeners.set(key, callback),
    removeEventListener: (key: string) => listeners.delete(key),
  };
  vi.stubGlobal("window", events);
  vi.stubGlobal("document", events);
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
test("server snapshot hydrates into local travel dates and moves a trip to Past at local midnight", async () => {
  expect(renderToStaticMarkup(fixture)).toContain("Your Kyoto journey");
  await act(async () => {
    renderer = create(fixture);
  });
  expect(JSON.stringify(renderer!.toJSON())).not.toContain(
    "Your Kyoto journey",
  );
  expect(JSON.stringify(renderer!.toJSON())).toContain("No past trips");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain("Your Kyoto journey");
});
test("returning to focus reconciles calendar changes and exit releases timer/listeners", async () => {
  await act(async () => {
    renderer = create(fixture);
  });
  await act(async () => {
    vi.setSystemTime(new Date(2026, 9, 15, 12));
    listeners.get("focus")!();
  });
  expect(JSON.stringify(renderer!.toJSON())).toContain("Your Kyoto journey");
  const lateFocus = listeners.get("focus")!;
  await act(async () => {
    renderer!.unmount();
  });
  renderer = undefined;
  lateFocus();
  expect(listeners.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});

test("long journey lists reveal batches and reset on filter changes without truncating totals", async () => {
  const props = {
    trips: Array.from({ length: 35 }, (_, index) => ({
      id: String(index),
      destination: `Journey ${index}`,
      start_date: "2099-06-01",
      end_date: "2099-06-02",
      travelers: 1,
    })),
    filter: "all" as const,
    sort: "created" as const,
    serverDay: "2026-10-13",
  };
  await act(async () => {
    renderer = create(<DashboardTripList {...props} />);
  });
  expect(renderer!.root.findAllByType("article")).toHaveLength(12);
  const more = () =>
    renderer!.root
      .findAllByType("button")
      .find((button) => button.props["aria-controls"]);
  await act(async () => more()!.props.onClick());
  expect(renderer!.root.findAllByType("article")).toHaveLength(24);
  await act(async () => more()!.props.onClick());
  expect(renderer!.root.findAllByType("article")).toHaveLength(35);
  expect(more()!.props.disabled).toBe(true);
  expect(JSON.stringify(renderer!.toJSON())).toContain("All journeys shown");
  await act(async () =>
    renderer!.update(<DashboardTripList {...props} filter="upcoming" />),
  );
  expect(renderer!.root.findAllByType("article")).toHaveLength(12);
});
