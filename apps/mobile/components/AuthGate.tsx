import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthContext } from './AuthProvider';
import { colors, borderRadius, shadows } from '../constants/theme';

const { height } = Dimensions.get('window');

type AuthGateTrigger = 'save' | 'book' | 'share' | 'access' | 'general' | 'generate';

interface AuthGateProps {
  visible: boolean;
  trigger?: AuthGateTrigger;
  tripPreview?: {
    destination: string;
    coverImage: string;
  };
  onAuthenticated?: () => void;
  onDismiss?: () => void;
  onClose: () => void;
}

const triggerContent: Record<AuthGateTrigger, { title: string; subtitle: string }> = {
  save: {
    title: 'Save Your Trip',
    subtitle: 'Create a free account to save this amazing itinerary',
  },
  book: {
    title: 'Ready to Book?',
    subtitle: 'Sign in to complete your reservation',
  },
  share: {
    title: 'Share with Friends',
    subtitle: 'Create an account to save this trip before sharing',
  },
  access: {
    title: 'Welcome Back!',
    subtitle: 'Sign in to access your saved trips',
  },
  general: {
    title: 'Join Faroway',
    subtitle: 'Create a free account to unlock all features',
  },
  generate: {
    title: 'Sign in to generate your trip',
    subtitle: 'Faroway plans trips for signed-in users so your itinerary is saved to your account.',
  },
};

const benefits = [
  { icon: 'cloud-upload-outline', text: 'Save trips to your account' },
  { icon: 'notifications-outline', text: 'Get itinerary-ready alerts' },
  { icon: 'star-outline', text: 'Build your travel wishlist' },
  { icon: 'people-outline', text: 'Share itinerary links' },
];

export function AuthGate({
  visible,
  trigger = 'general',
  tripPreview,
  onAuthenticated,
  onDismiss,
  onClose,
}: AuthGateProps) {
  const { signInWithGoogle, signInWithApple } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const content = triggerContent[trigger];

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      onAuthenticated?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Please try again';
      Alert.alert('Sign In Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setLoading(true);
    try {
      await signInWithApple();
      onAuthenticated?.();
      onClose();
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign In Failed', e.message || 'Please try again');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMaybeLater = () => {
    onDismiss?.();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        {/* Blurred background with trip preview */}
        {tripPreview && (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: tripPreview.coverImage }}
              style={styles.previewImage}
              blurRadius={3}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.previewGradient}
            />
          </View>
        )}

        {/* Bottom Sheet */}
        <View style={styles.bottomSheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Content */}
          <View style={styles.content}>
            {/* Emoji/Icon */}
            <View style={styles.iconContainer}>
              <Text style={styles.emoji}>✨</Text>
            </View>

            {/* Title & Subtitle */}
            <Text style={styles.title}>{content.title}</Text>
            <Text style={styles.subtitle}>{content.subtitle}</Text>

            {/* Benefits */}
            <View style={styles.benefits}>
              {benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitRow}>
                  <Ionicons
                    name={benefit.icon as React.ComponentProps<typeof Ionicons>['name']}
                    size={20}
                    color={colors.primary[500]}
                  />
                  <Text style={styles.benefitText}>{benefit.text}</Text>
                </View>
              ))}
            </View>

            {/* Auth Buttons */}
            {loading ? (
              <ActivityIndicator
                size="large"
                color={colors.primary[500]}
                style={{ marginVertical: 24 }}
              />
            ) : (
              <View style={styles.authButtons}>
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={handleGoogle}
                  activeOpacity={0.9}
                >
                  <Ionicons name="logo-google" size={18} color="#DB4437" />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.appleButton}
                  onPress={handleApple}
                  activeOpacity={0.9}
                >
                  <Ionicons name="logo-apple" size={20} color="#fff" />
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Maybe Later */}
            <TouchableOpacity style={styles.maybeLaterButton} onPress={handleMaybeLater}>
              <Text style={styles.maybeLaterText}>Maybe Later</Text>
            </TouchableOpacity>

            {/* Terms */}
            <Text style={styles.terms}>
              By continuing, you agree to our <Text style={styles.termsLink}>Terms</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  previewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
  },
  bottomSheet: {
    backgroundColor: colors.surface[800],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    ...shadows.lg,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.surface[600],
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(99,102,241,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emoji: {
    fontSize: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.surface[400],
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  benefits: {
    width: '100%',
    backgroundColor: colors.surface[700],
    borderRadius: borderRadius.lg,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: 15,
    color: colors.surface[300],
    fontWeight: '500',
  },
  authButtons: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.surface[700],
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  maybeLaterButton: {
    paddingVertical: 12,
    marginBottom: 16,
  },
  maybeLaterText: {
    fontSize: 15,
    color: colors.surface[500],
    fontWeight: '600',
  },
  terms: {
    fontSize: 12,
    color: colors.surface[500],
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary[400],
    fontWeight: '600',
  },
});
