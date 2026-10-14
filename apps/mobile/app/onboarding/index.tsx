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
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { hapticFeedback } from '../../utils/haptics';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useUserStore } from '../../stores/userStore';
import { IMAGE_PATHS, getImageUrl } from '@faroway/constants';
import { USE_NATIVE_DRIVER } from '../../lib/animation';
import { colors } from '../../constants/theme';

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
    title: 'Your next trip,\ntaking shape',
    subtitle: 'Choose where you want to go. We’ll bring your days together',
    highlight: 'around you',
    image: getImageUrl(IMAGE_PATHS.marketing.travelPlanning),
    gradient: ['#F97066', '#F59E0B'],
  },
  {
    id: '2',
    emoji: '🗺️',
    title: 'Find your kind\nof places',
    subtitle: 'Explore food, culture, and experiences that fit how you like to travel',
    highlight: 'at your own pace',
    image: getImageUrl(IMAGE_PATHS.marketing.aerialTravel),
    gradient: ['#f59e0b', '#ef4444'],
  },
  {
    id: '3',
    emoji: '🎯',
    title: 'Your Whole Trip\nIn One Place',
    subtitle: 'Hotels, restaurants, and experiences organized day by day',
    highlight: 'ready when you are',
    image: getImageUrl(IMAGE_PATHS.marketing.travelDiscovery),
    gradient: ['#10b981', '#059669'],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const reduceMotion = useReduceMotion();
  const setOnboardingComplete = useUserStore((state) => state.setOnboardingComplete);

  useEffect(() => {
    // Animate content on slide change
    if (reduceMotion) {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }

    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [currentIndex, fadeAnim, reduceMotion, slideAnim]);

  const handleNext = () => {
    hapticFeedback.light();
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToOffset({
        offset: width * nextIndex,
        animated: !reduceMotion,
      });
    } else {
      hapticFeedback.success();
      setOnboardingComplete(true);
      router.replace('/(tabs)');
    }
  };

  const handleSkip = () => {
    hapticFeedback.light();
    setOnboardingComplete(true);
    router.replace('/(tabs)');
  };

  const currentSlide = SLIDES[currentIndex];

  const renderSlide = ({ item, index: _index }: { item: OnboardingSlide; index: number }) => (
    <View style={styles.slide}>
      <LinearGradient colors={['#203B50', '#102235', '#080B12']} style={StyleSheet.absoluteFill} />
      <View accessible={false} style={styles.atlasRing} />
      <View accessible={false} style={[styles.atlasRing, styles.atlasRingInner]} />
      <Image source={{ uri: item.image }} style={styles.slideImage} accessible={false} />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
        style={styles.slideGradient}
        locations={[0, 0.5, 1]}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
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
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        scrollEventThrottle={16}
      />

      {/* Skip button */}
      <SafeAreaView edges={['top']} style={styles.skipContainer}>
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipButton}
          accessibilityRole="button"
          accessibilityLabel="Skip introduction"
        >
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
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
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
        <View
          style={styles.pagination}
          accessible
          accessibilityLabel={`Step ${currentIndex + 1} of ${SLIDES.length}`}
        >
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
          style={styles.ctaButton}
          onPress={handleNext}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={
            currentIndex === SLIDES.length - 1 ? 'Start planning' : 'Next introduction step'
          }
        >
          <Text style={styles.ctaText}>
            {currentIndex === SLIDES.length - 1 ? 'Start Planning' : 'Next'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Value prop */}
        {currentIndex === SLIDES.length - 1 && (
          <Animated.View style={[styles.valueProps, { opacity: fadeAnim }]}>
            <View style={styles.valueProp}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.valuePropText}>Browse destinations first</Text>
            </View>
            <View style={styles.valueProp}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.valuePropText}>Personalized plans</Text>
            </View>
            <View style={styles.valueProp}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.valuePropText}>Sign in to generate</Text>
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
  atlasRing: {
    position: 'absolute',
    width: 620,
    height: 620,
    borderRadius: 310,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    top: -140,
    left: -130,
  },
  atlasRingInner: {
    width: 400,
    height: 400,
    borderRadius: 200,
    top: -30,
    left: -20,
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
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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
    backgroundColor: '#F97066',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.action.primary,
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
