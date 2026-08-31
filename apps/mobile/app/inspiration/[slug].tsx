import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getInspirationBySlug, popularDestinations } from '@faroway/constants';
import { colors, borderRadius, shadows } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { USE_NATIVE_DRIVER } from '../../lib/animation';

const { width, height: screenHeight } = Dimensions.get('window');
const HERO_HEIGHT = screenHeight * 0.45;

const HIGHLIGHT_ICONS: Record<string, string> = {
  'Crystal waters': 'water',
  'Sunset dinners': 'restaurant',
  'Seaside strolls': 'walk',
  'Water sports': 'boat',
  'Alpine trails': 'trail-sign',
  'Mountain views': 'eye',
  'Cozy lodges': 'home',
  'Fresh air': 'leaf',
  'Street food tours': 'fast-food',
  'Cooking classes': 'flame',
  'Local markets': 'storefront',
  'Fine dining': 'wine',
  'World-class museums': 'business',
  'Historic quarters': 'map',
  'Local artisans': 'color-palette',
  'Guided tours': 'compass',
  'Rooftop bars': 'beer',
  'Live music': 'musical-notes',
  'Club hopping': 'moon',
  'Late-night eats': 'pizza',
  'Candlelit dinners': 'heart',
  'Scenic sunsets': 'sunny',
  'Couples spa': 'sparkles',
  'Private tours': 'key',
};

