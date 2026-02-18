import Link from 'next/link'
import Image from 'next/image'

export type TripStatus = 'draft' | 'generating' | 'complete'

export interface Trip {
  id: string
  destination: string
  start_date: string
  end_date: string
  travelers: number
  status?: TripStatus
  thumbnail_url?: string
  created_at?: string
}

interface TripCardProps {
  trip: Trip
}

const statusConfig: Record<TripStatus, { label: string; color: string; bg: string; icon: string }> = {
  draft: {
    label: 'Draft',
    color: 'text-yellow-700',
    bg: 'bg-yellow-100',
    icon: '📝',
  },
  generating: {
    label: 'Generating',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    icon: '⏳',
  },
  complete: {
    label: 'Complete',
    color: 'text-green-700',
    bg: 'bg-green-100',
    icon: '✅',
  },
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  const options: Intl.DateTimeFormatOptions = { 
    month: 'short', 
    day: 'numeric'
  }
  
  const startStr = start.toLocaleDateString('en-US', options)
  const endStr = end.toLocaleDateString('en-US', { 
    ...options, 
    year: 'numeric' 
  })
  
  // If same year, show year only at the end
  if (start.getFullYear() === end.getFullYear()) {
    return `${startStr} - ${endStr}`
  }
  
  return `${start.toLocaleDateString('en-US', { ...options, year: 'numeric' })} - ${endStr}`
}

function getDaysUntil(startDate: string): { text: string; isUpcoming: boolean; isPast: boolean } {
  const now = new Date()
  const start = new Date(startDate)
  const diffTime = start.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) {
    return { text: 'Past trip', isUpcoming: false, isPast: true }
  } else if (diffDays === 0) {
    return { text: 'Today!', isUpcoming: true, isPast: false }
  } else if (diffDays === 1) {
    return { text: 'Tomorrow', isUpcoming: true, isPast: false }
  } else if (diffDays <= 7) {
    return { text: `In ${diffDays} days`, isUpcoming: true, isPast: false }
  } else if (diffDays <= 30) {
    const weeks = Math.floor(diffDays / 7)
    return { text: `In ${weeks} week${weeks > 1 ? 's' : ''}`, isUpcoming: true, isPast: false }
  }
  
  return { text: `In ${diffDays} days`, isUpcoming: true, isPast: false }
}

export function TripCard({ trip }: TripCardProps) {
  const status = trip.status || 'complete'
  const statusInfo = statusConfig[status]
  const daysInfo = getDaysUntil(trip.start_date)
  
  // Default placeholder images based on destination
  const placeholderImages = [
    'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&h=300&fit=crop', // Paris
    'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=400&h=300&fit=crop', // Tokyo
    'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=400&h=300&fit=crop', // NYC
    'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=400&h=300&fit=crop', // Italy
  ]
  
  const imageIndex = trip.destination.length % placeholderImages.length
  const thumbnailUrl = trip.thumbnail_url || placeholderImages[imageIndex]

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all overflow-hidden flex flex-col"
    >
      {/* Thumbnail */}
      <div className="relative h-40 sm:h-48 overflow-hidden bg-gray-100">
        <Image
          src={thumbnailUrl}
          alt={trip.destination}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        
        {/* Status Badge */}
        <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color} flex items-center gap-1`}>
          <span>{statusInfo.icon}</span>
          {statusInfo.label}
        </div>
        
        {/* Days until badge */}
        {!daysInfo.isPast && (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium bg-white/90 text-gray-700 backdrop-blur-sm">
            {daysInfo.text}
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-gray-900 text-lg group-hover:text-primary transition-colors">
          {trip.destination}
        </h3>
        
        <p className="text-sm text-gray-600 mt-1">
          {formatDateRange(trip.start_date, trip.end_date)}
        </p>
        
        <div className="mt-auto pt-4 flex items-center justify-between text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <span>👥</span>
            {trip.travelers} traveler{trip.travelers > 1 ? 's' : ''}
          </span>
          
          <span className="text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            View details →
          </span>
        </div>
      </div>
    </Link>
  )
}
