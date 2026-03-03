import { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  RefreshControl,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { Button, VibeChips } from '../../components/ui';
import { useTripStore, TripActivity } from '../../stores/tripStore';
import { usePromptStore } from '../../stores/promptStore';
import { useAuthContext } from '../../components/AuthProvider';
import { AuthGate } from '../../components/AuthGate';
import { RatingPrompt } from '../../components/RatingPrompt';
import { getTrip, shareTrip } from '../../services/api';
import { colors, borderRadius, shadows } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';
import { registry } from '../../lib/json-render/registry';

const { width } = Dimensions.get('window');
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
    console.error('Failed to open URL:', error);
  }
};

/**
 * Simple json-render Renderer Component
 */
function JsonRenderRenderer({ document }: { document: any }) {
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
    <View>
      {components.map((comp, index) => renderComponent(comp, index))}
    </View>
  );
}

interface ActivityCardProps {
  activity: TripActivity;
  onPress?: () => void;
}

function ActivityCard({ activity, onPress }: ActivityCardProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'restaurant':
        return 'restaurant';
      case 'transport':
        return 'car';
      case 'accommodation':
        return 'bed';
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
      default:
        return colors.primary[500];
    }
  };

  return (
    <TouchableOpacity
      style={styles.activityCard}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.activityTime}>
        <Text style={styles.activityTimeText}>{activity.time}</Text>
        <View
          style={[
            styles.activityDot,
            { backgroundColor: getTypeColor(activity.type) },
          ]}
        />
        <View style={styles.activityLine} />
      </View>
      <View style={styles.activityContent}>
        <View style={styles.activityHeader}>
          <View
            style={[
              styles.activityTypeIcon,
              { backgroundColor: `${getTypeColor(activity.type)}15` },
            ]}
          >
            <Ionicons
              name={getTypeIcon(activity.type) as any}
              size={16}
              color={getTypeColor(activity.type)}
            />
          </View>
          <View style={styles.activityInfo}>
            <Text style={styles.activityTitle}>{activity.title}</Text>
            <Text style={styles.activityDuration}>{activity.duration}</Text>
          </View>
          {activity.price && (
            <Text style={styles.activityPrice}>{activity.price}</Text>
          )}
        </View>
        <Text style={styles.activityDescription} numberOfLines={2}>
          {activity.description}
        </Text>
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
            onPress={() => openURL(activity.bookingUrl!)}
            activeOpacity={0.7}
          >
            <Text style={styles.bookButtonText}>Book Now</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary[500]} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function FeaturedHotelCard({ hotel }: { hotel: NonNullable<import('../../stores/tripStore').Trip['hotel']> }) {
  return (
    <View style={styles.hotelCard}>
      {hotel.images && hotel.images.length > 0 && (
        <Image source={{ uri: hotel.images[0] }} style={styles.hotelCardImage} />
      )}
      <View style={styles.hotelCardContent}>
        <View style={styles.hotelCardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hotelCardName}>{hotel.name}</Text>
            <View style={styles.hotelCardRating}>
              <Ionicons name="star" size={14} color="#fbbf24" />
              <Text style={styles.hotelCardRatingText}>{hotel.rating}</Text>
              {hotel.reviewCount != null && hotel.reviewCount > 0 && (
                <Text style={styles.hotelCardReviewCount}>
                  ({hotel.reviewCount.toLocaleString()} reviews)
                </Text>
              )}
            </View>
          </View>
          <View style={styles.hotelCardPriceContainer}>
            <Text style={styles.hotelCardPrice}>${hotel.pricePerNight}</Text>
            <Text style={styles.hotelCardPriceLabel}>per night</Text>
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
        <TouchableOpacity
          style={styles.hotelCardButton}
          onPress={() => hotel.bookingUrl && openURL(hotel.bookingUrl)}
          activeOpacity={0.7}
          disabled={!hotel.bookingUrl}
        >
          <Text style={styles.hotelCardButtonText}>Check Availability</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function TransportCard({ transport }: { transport: NonNullable<import('../../stores/tripStore').TripDay['transport']> }) {
  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const formatTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const stopsLabel = transport.stops === 0 ? 'Direct' : `${transport.stops} stop${transport.stops > 1 ? 's' : ''}`;

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
            ${transport.price}
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
            onPress={() => openURL(transport.bookingUrl!)}
            activeOpacity={0.7}
          >
            <Text style={styles.transportCardButtonText}>Book Flight</Text>
            <Ionicons name="arrow-forward" size={16} color="#1e40af" />
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
}

export default function TripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trips, currentTrip } = useTripStore();
  const { isAuthenticated } = useAuthContext();
  const { tripGenerationCount, shouldShowRatingPrompt } = usePromptStore();
  const [selectedDay, setSelectedDay] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authGateTrigger, setAuthGateTrigger] = useState<'save' | 'share'>('save');
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollViewRef = useRef<any>(null);
  const trip = trips.find((t) => t.id === id) || currentTrip;

  const estimatedTotal = useMemo(() => {
    let total = 0;
    if (trip?.hotel) total += trip.hotel.totalPrice;
    for (const day of (trip?.days || [])) {
      if (day.transport) total += day.transport.price;
      for (const act of day.activities) {
        if (act.price) {
          const numPrice = parseFloat(String(act.price).replace(/[^0-9.]/g, ''));
          if (!isNaN(numPrice)) total += numPrice;
        }
      }
    }
    return total;
  }, [trip]);

  useEffect(() => {
    if (!trip && id) {
      // Delay to allow store hydration before navigating back
      const timeout = setTimeout(() => {
        const freshTrip = useTripStore.getState().trips.find((t) => t.id === id) || useTripStore.getState().currentTrip;
        if (!freshTrip) router.back();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [trip, id]);

  // Clamp selectedDay when trip days change (e.g. after refresh with fewer days)
  useEffect(() => {
    if (trip?.days && selectedDay >= trip.days.length) {
      setSelectedDay(Math.max(0, trip.days.length - 1));
    }
  }, [trip?.days?.length, selectedDay]);

  // Show rating prompt after 10s on completed trips for authenticated users
  useEffect(() => {
    if (!isAuthenticated || trip?.status !== 'completed' || !shouldShowRatingPrompt()) return;
    const timer = setTimeout(() => {
      setShowRatingPrompt(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, trip?.status]);

  const handleHeartPress = () => {
    hapticFeedback.light();
    if (!isAuthenticated) {
      setAuthGateTrigger('save');
      setShowAuthGate(true);
    }
    // For authenticated users: no-op for now (toggle saved state TBD)
  };

  const onRefresh = async () => {
    if (!id) return;
    setRefreshing(true);
    hapticFeedback.light();
    try {
      const result = await getTrip(id);
      if (result.data?.trip) {
        const { saveTrip } = useTripStore.getState();
        saveTrip(result.data.trip as any);
      }
      hapticFeedback.success();
    } catch (error) {
      console.error('Failed to refresh trip:', error);
      hapticFeedback.error();
    }
    setRefreshing(false);
  };

  const handleShare = async () => {
    if (!id) return;
    hapticFeedback.light();
    if (!isAuthenticated) {
      setAuthGateTrigger('share');
      setShowAuthGate(true);
      return;
    }
    try {
      const result = await shareTrip(id);
      if (result.data?.shareUrl) {
        await Share.share({
          message: `Check out my trip to ${trip?.destination}! ${result.data.shareUrl}`,
          url: result.data.shareUrl,
          title: `${trip?.destination} Trip Itinerary`,
        });
      } else {
        Alert.alert('Error', result.error || 'Failed to create share link');
      }
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  if (!trip) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading trip...</Text>
      </View>
    );
  }

  const formatDateRange = () => {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    return `${start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} - ${end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
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
    <View style={styles.container}>
      <Animated.ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Hero Image */}
        <Animated.View
          style={[
            styles.heroContainer,
            { transform: [{ translateY: headerTranslate }] },
          ]}
        >
          <Animated.Image
            source={{ uri: trip.coverImage }}
            style={[styles.heroImage, { transform: [{ scale: imageScale }] }]}
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
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.heroActions}>
                <TouchableOpacity style={styles.actionButton} onPress={handleHeartPress}>
                  <Ionicons name="heart-outline" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                  <Ionicons name="share-outline" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroCountry}>{trip.country}</Text>
              <Text style={styles.heroTitle}>{trip.destination}</Text>
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
          {/* Vibes */}
          {trip.vibes && trip.vibes.length > 0 && (
            <View style={styles.vibesSection}>
              <VibeChips vibes={trip.vibes} />
            </View>
          )}

          {/* Featured Hotel */}
          {trip.hotel && (
            <FeaturedHotelCard hotel={trip.hotel} />
          )}

          {/* Day Selector */}
          <View style={styles.daySelector}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.daySelectorContent}
            >
              {trip.days.map((day, index) => (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    styles.dayTab,
                    selectedDay === index && styles.dayTabSelected,
                  ]}
                  onPress={() => {
                    hapticFeedback.selection();
                    setSelectedDay(index);
                  }}
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
                    {new Date(day.date).toLocaleDateString('en-US', {
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
            <Text style={styles.dayTheme}>
              {trip.days[selectedDay]?.theme}
            </Text>
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
        </View>
      </Animated.ScrollView>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarInfo}>
          <Text style={styles.bottomBarLabel}>Estimated cost</Text>
          <Text style={styles.bottomBarPrice}>
            {estimatedTotal > 0 ? `~$${estimatedTotal.toLocaleString()}` : 'Free activities'}
          </Text>
        </View>
        <Button
          title="View Bookings"
          onPress={() => {
            hapticFeedback.light();
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
          }}
          size="lg"
          style={styles.bookAllButton}
        />
      </View>

      {/* Auth gate for guests */}
      <AuthGate
        visible={showAuthGate}
        trigger={authGateTrigger}
        tripPreview={
          trip
            ? { destination: trip.destination, coverImage: trip.coverImage }
            : undefined
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
    color: colors.primary[300],
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
  },
  heroMeta: {
    flexDirection: 'row',
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
  vibesSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
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
    backgroundColor: colors.primary[500],
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
    width: 50,
    marginRight: 16,
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
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  },
  activityRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    gap: 6,
    backgroundColor: '#FFF5F4',
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  bookButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[400],
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  bottomBarInfo: {},
  bottomBarLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  bottomBarPrice: {
    fontSize: 24,
    fontWeight: '800',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    alignItems: 'flex-end',
  },
  hotelCardPrice: {
    fontSize: 20,
    fontWeight: '800',
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
    fontWeight: '800',
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
});
