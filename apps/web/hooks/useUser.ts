"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { withAuthRequestDeadline } from "@/lib/auth/request-deadline";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";

interface UseUserReturn {
  user: User | null;
  session: Session | null;
  loading: boolean;
  accountRevision: number;
  error: Error | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [accountRevision, setAccountRevision] = useState(0);
  const accountOwner = useRef<string | null>(null);
  const updateAccountOwner = useCallback((owner: string | null) => {
    if (accountOwner.current === owner) return;
    accountOwner.current = owner;
    setAccountRevision((revision) => revision + 1);
  }, []);
  const activeRef = useRef(false);
  const epochRef = useRef(0);

  // Fetch user data
  const fetchUser = useCallback(async () => {
    if (!activeRef.current) return;
    const epoch = ++epochRef.current;
    const isCurrent = () => activeRef.current && epochRef.current === epoch;
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const {
        data: { session },
        error: sessionError,
      } = await withAuthRequestDeadline(supabase.auth.getSession());

      if (!isCurrent()) return;
      if (sessionError) {
        throw sessionError;
      }

      updateAccountOwner(session?.user.id ?? null);
      setSession(session);
      setUser(session?.user ?? null);
    } catch (err) {
      if (!isCurrent()) return;
      setError(err instanceof Error ? err : new Error("Failed to fetch user"));
      updateAccountOwner(null);
      setUser(null);
      setSession(null);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [updateAccountOwner]);

  // Refresh user data
  const refresh = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  // Sign out
  const signOut = useCallback(async () => {
    if (!activeRef.current) return;
    const epoch = ++epochRef.current;
    const isCurrent = () => activeRef.current && epochRef.current === epoch;
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const { error } = await withAuthRequestDeadline(supabase.auth.signOut());
      if (!isCurrent()) return;
      if (error) throw error;
      updateAccountOwner(null);
      setUser(null);
      setSession(null);
    } catch (err) {
      if (!isCurrent()) return;
      setError(err instanceof Error ? err : new Error("Failed to sign out"));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [updateAccountOwner]);

  // Initial fetch and subscribe to auth changes
  useEffect(() => {
    let subscribed = true;
    activeRef.current = true;
    void fetchUser();

    const supabase = createClient();

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (!subscribed) return;
        epochRef.current++;
        updateAccountOwner(
          event === "SIGNED_OUT" ? null : (session?.user.id ?? null),
        );
        setError(null);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        switch (event) {
          case "SIGNED_OUT":
            setUser(null);
            setSession(null);
            break;
          case "SIGNED_IN":
          case "TOKEN_REFRESHED":
          case "USER_UPDATED":
            break;
        }
      },
    );

    // Cleanup subscription on unmount
    return () => {
      subscribed = false;
      activeRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchUser, updateAccountOwner]);

  return {
    user,
    session,
    accountRevision,
    loading,
    error,
    refresh,
    signOut,
  };
}

/**
 * Helper hook to get user profile data from the users table
 * Call this after useUser to get extended profile information
 */
export function useUserProfile() {
  const { user, loading: userLoading, accountRevision } = useUser();
  const userId = user?.id;
  const [profileScope, setProfileScope] = useState<{
    ownerId: string | undefined;
    revision: number;
  } | null>(null);
  const [profile, setProfile] = useState<{
    id: string;
    email: string;
    auth_provider: string;
    subscription_tier: string;
    created_at: string;
    updated_at: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchProfile() {
      setProfileScope({ ownerId: userId, revision: accountRevision });
      setProfile(null);
      setError(null);
      if (!userId) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const supabase = createClient();
        const { data, error: queryError } = await withAuthRequestDeadline(
          Promise.resolve(
            supabase.from("users").select("*").eq("id", userId).single(),
          ),
        );
        if (!active) return;

        if (queryError) throw queryError;
        if (data?.id !== userId)
          throw new Error("Your profile could not be confirmed. Please retry.");
        setProfile(data);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err : new Error("Failed to fetch profile"),
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    if (!userLoading) {
      void fetchProfile();
    }
    return () => {
      active = false;
    };
  }, [userId, userLoading, accountRevision]);

  const belongsToAccount =
    profileScope?.ownerId === userId &&
    profileScope?.revision === accountRevision;
  return {
    profile: belongsToAccount ? profile : null,
    loading: userLoading || !belongsToAccount || loading,
    error: belongsToAccount ? error : null,
  };
}
