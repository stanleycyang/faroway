import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useUserStore } from '../../stores/userStore';
import { useTripStore } from '../../stores/tripStore';
import { colors, borderRadius, shadows } from '../../constants/theme';
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
      <View
        style={[
          styles.menuIconContainer,
          danger && styles.menuIconContainerDanger,
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={danger ? colors.error : colors.primary[500]}
        />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>
          {label}
        </Text>
        {value && <Text style={styles.menuValue}>{value}</Text>}
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, setUser, setOnboardingComplete } = useUserStore();
  const { trips } = useTripStore();

  // Demo user data
  const demoUser = {
    name: 'Stanley',
    email: 'stanley@example.com',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
  };

  const displayUser = user || demoUser;
  const completedTrips = trips.filter((t) => t.status === 'completed').length;
  const upcomingTrips = trips.filter((t) =>
    ['draft', 'planned', 'active'].includes(t.status)
  ).length;

  const handleLogout = () => {
    logout();
    setOnboardingComplete(false);
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={24} color={colors.neutral[700]} />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Image
            source={{ uri: displayUser.avatar }}
            style={styles.avatar}
          />
          <Text style={styles.userName}>{displayUser.name}</Text>
          <Text style={styles.userEmail}>{displayUser.email}</Text>

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

        {/* Premium Banner */}
        <TouchableOpacity activeOpacity={0.9}>
          <LinearGradient
            colors={['#1a1a2e', '#16213e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumBanner}
          >
            <View style={styles.premiumContent}>
              <View style={styles.premiumIcon}>
                <Ionicons name="diamond" size={24} color="#ffd700" />
              </View>
              <View style={styles.premiumText}>
                <Text style={styles.premiumTitle}>Upgrade to Pro</Text>
                <Text style={styles.premiumSubtitle}>
                  Unlock unlimited AI itineraries
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Menu Sections */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Account</Text>
          <MenuItem
            icon="person-outline"
            label="Edit Profile"
            onPress={() => {}}
          />
          <MenuItem
            icon="heart-outline"
            label="Travel Preferences"
            value="5 vibes selected"
            onPress={() => {}}
          />
          <MenuItem
            icon="notifications-outline"
            label="Notifications"
            onPress={() => {}}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Support</Text>
          <MenuItem
            icon="help-circle-outline"
            label="Help Center"
            onPress={() => {}}
          />
          <MenuItem
            icon="chatbubble-outline"
            label="Contact Us"
            onPress={() => {}}
          />
          <MenuItem
            icon="star-outline"
            label="Rate the App"
            onPress={() => {}}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Legal</Text>
          <MenuItem
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => {}}
          />
          <MenuItem
            icon="shield-outline"
            label="Privacy Policy"
            onPress={() => {}}
          />
        </View>

        <View style={styles.menuSection}>
          <MenuItem
            icon="log-out-outline"
            label="Log Out"
            onPress={handleLogout}
            showChevron={false}
            danger
          />
        </View>

        {/* App Version */}
        <Text style={styles.versionText}>TripGenie v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    color: colors.neutral[900],
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.xl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 4,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[900],
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginHorizontal: 16,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.neutral[900],
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.neutral[200],
  },
  premiumBanner: {
    marginHorizontal: 24,
    marginBottom: 32,
    borderRadius: borderRadius.xl,
    padding: 20,
    ...shadows.md,
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  premiumIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,215,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  premiumText: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  premiumSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  menuSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  menuSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    padding: 16,
    borderRadius: borderRadius.lg,
    marginBottom: 8,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuIconContainerDanger: {
    backgroundColor: '#fef2f2',
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  menuLabelDanger: {
    color: colors.error,
  },
  menuValue: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: 2,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.neutral[400],
    marginTop: 16,
  },
});
