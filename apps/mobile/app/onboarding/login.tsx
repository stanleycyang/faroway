import { emailLoginEnabled } from '../../lib/testLogin';
import { TestEmailLogin } from '../../components/TestEmailLogin';
import { useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  ScrollView,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../components/AuthProvider';
import { useUserStore } from '../../stores/userStore';
import { colors, borderRadius } from '../../constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { setOnboardingComplete } = useUserStore();
  const { signInWithGoogle, signInWithApple } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
      setOnboardingComplete(true);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Please try again';
      Alert.alert('Sign In Failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithApple();
      setOnboardingComplete(true);
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign In Failed', e.message || 'Please try again');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipLogin = () => {
    setOnboardingComplete(true);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={emailLoginEnabled() ? (Platform.OS === 'ios' ? 'padding' : 'height') : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.surface[700]} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Title */}
          <View style={styles.titleSection}>
            <Text style={styles.title} accessibilityRole="header">
              Sign in to Faroway
            </Text>
            <Text style={styles.subtitle}>
              Keep your plans together, wherever you go. Sign in to save and create your trips.
            </Text>
          </View>

          {/* Auth Buttons */}
          {!emailLoginEnabled() &&
            (isLoading ? (
              <ActivityIndicator
                size="large"
                color={colors.primary[500]}
                style={{ marginTop: 40 }}
              />
            ) : (
              <View style={styles.buttonSection}>
                <TouchableOpacity
                  style={styles.socialButton}
                  onPress={handleGoogleLogin}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                >
                  <Ionicons name="logo-google" size={20} color="#DB4437" />
                  <Text style={styles.socialButtonText}>Continue with Google</Text>
                </TouchableOpacity>

                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[styles.socialButton, styles.appleButton]}
                    onPress={handleAppleLogin}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Continue with Apple"
                  >
                    <Ionicons name="logo-apple" size={20} color="#fff" />
                    <Text style={[styles.socialButtonText, styles.appleButtonText]}>
                      Continue with Apple
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

          <TestEmailLogin
            onAuthenticated={() => {
              setOnboardingComplete(true);
              router.replace('/(tabs)');
            }}
          />

          {/* Skip */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipLogin}
            accessibilityRole="button"
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF5F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  titleSection: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#182B31',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.surface[600],
    lineHeight: 24,
  },
  buttonSection: {
    gap: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF5F3',
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  appleButton: {
    backgroundColor: '#000',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#182B31',
  },
  appleButtonText: {
    color: '#fff',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 16,
  },
  skipText: {
    fontSize: 14,
    color: colors.surface[500],
    textDecorationLine: 'underline',
  },
});
