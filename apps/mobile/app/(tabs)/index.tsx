import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PlacesAutocomplete, DestinationCard } from '../../components/ui';
import { popularDestinations } from '@faroway/constants';
import { getPopularDestinations, getTrendingDestinations } from '../../services/api';
import type { DestinationInfo } from '@faroway/types';
import { useTripStore } from '../../stores/tripStore';
import { useUserStore } from '../../stores/userStore';
import { colors, borderRadius, shadows } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { USE_NATIVE_DRIVER } from '../../lib/animation';

const { width } = Dimensions.get('window');

const INSPIRATIONS = [
  { emoji: '🏖️', text: 'Beach getaway', slug: 'beach-getaway' },
  { emoji: '🏔️', text: 'Mountain escape', slug: 'mountain-escape' },
  { emoji: '🍜', text: 'Foodie adventure', slug: 'foodie-adventure' },
  { emoji: '🎨', text: 'Art & culture', slug: 'art-and-culture' },
  { emoji: '🎉', text: 'Party weekend', slug: 'party-weekend' },
  { emoji: '💑', text: 'Romantic trip', slug: 'romantic-trip' },
];

export default function ExploreScreen() {
  const router = useRouter();
  const { trips } = useTripStore();
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const reduceMotion = useReduceMotion();
  const [greeting, setGreeting] = useState('');
  const [apiPopular, setApiPopular] = useState<DestinationInfo[] | null>(null);
  const [apiTrending, setApiTrending] = useState<DestinationInfo[] | null>(null);

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Set greeting based on time
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    if (reduceMotion) {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }

    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, reduceMotion]);

  // Fetch destinations from API (swap in when ready, hardcoded shows immediately)
  useEffect(() => {
    getPopularDestinations({ limit: 5 })
      .then((res) => {
        if (res.data?.destinations?.length) setApiPopular(res.data.destinations);
      })
      .catch(() => {
        // Network failure — hardcoded popularDestinations remain visible
      });
    getTrendingDestinations({ limit: 4 })
      .then((res) => {
        if (res.data?.destinations?.length) setApiTrending(res.data.destinations);
      })
      .catch(() => {
        // Network failure — section simply stays hidden (no trending fallback data)
      });
  }, []);

  const handleDestinationPress = (name: string, country: string) => {
    hapticFeedback.light();
    router.push({
      pathname: '/create',
      params: { destination: name, country },
    });
  };

  const handleCreateTrip = () => {
    hapticFeedback.medium();
    router.push('/create');
  };

  const handleInspirationPress = (slug: string) => {
    hapticFeedback.light();
    router.push(`/inspiration/${slug}`);
  };

  const hasTrips = trips.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: USE_NATIVE_DRIVER,
        })}
        scrollEventThrottle={16}
      >
        {/* Header */}
        <Animated.View
          style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <View>
            <Text style={styles.greeting}>{greeting} 👋</Text>
            <Text style={styles.headerTitle} accessibilityRole="header">
              {hasTrips ? 'Where to next?' : 'Plan your dream trip'}
            </Text>
          </View>
          {isAuthenticated && (
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => router.push('/profile/notifications')}
              accessibilityRole="button"
              accessibilityLabel="Notification settings"
            >
              <Ionicons name="notifications-outline" size={24} color={'#475569'} />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Search */}
        <View style={styles.searchSection}>
          <PlacesAutocomplete
            onSelect={(city, country, placeId) => {
              hapticFeedback.light();
              router.push({
                pathname: '/create',
                params: {
                  destination: city,
                  country,
                  ...(placeId ? { placeId } : {}),
                },
              });
            }}
          />
        </View>

        {/* Hero Card - Main CTA */}
        <TouchableOpacity
          onPress={handleCreateTrip}
          activeOpacity={0.95}
          accessibilityRole="button"
          accessibilityLabel="Create your trip"
          accessibilityHint="Starts the AI trip planning flow"
        >
          <LinearGradient
            colors={['#F97066', '#F59E0B', '#FBBF24']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {/* Background pattern */}
            <View style={styles.heroPattern} accessible={false}>
              <Text style={styles.heroPatternEmoji}>✈️</Text>
              <Text style={[styles.heroPatternEmoji, styles.heroPattern2]}>🗺️</Text>
              <Text style={[styles.heroPatternEmoji, styles.heroPattern3]}>🌴</Text>
            </View>

            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <Ionicons name="sparkles" size={14} color="#fff" />
                <Text style={styles.heroBadgeText}>AI-Powered</Text>
              </View>

              <Text style={styles.heroTitle}>Create Your Trip</Text>
              <Text style={styles.heroSubtitle}>
                Tell us where you want to go, and we'll build a day-by-day plan step by step
              </Text>

              <View style={styles.heroButton}>
                <Text style={styles.heroButtonText}>Start Planning</Text>
                <Ionicons name="arrow-forward" size={18} color="#F97066" />
              </View>

              <View style={styles.heroFeatures}>
                <View style={styles.heroFeature}>
                  <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.heroFeatureText}>
                    {isAuthenticated ? 'Synced across devices' : 'Sign in to generate'}
                  </Text>
                </View>
                <View style={styles.heroFeature}>
                  <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.heroFeatureText}>Personalized plans</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Quick Inspirations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Looking for inspiration?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.inspirationsContainer}
          >
            {INSPIRATIONS.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.inspirationChip}
                onPress={() => handleInspirationPress(item.slug)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={item.text}
              >
                <Text style={styles.inspirationEmoji}>{item.emoji}</Text>
                <Text style={styles.inspirationText}>{item.text}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Popular Destinations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular Destinations</Text>
            <TouchableOpacity
              onPress={handleCreateTrip}
              accessibilityRole="button"
              accessibilityLabel="Search all destinations"
            >
              <Text style={styles.seeAllButton}>See all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
            decelerationRate="fast"
            snapToInterval={width * 0.7 + 16}
          >
            {(apiPopular ?? popularDestinations.slice(0, 5)).map((destination) => (
              <View key={destination.id} style={styles.destinationCard}>
                <DestinationCard
                  name={destination.name}
                  country={destination.country}
                  image={destination.image}
                  description={destination.description}
                  tags={destination.tags}
                  onPress={() => handleDestinationPress(destination.name, destination.country)}
                />
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Trending This Season */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trending This Season</Text>
          <View style={styles.trendingGrid}>
            {(apiTrending ?? popularDestinations.slice(5, 9)).map((destination) => (
              <TouchableOpacity
                key={destination.id}
                style={styles.trendingCard}
                onPress={() => handleDestinationPress(destination.name, destination.country)}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={`${destination.name}, ${destination.country}`}
                accessibilityHint="Starts trip planning for this destination"
              >
                <Image
                  source={{ uri: destination.image }}
                  style={styles.trendingImage}
                  accessible={false}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.7)']}
                  style={styles.trendingGradient}
                />
                <View style={styles.trendingContent}>
                  <Text style={styles.trendingName}>{destination.name}</Text>
                  <Text style={styles.trendingCountry}>{destination.country}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bottom padding */}
        <View style={{ height: 100 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
    zIndex: 50,
  },
  heroCard: {
    marginHorizontal: 24,
    borderRadius: borderRadius.xl,
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
    ...shadows.lg,
  },
  heroPattern: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  heroPatternEmoji: {
    position: 'absolute',
    fontSize: 60,
    opacity: 0.15,
    right: 20,
    top: 20,
  },
  heroPattern2: {
    right: 80,
    top: 60,
    fontSize: 40,
  },
  heroPattern3: {
    right: -10,
    top: 100,
    fontSize: 50,
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
    marginBottom: 20,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    marginBottom: 16,
  },
  heroButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F97066',
  },
  heroFeatures: {
    flexDirection: 'row',
    gap: 20,
  },
  heroFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroFeatureText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  seeAllButton: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[500],
  },
  inspirationsContainer: {
    paddingHorizontal: 24,
    gap: 10,
  },
  inspirationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inspirationEmoji: {
    fontSize: 20,
  },
  inspirationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  horizontalScroll: {
    paddingHorizontal: 24,
    gap: 16,
  },
  destinationCard: {
    width: width * 0.7,
  },
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: 12,
  },
  trendingCard: {
    width: (width - 60) / 2,
    height: 140,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  trendingImage: {
    width: '100%',
    height: '100%',
  },
  trendingGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  trendingContent: {
    position: 'absolute',
    bottom: 12,
    left: 12,
  },
  trendingName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  trendingCountry: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
});
