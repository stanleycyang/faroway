'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js'

interface UseUserReturn {
  user: User | null
  session: Session | null
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

/**
 * React hook to get the current authenticated user
 * Handles loading states, session refresh, and auth state changes
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, loading, signOut } = useUser()
 *   
 *   if (loading) return <div>Loading...</div>
 *   if (!user) return <div>Not logged in</div>
 *   
 *   return (
 *     <div>
 *       <p>Hello, {user.email}</p>
 *       <button onClick={signOut}>Sign out</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const supabase = createClient()

  // Fetch user data
  const fetchUser = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        throw sessionError
      }

      setSession(session)
      setUser(session?.user ?? null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch user'))
      setUser(null)
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [supabase.auth])

  // Refresh user data
  const refresh = useCallback(async () => {
    await fetchUser()
  }, [fetchUser])

  // Sign out
  const signOut = useCallback(async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      setSession(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to sign out'))
    } finally {
      setLoading(false)
    }
  }, [supabase.auth])

  // Initial fetch and subscribe to auth changes
  useEffect(() => {
    fetchUser()

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        // Handle specific auth events
        switch (event) {
          case 'SIGNED_IN':
            // User signed in
            break
          case 'SIGNED_OUT':
            // User signed out
            setUser(null)
            setSession(null)
            break
          case 'TOKEN_REFRESHED':
            // Session was refreshed
            break
          case 'USER_UPDATED':
            // User data was updated
            break
        }
      }
    )

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [fetchUser, supabase.auth])

  return {
    user,
    session,
    loading,
    error,
    refresh,
    signOut,
  }
}

/**
 * Helper hook to get user profile data from the users table
 * Call this after useUser to get extended profile information
 */
export function useUserProfile() {
  const { user, loading: userLoading } = useUser()
  const [profile, setProfile] = useState<{
    id: string
    email: string
    auth_provider: string
    subscription_tier: string
    created_at: string
    updated_at: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function fetchProfile() {
      if (!user) {
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { data, error: queryError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()

        if (queryError) throw queryError
        setProfile(data)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch profile'))
      } finally {
        setLoading(false)
      }
    }

    if (!userLoading) {
      fetchProfile()
    }
  }, [user, userLoading, supabase])

  return {
    profile,
    loading: userLoading || loading,
    error,
  }
}
