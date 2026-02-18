import { useEffect, useState, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { Button, VibeChips } from '../../components/ui';
import { useTripStore, TripActivity } from '../../stores/tripStore';
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

export default function TripDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trips, currentTrip } = useTripStore();
  const [selectedDay, setSelectedDay] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  
  const scrollY = useRef(new Animated.Value(0)).current;
  const trip = trips.find((t) => t.id === id) || currentTrip;

  useEffect(() => {
    if (!trip && id) {
      router.back();
    }
  }, [trip, id]);

  const onRefresh = async () => {
    setRefreshing(true);
    hapticFeedback.light();
    // Simulate refresh - in real app, refetch trip data
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
    hapticFeedback.success();
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
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="heart-outline" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
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
          <Text style={styles.bottomBarPrice}>~$2,450</Text>
        </View>
        <Button
          title="Book All"
          onPress={() => {}}
          size="lg"
          style={styles.bookAllButton}
        />
      </View>
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
    backgroundColor: colors.surface[900],
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
    backgroundColor: colors.surface[800],
    alignItems: 'center',
  },
  dayTabSelected: {
    backgroundColor: colors.primary[500],
  },
  dayTabNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface[400],
    marginBottom: 2,
  },
  dayTabNumberSelected: {
    color: '#fff',
  },
  dayTabDate: {
    fontSize: 12,
    color: colors.surface[500],
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
    color: '#fff',
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
    color: colors.surface[500],
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
    backgroundColor: colors.surface[700],
    marginTop: 8,
  },
  activityContent: {
    flex: 1,
    backgroundColor: colors.surface[800],
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    color: '#fff',
  },
  activityDuration: {
    fontSize: 12,
    color: colors.surface[400],
    marginTop: 2,
  },
  activityPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[400],
  },
  activityDescription: {
    fontSize: 14,
    color: colors.surface[400],
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
    color: '#fff',
    marginLeft: 4,
  },
  activityReviewCount: {
    fontSize: 13,
    color: colors.surface[400],
    marginLeft: 4,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(99,102,241,0.15)',
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
    backgroundColor: colors.surface[800],
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  bottomBarInfo: {},
  bottomBarLabel: {
    fontSize: 12,
    color: colors.surface[400],
    marginBottom: 2,
  },
  bottomBarPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  bookAllButton: {
    minWidth: 140,
  },
});
