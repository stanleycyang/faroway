'use client'

import { createClient } from '@/lib/supabase/client'

interface AppleButtonProps {
  mode: 'signin' | 'signup'
  redirectTo?: string
}

export function AppleButton({ mode, redirectTo = '/dashboard' }: AppleButtonProps) {
  const handleAppleAuth = async () => {
    const supabase = createClient()
    
    // Get the current origin for the callback URL
    const origin = window.location.origin
    const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: callbackUrl,
      },
    })
    
    if (error) {
      console.error('Apple auth error:', error.message)
    }
  }

  return (
    <button
      type="button"
      onClick={handleAppleAuth}
      className="w-full flex items-center justify-center gap-3 px-4 py-3 min-h-[48px] bg-black text-white rounded-xl font-medium hover:bg-gray-900 transition-all duration-200 shadow-sm"
    >
      {/* Apple Icon */}
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
      </svg>
      <span>
        {mode === 'signin' ? 'Continue with Apple' : 'Sign up with Apple'}
      </span>
    </button>
  )
}
