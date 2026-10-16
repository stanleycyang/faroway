import { Compass, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { type Trip } from "@/components/dashboard/TripCard";
import { DashboardTripList } from "@/components/dashboard/DashboardTripList";
import { loadDashboardTrips } from "@/lib/trips/load-dashboard-trips";
import { FilterType, SortType } from "@/components/dashboard/TripFilters";

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
  const filter: FilterType =
    params.filter === "upcoming" || params.filter === "past"
      ? params.filter
      : "all";
  const sort: SortType =
    params.sort === "date-asc" || params.sort === "created"
      ? params.sort
      : "date-desc";

  const { data: allTrips, error: tripsError } = await loadDashboardTrips(
    supabase,
    user.id,
    sort,
  );

  const trips = (allTrips || []) as Trip[];
  const serverDay = new Date().toISOString().split("T")[0];

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
                  className="min-h-11 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
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

        {tripsError ? (
          <section>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
              Your Trips
            </h2>
            <div
              role="alert"
              className="rounded-2xl border border-amber-200 bg-white p-6 sm:p-8"
            >
              <h3 className="text-xl font-semibold text-slate-900">
                Your trips couldn’t load
              </h3>
              <p className="mt-2 text-slate-600">
                We couldn’t retrieve your saved journeys. Try again in a moment.
              </p>
              <Link
                href={`/dashboard?filter=${encodeURIComponent(filter)}&sort=${encodeURIComponent(sort)}`}
                className="mt-5 inline-flex min-h-11 items-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
              >
                Try again
              </Link>
            </div>
          </section>
        ) : (
          <DashboardTripList
            trips={trips.map(
              ({
                id,
                destination,
                start_date,
                end_date,
                travelers,
                status,
                thumbnail_url,
              }) => ({
                id,
                destination,
                start_date,
                end_date,
                travelers,
                status,
                thumbnail_url,
              }),
            )}
            filter={filter}
            sort={sort}
            serverDay={serverDay}
          />
        )}
      </main>
    </div>
  );
}
