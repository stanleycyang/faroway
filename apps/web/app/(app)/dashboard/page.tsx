import { Compass, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TripCard, TripStats, EmptyState, Trip } from "@/components/dashboard";
import {
  TripFilters,
  FilterType,
  SortType,
} from "@/components/dashboard/TripFilters";

interface DashboardPageProps {
  searchParams: Promise<{ filter?: string; sort?: string }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const [params, supabase] = await Promise.all([searchParams, createClient()]);

  // Check if user is authenticated
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (error || !user) {
    redirect("/auth/login?redirectTo=/dashboard");
  }

  // Parse filter and sort params
  const filter = (params.filter as FilterType) || "all";
  const sort = (params.sort as SortType) || "date-desc";

  // Get user's trips
  let query = supabase.from("trips").select("*");

  // Apply sorting
  switch (sort) {
    case "date-asc":
      query = query.order("start_date", { ascending: true });
      break;
    case "created":
      query = query.order("created_at", { ascending: false });
      break;
    case "date-desc":
    default:
      query = query.order("start_date", { ascending: false });
  }

  const { data: allTrips } = await query;

  // Calculate stats and filter trips
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const trips = (allTrips || []) as Trip[];
  const upcomingTrips = trips.filter((t) => t.start_date >= today);
  const pastTrips = trips.filter((t) => t.end_date < today);
  const inProgressTrips = trips.filter(
    (t) => t.start_date <= today && t.end_date >= today,
  );
  // Apply filter
  let filteredTrips = trips;
  switch (filter) {
    case "upcoming":
      filteredTrips = upcomingTrips;
      break;
    case "past":
      filteredTrips = pastTrips;
      break;
    default:
      filteredTrips = trips;
  }

  const tripCounts = {
    all: trips.length,
    upcoming: upcomingTrips.length,
    past: pastTrips.length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <Compass className="h-6 w-6 text-slate-900" />
              <span className="text-xl font-bold text-gray-900">faroway.</span>
            </Link>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 hidden sm:block">
                {user.email}
              </span>
              <form action="/auth/logout" method="post">
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-editorial text-3xl text-slate-900 sm:text-4xl">
              Your journeys
            </h1>
            <p className="text-gray-600 mt-1">
              Pick up a plan, or dream up your next escape.
            </p>
          </div>

          {/* Create New Trip CTA */}
          <Link
            href="/create"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-full font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Create New Trip
          </Link>
        </div>

        {/* Stats Section */}
        <section className="mb-8">
          <TripStats
            totalTrips={trips.length}
            upcomingTrips={upcomingTrips.length}
            completedTrips={pastTrips.length}
            inProgressTrips={inProgressTrips.length}
          />
        </section>

        {/* Trips Section */}
        <section>
          <div className="mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
              Your Trips
            </h2>

            {trips.length > 0 && (
              <TripFilters
                currentFilter={filter}
                currentSort={sort}
                tripCounts={tripCounts}
              />
            )}
          </div>

          {/* Trip Grid or Empty State */}
          {trips.length === 0 ? (
            <EmptyState />
          ) : filteredTrips.length === 0 ? (
            <EmptyState
              title={`No ${filter} trips`}
              description={
                filter === "upcoming"
                  ? "You don't have any upcoming trips planned yet."
                  : "You haven't completed any trips yet."
              }
              showCTA={filter === "upcoming"}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
