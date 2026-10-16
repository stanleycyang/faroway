import { cleanupDeletedAccount } from '../services/deletedAccountCleanup';
import {
  deleteAccountWithRecovery,
  finishAccountDeletionCleanup,
} from '../services/accountDeletionService';
import { devicePushConsent } from '../services/pushConsentService';
import { useState, useEffect, useCallback, useRef } from 'react';
import * as Sentry from '@sentry/react-native';
import { supabase } from '../lib/supabase';
import { readTripSession } from '../lib/tripAccountScope';
import {
  APPLE_SIGN_IN_UNAVAILABLE_MESSAGE,
  createRequestCanceledError,
  isAppleSignInSupported,
} from '../lib/authProviders';
import { useUserStore, type User as AppUser } from '../stores/userStore';
import { useTripStore } from '../stores/tripStore';
import {
  discardPendingOAuthTripDraft,
  resolveWebOAuthRedirectUrl,
  savePendingOAuthTripDraft,
  takePendingOAuthTripDraft,
} from '../lib/oauthReturnState';
import { setAuthToken, getUserProfile } from '../services/api';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
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

export interface GoogleSignInOptions {
  redirectTo?: string;
  preserveTripDraft?: boolean;
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
  const sessionEpochRef = useRef(0);
  const profileEpochRef = useRef(0);
  const activeAccountRef = useRef<string | null>(null);

