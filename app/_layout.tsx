import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuthContext } from '../components/AuthProvider';
import { NotificationProvider } from '../components/NotificationProvider';
import { OfflineProvider } from '../components/OfflineProvider';
import { SyncStatusBanner } from '../components/ui/SyncStatusBanner';
import { useTripStore } from '../stores/tripStore';

function RootLayoutNav() {
  const { isAuthenticated, initialized, loading } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();
  const hydrateFromOffline = useTripStore((state) => state.hydrateFromOffline);
  const isHydrated = useTripStore((state) => state.isHydrated);

  // Hydrate trips from offline storage on mount
  useEffect(() => {
    if (!isHydrated) {
      hydrateFromOffline();
    }
  }, [isHydrated, hydrateFromOffline]);

  useEffect(() => {
    if (!initialized) return;

    const inOnboarding = segments[0] === 'onboarding';
    const inIndex = (segments as string[]).length === 0 || segments[0] === undefined;
    const inCreate = segments[0] === 'create';
    const inTrip = segments[0] === 'trip';
    const inTabs = segments[0] === '(tabs)';
    
    // Protected routes that require authentication
    const protectedTabRoutes = ['profile'];
    const currentTab = segments[1];
    const isProtectedTab = inTabs && protectedTabRoutes.includes(currentTab as string);

    // Allow access to index (splash) screen
    if (inIndex) return;

    // CHANGED: Allow anonymous users to access:
    // - Onboarding
    // - Create trip flow
    // - View trips
    // - Main tabs (except profile)
    if (inOnboarding || inCreate || inTrip) return;
    
    // Allow tabs except protected ones
    if (inTabs && !isProtectedTab) return;
    
    // If user is not authenticated and trying to access protected routes
    if (!isAuthenticated && isProtectedTab) {
      // Don't redirect - we'll show AuthGate component instead
      return;
    }
  }, [isAuthenticated, initialized, segments]);

  // Show loading screen while initializing
  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <SyncStatusBanner position="top" autoHide={true} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0a0a0a' },
          animation: 'slide_from_right',
          animationDuration: 300,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{
            animation: 'fade',
            animationDuration: 200,
          }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{
            animation: 'fade',
            animationDuration: 250,
          }}
        />
        <Stack.Screen
          name="create"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            animationDuration: 350,
          }}
        />
        <Stack.Screen
          name="trip/[id]"
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            animation: 'slide_from_right',
            animationDuration: 300,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <OfflineProvider autoSync={true} syncOnForeground={true} syncOnMount={true}>
          <RootLayoutNav />
        </OfflineProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
