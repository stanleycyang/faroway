'use client'

import Link from 'next/link'
import { MapPin, Home, Search, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-primary-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Animated Map Pin */}
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto bg-white rounded-full shadow-lg flex items-center justify-center">
            <MapPin className="w-16 h-16 text-primary animate-bounce" />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-black/10 rounded-full blur-md" />
        </div>

        {/* Error Message */}
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">
          Looks like you&apos;re lost!
        </h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          This destination doesn&apos;t exist in our travel guide. 
          Let&apos;s get you back on track to plan your perfect trip.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-semibold hover:bg-primary-600 transition-all shadow-lg shadow-primary/25 hover:shadow-xl"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </Link>
          <Link
            href="/create"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-full font-semibold border border-gray-200 hover:border-primary hover:text-primary transition-all"
          >
            <Search className="w-5 h-5" />
            Plan a Trip
          </Link>
        </div>

        {/* Go Back Link */}
        <button
          onClick={() => window.history.back()}
          className="mt-6 inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Go back to previous page
        </button>

        {/* Popular Destinations Suggestion */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4">Popular destinations to explore:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['Tokyo', 'Paris', 'Bali', 'New York', 'Barcelona'].map((city) => (
              <Link
                key={city}
                href={`/?destination=${encodeURIComponent(city)}`}
                className="px-4 py-2 bg-white rounded-full text-sm text-gray-600 hover:text-primary hover:border-primary border border-gray-200 transition-colors"
              >
                {city}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
