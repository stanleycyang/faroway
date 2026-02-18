'use client'

interface TripStatsProps {
  totalTrips: number
  upcomingTrips: number
  completedTrips: number
  inProgressTrips?: number
}

export function TripStats({ 
  totalTrips, 
  upcomingTrips, 
  completedTrips,
  inProgressTrips = 0 
}: TripStatsProps) {
  const stats = [
    {
      label: 'Total Trips',
      value: totalTrips,
      icon: '📊',
      color: 'text-primary',
      bgColor: 'bg-primary-50',
    },
    {
      label: 'Upcoming',
      value: upcomingTrips,
      icon: '🗓️',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'In Progress',
      value: inProgressTrips,
      icon: '✈️',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Completed',
      value: completedTrips,
      icon: '✅',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${stat.bgColor} mb-3`}>
            <span className="text-xl">{stat.icon}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">{stat.label}</h3>
          <p className={`text-2xl sm:text-3xl font-bold ${stat.color}`}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}
