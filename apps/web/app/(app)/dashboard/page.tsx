import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { TripCard, TripStats, EmptyState, Trip } from '@/components/dashboard'
import { TripFilters, FilterType, SortType } from '@/components/dashboard/TripFilters'

interface DashboardPageProps {
  searchParams: Promise<{ filter?: string; sort?: string }>
}

// Loading skeleton for the trip grid
function TripGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
          <div className="h-48 bg-gray-200" />
          <div className="p-4 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  
  // Check if user is authenticated
  const { data: { user }, error } = await supabase.auth.getUser()
  
  // Redirect to login if not authenticated
  if (error || !user) {
    redirect('/auth/login?redirectTo=/dashboard')
  }

  // Parse filter and sort params
  const filter = (params.filter as FilterType) || 'all'
  const sort = (params.sort as SortType) || 'date-desc'

  // Get user's trips
  let query = supabase
    .from('trips')
    .select('*')
  
  // Apply sorting
  switch (sort) {
    case 'date-asc':
      query = query.order('start_date', { ascending: true })
      break
    case 'created':
      query = query.order('created_at', { ascending: false })
      break
    case 'date-desc':
    default:
      query = query.order('start_date', { ascending: false })
  }

  const { data: allTrips } = await query

  // Calculate stats and filter trips
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  
  const trips = (allTrips || []) as Trip[]
  const upcomingTrips = trips.filter(t => t.start_date >= today)
  const pastTrips = trips.filter(t => t.end_date < today)
  const inProgressTrips = trips.filter(t => t.start_date <= today && t.end_date >= today)
  
  // Apply filter
  let filteredTrips = trips
  switch (filter) {
    case 'upcoming':
      filteredTrips = upcomingTrips
      break
    case 'past':
      filteredTrips = pastTrips
      break
    default:
      filteredTrips = trips
  }

  const tripCounts = {
    all: trips.length,
    upcoming: upcomingTrips.length,
    past: pastTrips.length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">✈️</span>
              <span className="text-xl font-bold text-gray-900">TripGenie</span>
            </Link>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 hidden sm:block">{user.email}</span>
              <Link
                href="/auth/logout"
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Sign out
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Welcome back!</h1>
            <p className="text-gray-600 mt-1">Here&apos;s an overview of your trips.</p>
          </div>
          
          {/* Create New Trip CTA */}
          <Link
            href="/create"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary-600 text-white rounded-full font-semibold hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 whitespace-nowrap"
          >
            <span className="text-lg">✨</span>
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
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Your Trips</h2>
            
            {trips.length > 0 && (
              <Suspense fallback={<div className="h-12 bg-gray-100 rounded-xl animate-pulse" />}>
                <TripFilters
                  currentFilter={filter}
                  currentSort={sort}
                  tripCounts={tripCounts}
                />
              </Suspense>
            )}
          </div>

          {/* Trip Grid or Empty State */}
          {trips.length === 0 ? (
            <EmptyState />
          ) : filteredTrips.length === 0 ? (
            <EmptyState
              title={`No ${filter} trips`}
              description={filter === 'upcoming' 
                ? "You don't have any upcoming trips planned yet." 
                : "You haven't completed any trips yet."
              }
              showCTA={filter === 'upcoming'}
            />
          ) : (
            <Suspense fallback={<TripGridSkeleton />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTrips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
              </div>
            </Suspense>
          )}
        </section>

        {/* Quick Actions (only show when user has trips) */}
        {trips.length > 0 && (
          <section className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/create"
              className="p-6 bg-gradient-to-br from-primary to-primary-600 rounded-2xl text-white shadow-lg hover:shadow-xl transition-all group"
            >
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">✨</div>
              <h3 className="text-lg font-semibold">Plan Another Trip</h3>
              <p className="text-white/80 text-sm mt-1">Let AI help you create the perfect itinerary</p>
            </Link>
            
            <Link
              href="/trips"
              className="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">📋</div>
              <h3 className="text-lg font-semibold text-gray-900">View All Trips</h3>
              <p className="text-gray-600 text-sm mt-1">Manage and edit your planned adventures</p>
            </Link>
          </section>
        )}
      </main>
    </div>
  )
}
