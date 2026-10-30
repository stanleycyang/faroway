import { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useUserStore } from '../stores/userStore';
import { Button } from '../components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { IMAGE_PATHS, getImageUrl } from '@faroway/constants';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { USE_NATIVE_DRIVER } from '../lib/animation';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const { hasCompletedOnboarding, isAuthenticated } = useUserStore();
  const reduceMotion = useReduceMotion();

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      logoOpacity.setValue(1);
      logoScale.setValue(1);
      titleOpacity.setValue(1);
      titleTranslateY.setValue(0);
      subtitleOpacity.setValue(1);
      buttonOpacity.setValue(1);
      return;
    }

    // Animate entrance
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 800,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(600),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();

    Animated.sequence([
      Animated.delay(800),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [
    buttonOpacity,
    logoOpacity,
    logoScale,
    reduceMotion,
    subtitleOpacity,
    titleOpacity,
    titleTranslateY,
  ]);

  useEffect(() => {
    // Auto-redirect if already onboarded
    if (hasCompletedOnboarding && isAuthenticated) {
      const redirect = setTimeout(() => router.replace('/(tabs)'), 0);
      return () => clearTimeout(redirect);
    }
  }, [hasCompletedOnboarding, isAuthenticated, router]);

  const handleGetStarted = () => {
    if (hasCompletedOnboarding) {
      router.replace('/(tabs)');
    } else {
      router.push('/onboarding');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Image
        source={{
          uri: getImageUrl(IMAGE_PATHS.inspirations['beach-getaway']),
        }}
        style={styles.backgroundImage}
        accessible={false}
      />
      <LinearGradient
        colors={['rgba(20,61,70,0.1)', 'rgba(20,61,70,0.9)']}
        style={styles.gradient}
      />

      <SafeAreaView style={styles.content} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <LinearGradient
              colors={[colors.action.primary, colors.action.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <Text style={styles.logoIcon}>✦</Text>
            </LinearGradient>
          </Animated.View>

          <Animated.Text
            accessibilityRole="header"
            style={[
              styles.title,
              {
                opacity: titleOpacity,
                transform: [{ translateY: titleTranslateY }],
              },
            ]}
          >
            Faroway
          </Animated.Text>

          <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
            Your next journey starts here.{'\n'}A day-by-day plan, shaped around you.
          </Animated.Text>
        </View>

        <Animated.View style={[styles.buttonContainer, { opacity: buttonOpacity }]}>
          <Button
            title="Get Started"
            onPress={handleGetStarted}
            size="lg"
            fullWidth
            style={styles.primaryButton}
          />
          <Button
            title="I already have an account"
            onPress={() => router.push('/onboarding/login')}
            variant="ghost"
            size="md"
            fullWidth
            textStyle={styles.ghostButtonText}
          />
        </Animated.View>
      </SafeAreaView>
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
  gradient: {
    position: 'absolute',
    width,
    height,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'flex-start',
    marginTop: 48,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoGradient: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 36,
    color: '#fff',
    fontWeight: '700',
  },
  title: {
    fontSize: 44,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'left',
    lineHeight: 26,
  },
  buttonContainer: {
    gap: 12,
  },
  primaryButton: {},
  ghostButtonText: {
    color: 'rgba(255,255,255,0.8)',
  },
});
