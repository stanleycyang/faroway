import { useEffect, useState } from 'react';
import { Stack, router, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { AuthProvider, useAuthContext } from '../components/AuthProvider';
import { NotificationProvider } from '../components/NotificationProvider';
import { OfflineProvider } from '../components/OfflineProvider';
import { TripSyncConflicts } from '../components/ui/TripSyncConflicts';
import { SyncStatusBanner } from '../components/ui/SyncStatusBanner';
import { useTripStore } from '../stores/tripStore';
import { useUserStore } from '../stores/userStore';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { FONT_LOAD_TIMEOUT_MS, FONT_SOURCES } from '../constants/fonts';

SplashScreen.preventAutoHideAsync?.().catch(() => {});

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.1,
  // Attach JS bundle source maps for readable stack traces
  attachStacktrace: true,
  // Don't send events in dev unless DSN is explicitly set
  enabled: !__DEV__ || !!process.env.EXPO_PUBLIC_SENTRY_DSN,
});

function RootLayoutNav() {
  const { initialized } = useAuthContext();
  const reduceMotion = useReduceMotion();
  const hydrateFromOffline = useTripStore((state) => state.hydrateFromOffline);
  const accountRevision = useUserStore((state) => state.accountRevision);
  const [fontsLoaded, fontError] = useFonts(FONT_SOURCES);
  const [fontTimedOut, setFontTimedOut] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const timer = setTimeout(() => setFontTimedOut(true), FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  const fontsReady = fontsLoaded || Boolean(fontError) || fontTimedOut;

  useEffect(() => {
    if (initialized && fontsReady) {
      void SplashScreen.hideAsync?.().catch(() => {});
    }
  }, [initialized, fontsReady]);

  // Never expose a cache before Auth has resolved its owner. Rehydrate after
  // account changes even when a previous account completed hydration.
  useEffect(() => {
    if (initialized) void hydrateFromOffline();
  }, [initialized, accountRevision, hydrateFromOffline]);

  // Show loading screen while initializing
  if (!initialized) {
    return (
      <View
        accessibilityLabel="Loading account"
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#ffffff',
        }}
      >
        <ActivityIndicator size="large" color="#C03A31" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <SyncStatusBanner position="top" autoHide={true} />
      <TripSyncConflicts />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#ffffff' },
          animation: reduceMotion ? 'none' : 'slide_from_right',
          animationDuration: reduceMotion ? 0 : 300,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            animation: reduceMotion ? 'none' : 'fade',
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{
            animation: reduceMotion ? 'none' : 'fade',
            animationDuration: reduceMotion ? 0 : 200,
          }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{
            animation: reduceMotion ? 'none' : 'fade',
            animationDuration: reduceMotion ? 0 : 250,
          }}
        />
        <Stack.Screen
          name="create"
          options={{
            presentation: 'modal',
            animation: reduceMotion ? 'none' : 'slide_from_bottom',
            animationDuration: reduceMotion ? 0 : 350,
          }}
        />
        <Stack.Screen
          name="trip/[id]"
          options={{
            animation: reduceMotion ? 'none' : 'slide_from_right',
            animationDuration: reduceMotion ? 0 : 300,
          }}
        />
        <Stack.Screen
          name="inspiration/[slug]"
          options={{
            animation: reduceMotion ? 'none' : 'slide_from_bottom',
            animationDuration: reduceMotion ? 0 : 350,
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            animation: reduceMotion ? 'none' : 'slide_from_right',
            animationDuration: reduceMotion ? 0 : 300,
          }}
        />
      </Stack>
    </>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <View style={errorStyles.container}>
      <Text style={errorStyles.title}>Something went wrong</Text>
      <Text style={errorStyles.subtitle}>
        Your saved trips are safe. Try reloading this screen or returning home.
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={retry}
        style={errorStyles.primaryButton}
      >
        <Text style={errorStyles.primaryText}>Try again</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => {
          try {
            router.replace('/(tabs)');
          } catch {
            // Ignore navigation errors if the router is unmounted.
          } finally {
            retry();
          }
        }}
        style={errorStyles.secondaryButton}
      >
        <Text style={errorStyles.secondaryText}>Go home</Text>
      </TouchableOpacity>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 320,
  },
  primaryButton: {
    minHeight: 48,
    minWidth: 200,
    borderRadius: 999,
    backgroundColor: '#C03A31',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 12,
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default Sentry.wrap(function RootLayout() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <OfflineProvider autoSync={true} syncOnForeground={true} syncOnMount={true}>
          <RootLayoutNav />
        </OfflineProvider>
      </NotificationProvider>
    </AuthProvider>
  );
});
