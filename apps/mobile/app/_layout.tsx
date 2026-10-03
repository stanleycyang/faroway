import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { AuthProvider, useAuthContext } from '../components/AuthProvider';
import { NotificationProvider } from '../components/NotificationProvider';
import { OfflineProvider } from '../components/OfflineProvider';
import { TripSyncConflicts } from '../components/ui/TripSyncConflicts';
import { SyncStatusBanner } from '../components/ui/SyncStatusBanner';
import { useTripStore } from '../stores/tripStore';
import { useReduceMotion } from '../hooks/useReduceMotion';

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
  const isHydrated = useTripStore((state) => state.isHydrated);

  // Hydrate trips from offline storage on mount
  useEffect(() => {
    if (!isHydrated) {
      hydrateFromOffline();
    }
  }, [isHydrated, hydrateFromOffline]);

  // Show loading screen while initializing
  if (!initialized) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#ffffff',
        }}
      >
        <ActivityIndicator size="large" color="#F97066" />
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
