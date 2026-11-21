import { useProfileRefresh } from '../../hooks/useProfileRefresh';
import { useLocalCalendarDate } from '../../hooks/useLocalCalendarDate';
import { BUDGET_TIERS, tripDatePhase } from '@faroway/constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
const useOptionalFocusEffect =
  typeof useFocusEffect === 'function' ? useFocusEffect : (_cb: () => void) => {};
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useAuthContext } from '../../components/AuthProvider';
import { isRequestCanceled } from '../../lib/authProviders';
import { useUserStore } from '../../stores/userStore';
import { useTripStore } from '../../stores/tripStore';
import { colors, borderRadius } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';
import { requestStoreReview, hasRealStoreListing } from '../../lib/storeReview';
import {
  clearTravelerMemory,
  hasTravelerMemoryContent,
  loadTravelerMemory,
  saveTravelerMemory,
  summarizeTravelerMemory,
  type TravelerMemoryDefaults,
} from '../../lib/travelerMemory';

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
    <TouchableOpacity
      style={styles.menuItem}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}. ${value}` : label}
    >
      <View style={[styles.menuIconContainer, danger && styles.menuIconContainerDanger]}>
        <Ionicons name={icon} size={20} color={danger ? '#B91C1C' : colors.action.primary} />
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
      if (!isRequestCanceled(error)) {
        const msg = error instanceof Error ? error.message : 'Please try again';
        Alert.alert('Sign In Failed', msg);
      }
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
          <Ionicons name="person" size={40} color={colors.surface[600]} />
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
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton]}
              onPress={handleAppleSignIn}
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
      )}

      <Text style={styles.guestTerms}>
        By continuing, you agree to our{' '}
        <Text
          style={styles.termsLink}
          onPress={() => WebBrowser.openBrowserAsync('https://faroway.ai/terms')}
          accessibilityRole="link"
        >
          Terms
        </Text>{' '}
        and{' '}
        <Text
          style={styles.termsLink}
          onPress={() => WebBrowser.openBrowserAsync('https://faroway.ai/privacy')}
          accessibilityRole="link"
        >
          Privacy Policy
        </Text>
        .
      </Text>
    </View>
  );
}

// ─── Main Profile Screen ──────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { isAuthenticated, signOut, deleteAccount } = useAuthContext();
  const { user, accountRevision } = useUserStore();
  const { trips } = useTripStore();
  const [memory, setMemory] = useState<TravelerMemoryDefaults | null>(null);
  const [editingMemory, setEditingMemory] = useState(false);
  const [airportDraft, setAirportDraft] = useState('');
  const [budgetDraft, setBudgetDraft] = useState<'budget' | 'moderate' | 'luxury' | undefined>(
    undefined
  );
  const [avoidEarlyDraft, setAvoidEarlyDraft] = useState(false);
  const mountedRef = useRef(true);

  const isCurrentAccount = useCallback((ownerId: string | undefined, rev: number) => {
    const latest = useUserStore.getState();
    return mountedRef.current && latest.user?.id === ownerId && latest.accountRevision === rev;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reloadMemory = useCallback(() => {
    const ownerId = user?.id;
    const rev = accountRevision;
    void loadTravelerMemory(ownerId)
      .then((loaded) => {
        if (!isCurrentAccount(ownerId, rev)) return;
        setMemory(loaded);
        setAirportDraft(loaded?.homeAirport ?? '');
        setBudgetDraft(loaded?.defaultBudget);
        setAvoidEarlyDraft(loaded?.avoidEarlyStarts ?? false);
      })
      .catch(() => undefined);
  }, [user?.id, accountRevision, isCurrentAccount]);

  useEffect(() => {
    setEditingMemory(false);
    reloadMemory();
  }, [reloadMemory]);

  useOptionalFocusEffect(
    useCallback(() => {
      reloadMemory();
    }, [reloadMemory])
  );

  const handleSaveMemoryEdit = () => {
    const ownerId = user?.id;
    const rev = accountRevision;
    hapticFeedback.selection();
    void saveTravelerMemory(ownerId, {
      homeAirport: airportDraft.trim() || undefined,
      defaultBudget: budgetDraft,
      avoidEarlyStarts: avoidEarlyDraft,
    })
      .then((saved) => {
        if (!isCurrentAccount(ownerId, rev)) return;
        setMemory(saved);
        setEditingMemory(false);
        hapticFeedback.success();
      })
      .catch(() => {
        if (isCurrentAccount(ownerId, rev)) {
          Alert.alert('Could not save defaults', 'Please try again.');
        }
      });
  };

  const handleClearMemory = () => {
    const ownerId = user?.id;
    const rev = accountRevision;
    Alert.alert(
      'Clear traveler memory?',
      'This removes your always-apply defaults on this device. Your saved trips stay untouched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear defaults',
          style: 'destructive',
          onPress: () => {
            void clearTravelerMemory(ownerId)
              .then(() => {
                if (!isCurrentAccount(ownerId, rev)) return;
                setMemory(null);
                setAirportDraft('');
                setBudgetDraft(undefined);
                setAvoidEarlyDraft(false);
                setEditingMemory(false);
                hapticFeedback.success();
              })
              .catch(() => undefined);
          },
        },
      ]
    );
  };

  const memoryLines = summarizeTravelerMemory(memory);
  const hasMemory = hasTravelerMemoryContent(memory);

  const profileStatus = useProfileRefresh();
  const today = useLocalCalendarDate();
  const pastTrips = trips.filter(
    (t) => tripDatePhase(t.startDate, t.endDate, today) === 'past'
  ).length;
  const upcomingTrips = trips.filter(
    (t) => tripDatePhase(t.startDate, t.endDate, today) === 'upcoming'
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle} accessibilityRole="header">
              Profile
            </Text>
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
                  <Text style={styles.statValue}>{pastTrips}</Text>
                  <Text style={styles.statLabel}>Past</Text>
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
                label="Edit profile"
                onPress={() => router.push('/profile/edit-profile')}
              />
              <MenuItem
                icon="heart-outline"
                label="Travel preferences"
                value={
                  user?.preferences?.vibes?.length
                    ? `${user.preferences.vibes.length} vibes selected`
                    : profileStatus === 'ready'
                      ? 'Not set'
                      : profileStatus === 'error'
                        ? 'Couldn’t load — open to retry'
                        : 'Loading saved preferences…'
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

          {/* Traveler Memory (Always-apply defaults) */}
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>Traveler Memory</Text>
            <View style={styles.memoryCard}>
              <View style={styles.memoryHeaderRow}>
                <View style={styles.memoryTitleWrap}>
                  <Ionicons name="bookmark-outline" size={18} color="#0F766E" />
                  <Text style={styles.memoryHeading}>Always apply to my trips</Text>
                </View>
                <TouchableOpacity
                  style={styles.memoryTextBtn}
                  onPress={() => {
                    hapticFeedback.light();
                    setAirportDraft(memory?.homeAirport ?? '');
                    setBudgetDraft(memory?.defaultBudget);
                    setAvoidEarlyDraft(memory?.avoidEarlyStarts ?? false);
                    setEditingMemory((v) => !v);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    editingMemory ? 'Cancel editing traveler memory' : 'Edit traveler memory'
                  }
                >
                  <Text style={styles.memoryEditLabel}>{editingMemory ? 'Cancel' : 'Edit'}</Text>
                </TouchableOpacity>
              </View>

              {!editingMemory ? (
                <>
                  {hasMemory && memoryLines.length > 0 ? (
                    <View style={styles.memoryPillList}>
                      {memoryLines.map((line) => (
                        <View key={line} style={styles.memoryPill}>
                          <Text style={styles.memoryPillText}>{line}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.memoryHint}>
                      No defaults saved yet. Add your home airport, preferred comfort tier, or save
                      vibes & dietary notes from the trip planner.
                    </Text>
                  )}

                  {hasMemory ? (
                    <View style={styles.memoryFooterRow}>
                      <TouchableOpacity
                        style={styles.memoryClearBtn}
                        onPress={handleClearMemory}
                        accessibilityRole="button"
                        accessibilityLabel="Clear traveler memory defaults"
                      >
                        <Text style={styles.memoryClearBtnText}>Clear defaults</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={styles.memoryEditor}>
                  <Text style={styles.memoryFieldLabel}>Home airport (optional)</Text>
                  <TextInput
                    style={styles.memoryInput}
                    value={airportDraft}
                    onChangeText={setAirportDraft}
                    placeholder="e.g., SFO, JFK, LHR"
                    placeholderTextColor="#64748b"
                    autoCapitalize="characters"
                    maxLength={10}
                    accessibilityLabel="Home airport code"
                  />

                  <Text style={styles.memoryFieldLabel}>Default budget tier</Text>
                  <View style={styles.memoryTierRow}>
                    {BUDGET_TIERS.map((tier) => {
                      const selected = budgetDraft === tier.id;
                      return (
                        <TouchableOpacity
                          key={tier.id}
                          style={[styles.memoryTierBtn, selected && styles.memoryTierBtnSelected]}
                          onPress={() => {
                            hapticFeedback.selection();
                            setBudgetDraft(selected ? undefined : tier.id);
                          }}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`Default budget: ${tier.label}`}
                        >
                          <Text
                            style={[
                              styles.memoryTierText,
                              selected && styles.memoryTierTextSelected,
                            ]}
                          >
                            {tier.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={styles.memoryToggleRow}
                    onPress={() => {
                      hapticFeedback.selection();
                      setAvoidEarlyDraft((v) => !v);
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: avoidEarlyDraft }}
                    accessibilityLabel="Prefer relaxed mornings without early starts"
                  >
                    <Ionicons
                      name={avoidEarlyDraft ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={avoidEarlyDraft ? '#0F766E' : '#475569'}
                    />
                    <Text style={styles.memoryToggleLabel}>
                      Prefer relaxed mornings (avoid early starts)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.memorySaveBtn}
                    onPress={handleSaveMemoryEdit}
                    accessibilityRole="button"
                    accessibilityLabel="Save traveler memory defaults"
                  >
                    <Text style={styles.memorySaveBtnText}>Save defaults</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

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
              onPress={async () => {
                try {
                  await Linking.openURL('mailto:support@faroway.ai');
                } catch {
                  Alert.alert('Contact Us', 'Email us at support@faroway.ai', [
                    {
                      text: 'Open Help Center',
                      onPress: () => void WebBrowser.openBrowserAsync('https://faroway.ai/support'),
                    },
                    { text: 'OK' },
                  ]);
                }
              }}
            />
            {Platform.OS !== 'web' && hasRealStoreListing() && (
              <MenuItem
                icon="star-outline"
                label="Rate the App"
                onPress={async () => {
                  const result = await requestStoreReview();
                  if (result.destination === 'unavailable') {
                    Alert.alert('Unable to open ratings', 'Please try again later.');
                  }
                }}
              />
            )}
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
                label="Log out"
                onPress={handleLogout}
                showChevron={false}
                danger
              />
              <MenuItem
                icon="trash-outline"
                label="Delete account"
                onPress={handleDeleteAccount}
                showChevron={false}
                danger
              />
            </View>
          )}

          {/* App Version */}
          <Text style={styles.versionText}>
            Faroway v{Constants.expoConfig?.version ?? '1.0.0'}
            {Constants.nativeBuildVersion ? ` (${Constants.nativeBuildVersion})` : ''}
          </Text>
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
  scrollContent: {
    paddingBottom: 32,
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
    fontWeight: '700',
    color: '#0f172a',
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
  termsLink: {
    color: colors.primary[600],
    textDecorationLine: 'underline',
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
    color: colors.action.primary,
  },

  // ─── Logged-In Profile Card ──────────
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 16,
    borderWidth: 0,
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
    textAlign: 'center',
    flexShrink: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    paddingHorizontal: 8,
    width: '100%',
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
    letterSpacing: 0,
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
    color: '#B91C1C',
  },
  menuValue: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.surface[600],
    marginTop: 16,
  },
  memoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 12,
  },
  memoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  memoryTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  memoryHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  memoryTextBtn: {
    minHeight: 44,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  memoryEditLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F766E',
  },
  memoryPillList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memoryPill: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  memoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#134E4A',
  },
  memoryHint: {
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
  },
  memoryFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  memoryClearBtn: {
    minHeight: 44,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  memoryClearBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9B2D25',
  },
  memoryEditor: {
    gap: 10,
  },
  memoryFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  memoryInput: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#0f172a',
  },
  memoryTierRow: {
    flexDirection: 'row',
    gap: 8,
  },
  memoryTierBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryTierBtnSelected: {
    borderColor: '#0F766E',
    backgroundColor: '#F0FDFA',
  },
  memoryTierText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  memoryTierTextSelected: {
    color: '#134E4A',
    fontWeight: '700',
  },
  memoryToggleRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memoryToggleLabel: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
  },
  memorySaveBtn: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#143D46',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  memorySaveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
