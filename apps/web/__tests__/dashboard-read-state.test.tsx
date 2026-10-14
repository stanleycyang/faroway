import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import DashboardPage from "../app/(app)/dashboard/page";
const state = vi.hoisted(() => ({
  result: { data: [] as unknown[], error: null as null | { message: string } },
  eq: vi.fn(),
  order: vi.fn(),
  filters: vi.fn(),
  summaries: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "owner-a", email: "qa@example.test" } },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: (...args: unknown[]) => {
          state.eq(...args);
          const chain = {
            order: (...orderArgs: unknown[]) => {
              state.order(...orderArgs);
              return chain;
            },
            limit: () => chain,
            or: () => chain,
            get data() {
              return state.result.data;
            },
            get error() {
              return state.result.error;
            },
          };
          return chain;
        },
      }),
    }),
  }),
}));
vi.mock("@/components/dashboard/TripCard", () => ({
  TripCard: () => null,
  TripStats: () => <div>Trip statistics</div>,
  EmptyState: () => <div>Genuine empty account</div>,
}));
vi.mock("@/components/dashboard/DashboardTripList", () => ({
  DashboardTripList: (props: {
    filter: string;
    sort: string;
    trips: unknown[];
  }) => {
    state.filters({ currentFilter: props.filter, currentSort: props.sort });
    state.summaries(props.trips);
    return (
      <>
        <div>Trip statistics</div>
        {props.trips.length === 0 && <div>Genuine empty account</div>}
      </>
    );
  },
}));
beforeEach(() => {
  state.result = { data: [], error: null };
  state.eq.mockClear();
  state.order.mockClear();
  state.filters.mockClear();
  state.summaries.mockClear();
});
test("failed read shows recovery without empty-account claims or false statistics", async () => {
  state.result = { data: [], error: { message: "Database unavailable" } };
  const html = renderToStaticMarkup(
    await DashboardPage({
      searchParams: Promise.resolve({ filter: "upcoming", sort: "created" }),
    }),
  );
  expect(html).toContain("Your trips couldn’t load");
  expect(html).toContain('role="alert"');
  expect(html).not.toContain("Genuine empty account");
  expect(html).not.toContain("Trip statistics");
  expect(html).toContain("/dashboard?filter=upcoming&amp;sort=created");
  expect(state.eq).toHaveBeenCalledWith("user_id", "owner-a");
});
test("successful empty read retains the genuine empty account state", async () => {
  const html = renderToStaticMarkup(
    await DashboardPage({ searchParams: Promise.resolve({}) }),
  );
  expect(html).toContain("Genuine empty account");
  expect(html).toContain("Trip statistics");
  expect(html).not.toContain("Your trips couldn’t load");
});

test("unsupported URL filters and sorting recover to canonical dashboard choices", async () => {
  state.result = {
    data: [{ id: "trip-a", start_date: "2099-06-01", end_date: "2099-06-03" }],
    error: null,
  };
  await DashboardPage({
    searchParams: Promise.resolve({ filter: "unknown", sort: "unknown" }),
  }).then(renderToStaticMarkup);
  expect(state.filters).toHaveBeenCalledWith(
    expect.objectContaining({ currentFilter: "all", currentSort: "date-desc" }),
  );
  expect(state.order).toHaveBeenCalledWith("created_at", { ascending: false });
});

test("serializes only card summaries instead of unused private metadata or card trees", async () => {
  state.result = {
    data: [
      {
        id: "trip-a",
        destination: "Paris",
        start_date: "2099-06-01",
        end_date: "2099-06-02",
        travelers: 2,
        status: "planned",
        user_id: "owner-a",
        preferences: { unused: "private-metadata" },
        search_id: "job-key",
      },
    ],
    error: null,
  };
  renderToStaticMarkup(
    await DashboardPage({ searchParams: Promise.resolve({}) }),
  );
  expect(state.summaries).toHaveBeenCalledWith([
    {
      id: "trip-a",
      destination: "Paris",
      start_date: "2099-06-01",
      end_date: "2099-06-02",
      travelers: 2,
      status: "planned",
      thumbnail_url: undefined,
    },
  ]);
});
