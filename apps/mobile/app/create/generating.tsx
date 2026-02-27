import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
import * as Haptics from 'expo-haptics';
import { useTripStore, Trip, TripDay, Activity } from '../../stores/tripStore';
import { popularDestinations, IMAGE_PATHS, getImageUrl } from '@faroway/constants';
import { colors, borderRadius } from '../../constants/theme';
import {
  useStreamingItinerary,
  StreamingBlock,
  MicroProgress,
} from '../../hooks/useStreamingItinerary';
import { registry } from '../../lib/json-render/registry';

const { width, height } = Dimensions.get('window');

const GENERATION_STEPS = [
  { key: 'orchestrator', text: 'Analyzing', emoji: '🔍', color: '#8B5CF6' },
  { key: 'hotels', text: 'Hotels', emoji: '🏨', color: '#F59E0B' },
  { key: 'activities', text: 'Activities', emoji: '✨', color: '#10B981' },
  { key: 'dining', text: 'Dining', emoji: '🍽️', color: '#EF4444' },
  { key: 'aggregator', text: 'Itinerary', emoji: '📝', color: '#3B82F6' },
];

const DESTINATION_FACTS: Record<string, string[]> = {
  Paris: [
    'The Eiffel Tower was meant to be temporary, built for the 1889 World\'s Fair.',
    'Paris has 470+ parks and gardens covering 3,000+ acres.',
    'The Louvre would take 100 days to see every artwork for 30 seconds each.',
    'There are more dogs than children in Paris.',
  ],
  Tokyo: [
    'Tokyo has more Michelin-starred restaurants than any other city.',
    'The Shibuya Crossing sees 3,000 people cross at once during rush hour.',
    'Tokyo was called Edo until 1868 when it became the capital.',
    'Vending machines in Tokyo sell everything from eggs to umbrellas.',
  ],
  Rome: [
    'Rome has more fountains than any other city in the world.',
    'The Pantheon has the world\'s largest unreinforced concrete dome.',
    'Trevi Fountain collects €1.5 million in coins annually.',
    'Cats have legal protection at Roman archaeological sites.',
  ],
  London: [
    'Big Ben is actually the name of the bell, not the tower.',
    'London has 170 museums, many of which are free.',
    'The Underground is the world\'s oldest metro system.',
    'There are over 300 languages spoken in London.',
  ],
  'New York': [
    'The NYC subway runs 24/7, 365 days a year.',
    'Central Park is larger than Monaco.',
    'Times Square was originally called Longacre Square.',
    'The Statue of Liberty was a gift from France in 1886.',
  ],
  default: [
    'Your personalized itinerary includes local hidden gems.',
    'Our AI considers weather, crowds, and local events.',
    'We match activities to your unique travel style.',
    'Every recommendation is curated for your preferences.',
  ],
};

