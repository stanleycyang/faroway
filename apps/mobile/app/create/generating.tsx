import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Animated,
  Easing,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTripStore, Trip, TripDay, Activity } from '../../stores/tripStore';
import { popularDestinations } from '@tripgenie/constants';
import { colors, borderRadius } from '../../constants/theme';
import { useItineraryGeneration } from '../../hooks/useItineraryGeneration';
import { registry } from '../../lib/json-render/registry';
import type { SearchResults } from '../../services/searchService';

const { width, height } = Dimensions.get('window');

const GENERATION_STEPS = [
  { text: 'Understanding your preferences...', emoji: '🔍', progress: 'orchestrator' },
  { text: 'Searching for hotels...', emoji: '🏨', progress: 'hotels' },
  { text: 'Finding activities & attractions...', emoji: '✨', progress: 'activities' },
  { text: 'Discovering best restaurants...', emoji: '🍽️', progress: 'dining' },
  { text: 'Crafting your perfect itinerary...', emoji: '📝', progress: 'aggregator' },
];

/**
 * Convert search results to Trip format for the app
 */
function convertResultsToTrip(
  searchId: string,
  results: SearchResults,
  input: any
): Trip {
  const destinationInfo = popularDestinations.find(
    (d) => d.name === input.destination
  );

  // Convert itinerary days to TripDay format
  const days: TripDay[] = results.itinerary.map((day) => {
    const activities: Activity[] = [];

    // Morning activities
    day.morning.activities.forEach((activity, idx) => {
      activities.push({
        id: activity.id,
        time: `${9 + idx}:00`,
        title: activity.name,
        description: activity.description,
        location: activity.location.name,
        duration: `${Math.round(activity.duration / 60)} hours`,
        type: 'activity',
        price: `$${activity.price}`,
        rating: activity.rating,
        reviewCount: activity.reviewCount,
        image: activity.images[0],
        bookingUrl: activity.affiliateUrl,
      });
    });

    // Morning meal
    if (day.morning.meal) {
      activities.push({
        id: day.morning.meal.id,
        time: '08:00',
        title: day.morning.meal.name,
        description: day.morning.meal.description,
        location: day.morning.meal.location.name,
        duration: '1 hour',
        type: 'restaurant',
        price: '$'.repeat(day.morning.meal.priceLevel),
        rating: day.morning.meal.rating,
        reviewCount: day.morning.meal.reviewCount,
        image: day.morning.meal.images[0],
        bookingUrl: day.morning.meal.reservationUrl,
      });
    }

    // Afternoon activities
    day.afternoon.activities.forEach((activity, idx) => {
      activities.push({
        id: activity.id,
        time: `${14 + idx}:00`,
        title: activity.name,
        description: activity.description,
        location: activity.location.name,
        duration: `${Math.round(activity.duration / 60)} hours`,
        type: 'activity',
        price: `$${activity.price}`,
        rating: activity.rating,
        reviewCount: activity.reviewCount,
        image: activity.images[0],
        bookingUrl: activity.affiliateUrl,
      });
    });

    // Lunch
    if (day.afternoon.meal) {
      activities.push({
        id: day.afternoon.meal.id,
        time: '12:30',
        title: day.afternoon.meal.name,
        description: day.afternoon.meal.description,
        location: day.afternoon.meal.location.name,
        duration: '1.5 hours',
        type: 'restaurant',
        price: '$'.repeat(day.afternoon.meal.priceLevel),
        rating: day.afternoon.meal.rating,
        reviewCount: day.afternoon.meal.reviewCount,
        image: day.afternoon.meal.images[0],
        bookingUrl: day.afternoon.meal.reservationUrl,
      });
    }

    // Evening activities
    day.evening.activities.forEach((activity, idx) => {
      activities.push({
        id: activity.id,
        time: `${18 + idx}:00`,
        title: activity.name,
        description: activity.description,
        location: activity.location.name,
        duration: `${Math.round(activity.duration / 60)} hours`,
        type: 'activity',
        price: `$${activity.price}`,
        rating: activity.rating,
        reviewCount: activity.reviewCount,
        image: activity.images[0],
        bookingUrl: activity.affiliateUrl,
      });
    });

    // Dinner
    if (day.evening.meal) {
      activities.push({
        id: day.evening.meal.id,
        time: '19:30',
        title: day.evening.meal.name,
        description: day.evening.meal.description,
        location: day.evening.meal.location.name,
        duration: '2 hours',
        type: 'restaurant',
        price: '$'.repeat(day.evening.meal.priceLevel),
        rating: day.evening.meal.rating,
        reviewCount: day.evening.meal.reviewCount,
        image: day.evening.meal.images[0],
        bookingUrl: day.evening.meal.reservationUrl,
      });
    }

    // Sort activities by time
    activities.sort((a, b) => {
      const timeA = parseInt(a.time.split(':')[0]);
      const timeB = parseInt(b.time.split(':')[0]);
      return timeA - timeB;
    });

    return {
      date: day.date,
      dayNumber: day.dayNumber,
      theme: day.title,
      activities,
    };
  });

  // Get the top hotel
  const topHotel = results.hotels[0];

  return {
    id: searchId,
    destination: input.destination,
    country: input.country || destinationInfo?.country || '',
    startDate: input.startDate,
    endDate: input.endDate,
    travelers: input.travelers,
    travelerType: input.travelerType,
    vibes: input.vibes,
    budget: input.budget,
    days,
    hotel: topHotel
      ? {
          id: topHotel.id,
          name: topHotel.name,
          description: topHotel.description,
          pricePerNight: topHotel.pricePerNight,
          totalPrice: topHotel.totalPrice,
          rating: topHotel.userRating,
          reviewCount: topHotel.reviewCount,
          amenities: topHotel.amenities,
          images: topHotel.images,
          bookingUrl: topHotel.affiliateUrl,
          location: topHotel.location,
        }
      : undefined,
    coverImage:
      destinationInfo?.image ||
      topHotel?.images[0] ||
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    createdAt: new Date().toISOString(),
    status: 'planned',
  };
}

