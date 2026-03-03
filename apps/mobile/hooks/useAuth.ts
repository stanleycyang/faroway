import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/userStore';
import { setAuthToken, getUserProfile } from '../services/api';
import { API_BASE_URL } from '../constants/api';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

const ANONYMOUS_TRIPS_KEY = '@faroway/anonymous_trips';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

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

  /**
   * Hydrate user store from profile API, falling back to Supabase auth metadata.
   */
  const hydrateUser = async (session: Session) => {
    const authUser = session.user;
    // Set auth token for API calls
    setAuthToken(session.access_token);

    // Start with Supabase metadata as fallback
    const fallback = {
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
        } as any);
        return;
      }
    } catch (err) {
      console.warn('Failed to fetch profile from API, using auth metadata:', err);
    }

    setUser(fallback);
  };

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
        }

        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
          initialized: true,
        });

        if (session) {
          await hydrateUser(session);
        }
      } catch (error) {
        console.error('Error initializing session:', error);
        setAuthState(prev => ({ ...prev, loading: false, initialized: true }));
      }
    };

    initSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('Auth state changed:', event);

        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
          initialized: true,
        });

        if (session) {
          await hydrateUser(session);

          // Claim any anonymous trips stored locally
          try {
            const stored = await AsyncStorage.getItem(ANONYMOUS_TRIPS_KEY);
            if (stored) {
              const tripIds = JSON.parse(stored);
              if (Array.isArray(tripIds) && tripIds.length > 0) {
                fetch(`${API_BASE_URL}/api/auth/claim-trips`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                  body: JSON.stringify({ tripIds }),
                }).finally(() => {
                  AsyncStorage.removeItem(ANONYMOUS_TRIPS_KEY);
                });
              }
            }
          } catch {
            // Non-blocking — don't prevent sign-in flow
          }
        } else {
          setAuthToken(null);
          clearUserStore();
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
      setAuthState(prev => ({ ...prev, loading: true }));

      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

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
      console.error('Google sign in error:', error);
      setAuthState(prev => ({ ...prev, loading: false }));
      throw error;
    }
  }, []);

  // Sign in with Apple
  const signInWithApple = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Error', 'Apple Sign In is only available on iOS devices');
      return;
    }

    try {
      setAuthState(prev => ({ ...prev, loading: true }));
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
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
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled the sign in
        setAuthState(prev => ({ ...prev, loading: false }));
        return;
      }
      console.error('Apple sign in error:', error);
      setAuthState(prev => ({ ...prev, loading: false }));
      throw error;
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    setAuthState(prev => ({ ...prev, loading: true }));

    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthState(prev => ({ ...prev, loading: false }));
      throw error;
    }

    // Clear cached Google credentials so account picker shows on next sign-in
    try {
      await GoogleSignin.signOut();
    } catch {
      // Non-blocking — Google session may not exist (e.g. Apple sign-in user)
    }

    clearUserStore();
  }, [clearUserStore]);

  return {
    ...authState,
    isAuthenticated: !!authState.session,
    signInWithGoogle,
    signInWithApple,
    signOut,
  };
}
