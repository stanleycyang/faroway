import { useLocalCalendarDate } from '../../hooks/useLocalCalendarDate';
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TripCard, Button } from '../../components/ui';
import { useTrips } from '../../hooks/useTrips';
import { useAuthContext } from '../../components/AuthProvider';
import { useTripStore } from '../../stores/tripStore';
import { colors, borderRadius } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';
import * as WebBrowser from 'expo-web-browser';
import { formatTripDate, tripDurationDays } from '../../lib/tripDate';

import { tripDatePhase } from '@faroway/constants';

type FilterTab = 'all' | 'upcoming' | 'past';

// ─── Guest CTA (signed-out state) ──────────────────────────

function GuestTripsView() {
  const { signInWithGoogle, signInWithApple, loading } = useAuthContext();
  const router = useRouter();
  const { trips: localTrips } = useTripStore();
  const [authLoading, setAuthLoading] = useState(false);

  const isLoading = loading || authLoading;

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithGoogle();
      hapticFeedback.success();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Please try again';
      Alert.alert('Sign In Failed', msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithApple();
      hapticFeedback.success();
    } catch (error: unknown) {
      const e = error as { code?: string; message?: string };
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign In Failed', e.message || 'Please try again');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.guestScrollContent}
    >
      {/* Hero */}
      <View style={styles.heroSection}>
        <View style={styles.heroIconContainer} accessible={false}>
          <LinearGradient colors={[colors.primary[50], '#fff']} style={styles.heroIconGradient}>
            <Ionicons name="airplane" size={48} color={colors.primary[500]} />
          </LinearGradient>
        </View>

        <Text style={styles.heroTitle}>Sign in to save your trips</Text>
        <Text style={styles.heroSubtitle}>
          {localTrips.length > 0
            ? `Keep ${localTrips.length} trip${localTrips.length > 1 ? 's' : ''} backed up and ready on every device.`
            : 'Keep every itinerary backed up and ready on all your devices.'}
        </Text>
      </View>

      {/* Sign-in buttons */}
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={colors.primary[500]}
          style={{ marginVertical: 20 }}
        />
      ) : (
        <View style={styles.authButtons}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleGoogleSignIn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton]}
              onPress={handleAppleSignIn}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Continue with Apple"
            >
              <Ionicons name="logo-apple" size={20} color="#fff" />
              <Text style={[styles.socialButtonText, styles.appleButtonText]}>
                Continue with Apple
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={styles.termsText}>
        By continuing, you agree to our{' '}
        <Text
          style={styles.termsLink}
          onPress={() => WebBrowser.openBrowserAsync('https://faroway.ai/terms')}
          accessibilityRole="link"
        >
          Terms
        </Text>{' '}
        and{' '}
        <Text
          style={styles.termsLink}
          onPress={() => WebBrowser.openBrowserAsync('https://faroway.ai/privacy')}
          accessibilityRole="link"
        >
          Privacy Policy
        </Text>
        .
      </Text>

      <View style={styles.exploreCta}>
        <Button
          title="Start planning"
          onPress={() => router.push('/create')}
          size="md"
          variant="outline"
          style={styles.exploreButton}
          accessibilityHint="Choose a destination and dates before signing in to generate"
        />
      </View>
    </ScrollView>
  );
}

// ─── Authenticated trips list ──────────────────────────

function AuthenticatedTripsView() {
  const router = useRouter();
  const { trips, loading, error, fetchTrips } = useTrips();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    fetchTrips().finally(() => setInitialLoad(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTrips();
    setRefreshing(false);
  }, [fetchTrips]);

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past' },
  ];

  const today = useLocalCalendarDate();
  const filteredTrips = trips.filter((trip) => {
    if (activeTab === 'all') return true;
    return tripDatePhase(trip.startDate, trip.endDate, today) === activeTab;
  });

  const formatDateRange = (start: string, end: string) => {
    const first = formatTripDate(start, { month: 'short', day: 'numeric' });
    const last = formatTripDate(end, { month: 'short', day: 'numeric', year: 'numeric' });
    return first === 'Date unavailable' || last === 'Date unavailable'
      ? 'Travel dates unavailable'
      : `${first} - ${last}`;
  };

  const handleTripPress = (tripId: string) => {
    hapticFeedback.light();
    router.push(`/trip/${tripId}`);
  };

  return (
    <>
      {/* Filter Tabs */}
      <View style={styles.tabContainer}>
        {filterTabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => {
              hapticFeedback.selection();
              setActiveTab(tab.id);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.id }}
            accessibilityLabel={`${tab.label} trips`}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
        }
      >
        {error && !loading && (
          <TouchableOpacity
            style={styles.errorBanner}
            onPress={onRefresh}
            accessibilityRole="button"
            accessibilityLabel={`${error}. Retry loading trips`}
          >
            <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorRetry}>Tap to retry</Text>
          </TouchableOpacity>
        )}

        {initialLoad && loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
          </View>
        ) : error && trips.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>Your trips couldn’t load</Text>
            <Text style={styles.emptyStateSubtitle}>
              We couldn’t confirm your saved trips. Use the retry above when you’re ready.
            </Text>
          </View>
        ) : trips.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <Ionicons name="airplane-outline" size={48} color={colors.surface[400]} />
            </View>
            <Text style={styles.emptyStateTitle}>No trips yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              Start planning your next adventure!{'\n'}
              Shape a day-by-day plan around what you love.
            </Text>
            <Button
              title="Create Your First Trip"
              onPress={() => router.push('/create')}
              size="lg"
              style={styles.emptyStateButton}
            />
          </View>
        ) : (
          <>
            {filteredTrips.length === 0 ? (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>
                  No {activeTab === 'upcoming' ? 'upcoming' : 'past'} trips
                </Text>
              </View>
            ) : (
              filteredTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  destination={trip.destination}
                  country={trip.country}
                  dates={formatDateRange(trip.startDate, trip.endDate)}
                  image={trip.coverImage}
                  status={trip.status}
                  daysCount={tripDurationDays(trip.startDate, trip.endDate)}
                  onPress={() => handleTripPress(trip.id)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

// ─── Main screen ──────────────────────────

export default function TripsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          My Trips
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/create')}
          accessibilityRole="button"
          accessibilityLabel="Plan a new trip"
        >
          <Ionicons name="add" size={24} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      {isAuthenticated ? <AuthenticatedTripsView /> : <GuestTripsView />}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF5F4',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Guest / Signed-Out ──────────
  guestScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
  },
  heroIconContainer: {
    marginBottom: 24,
  },
  heroIconGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  authButtons: {
    gap: 10,
    marginTop: 24,
    marginBottom: 12,
  },
  termsText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  termsLink: {
    color: colors.primary[600],
    textDecorationLine: 'underline',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  appleButton: {
    backgroundColor: '#000',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  appleButtonText: {
    color: '#fff',
  },
  exploreCta: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  exploreButton: {
    minWidth: 160,
  },

  // ─── Authenticated ──────────
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: borderRadius.full,
    backgroundColor: '#f1f5f9',
  },
  tabActive: {
    backgroundColor: colors.primary[500],
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#fff',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyStateButton: {
    minWidth: 220,
  },
  noResults: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#64748b',
  },
  loadingContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: borderRadius.lg,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#dc2626',
  },
  errorRetry: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626',
  },
});
