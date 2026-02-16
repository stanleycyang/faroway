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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTripStore, Trip, TripDay, Activity } from '../../stores/tripStore';
import { popularDestinations } from '../../constants/destinations';
import { colors, borderRadius } from '../../constants/theme';
import {
  startSearch,
  pollSearchStatus,
  calculateProgressPercent,
  getStatusMessage,
  SearchResults,
  SearchProgress,
} from '../../services/searchService';
import { useStreamingItinerary } from '../../hooks/useStreamingItinerary';
import { registry } from '../../lib/json-render/registry';

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
 * Generate mock itinerary as fallback
 */
function generateMockItinerary(input: any): Trip {
  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  const dayCount =
    Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

  const destinationInfo = popularDestinations.find(
    (d) => d.name === input.destination
  );

  const days: TripDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + i);

    days.push({
      date: currentDate.toISOString().split('T')[0],
      dayNumber: i + 1,
      theme:
        i === 0
          ? 'Arrival & Exploration'
          : i === dayCount - 1
            ? 'Departure Day'
            : `Day ${i + 1} Adventure`,
      activities: [
        {
          id: `${i}-1`,
          time: '09:00',
          title: i === 0 ? 'Arrive & Check In' : 'Morning Activity',
          description: 'Start your day with an authentic local experience',
          location: input.destination,
          duration: '2 hours',
          type: 'activity',
          price: '$45',
          rating: 4.8,
          reviewCount: 1247,
          image: destinationInfo?.image,
        },
        {
          id: `${i}-2`,
          time: '12:00',
          title: 'Local Lunch Experience',
          description:
            'Savor the flavors of local cuisine at a highly-rated restaurant',
          location: input.destination,
          duration: '1.5 hours',
          type: 'restaurant',
          price: '$$',
          rating: 4.6,
          reviewCount: 892,
        },
        {
          id: `${i}-3`,
          time: '14:30',
          title: 'Afternoon Exploration',
          description: 'Discover iconic landmarks and hidden gems',
          location: input.destination,
          duration: '3 hours',
          type: 'activity',
          price: '$30',
          rating: 4.9,
          reviewCount: 2341,
        },
        {
          id: `${i}-4`,
          time: '19:00',
          title: 'Evening Dining',
          description: 'End the day with a memorable dinner experience',
          location: input.destination,
          duration: '2 hours',
          type: 'restaurant',
          price: '$$$',
          rating: 4.7,
          reviewCount: 567,
        },
      ],
    });
  }

  return {
    id: `trip-${Date.now()}`,
    destination: input.destination,
    country: input.country || destinationInfo?.country || '',
    startDate: input.startDate,
    endDate: input.endDate,
    travelers: input.travelers,
    travelerType: input.travelerType,
    vibes: input.vibes,
    budget: input.budget,
    days,
    coverImage:
      destinationInfo?.image ||
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
    createdAt: new Date().toISOString(),
    status: 'planned',
  };
}

/**
 * Simple json-render Renderer Component
 * Renders a json-render document using the component registry
 */
function JsonRenderRenderer({ document }: { document: any }) {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [document]);

  if (!document) return null;

  const renderComponent = (comp: any, index: number) => {
    if (!comp || !comp.type) return null;

    const Component = registry[comp.type as keyof typeof registry];
    if (!Component) {
      console.warn(`[JsonRender] Unknown component type: ${comp.type}`);
      return null;
    }

    return <Component key={index} {...(comp.props || {})} />;
  };

  const components = Array.isArray(document) ? document : [document];

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      {components.map((comp, index) => renderComponent(comp, index))}
    </Animated.View>
  );
}

