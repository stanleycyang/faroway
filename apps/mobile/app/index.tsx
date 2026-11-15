import { useEffect } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserStore } from '../stores/userStore';
import { Button } from '../components/ui/Button';
import { VenuePhotoCredit } from '../components/VenuePhotoCredit';
import { firstRunDestinations } from '../lib/firstRunDestinations';

export default function WelcomeScreen() {
  const router = useRouter();
  const { hasCompletedOnboarding, isAuthenticated, setOnboardingComplete } = useUserStore();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const destination = firstRunDestinations[0];

  useEffect(() => {
    if (hasCompletedOnboarding && isAuthenticated) router.replace('/(tabs)');
  }, [hasCompletedOnboarding, isAuthenticated, router]);

  const explore = () => {
    setOnboardingComplete(true);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { height: Math.min(380, Math.max(250, height * 0.42)) }]}>
          <Image
            source={destination.source}
            style={styles.heroPhoto}
            resizeMode="cover"
            accessible={false}
          />
          <LinearGradient
            colors={['rgba(12,35,42,0.65)', 'transparent', 'rgba(12,35,42,0.55)']}
            style={StyleSheet.absoluteFill}
          />
          <Text style={[styles.wordmark, { top: insets.top + 16 }]}>faroway</Text>
          <Text style={styles.place}>Copenhagen, Denmark</Text>
        </View>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.paper}>
          <Text accessibilityRole="header" style={styles.title}>
            Go somewhere{'\n'}that stays with you.
          </Text>
          <Text style={styles.description}>
            Turn a place, your dates, and what you love into a day-by-day travel plan.
          </Text>
          <View style={styles.actions}>
            <Button
              title="Plan my trip"
              onPress={() => router.push(hasCompletedOnboarding ? '/create' : '/onboarding')}
              fullWidth
              size="lg"
            />
            <Button title="Explore destinations" onPress={explore} fullWidth variant="outline" />
          </View>
          <Text style={styles.note}>Explore first. Sign in when you’re ready to generate.</Text>
          <Button
            title="Already have an account? Sign in"
            onPress={() => router.push('/onboarding/login')}
            variant="ghost"
            fullWidth
            textStyle={styles.signIn}
          />
          <VenuePhotoCredit credit={destination.credit} />
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F3' },
  scroll: { flexGrow: 1 },
  hero: { backgroundColor: '#143D46', overflow: 'hidden' },
  // Bundled native images retain intrinsic dimensions unless explicitly sized.
  heroPhoto: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  wordmark: {
    position: 'absolute',
    left: 24,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: '#FFFFFF',
  },
  place: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  paper: { padding: 24, paddingTop: 28, flexGrow: 1, backgroundColor: '#FAF8F3' },
  title: { color: '#143D46', fontSize: 36, lineHeight: 42, fontWeight: '800', letterSpacing: -1 },
  description: { color: '#475D61', fontSize: 17, lineHeight: 25, marginTop: 16, marginBottom: 24 },
  actions: { gap: 12 },
  note: {
    color: '#475D61',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  signIn: { color: '#143D46', fontSize: 14 },
});
