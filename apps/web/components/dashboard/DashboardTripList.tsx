"use client";
import { useId, useState } from "react";
import { tripDatePhase } from "@faroway/constants";
import { useLocalCalendarDate } from "@/hooks/useLocalCalendarDate";
import { TripStats } from "./TripStats";
import { TripFilters, type FilterType, type SortType } from "./TripFilters";
import { EmptyState } from "./EmptyState";
import { useHydrated } from "@/hooks/useHydrated";
import { TripCard, type Trip } from "./TripCard";

function TripCardPages({ trips }: { trips: Trip[] }) {
  const [limit, setLimit] = useState(12);
  const gridId = useId();
  const hydrated = useHydrated();
  const shown = Math.min(limit, trips.length);
  return (
    <>
      <div
        id={gridId}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {trips.slice(0, shown).map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>
      {trips.length > 12 && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <p role="status" className="text-sm text-slate-600">
            Showing {shown} of {trips.length} journeys
          </p>
          <button
            type="button"
            aria-controls={gridId}
            disabled={!hydrated || shown === trips.length}
            aria-busy={!hydrated}
            onClick={() => setLimit((value) => value + 12)}
            className="min-h-12 rounded-full border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900 disabled:opacity-60"
          >
            {shown === trips.length
              ? "All journeys shown"
              : "Show more journeys"}
          </button>
        </div>
      )}
    </>
  );
}

/** Serialize only trip summaries; render the visible card batch. */
export function DashboardTripList({
  trips,
  filter,
  sort,
  serverDay,
}: {
  trips: Trip[];
  filter: FilterType;
  sort: SortType;
  serverDay: string;
}) {
  const today = useLocalCalendarDate(serverDay);
  const phases = trips.map((trip) =>
    tripDatePhase(trip.start_date, trip.end_date, today),
  );
  const upcoming = phases.filter((phase) => phase === "upcoming").length;
  const past = phases.filter((phase) => phase === "past").length;
  const visible = trips.filter(
    (_card, index) => filter === "all" || phases[index] === filter,
  );
  return (
    <>
      <section className="mb-8">
        <TripStats
          totalTrips={trips.length}
          upcomingTrips={upcoming}
          pastTrips={past}
          inProgressTrips={
            phases.filter((phase) => phase === "in-progress").length
          }
        />
      </section>
      <section>
        <div className="mb-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
            Your Trips
          </h2>
          {trips.length > 0 && (
            <TripFilters
              currentFilter={filter}
              currentSort={sort}
              tripCounts={{ all: trips.length, upcoming, past }}
            />
          )}
        </div>
        {trips.length === 0 ? (
          <EmptyState />
        ) : visible.length === 0 ? (
          <EmptyState
            title={`No ${filter} trips`}
            description={
              filter === "upcoming"
                ? "You don't have any upcoming trips planned yet."
                : "You don't have any past trips yet."
            }
            showCTA={filter === "upcoming"}
          />
        ) : (
          <TripCardPages key={`${filter}:${sort}:${today}`} trips={visible} />
        )}
      </section>
    </>
  );
}
