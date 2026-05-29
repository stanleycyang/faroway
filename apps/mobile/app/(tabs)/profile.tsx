import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as StoreReview from 'expo-store-review';
import { useAuthContext } from '../../components/AuthProvider';
import { useUserStore } from '../../stores/userStore';
import { useTripStore } from '../../stores/tripStore';
import { colors, borderRadius } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  showChevron?: boolean;
  danger?: boolean;
}

function MenuItem({
  icon,
  label,
  value,
  onPress,
  showChevron = true,
  danger = false,
}: MenuItemProps) {
  const handlePress = () => {
    hapticFeedback.light();
    onPress();
  };

  return (
    <TouchableOpacity style={styles.menuItem} onPress={handlePress} activeOpacity={0.7}>
      <View style={[styles.menuIconContainer, danger && styles.menuIconContainerDanger]}>
        <Ionicons name={icon} size={20} color={danger ? colors.error : colors.primary[500]} />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
        {value && <Text style={styles.menuValue}>{value}</Text>}
      </View>
      {showChevron && <Ionicons name="chevron-forward" size={20} color={colors.surface[500]} />}
    </TouchableOpacity>
  );
}

// ─── Logged-Out Guest CTA ──────────────────────────

function GuestProfileCard() {
  const { signInWithGoogle, signInWithApple, loading } = useAuthContext();
  const [authLoading, setAuthLoading] = useState(false);

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

  const isLoading = loading || authLoading;

  return (
    <View style={styles.guestCard}>
      <View style={styles.guestAvatarContainer}>
        <LinearGradient colors={['#f1f5f9', '#e2e8f0']} style={styles.guestAvatar}>
          <Ionicons name="person" size={40} color={'#94a3b8'} />
        </LinearGradient>
      </View>

      <Text style={styles.guestTitle}>Sign in to Faroway</Text>
      <Text style={styles.guestSubtitle}>
        Save trips to your account and keep your recommendations personalized.
      </Text>

      {isLoading ? (
        <ActivityIndicator size="small" color={colors.primary[500]} style={{ marginTop: 20 }} />
      ) : (
        <View style={styles.guestButtons}>
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

      <Text style={styles.guestTerms}>
        By continuing, you agree to our Terms and Privacy Policy.
      </Text>
    </View>
  );
}

// ─── Main Profile Screen ──────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { isAuthenticated, signOut, deleteAccount } = useAuthContext();
  const { user } = useUserStore();
  const { trips } = useTripStore();

  const completedTrips = trips.filter((t) => t.status === 'completed').length;
  const upcomingTrips = trips.filter((t) =>
    ['draft', 'planned', 'active'].includes(t.status)
  ).length;

  const handleLogout = async () => {
    try {
      await signOut();
      hapticFeedback.success();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to sign out';
      Alert.alert('Error', msg);
    }
  };

  const handleDeleteAccount = () => {
    hapticFeedback.warning();
    Alert.alert(
      'Delete account?',
      'This permanently erases your account, trips, and preferences. Anonymized booking records may be retained for fraud prevention and revenue reconciliation. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              hapticFeedback.success();
            } catch (error: unknown) {
              const msg = error instanceof Error ? error.message : 'Could not delete account';
              Alert.alert('Could not delete account', msg);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={24} color={'#475569'} />
          </TouchableOpacity>
        </View>

        {/* Logged-Out State */}
        {!isAuthenticated && <GuestProfileCard />}

        {/* Logged-In State */}
        {isAuthenticated && user && (
          <View style={styles.profileCard}>
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={36} color={colors.surface[500]} />
              </View>
            )}
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{trips.length}</Text>
                <Text style={styles.statLabel}>Total Trips</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{upcomingTrips}</Text>
                <Text style={styles.statLabel}>Upcoming</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{completedTrips}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
            </View>
          </View>
        )}

        {/* Account Menu (only when logged in) */}
        {isAuthenticated && (
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>Account</Text>
            <MenuItem
              icon="person-outline"
              label="Edit Profile"
              onPress={() => router.push('/profile/edit-profile')}
            />
            <MenuItem
              icon="heart-outline"
              label="Travel Preferences"
              value={
                user?.preferences?.vibes?.length
                  ? `${user.preferences.vibes.length} vibes selected`
                  : 'Not set'
              }
              onPress={() => router.push('/profile/preferences')}
            />
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              onPress={() => router.push('/profile/notifications')}
            />
          </View>
        )}

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Support</Text>
          <MenuItem
            icon="help-circle-outline"
            label="Help Center"
            onPress={() => WebBrowser.openBrowserAsync('https://faroway.ai/support')}
          />
          <MenuItem
            icon="chatbubble-outline"
            label="Contact Us"
            onPress={() => Linking.openURL('mailto:support@faroway.ai')}
          />
          <MenuItem
            icon="star-outline"
            label="Rate the App"
            onPress={async () => {
              const available = await StoreReview.isAvailableAsync();
              if (available) {
                await StoreReview.requestReview();
              } else {
                const url =
                  Platform.OS === 'ios'
                    ? 'https://apps.apple.com/app/faroway/id0000000000'
                    : 'https://play.google.com/store/apps/details?id=app.faroway';
                Linking.openURL(url);
              }
            }}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Legal</Text>
          <MenuItem
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => WebBrowser.openBrowserAsync('https://faroway.ai/terms')}
          />
          <MenuItem
            icon="shield-outline"
            label="Privacy Policy"
            onPress={() => WebBrowser.openBrowserAsync('https://faroway.ai/privacy')}
          />
        </View>

        {isAuthenticated && (
          <View style={styles.menuSection}>
            <MenuItem
              icon="log-out-outline"
              label="Log Out"
              onPress={handleLogout}
              showChevron={false}
              danger
            />
            <MenuItem
              icon="trash-outline"
              label="Delete Account"
              onPress={handleDeleteAccount}
              showChevron={false}
              danger
            />
          </View>
        )}

        {/* App Version */}
        <Text style={styles.versionText}>Faroway v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  // ─── Guest / Logged-Out ──────────
  guestCard: {
    alignItems: 'center',
    padding: 28,
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  guestAvatarContainer: {
    marginBottom: 20,
  },
  guestAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  guestSubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  guestButtons: {
    width: '100%',
    gap: 10,
    marginTop: 20,
  },
  guestTerms: {
    marginTop: 14,
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  appleButton: {
    backgroundColor: '#000',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  socialButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  appleButtonText: {
    color: '#fff',
  },
  emailSignInButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  emailSignInText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[400],
  },

  // ─── Logged-In Profile Card ──────────
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: colors.primary[500],
  },
  avatarPlaceholder: {
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginHorizontal: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e2e8f0',
  },

  // ─── Menu ──────────
  menuSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  menuSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: borderRadius.lg,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF5F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuIconContainerDanger: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  menuLabelDanger: {
    color: colors.error,
  },
  menuValue: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 16,
  },
});
