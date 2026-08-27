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

type FilterTab = 'all' | 'upcoming' | 'past';

function FeatureRow({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={20} color={colors.primary[500]} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

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
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.guestScrollContent}>
      <View style={styles.heroSection}>
        <View style={styles.heroIconContainer}>
          <LinearGradient colors={[colors.primary[50], '#fff']} style={styles.heroIconGradient}>
            <Ionicons name="airplane" size={48} color={colors.primary[500]} />
          </LinearGradient>
        </View>
        <Text style={styles.heroTitle}>
          {localTrips.length > 0
            ? `You have ${localTrips.length} trip${localTrips.length > 1 ? 's' : ''} on this device`
            : 'Your trips, all in one place'}
        </Text>
        <Text style={styles.heroSubtitle}>
          {localTrips.length > 0
            ? 'Sign in to save them to your account and open them on any device.'
            : 'Sign in to save your itineraries to your account and revisit your trip plans.'}
        </Text>
      </View>
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary[500]} style={{ marginVertical: 20 }} />
      ) : (
        <View style={styles.authButtons}>
          <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignIn} activeOpacity={0.7}>
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.socialButton, styles.appleButton]} onPress={handleAppleSignIn} activeOpacity={0.7}>
            <Ionicons name="logo-apple" size={20} color="#fff" />
            <Text style={[styles.socialButtonText, styles.appleButtonText]}>Continue with Apple</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={styles.termsText}>By continuing, you agree to our Terms and Privacy Policy.</Text>
      <View style={styles.featuresSection}>
        <FeatureRow icon="cloud-outline" title="Saved trips" subtitle="Keep generated plans tied to your account" />
        <FeatureRow icon="sparkles-outline" title="AI itineraries saved" subtitle="Generated plans stored and ready to revisit" />
        <FeatureRow icon="people-outline" title="Share links" subtitle="Send completed itineraries when sharing is enabled" />
      </View>
      <View style={styles.previewSection}>
        <Text style={styles.previewLabel}>What your trips will look like</Text>
        <View style={styles.previewCardsContainer}>
          <View style={styles.previewCard}>
            <View style={styles.previewImagePlaceholder}>
              <Ionicons name="image-outline" size={28} color={colors.surface[300]} />
            </View>
            <View style={styles.previewCardBody}>
              <View style={styles.previewPill} />
              <View style={[styles.previewPill, { width: 80 }]} />
            </View>
          </View>
          <View style={styles.previewCard}>
            <View style={styles.previewImagePlaceholder}>
              <Ionicons name="image-outline" size={28} color={colors.surface[300]} />
            </View>
            <View style={styles.previewCardBody}>
              <View style={styles.previewPill} />
              <View style={[styles.previewPill, { width: 60 }]} />
            </View>
          </View>
        </View>
      </View>
      <View style={styles.exploreCta}>
        <Text style={styles.exploreText}>Want to explore first?</Text>
        <Button title="Plan a Trip" onPress={() => router.push('/create')} size="md" variant="outline" style={styles.exploreButton} />
      </View>
    </ScrollView>
  );
}

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

  const filteredTrips = trips.filter((trip) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'upcoming') return ['draft', 'planned', 'active'].includes(trip.status);
    return trip.status === 'completed';
  });

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const handleTripPress = (tripId: string) => {
    hapticFeedback.light();
    router.push(`/trip/${tripId}`);
  };

  return (
    <>
      <View style={styles.tabContainer}>
        {filterTabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => {
              hapticFeedback.selection();
              setActiveTab(tab.id);
            }}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
      >
        {error && !loading && (
          <TouchableOpacity style={styles.errorBanner} onPress={onRefresh}>
            <Ionicons name="alert-circle-outline" size={18} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorRetry}>Tap to retry</Text>
          </TouchableOpacity>
        )}
        {initialLoad && loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
          </View>
        ) : trips.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <Ionicons name="airplane-outline" size={48} color={colors.surface[400]} />
            </View>
            <Text style={styles.emptyStateTitle}>No trips yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              Start planning your next adventure!{'\n'}
              Our AI will help you create the perfect itinerary.
            </Text>
            <Button title="Create Your First Trip" onPress={() => router.push('/create')} size="lg" style={styles.emptyStateButton} />
          </View>
        ) : filteredTrips.length === 0 ? (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>No {activeTab === 'upcoming' ? 'upcoming' : 'past'} trips</Text>
            <Button title="Plan a Trip" onPress={() => router.push('/create')} size="md" variant="outline" style={styles.emptyFilterButton} />
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
              daysCount={trip.days.length}
              onPress={() => handleTripPress(trip.id)}
            />
          ))
        )}
      </ScrollView>
    </>
  );
}

