import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';

interface NotificationSetting {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

const notificationSettings: NotificationSetting[] = [
  {
    id: 'trip_reminders',
    icon: 'airplane-outline',
    title: 'Trip Reminders',
    description: 'Get notified about upcoming trips and packing lists',
  },
  {
    id: 'deals',
    icon: 'pricetag-outline',
    title: 'Travel Deals',
    description: 'Exclusive deals and discounts on activities',
  },
  {
    id: 'itinerary_updates',
    icon: 'calendar-outline',
    title: 'Itinerary Updates',
    description: 'Changes or suggestions for your planned trips',
  },
  {
    id: 'app_updates',
    icon: 'sparkles-outline',
    title: 'New Features',
    description: 'Be the first to know about new app features',
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string, boolean>>({
    trip_reminders: true,
    deals: true,
    itinerary_updates: true,
    app_updates: false,
  });

  const toggleSetting = (id: string) => {
    hapticFeedback.selection();
    setSettings((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.surface[300]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionDescription}>
          Choose which notifications you'd like to receive.
        </Text>

        <View style={styles.settingsList}>
          {notificationSettings.map((setting) => (
            <View key={setting.id} style={styles.settingItem}>
              <View style={styles.settingIconContainer}>
                <Ionicons
                  name={setting.icon}
                  size={20}
                  color={colors.primary[400]}
                />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{setting.title}</Text>
                <Text style={styles.settingDescription}>
                  {setting.description}
                </Text>
              </View>
              <Switch
                value={settings[setting.id]}
                onValueChange={() => toggleSetting(setting.id)}
                trackColor={{
                  false: colors.surface[700],
                  true: colors.primary[500],
                }}
                thumbColor="#fff"
                ios_backgroundColor={colors.surface[700]}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface[900],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface[800],
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  scrollContent: {
    padding: 24,
  },
  sectionDescription: {
    fontSize: 15,
    color: colors.surface[400],
    lineHeight: 22,
    marginBottom: 24,
  },
  settingsList: {
    gap: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface[800],
    padding: 16,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(99,102,241,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingContent: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: colors.surface[400],
    lineHeight: 18,
  },
});
