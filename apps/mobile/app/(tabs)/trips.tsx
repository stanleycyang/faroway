import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TripCard, Button } from '../../components/ui';
import { useTrips } from '../../hooks/useTrips';
import { useAuthContext } from '../../components/AuthProvider';
import { useTripStore } from '../../stores/tripStore';
import { colors, borderRadius } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';

type FilterTab = 'all' | 'upcoming' | 'past';

function FeatureRow({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={20} color={colors.primary[500]} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function GuestTripsView() {
  const { signInWithGoogle, signInWithApple, loading } = useAuthContext();
  const router = useRouter();
  const { trips: localTrips } = useTripStore();
  const [authLoading, setAuthLoading] = useState(false);

  const isLoading = loading || authLoading;

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithGoogle();
      hapticFeedback.success();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Please try again';
      Alert.alert('Sign In Failed', msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithApple();
      hapticFeedback.success();
    } catch (error: unknown) {
      const e = error as { code?: string; message?: string };
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign In Failed', e.message || 'Please try again');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.guestScrollContent}
    >
      <View style={styles.heroSection}>
        <View style={styles.heroIconContainer}>
          <LinearGradient colors={[colors.primary[50], '#fff']} style={styles.heroIconGradient}>
            <Ionicons name="airplane" size={48} color={colors.primary[500]} />
          </LinearGradient>
        </View>

        <Text style={styles.heroTitle}>
          {localTrips.length > 0
            ? `You have ${localTrips.length} trip${localTrips.length > 1 ? 's' : ''} on this device`
            : 'Your trips, all in one place'}
        </Text>
        <Text style={styles.heroSubtitle}>
          {localTrips.length > 0
            ? 'Sign in to save them to your account and open them on any device.'
            : 'Sign in to save your itineraries to your account and revisit your trip plans.'}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={colors.primary[500]}
          style={{ marginVertical: 20 }}
        />
      ) : (
        <View style={styles.authButtons}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleGoogleSignIn}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, styles.appleButton]}
            onPress={handleAppleSignIn}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-apple" size={20} color="#fff" />
            <Text style={[styles.socialButtonText, styles.appleButtonText]}>
              Continue with Apple
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.termsText}>
        By continuing, you agree to our Terms and Privacy Policy.
      </Text>

      <View style={styles.featuresSection}>
        <FeatureRow
          icon="cloud-outline"
          title="Saved trips"
          subtitle="Keep generated plans tied to your account"
        />
        <FeatureRow
          icon="sparkles-outline"
          title="AI itineraries saved"
          subtitle="Generated plans stored and ready to revisit"
        />
        <FeatureRow
          icon="people-outline"
          title="Share links"
          subtitle="Send completed itineraries when sharing is enabled"
        />
      </View>

      <View style={styles.previewSection}>
        <Text style={styles.previewLabel}>What your trips will look like</Text>
        <View style={styles.previewCardsContainer}>
          <View style={styles.previewCard}>
            <View style={styles.previewImagePlaceholder}>
              <Ionicons name="image-outline" size={28} color={colors.surface[300]} />
            </View>
            <View style={styles.previewCardBody}>
              <View style={styles.previewPill} />
              <View style={[styles.previewPill, { width: 80 }]} />
            </View>
          </View>
          <View style={styles.previewCard}>
            <View style={styles.previewImagePlaceholder}>
              <Ionicons name="image-outline" size={28} color={colors.surface[300]} />
            </View>
            <View style={styles.previewCardBody}>
              <View style={styles.previewPill} />
              <View style={[styles.previewPill, { width: 60 }]} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.exploreCta}>
        <Text style={styles.exploreText}>Want to explore first?</Text>
        <Button
          title="Plan a Trip"
          onPress={() => router.push('/create')}
          size="md"
          variant="outline"
          style={styles.exploreButton}
        />
      </View>
    </ScrollView>
  );
}