function convertStreamingDataToTrip(
  tripId: string,
  itineraryDays: unknown[],
  topHotel: Record<string, unknown> | null,
  input: NonNullable<ReturnType<typeof useTripStore>['draftInput']>
): Trip {
  const destinationInfo = popularDestinations.find((d) => d.name === input.destination);

  const days: TripDay[] = (itineraryDays as any[]).map((day) => {
    const activities: Activity[] = [];

    const processActivities = (items: any[] | undefined, startHour: number) => {
      items?.forEach((activity: any, idx: number) => {
        activities.push({
          id: activity.id || `activity-${day.dayNumber}-${startHour + idx}`,
          time: `${startHour + idx}:00`,
          title: activity.name,
          description: activity.description || '',
          location: activity.location?.name || activity.location?.neighborhood || '',
          duration: activity.duration ? `${Math.round(activity.duration / 60)} hours` : '2 hours',
          type: 'activity',
          price: activity.price ? `$${activity.price}` : undefined,
          rating: activity.rating,
          reviewCount: activity.reviewCount,
          image: activity.images?.[0],
          bookingUrl: activity.affiliateUrl,
        });
      });
    };

    const processMeal = (meal: any | undefined, time: string) => {
      if (!meal) return;
      activities.push({
        id: meal.id || `meal-${day.dayNumber}-${time}`,
        time,
        title: meal.name,
        description: meal.description || '',
        location: meal.location?.name || meal.location?.neighborhood || '',
        duration: '1 hour',
        type: 'restaurant',
        price: meal.priceLevel
          ? '$'.repeat(typeof meal.priceLevel === 'number' ? meal.priceLevel : 2)
          : undefined,
        rating: meal.rating,
        reviewCount: meal.reviewCount,
        image: meal.images?.[0],
        bookingUrl: meal.reservationUrl,
      });
    };

    processMeal(day.morning?.meal, '08:00');
    processActivities(day.morning?.activities, 9);
    processMeal(day.afternoon?.meal, '12:30');
    processActivities(day.afternoon?.activities, 14);
    processActivities(day.evening?.activities, 18);
    processMeal(day.evening?.meal, '19:30');

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

  const hotel = topHotel as any;

  return {
    id: tripId,
    destination: input.destination!,
    country: input.country || destinationInfo?.country || '',
    startDate: input.startDate!,
    endDate: input.endDate!,
    travelers: input.travelers || 2,
    travelerType: input.travelerType,
    vibes: input.vibes || [],
    budget: input.budget,
    days,
    hotel: hotel
      ? {
          id: hotel.id || 'hotel-1',
          name: hotel.name,
          description: hotel.description,
          pricePerNight: hotel.pricePerNight,
          totalPrice: hotel.totalPrice,
          rating: hotel.userRating || hotel.rating,
          reviewCount: hotel.reviewCount,
          amenities: hotel.amenities || [],
          images: hotel.images || [],
          bookingUrl: hotel.affiliateUrl,
          location: hotel.location,
        }
      : undefined,
    coverImage:
      destinationInfo?.image ||
      hotel?.images?.[0] ||
      getImageUrl(IMAGE_PATHS.inspirations['beach-getaway']),
    createdAt: new Date().toISOString(),
    status: 'planned',
  };
}

function JsonRenderRenderer({
  blocks,
  onNewContent,
}: {
  blocks: StreamingBlock[];
  onNewContent?: () => void;
}) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const prevLengthRef = useRef(0);

  useEffect(() => {
    if (blocks.length > prevLengthRef.current) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      prevLengthRef.current = blocks.length;
      onNewContent?.();
    }
  }, [blocks.length, fadeAnim, onNewContent]);

  if (blocks.length === 0) return null;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      {blocks.map((comp, index) => {
        if (!comp || !comp.type) return null;
        const Component = registry[comp.type as keyof typeof registry];
        if (!Component) return null;
        return <Component key={`${comp.type}-${index}`} {...(comp.props || {})} />;
      })}
    </Animated.View>
  );
}

// Pulsing dot for streaming indicator
function PulsingDot() {
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <Animated.View style={[styles.streamingDot, { opacity: pulseAnim }]} />
  );
}

