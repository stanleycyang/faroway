import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TripCard, Button } from '../../components/ui';
import { useTripStore } from '../../stores/tripStore';
import { colors, borderRadius, shadows } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';

type FilterTab = 'all' | 'upcoming' | 'past';

export default function TripsScreen() {
  const router = useRouter();
  const { trips } = useTripStore();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past' },
  ];

  const filteredTrips = trips.filter((trip) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'upcoming') {
      return ['draft', 'planned', 'active'].includes(trip.status);
    }
    return trip.status === 'completed';
  });

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} - ${endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  };

  const handleTripPress = (tripId: string) => {
    hapticFeedback.light();
    router.push(`/trip/${tripId}`);
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyStateIcon}>
        <Text style={styles.emptyStateEmoji}>🗺️</Text>
      </View>
      <Text style={styles.emptyStateTitle}>No trips yet</Text>
      <Text style={styles.emptyStateSubtitle}>
        Start planning your next adventure!{'\n'}
        Our AI will help you create the perfect itinerary.
      </Text>
      <Button
        title="Create Your First Trip"
        onPress={() => router.push('/create')}
        size="lg"
        style={styles.emptyStateButton}
      />
    </View>
  );

  const renderSampleTrips = () => {
    // Sample trips for demo purposes
    const sampleTrips = [
      {
        id: 'sample-1',
        destination: 'Tokyo',
        country: 'Japan',
        dates: 'Mar 15 - Mar 22, 2026',
        image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
        status: 'planned' as const,
        daysCount: 7,
      },
      {
        id: 'sample-2',
        destination: 'Barcelona',
        country: 'Spain',
        dates: 'Apr 5 - Apr 12, 2026',
        image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80',
        status: 'draft' as const,
        daysCount: 7,
      },
    ];

    return (
      <>
        {sampleTrips.map((trip) => (
          <TripCard
            key={trip.id}
            destination={trip.destination}
            country={trip.country}
            dates={trip.dates}
            image={trip.image}
            status={trip.status}
            daysCount={trip.daysCount}
            onPress={() => handleTripPress(trip.id)}
          />
        ))}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Trips</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/create')}
        >
          <Ionicons name="add" size={24} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

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
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {trips.length === 0 ? (
          <>
            {renderEmptyState()}
            <View style={styles.sampleSection}>
              <Text style={styles.sampleTitle}>Sample Trips</Text>
              <Text style={styles.sampleSubtitle}>
                Here's what your trips could look like
              </Text>
              {renderSampleTrips()}
            </View>
          </>
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
                  daysCount={trip.days.length}
                  onPress={() => handleTripPress(trip.id)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    color: colors.neutral[900],
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
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
    backgroundColor: colors.neutral[100],
  },
  tabActive: {
    backgroundColor: colors.neutral[900],
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[600],
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
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyStateEmoji: {
    fontSize: 56,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[900],
    marginBottom: 12,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: colors.neutral[500],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyStateButton: {
    minWidth: 220,
  },
  sampleSection: {
    marginTop: 32,
    paddingTop: 32,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  sampleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[900],
    marginBottom: 4,
  },
  sampleSubtitle: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: 20,
  },
  noResults: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: colors.neutral[500],
  },
});
