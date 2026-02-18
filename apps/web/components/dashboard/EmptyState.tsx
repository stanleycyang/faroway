import Link from 'next/link'
import { Sparkles, MapPin, Calendar } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
  showCTA?: boolean
}

export function EmptyState({
  title = 'No trips yet',
  description = "You haven't planned any trips yet. Start by creating your first AI-powered itinerary!",
  showCTA = true,
}: EmptyStateProps) {
  return (
    <div className="bg-gradient-to-br from-white to-primary-50/30 rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
      {/* Animated Icon */}
      <div className="relative mb-8">
        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary-100 to-amber-100 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center animate-pulse">
            <span className="text-4xl">✈️</span>
          </div>
        </div>
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-primary/20 rounded-full blur-md" />
      </div>

      {/* Content */}
      <h3 className="text-2xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">{description}</p>

      {/* CTA */}
      {showCTA && (
        <div className="space-y-4">
          <Link
            href="/create"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-primary to-primary-600 text-white rounded-full font-semibold hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105"
          >
            <Sparkles className="w-5 h-5" />
            Create Your First Trip
          </Link>

          {/* Quick Start Guide */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-4">How it works:</p>
            <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
              <div className="flex items-start gap-3 p-4 bg-white rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Choose destination</p>
                  <p className="text-xs text-gray-500 mt-1">Where do you want to go?</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-white rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Pick dates</p>
                  <p className="text-xs text-gray-500 mt-1">When are you traveling?</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-white rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">Get itinerary</p>
                  <p className="text-xs text-gray-500 mt-1">AI creates your plan!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