// Animated circular progress ring
function ProgressRing({ progress, size = 180 }: { progress: number; size?: number }) {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.spring(animatedProgress, {
      toValue: progress,
      useNativeDriver: false,
      friction: 8,
    }).start();
  }, [progress, animatedProgress]);

  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ rotate: '-90deg' }],
          },
        ]}
      >
        {/* Background circle */}
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: 'rgba(255,255,255,0.15)',
          }}
        />
      </Animated.View>
      {/* Animated progress circle using View */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <LinearGradient
          colors={[colors.primary[400], colors.primary[600]]}
          style={{
            width: size - strokeWidth * 4,
            height: size - strokeWidth * 4,
            borderRadius: (size - strokeWidth * 4) / 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
        </LinearGradient>
      </View>
    </View>
  );
}

// Skeleton loader for content
function SkeletonLoader() {
  const [shimmerAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  const SkeletonBox = ({ w, h, style }: { w: number | string; h: number; style?: object }) => (
    <View style={[{ width: w, height: h, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' }, style]}>
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(255,255,255,0.05)',
          transform: [{ translateX }],
        }}
      />
    </View>
  );

  return (
    <View style={styles.skeletonContainer}>
      <SkeletonBox w="100%" h={200} style={{ marginBottom: 16, borderRadius: 16 }} />
      <SkeletonBox w="70%" h={24} style={{ marginBottom: 12 }} />
      <SkeletonBox w="50%" h={16} style={{ marginBottom: 24 }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <SkeletonBox w={100} h={80} style={{ borderRadius: 12 }} />
        <SkeletonBox w={100} h={80} style={{ borderRadius: 12 }} />
        <SkeletonBox w={100} h={80} style={{ borderRadius: 12 }} />
      </View>
    </View>
  );
}

// Hotel preview card shown when hotel data arrives
function HotelPreviewCard({ hotel }: { hotel: Record<string, unknown> }) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.9));

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const h = hotel as any;

  return (
    <Animated.View style={[styles.hotelPreview, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.hotelPreviewHeader}>
        <Text style={styles.hotelPreviewLabel}>🏨 Your Top Hotel Match</Text>
      </View>
      <View style={styles.hotelPreviewContent}>
        <View style={styles.hotelPreviewInfo}>
          <Text style={styles.hotelPreviewName} numberOfLines={2}>{h.name}</Text>
          <View style={styles.hotelPreviewRating}>
            <Text style={styles.hotelPreviewStars}>{'★'.repeat(h.starRating || 4)}</Text>
            <Text style={styles.hotelPreviewScore}>{h.userRating?.toFixed(1) || '4.5'}</Text>
          </View>
          <Text style={styles.hotelPreviewPrice}>
            ${h.pricePerNight || 200}<Text style={styles.hotelPreviewPriceUnit}>/night</Text>
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

// Step indicator with animation
function StepIndicator({
  step,
  status,
  count,
  microMessage,
}: {
  step: typeof GENERATION_STEPS[0];
  status: 'pending' | 'searching' | 'done';
  count?: number;
  microMessage?: string;
}) {
  const [scaleAnim] = useState(new Animated.Value(status === 'pending' ? 0.95 : 1));
  const [pulseAnim] = useState(new Animated.Value(1));
  const prevStatusRef = useRef(status);

  useEffect(() => {
    if (status !== prevStatusRef.current) {
      if (status === 'done') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      prevStatusRef.current = status;
    }

    if (status === 'searching') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    }
  }, [status, scaleAnim, pulseAnim]);

  const opacity = status === 'pending' ? 0.5 : 1;

  return (
    <Animated.View
      style={[
        styles.stepRow,
        {
          opacity,
          transform: [{ scale: status === 'searching' ? pulseAnim : scaleAnim }],
        },
      ]}
    >
      <View
        style={[
          styles.stepIcon,
          status === 'done' && { backgroundColor: step.color },
          status === 'searching' && styles.stepIconActive,
        ]}
      >
        <Text style={styles.stepEmoji}>{status === 'done' ? '✓' : step.emoji}</Text>
      </View>
      <View style={styles.stepContent}>
        <Text style={[styles.stepText, status === 'done' && styles.stepTextDone]}>{step.text}</Text>
        {microMessage && status === 'searching' && (
          <Text style={styles.stepMicro} numberOfLines={1}>{microMessage}</Text>
        )}
        {count !== undefined && count > 0 && status === 'done' && (
          <Text style={[styles.stepCount, { color: step.color }]}>{count} found</Text>
        )}
      </View>
      {status === 'done' && (
        <View style={[styles.stepCheckBadge, { backgroundColor: step.color }]}>
          <Text style={styles.stepCheckText}>✓</Text>
        </View>
      )}
    </Animated.View>
  );
}

// Cycling fun facts
function FunFactCard({ destination }: { destination: string }) {
  const [factIndex, setFactIndex] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(1));
  const facts = DESTINATION_FACTS[destination] || DESTINATION_FACTS.default;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setFactIndex((prev) => (prev + 1) % facts.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [facts.length, fadeAnim]);

  return (
    <View style={styles.funFact}>
      <Text style={styles.funFactLabel}>💡 Did you know?</Text>
      <Animated.Text style={[styles.funFactText, { opacity: fadeAnim }]}>{facts[factIndex]}</Animated.Text>
    </View>
  );
}

// Celebration animation when complete
function CelebrationOverlay({ onComplete }: { onComplete: () => void }) {
  const [scaleAnim] = useState(new Animated.Value(0));
  const [opacityAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [scaleAnim, opacityAnim, onComplete]);

  return (
    <Animated.View style={[styles.celebrationOverlay, { opacity: opacityAnim }]}>
      <Animated.View style={[styles.celebrationContent, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.celebrationEmoji}>🎉</Text>
        <Text style={styles.celebrationTitle}>Your Trip is Ready!</Text>
        <Text style={styles.celebrationSubtitle}>Personalized just for you</Text>
      </Animated.View>
    </Animated.View>
  );
}

export default function GeneratingScreen() {
  const router = useRouter();
  const { draftInput, finishGeneration } = useTripStore();
  const [showCelebration, setShowCelebration] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const destinationInfo = popularDestinations.find((d) => d.name === draftInput?.destination);

  const handleComplete = useCallback((document: StreamingBlock[]) => {
    console.log('[Generating] Complete with', document.length, 'blocks');
    setShowCelebration(true);
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('[Generating] Error:', error.message);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  const streaming = useStreamingItinerary(
    draftInput
      ? {
          input: {
            destination: draftInput.destination!,
            startDate: draftInput.startDate!,
            endDate: draftInput.endDate!,
            travelers: draftInput.travelers || 2,
            travelerType: draftInput.travelerType || 'couple',
            vibes: draftInput.vibes || [],
            budget: draftInput.budget,
          },
          onComplete: handleComplete,
          onError: handleError,
        }
      : {}
  );

  const handleViewTrip = useCallback(() => {
    if (!draftInput || !streaming.tripId) return;

    if (streaming.days && streaming.days.length > 0) {
      const trip = convertStreamingDataToTrip(
        streaming.tripId,
        streaming.days,
        streaming.topHotel,
        draftInput
      );
      finishGeneration(trip);
      router.replace(`/trip/${trip.id}`);
    } else {
      router.replace(`/trip/${streaming.tripId}`);
    }
  }, [draftInput, streaming.tripId, streaming.days, streaming.topHotel, finishGeneration, router]);

  const searchProgress = streaming.searchProgress || {};
  const showProgressiveBlocks = streaming.blocks.length > 0;

  // Auto-scroll when new content arrives
  const handleNewContent = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Get micro-message for each step
  const getMicroMessage = (step: string) => {
    if (streaming.microProgress?.stage === step) {
      return streaming.microProgress.message;
    }
    return undefined;
  };

  const counts = useMemo(
    () => ({
      hotels: streaming.topHotel ? 10 : 0,
      activities: streaming.activitiesCount,
      dining: streaming.diningCount,
    }),
    [streaming.topHotel, streaming.activitiesCount, streaming.diningCount]
  );

  return (
    <View style={styles.container}>
      {destinationInfo && (
        <Image source={{ uri: destinationInfo.image }} style={styles.bgImage} blurRadius={25} />
      )}
      <LinearGradient colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']} style={styles.overlay} />

      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerLabel}>Creating your trip to</Text>
            <Text style={styles.headerDestination}>{draftInput?.destination}</Text>
            <View style={styles.headerMeta}>
              <Text style={styles.headerMetaText}>
                {draftInput?.startDate &&
                  new Date(draftInput.startDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                -{' '}
                {draftInput?.endDate &&
                  new Date(draftInput.endDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
              </Text>
              <Text style={styles.headerMetaDot}>•</Text>
              <Text style={styles.headerMetaText}>{draftInput?.travelers || 2} travelers</Text>
            </View>
          </View>

          {/* Main progress area */}
          {!streaming.isComplete && !showProgressiveBlocks && (
            <View style={styles.progressArea}>
              <ProgressRing progress={streaming.progress} />

              <Text style={styles.currentMessage}>{streaming.message}</Text>

              {/* Step indicators */}
              <View style={styles.stepsContainer}>
                {GENERATION_STEPS.map((step) => {
                  const status = (searchProgress[step.key] as 'pending' | 'searching' | 'done') || 'pending';
                  const count =
                    step.key === 'hotels' ? counts.hotels
                    : step.key === 'activities' ? counts.activities
                    : step.key === 'dining' ? counts.dining
                    : undefined;
                  return (
                    <StepIndicator
                      key={step.key}
                      step={step}
                      status={status}
                      count={status === 'done' ? count : undefined}
                      microMessage={getMicroMessage(step.key)}
                    />
                  );
                })}
              </View>

              {/* Hotel preview */}
              {streaming.topHotel && <HotelPreviewCard hotel={streaming.topHotel} />}

              {/* Fun facts */}
              <FunFactCard destination={draftInput?.destination || 'default'} />
            </View>
          )}

          {/* Error state */}
          {streaming.error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorEmoji}>😔</Text>
              <Text style={styles.errorTitle}>Something went wrong</Text>
              <Text style={styles.errorMessage}>{streaming.error}</Text>
              <TouchableOpacity style={styles.errorButton} onPress={() => router.back()}>
                <Text style={styles.errorButtonText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Progressive blocks */}
          {showProgressiveBlocks && (
            <View style={styles.blocksContainer}>
              {!streaming.isComplete && streaming.isStreaming && (
                <View style={styles.streamingBanner}>
                  <PulsingDot />
                  <Text style={styles.streamingText}>{streaming.message}</Text>
                </View>
              )}
              <JsonRenderRenderer blocks={streaming.blocks} onNewContent={handleNewContent} />
            </View>
          )}

          {/* Skeleton when no content yet */}
          {!streaming.error && !showProgressiveBlocks && streaming.progress > 60 && (
            <SkeletonLoader />
          )}

          {/* View trip button */}
          {streaming.isComplete && streaming.tripId && !showCelebration && (
            <TouchableOpacity style={styles.viewButton} onPress={handleViewTrip} activeOpacity={0.9}>
              <LinearGradient
                colors={[colors.primary[500], colors.primary[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.viewButtonGradient}
              >
                <Text style={styles.viewButtonText}>View Your Trip</Text>
                <Text style={styles.viewButtonArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </ScrollView>

      {/* Celebration overlay */}
      {showCelebration && <CelebrationOverlay onComplete={() => setShowCelebration(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bgImage: { position: 'absolute', width, height, resizeMode: 'cover' },
  overlay: { position: 'absolute', width, height },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  safeArea: { flex: 1, paddingHorizontal: 24, paddingVertical: 16 },

  // Header
  header: { alignItems: 'center', marginBottom: 24 },
  headerLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  headerDestination: { fontSize: 32, fontWeight: '800', color: '#fff', textAlign: 'center' },
  headerMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  headerMetaText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  headerMetaDot: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginHorizontal: 8 },

  // Progress area
  progressArea: { alignItems: 'center' },
  progressPercent: { fontSize: 36, fontWeight: '800', color: '#fff' },
  currentMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    fontWeight: '600',
  },

  // Steps
  stepsContainer: { width: '100%', marginBottom: 20 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  stepIconActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  stepEmoji: { fontSize: 20 },
  stepContent: { flex: 1 },
  stepText: { fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  stepTextDone: { color: '#fff' },
  stepMicro: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  stepCount: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  stepCheckBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCheckText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Hotel preview
  hotelPreview: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  hotelPreviewHeader: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  hotelPreviewLabel: { fontSize: 13, color: '#F59E0B', fontWeight: '700' },
  hotelPreviewContent: { padding: 16 },
  hotelPreviewInfo: {},
  hotelPreviewName: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 6 },
  hotelPreviewRating: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  hotelPreviewStars: { fontSize: 14, color: '#F59E0B', marginRight: 8 },
  hotelPreviewScore: {
    fontSize: 14,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '600',
  },
  hotelPreviewPrice: { fontSize: 22, fontWeight: '800', color: colors.primary[400] },
  hotelPreviewPriceUnit: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },

  // Fun fact
  funFact: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  funFactLabel: { fontSize: 12, color: colors.primary[400], fontWeight: '700', marginBottom: 6 },
  funFactText: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },

  // Skeleton
  skeletonContainer: { padding: 20, marginTop: 20 },

  // Blocks container
  blocksContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    marginTop: 16,
    padding: 20,
    minHeight: 300,
  },
  streamingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  streamingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[500],
    marginRight: 10,
  },
  streamingText: { fontSize: 14, color: colors.primary[700], fontWeight: '500' },

  // Error
  errorBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 20,
    padding: 24,
    marginTop: 20,
  },
  errorEmoji: { fontSize: 48, marginBottom: 12 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  errorMessage: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 20 },
  errorButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  // View button
  viewButton: { marginTop: 24, borderRadius: 16, overflow: 'hidden' },
  viewButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  viewButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  viewButtonArrow: { color: '#fff', fontSize: 20, marginLeft: 8 },

  // Celebration
  celebrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationContent: { alignItems: 'center' },
  celebrationEmoji: { fontSize: 80, marginBottom: 16 },
  celebrationTitle: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 8 },
  celebrationSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)' },
});
