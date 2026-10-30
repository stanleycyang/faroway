import { flightQuoteIsCurrent } from '@faroway/constants';
import { formatKnownPrice, summarizeTripCosts } from '../../lib/tripCost';
import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  createContext,
  useContext,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  RefreshControl,
  ActivityIndicator,
  Share,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { Button, VibeChips } from '../../components/ui';
import { useTripStore, TripActivity, Activity } from '../../stores/tripStore';
import { usePromptStore } from '../../stores/promptStore';
import { useAuthContext } from '../../components/AuthProvider';
import { AuthGate } from '../../components/AuthGate';
import { RatingPrompt } from '../../components/RatingPrompt';
import { shareOwnedTrip, revokeOwnedTripShare } from '../../lib/tripSharing';
import { useUserStore } from '../../stores/userStore';
import { colors, borderRadius, shadows } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';
import { useTrips } from '../../hooks/useTrips';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { USE_NATIVE_DRIVER } from '../../lib/animation';
import { reviewSavedTripBooking } from '../../lib/savedTripBooking';
import { formatTripDate, formatTripTime } from '../../lib/tripDate';
import { collectBookingOptions } from '../../lib/bookingOptions';
import { selectTripDetail } from '../../lib/tripSummary';

const BookingTripContext = createContext<string | undefined>(undefined);
const useBookingReview = () => {
  const tripId = useContext(BookingTripContext);
  return () => reviewSavedTripBooking(tripId, openURL);
};

const HEADER_HEIGHT = 300;

/**
 * Helper function to open URLs using expo-web-browser
 */
const openURL = async (url: string) => {
  try {
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
      controlsColor: colors.primary[600],
    });
  } catch (error) {
    throw error;
  }
};

interface ActivityCardProps {
  activity: TripActivity;
}

