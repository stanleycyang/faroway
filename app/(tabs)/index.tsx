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
import { SearchInput, DestinationCard, Button } from '../../components/ui';
import { popularDestinations } from '../../constants/destinations';
import { useAuthContext } from '../../components/AuthProvider';
import { useTripStore } from '../../stores/tripStore';
import { colors, borderRadius, shadows } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';

const { width } = Dimensions.get('window');

const INSPIRATIONS = [
  { emoji: '🏖️', text: 'Beach getaway' },
  { emoji: '🏔️', text: 'Mountain escape' },
  { emoji: '🍜', text: 'Foodie adventure' },
  { emoji: '🎨', text: 'Art & culture' },
  { emoji: '🎉', text: 'Party weekend' },
  { emoji: '💑', text: 'Romantic trip' },
];

export default function ExploreScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();
  const { trips } = useTripStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [greeting, setGreeting] = useState('');
  
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

    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDestinationPress = (destinationId: string) => {
    hapticFeedback.light();
    const destination = popularDestinations.find((d) => d.id === destinationId);
    if (destination) {
      router.push({
        pathname: '/create',
        params: { destination: destination.name, country: destination.country },
      });
    }
  };

  const handleCreateTrip = () => {
    hapticFeedback.medium();
    router.push('/create');
  };

  const handleInspirationPress = (text: string) => {
    hapticFeedback.light();
    // Could pre-fill vibes based on inspiration
    router.push('/create');
  };

  const hasTrips = trips.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View>
            <Text style={styles.greeting}>{greeting} 👋</Text>
            <Text style={styles.headerTitle}>
              {hasTrips ? 'Where to next?' : 'Plan your dream trip'}
            </Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons
              name="notifications-outline"
              size={24}
              color={colors.neutral[700]}
            />
          </TouchableOpacity>
        </Animated.View>

        {/* Search */}
        <View style={styles.searchSection}>
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search destinations..."
          />
        </View>

        {/* Hero Card - Main CTA */}
        <TouchableOpacity onPress={handleCreateTrip} activeOpacity={0.95}>
          <LinearGradient
            colors={['#6366f1', '#8b5cf6', '#a855f7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {/* Background pattern */}
            <View style={styles.heroPattern}>
              <Text style={styles.heroPatternEmoji}>✈️</Text>
              <Text style={[styles.heroPatternEmoji, styles.heroPattern2]}>🗺️</Text>
              <Text style={[styles.heroPatternEmoji, styles.heroPattern3]}>🌴</Text>
            </View>

            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <Ionicons name="sparkles" size={14} color="#fff" />
                <Text style={styles.heroBadgeText}>AI-Powered</Text>
              </View>

              <Text style={styles.heroTitle}>Create Your Perfect Trip</Text>
              <Text style={styles.heroSubtitle}>
                Tell us where you want to go, and we'll plan everything in seconds
              </Text>

              <View style={styles.heroButton}>
                <Text style={styles.heroButtonText}>Start Planning</Text>
                <Ionicons name="arrow-forward" size={18} color="#6366f1" />
              </View>

              <View style={styles.heroFeatures}>
                <View style={styles.heroFeature}>
                  <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.heroFeatureText}>No account needed</Text>
                </View>
                <View style={styles.heroFeature}>
                  <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.heroFeatureText}>100% free</Text>
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
                onPress={() => handleInspirationPress(item.text)}
                activeOpacity={0.7}
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
            <TouchableOpacity>
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
            {popularDestinations.slice(0, 5).map((destination) => (
              <DestinationCard
                key={destination.id}
                destination={destination}
                onPress={() => handleDestinationPress(destination.id)}
                style={styles.destinationCard}
              />
            ))}
          </ScrollView>
        </View>

        {/* Social Proof */}
        <View style={styles.socialProof}>
          <View style={styles.socialProofAvatars}>
            {['👩🏻', '👨🏽', '👩🏼', '👨🏻'].map((emoji, i) => (
              <View
                key={i}
                style={[styles.avatar, { marginLeft: i > 0 ? -10 : 0 }]}
              >
                <Text style={styles.avatarEmoji}>{emoji}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.socialProofText}>
            <Text style={styles.socialProofNumber}>10,000+</Text> trips planned this week
          </Text>
        </View>

        {/* Trending This Season */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trending This Season</Text>
          <View style={styles.trendingGrid}>
            {popularDestinations.slice(5, 9).map((destination) => (
              <TouchableOpacity
                key={destination.id}
                style={styles.trendingCard}
                onPress={() => handleDestinationPress(destination.id)}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: destination.image }}
                  style={styles.trendingImage}
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
    backgroundColor: colors.neutral[50],
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
    color: colors.neutral[500],
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.neutral[900],
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  searchSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
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
    color: '#6366f1',
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
    color: colors.neutral[900],
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
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  inspirationEmoji: {
    fontSize: 20,
  },
  inspirationText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  horizontalScroll: {
    paddingHorizontal: 24,
    gap: 16,
  },
  destinationCard: {
    width: width * 0.7,
  },
  socialProof: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 20,
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  socialProofAvatars: {
    flexDirection: 'row',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarEmoji: {
    fontSize: 16,
  },
  socialProofText: {
    fontSize: 14,
    color: colors.neutral[600],
  },
  socialProofNumber: {
    fontWeight: '700',
    color: colors.neutral[900],
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