/**
 * Render a json-render component array using the mobile component registry
 */
function JsonRenderRenderer({ spec }: { spec: unknown[] }) {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      {spec.map((comp: any, index: number) => {
        if (!comp || !comp.type) return null;

        const Component = registry[comp.type as keyof typeof registry];
        if (!Component) {
          console.warn(`[JsonRender] Unknown component type: ${comp.type}`);
          return null;
        }

        return <Component key={index} {...(comp.props || {})} />;
      })}
    </Animated.View>
  );
}

export default function GeneratingScreen() {
  const router = useRouter();
  const { draftInput, finishGeneration } = useTripStore();
  const [currentStep, setCurrentStep] = useState(0);

  // Animations
  const [rotateAnim] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));
  const [stepOpacity] = useState(new Animated.Value(1));

  const destinationInfo = popularDestinations.find(
    (d) => d.name === draftInput?.destination
  );

  // Single poll-based generation hook
  const generation = useItineraryGeneration(
    draftInput
      ? {
          destination: draftInput.destination!,
          startDate: draftInput.startDate!,
          endDate: draftInput.endDate!,
          travelers: draftInput.travelers || 2,
          travelerType: draftInput.travelerType,
          vibes: draftInput.vibes || [],
          budget: draftInput.budget,
        }
      : null,
  );

  // Start looping animations
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Map search progress to current step index
  useEffect(() => {
    if (!generation.searchProgress) return;

    const steps = ['orchestrator', 'hotels', 'activities', 'dining', 'aggregator'] as const;
    for (let i = steps.length - 1; i >= 0; i--) {
      if (
        generation.searchProgress[steps[i]] === 'searching' ||
        generation.searchProgress[steps[i]] === 'done'
      ) {
        if (currentStep !== i) {
          setCurrentStep(i);
          Animated.sequence([
            Animated.timing(stepOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(stepOpacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start();
        }
        break;
      }
    }
  }, [generation.searchProgress]);

  // Navigate to trip detail when complete (using traditional results path)
  const handleViewTrip = () => {
    if (!generation.results || !generation.searchId || !draftInput) return;
    const trip = convertResultsToTrip(generation.searchId, generation.results, draftInput);
    finishGeneration(trip);
    router.replace(`/trip/${trip.id}`);
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Background Image */}
      {destinationInfo && (
        <Image
          source={{ uri: destinationInfo.image }}
          style={styles.backgroundImage}
          blurRadius={20}
        />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
        style={styles.overlay}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView style={styles.content}>
          {/* Destination Info */}
          <View style={styles.header}>
            <Text style={styles.destinationLabel}>Creating your trip to</Text>
            <Text style={styles.destinationName}>{draftInput?.destination}</Text>
          </View>

          {/* Animated Loader (hidden once complete) */}
          {!generation.isComplete && (
            <>
              <View style={styles.loaderContainer}>
                <Animated.View
                  style={[styles.outerRing, { transform: [{ rotate: rotation }] }]}
                >
                  <LinearGradient
                    colors={[
                      colors.primary[400],
                      colors.primary[600],
                      colors.primary[400],
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.ringGradient}
                  />
                </Animated.View>

                <Animated.View
                  style={[styles.innerCircle, { transform: [{ scale: pulseAnim }] }]}
                >
                  <Text style={styles.progressEmoji}>
                    {GENERATION_STEPS[currentStep]?.emoji || '✈️'}
                  </Text>
                </Animated.View>
              </View>

              {/* Progress */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${generation.progress}%` }]} />
                </View>
                <Animated.Text style={[styles.stepText, { opacity: stepOpacity }]}>
                  {generation.statusMessage}
                </Animated.Text>
              </View>
            </>
          )}

          {/* Error state */}
          {generation.error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                Something went wrong: {generation.error}
              </Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => router.back()}
              >
                <Text style={styles.retryButtonText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Trip Details */}
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Dates</Text>
                <Text style={styles.detailValue}>
                  {draftInput?.startDate && draftInput?.endDate
                    ? `${new Date(draftInput.startDate).toLocaleDateString(
                        'en-US',
                        { month: 'short', day: 'numeric' }
                      )} - ${new Date(draftInput.endDate).toLocaleDateString(
                        'en-US',
                        { month: 'short', day: 'numeric' }
                      )}`
                    : '-'}
                </Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Travelers</Text>
                <Text style={styles.detailValue}>
                  {draftInput?.travelers || 2}
                </Text>
              </View>
            </View>
            {draftInput?.vibes && draftInput.vibes.length > 0 && (
              <View style={styles.vibesRow}>
                <Text style={styles.detailLabel}>Vibes</Text>
                <Text style={styles.detailValue}>
                  {draftInput.vibes.slice(0, 3).join(' • ')}
                </Text>
              </View>
            )}
          </View>

          {/* json-render spec – rendered once complete */}
          {generation.isComplete && generation.jsonRenderSpec && (
            <View style={styles.jsonRenderContainer}>
              <JsonRenderRenderer spec={generation.jsonRenderSpec} />
            </View>
          )}

          {/* View Trip button once complete */}
          {generation.isComplete && generation.results && (
            <TouchableOpacity
              style={styles.viewTripButton}
              onPress={handleViewTrip}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary[500], colors.primary[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.viewTripButtonGradient}
              >
                <Text style={styles.viewTripButtonText}>View Trip</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    position: 'absolute',
    width,
    height,
  },
  overlay: {
    position: 'absolute',
    width,
    height,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    minHeight: height,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
  },
  destinationLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  destinationName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  outerRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    padding: 4,
  },
  ringGradient: {
    flex: 1,
    borderRadius: 80,
    opacity: 0.5,
  },
  innerCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressEmoji: {
    fontSize: 48,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: 3,
  },
  stepText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontWeight: '600',
  },
  detailsContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.xl,
    padding: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  vibesRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  jsonRenderContainer: {
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    marginTop: 32,
    padding: 20,
    minHeight: 200,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  errorText: {
    color: '#f87171',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: borderRadius.lg,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  viewTripButton: {
    marginTop: 24,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  viewTripButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewTripButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