export default function GeneratingScreen() {
  const router = useRouter();
  const { draftInput, finishGeneration } = useTripStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState(GENERATION_STEPS[0].text);
  const [useBackend, setUseBackend] = useState(true);
  const [useJsonRender, setUseJsonRender] = useState(true);
  const searchIdRef = useRef<string | null>(null);

  // Animations
  const [rotateAnim] = useState(new Animated.Value(0));
  const [pulseAnim] = useState(new Animated.Value(1));
  const [stepOpacity] = useState(new Animated.Value(1));

  const destinationInfo = popularDestinations.find(
    (d) => d.name === draftInput?.destination
  );

  // Streaming itinerary with json-render
  const streamingState = useStreamingItinerary({
    input: useJsonRender && draftInput ? {
      destination: draftInput.destination!,
      startDate: draftInput.startDate!,
      endDate: draftInput.endDate!,
      travelers: draftInput.travelers || 2,
      travelerType: draftInput.travelerType as any,
      vibes: draftInput.vibes || [],
      budget: draftInput.budget,
    } : undefined,
    onComplete: (document) => {
      console.log('[Generating] json-render streaming complete', document);
      // We'll still save as Trip for now, but render from json-render
      // In the future, we can store the json-render document directly
    },
    onError: (error) => {
      console.error('[Generating] json-render streaming error:', error);
      // Fall back to traditional polling
      setUseJsonRender(false);
    },
  });

  useEffect(() => {
    // Rotate animation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Pulse animation
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

  useEffect(() => {
    if (!draftInput) return;

    const runSearch = async () => {
      try {
        // Start the search
        const { searchId, estimatedTime } = await startSearch({
          destination: draftInput.destination!,
          startDate: draftInput.startDate!,
          endDate: draftInput.endDate!,
          travelers: draftInput.travelers || 2,
          travelerType: draftInput.travelerType as any,
          vibes: draftInput.vibes || [],
          budget: draftInput.budget as any,
        });

        searchIdRef.current = searchId;
        console.log(`[Generating] Search started: ${searchId}, ETA: ${estimatedTime}s`);

        // Poll for results
        const results = await pollSearchStatus(
          searchId,
          (status) => {
            // Update progress UI based on agent status
            const progressPercent = calculateProgressPercent(status.progress);
            setProgress(progressPercent);
            setStatusMessage(getStatusMessage(status.progress));

            // Update step based on progress
            const steps = ['orchestrator', 'hotels', 'activities', 'dining', 'aggregator'] as const;
            for (let i = steps.length - 1; i >= 0; i--) {
              if (status.progress[steps[i]] === 'searching' || status.progress[steps[i]] === 'done') {
                if (currentStep !== i) {
                  setCurrentStep(i);
                  // Fade animation for step change
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
          },
          2000, // Poll every 2 seconds
          90 // Max 3 minutes
        );

        // Convert results to trip format
        const trip = convertResultsToTrip(searchId, results, draftInput);
        finishGeneration(trip);
        router.replace(`/trip/${trip.id}`);
      } catch (error) {
        console.error('[Generating] Search failed:', error);
        // Fallback to mock data if backend fails
        setUseBackend(false);
        const trip = generateMockItinerary(draftInput);
        finishGeneration(trip);
        router.replace(`/trip/${trip.id}`);
      }
    };

    if (useBackend) {
      runSearch();
    } else {
      // Fallback: use mock generation with simulated progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          return prev + 1;
        });
      }, 50);

      const stepInterval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= GENERATION_STEPS.length - 1) {
            clearInterval(stepInterval);
            return prev;
          }
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
          return prev + 1;
        });
      }, 1000);

      const completeTimeout = setTimeout(() => {
        const trip = generateMockItinerary(draftInput);
        finishGeneration(trip);
        router.replace(`/trip/${trip.id}`);
      }, 5500);

      return () => {
        clearInterval(progressInterval);
        clearInterval(stepInterval);
        clearTimeout(completeTimeout);
      };
    }
  }, [draftInput, useBackend]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Combine progress from both streaming and polling
  const displayProgress = useJsonRender ? streamingState.progress : progress;
  const displayMessage = useJsonRender && streamingState.isStreaming
    ? 'Generating your itinerary...'
    : statusMessage;

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

        {/* Animated Loader */}
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
            <View style={[styles.progressFill, { width: `${displayProgress}%` }]} />
          </View>
          <Animated.Text style={[styles.stepText, { opacity: stepOpacity }]}>
            {displayMessage}
          </Animated.Text>
        </View>

        {/* Trip Details */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Dates</Text>
              <Text style={styles.detailValue}>
                {draftInput?.startDate && draftInput?.endDate
                  ? `${new Date(draftInput.startDate).toLocaleDateString(
                      'en-US',
                      {
                        month: 'short',
                        day: 'numeric',
                      }
                    )} - ${new Date(draftInput.endDate).toLocaleDateString(
                      'en-US',
                      {
                        month: 'short',
                        day: 'numeric',
                      }
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

        {/* json-render Content - Progressively revealed */}
        {useJsonRender && streamingState.document && (
          <View style={styles.jsonRenderContainer}>
            <JsonRenderRenderer document={streamingState.document} />
          </View>
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
    backgroundColor: '#fff',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    marginTop: 32,
    padding: 20,
    minHeight: 200,
  },
});