function ActivityCard({ activity }: ActivityCardProps) {
  const reviewBooking = useBookingReview();
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'restaurant':
        return 'restaurant';
      case 'transport':
        return 'car';
      case 'accommodation':
        return 'bed';
      case 'attraction':
        return 'camera';
      case 'experience':
        return 'sparkles';
      default:
        return 'location';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'restaurant':
        return '#ef4444';
      case 'transport':
        return '#3b82f6';
      case 'accommodation':
        return '#8b5cf6';
      case 'attraction':
        return '#f59e0b';
      case 'experience':
        return '#10b981';
      default:
        return colors.primary[500];
    }
  };

  const handleBooking = () => {
    if (!activity.bookingUrl) return;
    reviewBooking();
  };

  return (
    <View style={styles.activityCard}>
      <View style={styles.activityTime}>
        <Text style={styles.activityTimeText}>{activity.time}</Text>
        <View style={[styles.activityDot, { backgroundColor: getTypeColor(activity.type) }]} />
        <View style={styles.activityLine} />
      </View>
      <View style={styles.activityContent}>
        {/* Activity Image */}
        {activity.image && (
          <Image source={{ uri: activity.image }} style={styles.activityImage} accessible={false} />
        )}
        <View style={styles.activityHeader}>
          <View
            style={[
              styles.activityTypeIcon,
              { backgroundColor: `${getTypeColor(activity.type)}15` },
            ]}
          >
            <Ionicons
              name={getTypeIcon(activity.type) as React.ComponentProps<typeof Ionicons>['name']}
              size={16}
              color={getTypeColor(activity.type)}
            />
          </View>
          <View style={styles.activityInfo}>
            <Text style={styles.activityTitle}>{activity.title}</Text>
            <Text style={styles.activityDuration}>{activity.duration}</Text>
          </View>
          {activity.price && <Text style={styles.activityPrice}>{activity.price}</Text>}
        </View>
        <Text style={styles.activityDescription}>{activity.description}</Text>
        {activity.rating && (
          <View style={styles.activityRating}>
            <Ionicons name="star" size={14} color="#fbbf24" />
            <Text style={styles.activityRatingText}>{activity.rating}</Text>
            {activity.reviewCount && (
              <Text style={styles.activityReviewCount}>
                ({activity.reviewCount.toLocaleString()} reviews)
              </Text>
            )}
          </View>
        )}
        {activity.bookingUrl && (
          <TouchableOpacity
            style={styles.bookButton}
            onPress={handleBooking}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Review booking options for ${activity.title}`}
          >
            <LinearGradient
              colors={
                activity.type === 'restaurant' ? ['#f97316', '#ea580c'] : ['#6366f1', '#8b5cf6']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons
              name={
                activity.type === 'restaurant' ? 'restaurant-outline' : 'shield-checkmark-outline'
              }
              size={16}
              color="#fff"
            />
            <Text style={styles.bookButtonText}>Review booking options</Text>
            <Ionicons name="open-outline" size={14} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}
        {activity.bookingUrl && activity.freeCancellation && (
          <View style={styles.freeCancelRow}>
            <Ionicons name="checkmark-circle" size={12} color="#22c55e" />
            <Text style={styles.freeCancelText}>Free cancellation</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function FeaturedHotelCard({
  hotel,
}: {
  hotel: NonNullable<import('../../stores/tripStore').Trip['hotel']>;
}) {
  const reviewBooking = useBookingReview();
  const handleBooking = () => {
    if (!hotel.bookingUrl) return;
    reviewBooking();
  };

  return (
    <View style={styles.hotelCard}>
      {hotel.images && hotel.images.length > 0 && (
        <Image source={{ uri: hotel.images[0] }} style={styles.hotelCardImage} accessible={false} />
      )}
      <View style={styles.hotelCardContent}>
        <View style={styles.hotelCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hotelCardName}>{hotel.name}</Text>
            {hotel.rating > 0 && (
              <View style={styles.hotelCardRating}>
                <Ionicons name="star" size={14} color="#fbbf24" />
                <Text style={styles.hotelCardRatingText}>{hotel.rating}</Text>
                {hotel.reviewCount != null && hotel.reviewCount > 0 && (
                  <Text style={styles.hotelCardReviewCount}>
                    ({hotel.reviewCount.toLocaleString()} reviews)
                  </Text>
                )}
              </View>
            )}
          </View>
          <View style={styles.hotelCardPriceContainer}>
            <Text style={styles.hotelCardPrice}>
              {formatKnownPrice(hotel.pricePerNight, hotel.currency)}
            </Text>
            {Number.isFinite(hotel.pricePerNight) && !!hotel.currency && (
              <Text style={styles.hotelCardPriceLabel}>per night</Text>
            )}
          </View>
        </View>
        {hotel.amenities && hotel.amenities.length > 0 && (
          <View style={styles.hotelCardAmenities}>
            {hotel.amenities.slice(0, 3).map((amenity, index) => (
              <View key={index} style={styles.hotelCardAmenityChip}>
                <Text style={styles.hotelCardAmenityText}>{amenity}</Text>
              </View>
            ))}
          </View>
        )}
        {hotel.bookingUrl && (
          <TouchableOpacity
            style={styles.hotelCardButton}
            onPress={handleBooking}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Review booking options for ${hotel.name}`}
          >
            <Text style={styles.hotelCardButtonText}>Review booking options</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary[500]} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function TransportCard({
  transport,
}: {
  transport: NonNullable<import('../../stores/tripStore').TripDay['transport']>;
}) {
  const reviewBooking = useBookingReview();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const formatDuration = (minutes: number | undefined) => {
    if (minutes === undefined || !Number.isFinite(minutes) || minutes < 0)
      return 'Duration unavailable';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const formatTime = formatTripTime;

  const stopsLabel =
    transport.stops === undefined
      ? 'Stops unavailable'
      : transport.stops === 0
        ? 'Direct'
        : `${transport.stops} stop${transport.stops > 1 ? 's' : ''}`;

  const handleBooking = () => {
    if (!transport.bookingUrl) return;
    reviewBooking();
  };

  return (
    <View style={styles.transportCard}>
      <LinearGradient
        colors={['#1e40af', '#3b82f6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.transportCardGradient}
      >
        <View style={styles.transportCardHeader}>
          <View style={styles.transportCardProviderRow}>
            <Ionicons name="airplane" size={18} color="#fff" />
            <Text style={styles.transportCardProvider}>{transport.provider}</Text>
          </View>
          <Text style={styles.transportCardPrice}>
            {flightQuoteIsCurrent(transport, now)
              ? formatKnownPrice(transport.price, transport.currency)
              : 'Price expired or unavailable'}
          </Text>
        </View>
        <View style={styles.transportCardRoute}>
          <View style={styles.transportCardEndpoint}>
            <Text style={styles.transportCardAirport}>{transport.departure.airport}</Text>
            <Text style={styles.transportCardTime}>{formatTime(transport.departure.dateTime)}</Text>
            <Text style={styles.transportCardCity}>{transport.departure.city}</Text>
          </View>
          <View style={styles.transportCardMiddle}>
            <Text style={styles.transportCardDuration}>{formatDuration(transport.duration)}</Text>
            <View style={styles.transportCardLine}>
              <View style={styles.transportCardLineDot} />
              <View style={styles.transportCardLinePath} />
              <Ionicons name="airplane" size={12} color="rgba(255,255,255,0.7)" />
              <View style={styles.transportCardLinePath} />
              <View style={styles.transportCardLineDot} />
            </View>
            <Text style={styles.transportCardStops}>{stopsLabel}</Text>
          </View>
          <View style={styles.transportCardEndpoint}>
            <Text style={styles.transportCardAirport}>{transport.arrival.airport}</Text>
            <Text style={styles.transportCardTime}>{formatTime(transport.arrival.dateTime)}</Text>
            <Text style={styles.transportCardCity}>{transport.arrival.city}</Text>
          </View>
        </View>
        {transport.bookingUrl && (
          <TouchableOpacity
            style={styles.transportCardButton}
            onPress={handleBooking}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Review flight options from ${transport.departure.airport} to ${transport.arrival.airport}`}
          >
            <Text style={styles.transportCardButtonText}>Review flight options</Text>
            <Ionicons name="arrow-forward" size={16} color="#1e40af" />
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
}

/**
 * Bottom sheet modal showing all bookable items across the trip.
 */
function BookingsSheet({
  visible,
  onClose,
  bookableItems,
  costReferences,
}: {
  visible: boolean;
  onClose: () => void;
  bookableItems: { activity: Activity; dayNumber: number }[];
  costReferences: string[];
}) {
  const reviewBooking = useBookingReview();
  const reduceMotion = useReduceMotion();

  const renderBookableItem = ({ item }: { item: { activity: Activity; dayNumber: number } }) => {
    const { activity, dayNumber } = item;

    const handleBook = () => {
      reviewBooking();
    };

    return (
      <View style={styles.sheetItem}>
        <View style={styles.sheetItemInfo}>
          <Text style={styles.sheetItemDay}>{dayNumber === 0 ? 'Hotel' : `Day ${dayNumber}`}</Text>
          <Text style={styles.sheetItemTitle} numberOfLines={1}>
            {activity.title}
          </Text>
          {activity.price && <Text style={styles.sheetItemPrice}>{activity.price}</Text>}
        </View>
        <TouchableOpacity
          style={styles.sheetItemButton}
          onPress={handleBook}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Review booking options for ${activity.title}`}
        >
          <Text style={styles.sheetItemButtonText}>Review</Text>
          <Ionicons name="open-outline" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={['top']} style={styles.sheetContainer}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            {bookableItems.length} Booking {bookableItems.length === 1 ? 'Option' : 'Options'}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.sheetClose}
            accessibilityRole="button"
            accessibilityLabel="Close bookings"
          >
            <Ionicons name="close" size={24} color="#0f172a" />
          </TouchableOpacity>
        </View>
        <Text style={styles.sheetSubtitle}>
          Review the saved plan on Faroway before continuing to a provider. Confirm current prices
          and availability with the provider.
        </Text>
        <FlatList
          data={bookableItems}
          ListHeaderComponent={
            costReferences.length ? (
              <View style={{ marginBottom: 20 }}>
                <Text style={styles.sheetItemTitle}>Known price references</Text>
                {costReferences.map((reference) => (
                  <Text key={reference} style={styles.sheetItemPrice}>
                    {reference}
                  </Text>
                ))}
                <Text style={styles.sheetSubtitle}>
                  Partial estimates, kept in their original currencies. These aren’t a total for
                  your travel party. Check final prices, taxes, and availability with each partner.
                </Text>
              </View>
            ) : null
          }
          renderItem={renderBookableItem}
          keyExtractor={(item) => item.activity.id}
          contentContainerStyle={styles.sheetList}
          ItemSeparatorComponent={() => <View style={styles.sheetSeparator} />}
        />
      </SafeAreaView>
    </Modal>
  );
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const owner = useUserStore((state) => state.user?.id);
  const revision = useUserStore((state) => state.accountRevision);
  return <TripDetailSession key={`${owner ?? 'guest'}:${revision}:${id}`} id={id} />;
}

function TripDetailSession({ id }: { id: string | undefined }) {
  const router = useRouter();
  const mounted = useRef(false);
  const shareLock = useRef(false);
  const refreshLock = useRef(false);
  const detailController = useRef<AbortController | null>(null);
  const [account] = useState(() => {
    const state = useUserStore.getState();
    return { owner: state.user?.id, revision: state.accountRevision };
  });
  const isActive = useCallback(() => {
    const current = useUserStore.getState();
    return (
      mounted.current &&
      current.user?.id === account.owner &&
      current.accountRevision === account.revision
    );
  }, [account]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { trips, currentTrip, isHydrated } = useTripStore();
  const { getTripById } = useTrips();
  const { isAuthenticated } = useAuthContext();
  const { tripGenerationCount, shouldShowRatingPrompt } = usePromptStore();
  const reduceMotion = useReduceMotion();
  const [selectedDay, setSelectedDay] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);
  const [showBookingsSheet, setShowBookingsSheet] = useState(false);
  const [isLoadingTrip, setIsLoadingTrip] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const scrollY = useRef(new Animated.Value(0)).current;
  const trip = selectTripDetail(id, trips, currentTrip);

  const [quoteClock, setQuoteClock] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setQuoteClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const costReferences = useMemo(
    () => (trip ? summarizeTripCosts(trip, quoteClock || Date.now()) : []),
    [trip, quoteClock]
  );

  const bookableItems = useMemo(() => (trip ? collectBookingOptions(trip) : []), [trip]);

  const bookableCount = bookableItems.length;

  useFocusEffect(
    useCallback(() => {
      if (!id) {
        setIsLoadingTrip(false);
        setLoadError('This trip link is incomplete.');
        return;
      }

      // Read the cache at focus time so publishing fetched detail does not
      // restart this request. Cached remote trips still need revalidation.
      const saved = useTripStore.getState();
      const cachedTrip = selectTripDetail(id, saved.trips, saved.currentTrip);
      if (!isHydrated) return;

      if (id.startsWith('local_')) {
        setIsLoadingTrip(false);
        setLoadError(cachedTrip ? null : 'This offline trip is not available on this device.');
        return;
      }

      const controller = new AbortController();
      detailController.current = controller;
      refreshLock.current = false;
      setRefreshing(false);
      setIsLoadingTrip(!cachedTrip);
      setLoadError(null);

      getTripById(id, controller.signal)
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            const message = error instanceof Error ? error.message : 'Unable to load this trip.';
            setLoadError(
              message === 'Failed to fetch' || message === 'Network request failed'
                ? 'We couldn’t reach Faroway. Check your connection and try again.'
                : message
            );
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoadingTrip(false);
        });

      return () => {
        controller.abort();
        if (detailController.current === controller) detailController.current = null;
      };
      // A retry intentionally replaces the focus callback without changing its inputs.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getTripById, id, isHydrated, loadAttempt])
  );

  // Clamp selectedDay when trip days change (e.g. after refresh with fewer days)
  useEffect(() => {
    if (trip?.days && selectedDay >= trip.days.length) {
      setSelectedDay(Math.max(0, trip.days.length - 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.days?.length, selectedDay]);

  // Show rating prompt after 10s on completed trips for authenticated users
  useEffect(() => {
    if (!isAuthenticated || trip?.status !== 'completed' || !shouldShowRatingPrompt()) return;
    const timer = setTimeout(() => {
      setShowRatingPrompt(true);
    }, 10000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, trip?.status]);

  const onRefresh = async () => {
    const controller = detailController.current;
    if (!id || !isActive() || refreshLock.current || !controller || controller.signal.aborted)
      return;
    refreshLock.current = true;
    setRefreshing(true);
    hapticFeedback.light();
    try {
      // Use getTripById which properly transforms itinerary data with booking URLs
      const latest = await getTripById(id, controller.signal);
      if (!isActive() || controller.signal.aborted) return;
      if (!latest) throw new Error('The latest saved trip could not be loaded.');
      hapticFeedback.success();
    } catch (error) {
      if (!isActive() || controller.signal.aborted) return;
      console.error('Failed to refresh trip:', error);
      hapticFeedback.error();
      Alert.alert(
        'Couldn’t refresh trip',
        'Your last loaded trip is kept. Check your connection and available device storage, then try again.'
      );
    } finally {
      if (detailController.current === controller) {
        refreshLock.current = false;
        if (isActive()) setRefreshing(false);
      }
    }
  };

  const handleShare = async () => {
    if (!id || !isActive() || shareLock.current) return;
    hapticFeedback.light();
    if (!isAuthenticated) {
      setShowAuthGate(true);
      return;
    }
    shareLock.current = true;
    try {
      const action = await new Promise<'cancel' | 'share' | 'revoke'>((resolve) =>
        Alert.alert(
          'Make this trip public?',
          'Anyone with the link can see your dates and itinerary. The link remains active if you cancel the share sheet. You can turn off public access from this sharing menu.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
            {
              text: 'Turn off public access',
              style: 'destructive',
              onPress: () => resolve('revoke'),
            },
            { text: 'Create public link', onPress: () => resolve('share') },
          ],
          { cancelable: true, onDismiss: () => resolve('cancel') }
        )
      );
      if (!isActive() || action === 'cancel') return;
      if (action === 'revoke') {
        await revokeOwnedTripShare(id);
        if (isActive())
          Alert.alert('Public access turned off', 'The old public link no longer works.');
        return;
      }
      const url = await shareOwnedTrip(id);
      if (!isActive()) return;
      await Share.share({
        message: `Check out my trip to ${trip?.destination}! ${url}`,
        url,
        title: `${trip?.destination} Trip Itinerary`,
      });
    } catch (error) {
      if (!isActive()) return;
      Alert.alert(
        'Sharing did not finish',
        `${error instanceof Error ? error.message : 'Please try again.'} If a public link was created, it stays active until you turn off public access.`
      );
    } finally {
      shareLock.current = false;
    }
  };

  if (!trip && isLoadingTrip) {
    return (
      <View
        style={styles.loadingContainer}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading trip"
      >
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading trip…</Text>
      </View>
    );
  }

  if (!trip) {
    const needsSignIn = loadError?.toLowerCase().includes('sign in') ?? false;
    const canRetry = Boolean(
      id &&
      !id.startsWith('local_') &&
      loadError &&
      !needsSignIn &&
      loadError !== 'Trip not found' &&
      loadError !== 'This trip link is incomplete.' &&
      !loadError.includes('could not be verified') &&
      !loadError.toLowerCase().includes('account changed')
    );

    return (
      <SafeAreaView style={styles.errorState} edges={['top', 'bottom']}>
        <View style={styles.errorStateIcon} accessible={false}>
          <Ionicons name="map-outline" size={40} color={colors.primary[500]} />
        </View>
        <Text style={styles.errorStateTitle} accessibilityRole="header">
          Couldn’t open this trip
        </Text>
        <Text style={styles.errorStateMessage} accessibilityLiveRegion="polite">
          {loadError || 'The trip may have been removed or the link may be invalid.'}
        </Text>
        <Button
          title={needsSignIn ? 'Sign in to view trips' : canRetry ? 'Try again' : 'Go to My Trips'}
          onPress={() => {
            if (needsSignIn) {
              setShowAuthGate(true);
            } else if (canRetry) {
              setLoadAttempt((attempt) => attempt + 1);
            } else {
              router.replace('/(tabs)/trips');
            }
          }}
          size="lg"
          fullWidth
          style={styles.errorStatePrimary}
        />
        <TouchableOpacity
          style={styles.errorStateBack}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.errorStateBackText}>Go back</Text>
        </TouchableOpacity>
        <AuthGate
          visible={showAuthGate}
          trigger="general"
          onClose={() => setShowAuthGate(false)}
          onAuthenticated={() => {
            if (!isActive()) return;
            setShowAuthGate(false);
            setLoadAttempt((attempt) => attempt + 1);
          }}
        />
      </SafeAreaView>
    );
  }

  const isLocalTrip = trip.id.startsWith('local_');

  const formatDateRange = () => {
    const start = formatTripDate(trip.startDate, { month: 'short', day: 'numeric' });
    const end = formatTripDate(trip.endDate, { month: 'short', day: 'numeric', year: 'numeric' });
    return start === 'Date unavailable' || end === 'Date unavailable'
      ? 'Travel dates unavailable'
      : `${start} - ${end}`;
  };

  const headerTranslate = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT / 2],
    extrapolate: 'clamp',
  });

  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0],
    outputRange: [1.5, 1],
    extrapolate: 'clamp',
  });

  return (
    <BookingTripContext.Provider value={trip.id}>
      <View style={styles.container}>
        <StatusBar style="light" />
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: USE_NATIVE_DRIVER,
          })}
          scrollEventThrottle={16}
          refreshControl={
            isLocalTrip ? undefined : (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            )
          }
        >
          {/* Hero Image */}
          <Animated.View
            style={[
              styles.heroContainer,
              reduceMotion ? undefined : { transform: [{ translateY: headerTranslate }] },
            ]}
          >
            <Animated.Image
              source={{ uri: trip.coverImage }}
              style={[
                styles.heroImage,
                reduceMotion ? undefined : { transform: [{ scale: imageScale }] },
              ]}
              accessibilityLabel={`${trip.destination}, ${trip.country}`}
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.8)']}
              style={styles.heroGradient}
            />
            <SafeAreaView edges={['top']} style={styles.heroContent}>
              <View style={styles.heroHeader}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => router.back()}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.heroActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleShare}
                    accessibilityRole="button"
                    accessibilityLabel="Share trip"
                  >
                    <Ionicons name="share-outline" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.heroInfo}>
                <Text style={styles.heroCountry}>{trip.country}</Text>
                <Text style={styles.heroTitle} accessibilityRole="header">
                  {trip.destination}
                </Text>
                <View style={styles.heroMeta}>
                  <View style={styles.heroMetaItem}>
                    <Ionicons name="calendar-outline" size={16} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.heroMetaText}>{formatDateRange()}</Text>
                  </View>
                  <View style={styles.heroMetaItem}>
                    <Ionicons name="people-outline" size={16} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.heroMetaText}>
                      {trip.travelers} traveler{trip.travelers > 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              </View>
            </SafeAreaView>
          </Animated.View>

          {/* Content */}
          <View style={styles.content}>
            {trip.planNeedsRefresh && (
              <View style={styles.planRefreshNotice}>
                <Text style={{ color: '#65251e' }}>
                  Your brief changed. The previous plan is kept on the website; update it before
                  booking or sharing.
                </Text>
                <TouchableOpacity
                  accessibilityRole="link"
                  onPress={() => {
                    reviewSavedTripBooking(trip.id, openURL);
                  }}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text style={{ color: '#9f342e', fontWeight: '700' }}>
                    Review trip on Faroway website
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Vibes */}
            {trip.vibes && trip.vibes.length > 0 && (
              <View style={styles.vibesSection}>
                <VibeChips vibes={trip.vibes} />
              </View>
            )}

            {/* Featured Hotel */}
            {trip.hotel && <FeaturedHotelCard hotel={trip.hotel} />}

            {trip.days.length === 0 ? (
              <View style={styles.emptyItinerary}>
                <View style={styles.emptyItineraryIcon} accessible={false}>
                  <Ionicons name="time-outline" size={32} color={colors.primary[500]} />
                </View>
                <Text style={styles.emptyItineraryTitle}>
                  {isLocalTrip ? 'Your trip is saved offline' : 'Your itinerary isn’t loaded'}
                </Text>
                <Text style={styles.emptyItineraryText}>
                  {isLocalTrip
                    ? 'This trip is saved on this device, but no itinerary is available yet. Reconnect, then check My Trips for the latest saved version.'
                    : 'Your trip is saved. Refresh to load its latest day-by-day plan.'}
                </Text>
                <Button
                  title={isLocalTrip ? 'Go to My Trips' : 'Refresh itinerary'}
                  onPress={isLocalTrip ? () => router.replace('/(tabs)/trips') : onRefresh}
                  loading={refreshing}
                  disabled={refreshing}
                  size="md"
                />
              </View>
            ) : (
              <>
                {/* Day Selector */}
                <View style={styles.daySelector}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.daySelectorContent}
                  >
                    {trip.days.map((day, index) => (
                      <TouchableOpacity
                        key={`${index}:${day.date}`}
                        style={[styles.dayTab, selectedDay === index && styles.dayTabSelected]}
                        onPress={() => {
                          hapticFeedback.selection();
                          setSelectedDay(index);
                        }}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: selectedDay === index }}
                        accessibilityLabel={`Day ${day.dayNumber}, ${formatTripDate(day.date)}`}
                      >
                        <Text
                          style={[
                            styles.dayTabNumber,
                            selectedDay === index && styles.dayTabNumberSelected,
                          ]}
                        >
                          Day {day.dayNumber}
                        </Text>
                        <Text
                          style={[
                            styles.dayTabDate,
                            selectedDay === index && styles.dayTabDateSelected,
                          ]}
                        >
                          {formatTripDate(day.date, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Day Theme */}
                <View style={styles.dayThemeContainer}>
                  <Text style={styles.dayTheme}>{trip.days[selectedDay]?.theme}</Text>
                </View>

                {/* Transport */}
                {trip.days[selectedDay]?.transport && (
                  <View style={styles.transportCardWrapper}>
                    <TransportCard transport={trip.days[selectedDay].transport!} />
                  </View>
                )}

                {/* Activities */}
                <View style={styles.activitiesContainer}>
                  {trip.days[selectedDay]?.activities.map((activity) => (
                    <ActivityCard key={activity.id} activity={activity} />
                  ))}
                </View>
                {!!trip.days[selectedDay]?.tips?.length && (
                  <View style={{ paddingVertical: 20, backgroundColor: '#EFF5F3', marginTop: 8 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '700',
                        color: '#182B31',
                        marginHorizontal: 24,
                        marginBottom: 12,
                      }}
                    >
                      Before you go
                    </Text>
                    {trip.days[selectedDay]?.tips?.map((tip, index) => (
                      <Text key={`${index}:${tip}`} style={styles.dayTip}>
                        {tip}
                      </Text>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </Animated.ScrollView>

        {/* Bottom Bar */}
        {bookableCount > 0 && (
          <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
            <Text style={styles.bottomBarLabel}>Check availability and prices with providers</Text>
            <Button
              title="Review options"
              onPress={() => {
                hapticFeedback.light();
                setShowBookingsSheet(true);
              }}
              size="md"
              fullWidth
            />
          </SafeAreaView>
        )}

        {/* Bookings Bottom Sheet */}
        <BookingsSheet
          visible={showBookingsSheet}
          onClose={() => setShowBookingsSheet(false)}
          bookableItems={bookableItems}
          costReferences={costReferences}
        />

        {/* Auth gate for guests */}
        <AuthGate
          visible={showAuthGate}
          trigger="share"
          tripPreview={
            trip ? { destination: trip.destination, coverImage: trip.coverImage } : undefined
          }
          onClose={() => setShowAuthGate(false)}
        />

        {/* Rating prompt for authenticated users on completed trips */}
        <RatingPrompt
          visible={showRatingPrompt}
          tripCount={tripGenerationCount}
          onClose={() => setShowRatingPrompt(false)}
        />
      </View>
    </BookingTripContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.neutral[500],
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#fff',
  },
  errorStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
    marginBottom: 20,
  },
  errorStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[900],
    textAlign: 'center',
  },
  errorStateMessage: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: colors.neutral[600],
    textAlign: 'center',
  },
  errorStatePrimary: {
    marginTop: 28,
  },
  errorStateBack: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  errorStateBackText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  scrollContent: {
    paddingBottom: 120,
  },
  heroContainer: {
    height: HEADER_HEIGHT,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 16,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroInfo: {
    marginBottom: 8,
  },
  heroCountry: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    letterSpacing: 0,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroMetaText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  content: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    marginTop: -24,
    paddingTop: 24,
  },
  planRefreshNotice: {
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 12,
    backgroundColor: '#fff5ee',
    borderRadius: 12,
  },
  vibesSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  emptyItinerary: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyItineraryIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
    marginBottom: 16,
  },
  emptyItineraryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[900],
    textAlign: 'center',
  },
  emptyItineraryText: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 21,
    color: colors.neutral[600],
    textAlign: 'center',
  },
  daySelector: {
    marginBottom: 16,
  },
  daySelectorContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  dayTab: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: borderRadius.lg,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  dayTabSelected: {
    backgroundColor: colors.action.primary,
  },
  dayTabNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 2,
  },
  dayTabNumberSelected: {
    color: '#fff',
  },
  dayTabDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  dayTabDateSelected: {
    color: 'rgba(255,255,255,0.7)',
  },
  dayTip: {
    color: '#53676C',
    fontSize: 14,
    lineHeight: 21,
    marginHorizontal: 24,
    marginBottom: 12,
  },
  dayThemeContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  dayTheme: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  activitiesContainer: {
    paddingHorizontal: 24,
  },
  activityCard: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  activityTime: {
    alignItems: 'center',
    width: 54,
    marginRight: 10,
  },
  activityTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  activityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  activityLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#e2e8f0',
    marginTop: 8,
  },
  activityContent: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activityImage: {
    width: '100%',
    height: 120,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  activityTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  activityDuration: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  activityPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[400],
  },
  activityDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  activityRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  activityRatingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginLeft: 4,
  },
  activityReviewCount: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 4,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  freeCancelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: 12,
  },
  freeCancelText: {
    fontSize: 11,
    color: '#22c55e',
    fontWeight: '500',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    gap: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  bottomBarInfo: { flex: 1, minWidth: 0, paddingRight: 12 },
  bottomBarLabel: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    color: '#64748b',
    marginBottom: 2,
  },
  bottomBarPrice: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  bookAllButton: {
    minWidth: 140,
  },
  // Featured Hotel Card
  hotelCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: borderRadius.lg,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    ...shadows.md,
  },
  hotelCardImage: {
    width: '100%',
    height: 160,
  },
  hotelCardContent: {
    padding: 16,
  },
  hotelCardHeader: {
    gap: 8,
    marginBottom: 12,
  },
  hotelCardName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  hotelCardRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hotelCardRatingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginLeft: 4,
  },
  hotelCardReviewCount: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 4,
  },
  hotelCardPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  hotelCardPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
  },
  hotelCardPriceLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  hotelCardAmenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  hotelCardAmenityChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  hotelCardAmenityText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  hotelCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFF5F4',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  hotelCardButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[500],
  },
  // Transport Card
  transportCardWrapper: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  transportCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  transportCardGradient: {
    padding: 16,
  },
  transportCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  transportCardProviderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transportCardProvider: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  transportCardPrice: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  transportCardRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  transportCardEndpoint: {
    alignItems: 'center',
    width: 70,
  },
  transportCardAirport: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  transportCardTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  transportCardCity: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  transportCardMiddle: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  transportCardDuration: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  transportCardLine: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 4,
  },
  transportCardLineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  transportCardLinePath: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  transportCardStops: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  transportCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  transportCardButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
  },
  // Bookings Sheet
  sheetContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetSubtitle: {
    fontSize: 14,
    color: '#64748b',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sheetList: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  sheetSeparator: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sheetItemInfo: {
    flex: 1,
  },
  sheetItemDay: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  sheetItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  sheetItemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  sheetItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.action.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.lg,
  },
  sheetItemButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
