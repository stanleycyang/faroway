import { useState, useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/userStore';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

// Required for expo-auth-session
WebBrowser.maybeCompleteAuthSession();

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
        
        if (session?.user) {
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || '',
            avatar: session.user.user_metadata?.avatar_url,
            preferences: {
              vibes: [],
            },
          });
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

        if (session?.user) {
          setUser({
            id: session.user.id,
            name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
            email: session.user.email || '',
            avatar: session.user.user_metadata?.avatar_url,
            preferences: {
              vibes: [],
            },
          });
        } else {
          clearUserStore();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // setUser/clearUserStore are stable zustand selectors

  // Sign in with email/password
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true }));
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setAuthState(prev => ({ ...prev, loading: false }));
      throw error;
    }

    return data;
  }, []);

  // Sign up with email/password
  const signUpWithEmail = useCallback(async (email: string, password: string, fullName?: string) => {
    setAuthState(prev => ({ ...prev, loading: true }));
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setAuthState(prev => ({ ...prev, loading: false }));
      throw error;
    }

    return data;
  }, []);

  // Sign in with Google OAuth
  const signInWithGoogle = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true }));
      
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'tripgenie',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === 'success' && result.url) {
          // Extract the tokens from the URL
          const url = new URL(result.url);
          const params = new URLSearchParams(url.hash.substring(1));
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');

          if (access_token && refresh_token) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (sessionError) throw sessionError;
            return sessionData;
          }
        }
      }
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
    
    clearUserStore();
  }, [clearUserStore]);

  // Send password reset email
  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.EXPO_PUBLIC_API_URL}/auth/reset-password`,
    });

    if (error) throw error;
  }, []);

  return {
    ...authState,
    isAuthenticated: !!authState.session,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
    signOut,
    resetPassword,
  };
}
