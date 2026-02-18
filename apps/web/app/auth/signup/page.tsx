'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { EmailPasswordForm } from '@/components/auth/EmailPasswordForm'
import { GoogleButton } from '@/components/auth/GoogleButton'
import { AppleButton } from '@/components/auth/AppleButton'

function SignupContent() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  const error = searchParams.get('error')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-white px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="text-3xl">✈️</span>
            <span className="text-2xl font-bold text-gray-900">TripGenie</span>
          </Link>
          <h1 className="mt-6 text-2xl font-semibold text-gray-900">
            Create your account
          </h1>
          <p className="mt-2 text-gray-600">
            Start planning your perfect trips with AI
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Auth Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* OAuth Buttons */}
          <div className="space-y-3">
            <GoogleButton mode="signup" redirectTo={redirectTo} />
            <AppleButton mode="signup" redirectTo={redirectTo} />
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">or sign up with email</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <EmailPasswordForm mode="signup" redirectTo={redirectTo} />

          {/* Sign In Link */}
          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link 
              href={`/auth/login${redirectTo !== '/dashboard' ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`}
              className="font-semibold text-[#ec7a1c] hover:text-[#dd6012] transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500">
          By signing up, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-gray-700">Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline hover:text-gray-700">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ec7a1c]" />
      </div>
    }>
      <SignupContent />
    </Suspense>
  )
}