  /**
   * Hydrate user store from profile API, falling back to Supabase auth metadata.
   */
  const hydrateUser = async (session: Session, isCurrent: () => boolean) => {
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
    const current = useUserStore.getState().user;
    const baseline = current?.id === authUser.id ? current : fallback;
    if (baseline === fallback) setUser(fallback);

    // Try fetching full profile from API
    try {
      const result = await getUserProfile(session.access_token);
      if (!isCurrent() || useUserStore.getState().user !== baseline) return;
      if (result.data?.id === authUser.id) {
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

    // Metadata is already visible. A failed enrichment must not replace edits.
  };

  // Only the latest session may hydrate local data or finish initialization.
  useEffect(() => {
    let active = true;
    const isCurrent = (epoch: number) => active && sessionEpochRef.current === epoch;
    const applySession = async (session: Session | null, epoch: number) => {
      if (!isCurrent(epoch)) return;
      const previousAccount = activeAccountRef.current;
      activeAccountRef.current = session?.user.id ?? null;
      if (previousAccount !== activeAccountRef.current || !session) ++profileEpochRef.current;
      if (!session) {
        setAuthToken(null);
        Sentry.setUser(null);
        clearUserStore();
        if (hadAuthenticatedSessionRef.current) clearTrips();
        hadAuthenticatedSessionRef.current = false;
      } else {
        if (previousAccount && previousAccount !== session.user.id) {
          clearUserStore();
          clearTrips();
        }
        hadAuthenticatedSessionRef.current = true;
        setAuthToken(session.access_token);
        if (useUserStore.getState().user?.id !== session.user.id) {
          const profileEpoch = profileEpochRef.current;
          // Session readiness opens the app; profile enrichment is independent
          // of token refresh and cannot overwrite a newer profile edit.
          void hydrateUser(
            session,
            () =>
              active &&
              profileEpochRef.current === profileEpoch &&
              activeAccountRef.current === session.user.id
          );
        }
      }
      if (!isCurrent(epoch)) return;
      setAuthState({ user: session?.user ?? null, session, loading: false, initialized: true });
    };
    const initialEpoch = ++sessionEpochRef.current;
    const initSession = async () => {
      try {
        if (Platform.OS === 'web') {
          try {
            const pendingDraft = takePendingOAuthTripDraft(window.sessionStorage);
            if (pendingDraft) useTripStore.getState().setDraftInput(pendingDraft);
          } catch {
            // Browser storage can be disabled; session recovery should still proceed.
          }
        }
        const {
          data: { session },
        } = await readTripSession();
        await applySession(session, initialEpoch);
      } catch {
        await applySession(null, initialEpoch);
      }
    };
    void initSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      const epoch = ++sessionEpochRef.current;
      void applySession(session, epoch);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // Zustand actions remain stable for the lifetime of this provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sign in with Google (native SDK)
  const signInWithGoogle = useCallback(async (options?: GoogleSignInOptions) => {
    await devicePushConsent.disable();
    try {
      setAuthState((prev) => ({ ...prev, loading: true }));

      if (Platform.OS === 'web') {
        const currentPath = `${window.location.pathname}${window.location.search}`;
        const preserveTripDraft =
          options?.preserveTripDraft ?? window.location.pathname.startsWith('/create');

        if (preserveTripDraft) {
          const draft = useTripStore.getState().draftInput;
          if (draft) {
            savePendingOAuthTripDraft(window.sessionStorage, draft);
          }
        }

        const redirectTo = resolveWebOAuthRedirectUrl(
          window.location.origin,
          currentPath,
          options?.redirectTo
        );
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
          },
        });

        if (error) {
          if (preserveTripDraft) {
            discardPendingOAuthTripDraft(window.sessionStorage);
          }
          throw error;
        }
        return data;
      }

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

    await devicePushConsent.disable();
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
    // Complete device-token removal before invalidating its authenticated session.
    const signingOutAccount = activeAccountRef.current;
    await devicePushConsent.disable();
    if (activeAccountRef.current !== signingOutAccount) {
      throw new Error('Your account changed. Reopen your profile before signing out.');
    }
    setAuthState((prev) => ({ ...prev, loading: true }));

    const { error } = await supabase.auth.signOut();

    if (error) {
      if (activeAccountRef.current === signingOutAccount)
        setAuthState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
    if (activeAccountRef.current && activeAccountRef.current !== signingOutAccount) return;
    ++sessionEpochRef.current;
    activeAccountRef.current = null;
    clearUserStore();
    clearTrips();
    hadAuthenticatedSessionRef.current = false;
    setAuthToken(null);
    Sentry.setUser(null);
    setAuthState({ user: null, session: null, loading: false, initialized: true });

    // Clear cached Google credentials so account picker shows on next sign-in
    try {
      const googleSignIn = await getGoogleSignInModule();
      await googleSignIn?.GoogleSignin.signOut();
    } catch {
      // Non-blocking — Google session may not exist (e.g. Apple sign-in user)
    }

    // Provider cleanup must not clear a new account that signed in while it ran.
  }, [clearTrips, clearUserStore]);

  // Delete account
  const deleteAccount = useCallback(async () => {
    setAuthState((prev) => ({ ...prev, loading: true }));

    const deletingUserId = useUserStore.getState().user?.id;
    const deletingRevision = useUserStore.getState().accountRevision;
    const isCurrentDeletion = () =>
      activeAccountRef.current === deletingUserId &&
      useUserStore.getState().accountRevision === deletingRevision;
    const result = deletingUserId
      ? await deleteAccountWithRecovery(deletingUserId)
      : { error: 'Sign in to resume deletion.' };

    if (result.error) {
      if (isCurrentDeletion()) setAuthState((prev) => ({ ...prev, loading: false }));
      throw new Error(result.error);
    }

    try {
      await finishAccountDeletionCleanup(deletingUserId!, cleanupDeletedAccount);
    } catch (error) {
      if (isCurrentDeletion()) setAuthState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
    if (!isCurrentDeletion()) return;
    hadAuthenticatedSessionRef.current = false;
    setAuthState({
      user: null,
      session: null,
      loading: false,
      initialized: true,
    });
  }, []);

  return {
    ...authState,
    isAuthenticated: !!authState.session,
    signInWithGoogle,
    signInWithApple,
    signOut,
    deleteAccount,
  };
}