export default function TripsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Trips</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/create')}>
          <Ionicons name="add" size={24} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>
      {isAuthenticated ? <AuthenticatedTripsView /> : <GuestTripsView />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#0f172a' },
  addButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF5F4', justifyContent: 'center', alignItems: 'center' },
  guestScrollContent: { paddingHorizontal: 24, paddingBottom: 100 },
  heroSection: { alignItems: 'center', paddingTop: 16, paddingBottom: 8 },
  heroIconContainer: { marginBottom: 24 },
  heroIconGradient: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
  heroTitle: { fontSize: 24, fontWeight: '700', color: '#0f172a', textAlign: 'center', marginBottom: 12 },
  heroSubtitle: { fontSize: 15, color: '#475569', textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },
  authButtons: { gap: 10, marginTop: 24, marginBottom: 12 },
  termsText: { fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 18, marginBottom: 28 },
  socialButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', paddingVertical: 14, borderRadius: borderRadius.lg, gap: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  appleButton: { backgroundColor: '#000', borderColor: 'rgba(255,255,255,0.15)' },
  socialButtonText: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  appleButtonText: { color: '#fff' },
  featuresSection: { gap: 16, marginBottom: 32 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary[50], justifyContent: 'center', alignItems: 'center' },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 2 },
  featureSubtitle: { fontSize: 13, color: '#64748b' },
  previewSection: { paddingTop: 24, borderTopWidth: 1, borderTopColor: '#f1f5f9', marginBottom: 32 },
  previewLabel: { fontSize: 13, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 },
  previewCardsContainer: { gap: 12, opacity: 0.45 },
  previewCard: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: borderRadius.lg, overflow: 'hidden', height: 80 },
  previewImagePlaceholder: { width: 80, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  previewCardBody: { flex: 1, padding: 14, justifyContent: 'center', gap: 8 },
  previewPill: { width: 120, height: 12, borderRadius: 6, backgroundColor: '#e2e8f0' },
  exploreCta: { alignItems: 'center', gap: 12, paddingBottom: 16 },
  exploreText: { fontSize: 14, color: '#64748b' },
  exploreButton: { minWidth: 160 },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 24, gap: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: borderRadius.full, backgroundColor: '#f1f5f9' },
  tabActive: { backgroundColor: colors.primary[500] },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#fff' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 100 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyStateIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emptyStateTitle: { fontSize: 24, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  emptyStateSubtitle: { fontSize: 16, color: '#475569', textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  emptyStateButton: { minWidth: 220 },
  noResults: { paddingVertical: 48, alignItems: 'center', gap: 16 },
  noResultsText: { fontSize: 16, color: '#64748b' },
  emptyFilterButton: { minWidth: 160 },
  loadingContainer: { paddingVertical: 80, alignItems: 'center', justifyContent: 'center' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', borderRadius: borderRadius.lg, padding: 12, marginBottom: 16, gap: 8 },
  errorText: { flex: 1, fontSize: 14, color: '#dc2626' },
  errorRetry: { fontSize: 13, fontWeight: '600', color: '#dc2626' },
});
