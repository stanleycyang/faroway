import { useState, useEffect, useCallback, useRef } from 'react';
import * as Sentry from '@sentry/react-native';
import { supabase } from '../lib/supabase';
import {
  APPLE_SIGN_IN_UNAVAILABLE_MESSAGE,
  createRequestCanceledError,
  isAppleSignInSupported,
} from '../lib/authProviders';
import { useUserStore, type User as AppUser } from '../stores/userStore';
import { useTripStore } from '../stores/tripStore';
import {
  setAuthToken,
  getUserProfile,
  deleteAccount as deleteAccountRequest,
} from '../services/api';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
// Anonymous-trip claim flow has been removed. Trip generation is auth-gated
// end-to-end, so trips always belong to a real Supabase user from creation.

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

let googleSignInModule: GoogleSignInModule | null | undefined;

async function getGoogleSignInModule(): Promise<GoogleSignInModule | null> {
  if (googleSignInModule !== undefined) {
    return googleSignInModule;
  }

  try {
    googleSignInModule = await import('@react-native-google-signin/google-signin');
    googleSignInModule.GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
  } catch {
    googleSignInModule = null;
  }

  return googleSignInModule;
}

const GOOGLE_SIGN_IN_NATIVE_MODULE_UNAVAILABLE_MESSAGE =
  'Google Sign-In requires a development or production build with the native Google Sign-In module installed.';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    initialized: false,
  });

  const { setUser, logout: clearUserStore } = useUserStore();
  const clearTrips = useTripStore((state) => state.clearAll);
  const hadAuthenticatedSessionRef = useRef(false);

  /**
   * Hydrate user store from profile API, falling back to Supabase auth metadata.
   */
  const hydrateUser = async (session: Session) => {
    const authUser = session.user;
    // Set auth token for API calls
    setAuthToken(session.access_token);
    // Set Sentry user context (anonymized ID only — no PII)
    Sentry.setUser({ id: authUser.id });

    // Start with Supabase metadata as fallback
    const fallback: AppUser = {
      id: authUser.id,
      name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
      email: authUser.email || '',
      avatar: authUser.user_metadata?.avatar_url,
      preferences: { vibes: [] as string[] },
    };

    // Try fetching full profile from API
    try {
      const result = await getUserProfile();
      if (result.data) {
        const profile = result.data;
        setUser({
          id: profile.id,
          name: profile.name || fallback.name,
          email: profile.email,
          avatar: profile.avatar || fallback.avatar,
          preferences: {
            vibes: profile.preferences?.vibes || [],
            budget: profile.preferences?.budget,
            travelerType: profile.preferences?.travelerType,
          },
          notificationSettings: profile.notificationSettings,
        });
        return;
      }
    } catch {
      // Profile hydration is best-effort; auth metadata is enough to keep sign-in moving.
    }

    setUser(fallback);
  };

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    const initSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          hadAuthenticatedSessionRef.current = true;
          // Hydrate user store before marking initialized so screens never see
          // an authenticated-but-empty user state. hydrateUser catches its own
          // errors and always calls setUser() before returning.
          await hydrateUser(session);
        }

        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
          initialized: true,
        });
      } catch {
        setAuthState((prev) => ({ ...prev, loading: false, initialized: true }));
      }
    };

    initSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
          initialized: true,
        });

        if (session) {
          hadAuthenticatedSessionRef.current = true;
          await hydrateUser(session);
        } else {
          setAuthToken(null);
          Sentry.setUser(null);
          clearUserStore();
          if (hadAuthenticatedSessionRef.current) {
            clearTrips();
          }
          hadAuthenticatedSessionRef.current = false;
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // setUser/clearUserStore are stable zustand selectors

  // Sign in with Google (native SDK)
  const signInWithGoogle = useCallback(async () => {
    try {
      setAuthState((prev) => ({ ...prev, loading: true }));

      const googleSignIn = await getGoogleSignInModule();
      if (!googleSignIn) {
        throw new Error(GOOGLE_SIGN_IN_NATIVE_MODULE_UNAVAILABLE_MESSAGE);
      }

      const { GoogleSignin, isCancelledResponse } = googleSignIn;
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (isCancelledResponse(response)) {
        throw createRequestCanceledError('Google Sign-In was canceled');
      }

      if (!response.data?.idToken) {
        throw new Error('No ID token returned from Google Sign-In');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.data.idToken,
      });

      if (error) throw error;

      return data;
    } catch (error) {
      setAuthState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  }, []);

  // Sign in with Apple
  const signInWithApple = useCallback(async () => {
    if (!isAppleSignInSupported()) {
      throw new Error(APPLE_SIGN_IN_UNAVAILABLE_MESSAGE);
    }

    try {
      setAuthState((prev) => ({ ...prev, loading: true }));

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('No identity token returned from Sign in with Apple');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) throw error;

      // Update user metadata with Apple name if available
      if (credential.fullName && data.user) {
        const fullName = [credential.fullName.givenName, credential.fullName.familyName]
          .filter(Boolean)
          .join(' ');

        if (fullName) {
          await supabase.auth.updateUser({
            data: { full_name: fullName },
          });
        }
      }

      return data;
    } catch (error) {
      setAuthState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    setAuthState((prev) => ({ ...prev, loading: true }));

    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthState((prev) => ({ ...prev, loading: false }));
      throw error;
    }

    // Clear cached Google credentials so account picker shows on next sign-in
    try {
      const googleSignIn = await getGoogleSignInModule();
      await googleSignIn?.GoogleSignin.signOut();
    } catch {
      // Non-blocking — Google session may not exist (e.g. Apple sign-in user)
    }

    clearUserStore();
    clearTrips();
    hadAuthenticatedSessionRef.current = false;
    setAuthToken(null);
  }, [clearTrips, clearUserStore]);

  // Delete account
  const deleteAccount = useCallback(async () => {
    setAuthState((prev) => ({ ...prev, loading: true }));

    const result = await deleteAccountRequest();

    if (result.error) {
      setAuthState((prev) => ({ ...prev, loading: false }));
      throw new Error(result.error);
    }

    try {
      await supabase.auth.signOut();
    } catch {
      // The server has already deleted the auth user; local cleanup still needs to run.
    }

    try {
      const googleSignIn = await getGoogleSignInModule();
      await googleSignIn?.GoogleSignin.signOut();
    } catch {
      // Non-blocking — Google session may not exist (e.g. Apple sign-in user)
    }

    setAuthToken(null);
    clearUserStore();
    clearTrips();
    hadAuthenticatedSessionRef.current = false;
    setAuthState({
      user: null,
      session: null,
      loading: false,
      initialized: true,
    });
  }, [clearTrips, clearUserStore]);

  return {
    ...authState,
    isAuthenticated: !!authState.session,
    signInWithGoogle,
    signInWithApple,
    signOut,
    deleteAccount,
  };
}
