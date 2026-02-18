import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  FlatList,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui';
import { colors } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';

const { width, height } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  highlight: string;
  image: string;
  gradient: string[];
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    emoji: '✨',
    title: 'AI Plans Your\nPerfect Trip',
    subtitle: 'Tell us where you want to go, and watch magic happen',
    highlight: 'in seconds',
    image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80',
    gradient: ['#6366f1', '#8b5cf6'],
  },
  {
    id: '2',
    emoji: '🗺️',
    title: 'Discover\nHidden Gems',
    subtitle: 'Local favorites and secret spots that guidebooks miss',
    highlight: 'curated for you',
    image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80',
    gradient: ['#f59e0b', '#ef4444'],
  },
  {
    id: '3',
    emoji: '🎯',
    title: 'Book Everything\nIn One Tap',
    subtitle: 'Hotels, restaurants, experiences — all in one place',
    highlight: 'no more tabs',
    image: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=800&q=80',
    gradient: ['#10b981', '#059669'],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Animate content on slide change
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentIndex]);

  const handleNext = () => {
    hapticFeedback.light();
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      hapticFeedback.success();
      // Skip preferences, go straight to creating a trip
      router.replace('/(tabs)');
    }
  };

  const handleSkip = () => {
    hapticFeedback.light();
    // Go straight to the app - let them create a trip immediately
    router.replace('/(tabs)');
  };

  const currentSlide = SLIDES[currentIndex];

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => (
    <View style={styles.slide}>
      <Image source={{ uri: item.image }} style={styles.slideImage} />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
        style={styles.slideGradient}
        locations={[0, 0.5, 1]}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        scrollEventThrottle={16}
      />

      {/* Skip button */}
      <SafeAreaView edges={['top']} style={styles.skipContainer}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Content Overlay */}
      <SafeAreaView edges={['bottom']} style={styles.content}>
        {/* Emoji */}
        <Animated.View
          style={[
            styles.emojiContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.emoji}>{currentSlide.emoji}</Text>
        </Animated.View>

        {/* Title */}
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {currentSlide.title}
        </Animated.Text>

        {/* Subtitle with highlight */}
        <Animated.View
          style={[
            styles.subtitleContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.subtitle}>
            {currentSlide.subtitle}{' '}
            <Text style={[styles.highlight, { color: currentSlide.gradient[0] }]}>
              {currentSlide.highlight}
            </Text>
          </Text>
        </Animated.View>

        {/* Pagination */}
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentIndex === index && [
                  styles.dotActive,
                  { backgroundColor: currentSlide.gradient[0] },
                ],
              ]}
            />
          ))}
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={[
            styles.ctaButton,
            { backgroundColor: currentSlide.gradient[0] },
          ]}
          onPress={handleNext}
          activeOpacity={0.9}
        >
          <Text style={styles.ctaText}>
            {currentIndex === SLIDES.length - 1 ? 'Start Planning' : 'Next'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Value prop */}
        {currentIndex === SLIDES.length - 1 && (
          <Animated.View
            style={[styles.valueProps, { opacity: fadeAnim }]}
          >
            <View style={styles.valueProp}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.valuePropText}>No account needed</Text>
            </View>
            <View style={styles.valueProp}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.valuePropText}>100% free</Text>
            </View>
            <View style={styles.valueProp}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.valuePropText}>Takes 30 seconds</Text>
            </View>
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  slide: {
    width,
    height,
  },
  slideImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  slideGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  skipContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
  },
  skipButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },
  emojiContainer: {
    marginBottom: 16,
  },
  emoji: {
    fontSize: 56,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 16,
    lineHeight: 48,
  },
  subtitleContainer: {
    marginBottom: 32,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 26,
  },
  highlight: {
    fontWeight: '700',
  },
  pagination: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 28,
    backgroundColor: '#6366f1',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 20,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  valueProps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  valueProp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  valuePropText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
});
