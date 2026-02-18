'use client'

import Link from 'next/link'
import { ServerCrash, Home, RefreshCw } from 'lucide-react'

export default function InternalServerError() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-red-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Error Icon */}
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto bg-white rounded-full shadow-lg flex items-center justify-center">
            <ServerCrash className="w-16 h-16 text-red-500" />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-black/10 rounded-full blur-md" />
        </div>

        {/* Error Message */}
        <h1 className="text-6xl font-bold text-gray-900 mb-4">500</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-3">
          Server Error
        </h2>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          We&apos;re experiencing some technical difficulties. Our team has been notified and is working on a fix.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-semibold hover:bg-primary-600 transition-all shadow-lg shadow-primary/25 hover:shadow-xl"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-full font-semibold border border-gray-200 hover:border-primary hover:text-primary transition-all"
          >
            <Home className="w-5 h-5" />
            Go Home
          </Link>
        </div>

        {/* Support Link */}
        <p className="mt-8 text-sm text-gray-500">
          If the problem persists,{' '}
          <a
            href="mailto:support@tripgenie.ai"
            className="text-primary hover:text-primary-600 font-medium underline"
          >
            contact support
          </a>
        </p>
      </div>
    </div>
  )
}
