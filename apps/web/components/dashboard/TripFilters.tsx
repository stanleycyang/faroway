'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export type FilterType = 'all' | 'upcoming' | 'past'
export type SortType = 'date-desc' | 'date-asc' | 'created'

interface TripFiltersProps {
  currentFilter: FilterType
  currentSort: SortType
  tripCounts: {
    all: number
    upcoming: number
    past: number
  }
}

export function TripFilters({ currentFilter, currentSort, tripCounts }: TripFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`/dashboard?${params.toString()}`)
  }
  
  const filters: { value: FilterType; label: string; count: number }[] = [
    { value: 'all', label: 'All Trips', count: tripCounts.all },
    { value: 'upcoming', label: 'Upcoming', count: tripCounts.upcoming },
    { value: 'past', label: 'Past', count: tripCounts.past },
  ]
  
  const sortOptions: { value: SortType; label: string }[] = [
    { value: 'date-desc', label: 'Trip Date (Newest)' },
    { value: 'date-asc', label: 'Trip Date (Oldest)' },
    { value: 'created', label: 'Recently Created' },
  ]

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
      {/* Filter Tabs */}
      <div className="flex gap-1 sm:gap-2 p-1 bg-gray-100 rounded-xl w-full sm:w-auto overflow-x-auto">
        {filters.map((filter) => (
          <button
            key={filter.value}
            onClick={() => updateParams('filter', filter.value)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 min-h-[44px] flex items-center ${
              currentFilter === filter.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {filter.label}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
              currentFilter === filter.value
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-200 text-gray-600'
            }`}>
              {filter.count}
            </span>
          </button>
        ))}
      </div>
      
      {/* Sort Dropdown */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <span className="text-sm text-gray-500 whitespace-nowrap">Sort by:</span>
        <select
          value={currentSort}
          onChange={(e) => updateParams('sort', e.target.value)}
          className="flex-1 sm:flex-none px-3 py-2.5 min-h-[44px] bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