function getNextFriday(): Date {
  const today = new Date();
  const day = today.getDay();
  const daysUntilFriday = day === 5 ? 7 : (5 - day + 7) % 7 || 7;
  const friday = new Date(today);
  friday.setDate(today.getDate() + daysUntilFriday);
  return friday;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function InspirationDetailScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const inspiration = getInspirationBySlug(slug || '');
  const reduceMotion = useReduceMotion();

  const scrollY = useRef(new Animated.Value(0)).current;
  const sectionAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const matchingDestinations = useMemo(() => {
    if (!inspiration) return [];
    return popularDestinations.filter((d) => d.tags.some((tag) => inspiration.tags.includes(tag)));
  }, [inspiration]);

  useEffect(() => {
    hapticFeedback.light();

    if (reduceMotion) {
      sectionAnims.forEach((anim) => anim.setValue(1));
      return;
    }

    const animations = sectionAnims.map((anim, i) =>
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
        delay: 200 + i * 120,
        tension: 50,
        friction: 8,
      })
    );
    Animated.stagger(120, animations).start();
  }, [reduceMotion, sectionAnims]);

  if (!inspiration) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text
          style={{ fontSize: 20, fontWeight: '700', color: '#0f172a' }}
          accessibilityRole="header"
        >
          Inspiration not found
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ minHeight: 44, justifyContent: 'center', marginTop: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={{ fontSize: 16, color: colors.primary[500], fontWeight: '600' }}>
            Go back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const heroTranslateY = scrollY.interpolate({
    inputRange: [-100, 0, HERO_HEIGHT],
    outputRange: [-50, 0, HERO_HEIGHT * 0.3],
    extrapolate: 'clamp',
  });

  const heroScale = scrollY.interpolate({
    inputRange: [-200, 0],
    outputRange: [1.5, 1],
    extrapolateRight: 'clamp',
  });

  const makeSectionStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: reduceMotion
      ? []
      : [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [30, 0],
            }),
          },
        ],
  });

  const handleDestinationPress = (destination: (typeof matchingDestinations)[0]) => {
    hapticFeedback.medium();
    router.push({
      pathname: '/create',
      params: {
        destination: destination.name,
        country: destination.country,
        vibes: inspiration.vibes.join(','),
      },
    });
  };

  const handleSurpriseMe = () => {
    hapticFeedback.heavy();
    const randomDest =
      matchingDestinations[Math.floor(Math.random() * matchingDestinations.length)];
    if (!randomDest) return;

    const startDate = getNextFriday();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + inspiration.suggestedDuration);

    router.push({
      pathname: '/create',
      params: {
        destination: randomDest.name,
        country: randomDest.country,
        vibes: inspiration.vibes.join(','),
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        travelerType: inspiration.suggestedTravelerType,
        travelers: '2',
      },
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: USE_NATIVE_DRIVER,
        })}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          <Animated.Image
            source={{ uri: inspiration.heroImage }}
            style={[
              styles.heroImage,
              reduceMotion
                ? undefined
                : {
                    transform: [{ translateY: heroTranslateY }, { scale: heroScale }],
                  },
            ]}
            accessible={false}
          />
          <LinearGradient
            colors={[
              'transparent',
              inspiration.gradientColors[0] + 'CC',
              inspiration.gradientColors[1],
            ]}
            locations={[0, 0.6, 1]}
            style={styles.heroGradient}
          />
          <View style={[styles.heroContent, { paddingTop: insets.top }]}>
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroEmoji}>{inspiration.emoji}</Text>
              <Text style={styles.heroTitle} accessibilityRole="header">
                {inspiration.title}
              </Text>
              <Text style={styles.heroTagline}>{inspiration.tagline}</Text>
            </View>
          </View>
        </View>

        {/* What to Expect */}
        <Animated.View style={[styles.section, makeSectionStyle(sectionAnims[0])]}>
          <Text style={styles.sectionTitle}>What to expect</Text>
          <View style={styles.highlightsContainer}>
            {inspiration.highlights.map((highlight) => (
              <View key={highlight} style={styles.highlightChip}>
                <Ionicons
                  name={
                    (HIGHLIGHT_ICONS[highlight] || 'sparkles') as React.ComponentProps<
                      typeof Ionicons
                    >['name']
                  }
                  size={16}
                  color={inspiration.gradientColors[0]}
                />
                <Text style={styles.highlightText}>{highlight}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Perfect Destinations */}
        <Animated.View style={[styles.section, makeSectionStyle(sectionAnims[1])]}>
          <Text style={styles.sectionTitle}>Perfect destinations</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.destinationsScroll}
          >
            {matchingDestinations.map((dest) => (
              <TouchableOpacity
                key={dest.id}
                style={styles.destCard}
                activeOpacity={0.9}
                onPress={() => handleDestinationPress(dest)}
                accessibilityRole="button"
                accessibilityLabel={`${dest.name}, ${dest.country}`}
              >
                <Image source={{ uri: dest.image }} style={styles.destImage} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.75)']}
                  style={styles.destGradient}
                />
                <View style={styles.destContent}>
                  <View style={styles.destBestTime}>
                    <Ionicons name="calendar-outline" size={10} color="#fff" />
                    <Text style={styles.destBestTimeText}>{dest.bestTime}</Text>
                  </View>
                  <Text style={styles.destName}>{dest.name}</Text>
                  <Text style={styles.destCountry}>{dest.country}</Text>
                  <Text style={styles.destDescription} numberOfLines={2}>
                    {dest.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      </Animated.ScrollView>

      {/* Back Button */}
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 8 }]}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>

      {/* Bottom Sticky CTA */}
      <Animated.View style={[styles.bottomCta, makeSectionStyle(sectionAnims[2])]}>
        <TouchableOpacity
          style={[styles.surpriseButton, { backgroundColor: inspiration.gradientColors[0] }]}
          activeOpacity={0.85}
          onPress={handleSurpriseMe}
          accessibilityRole="button"
          accessibilityLabel="Surprise me with a destination"
        >
          <Ionicons name="sparkles" size={20} color="#fff" />
          <Text style={styles.surpriseButtonText}>Surprise Me</Text>
        </TouchableOpacity>
        <Text style={styles.ctaSubtext}>or pick a destination above</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  heroContainer: {
    height: HERO_HEIGHT,
    overflow: 'hidden',
  },
  heroImage: {
    width: width,
    height: HERO_HEIGHT + 100,
    position: 'absolute',
    top: -50,
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  heroTextContainer: {},
  heroEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  heroTagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    paddingTop: 28,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  highlightsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  highlightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  highlightText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  destinationsScroll: {
    paddingRight: 24,
    gap: 14,
  },
  destCard: {
    width: width * 0.65,
    height: 240,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.md,
  },
  destImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  destGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
  },
  destContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  destBestTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  destBestTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  destName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  destCountry: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  destDescription: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    lineHeight: 16,
  },
  bottomCta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center',
  },
  surpriseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    ...(Platform.OS === 'web' ? { boxShadow: '0 0 16px rgba(250, 140, 132, 0.35)' } : shadows.glow),
  },
  surpriseButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  ctaSubtext: {
    marginTop: 10,
    fontSize: 13,
    color: '#94a3b8',
  },
});
