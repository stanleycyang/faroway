import { useEffect, useState } from 'react';
import { useNotificationContext } from '../../components/NotificationProvider';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '../../stores/userStore';
import { updateNotificationPreferences } from '../../services/pushConsentService';
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

const defaultSettings: Record<string, boolean> = {
  trip_reminders: false,
  deals: false,
  itinerary_updates: false,
  app_updates: false,
};

export default function NotificationsScreen() {
  const router = useRouter();
  const push = useNotificationContext();
  const { user } = useUserStore();
  const userWithSettings = user as
    | (typeof user & { notificationSettings?: Record<string, boolean> })
    | null;
  const [settings, setSettings] = useState<Record<string, boolean>>(
    userWithSettings?.notificationSettings &&
      Object.keys(userWithSettings.notificationSettings).length > 0
      ? userWithSettings.notificationSettings
      : defaultSettings
  );
  const [savingSetting, setSavingSetting] = useState<string | null>(null);
  useEffect(() => {
    setSettings(user?.notificationSettings || defaultSettings);
  }, [user?.id, user?.notificationSettings]);

  const toggleSetting = async (id: string) => {
    hapticFeedback.selection();
    const accountId = user?.id;
    const previous = settings;
    const updated = { ...settings, [id]: !settings[id] };
    setSettings(updated);
    setSavingSetting(id);

    try {
      if (!accountId) throw new Error('Sign in to change notification settings.');
      await updateNotificationPreferences(accountId, updated);
      if (useUserStore.getState().user?.id !== accountId) return;
      const current = useUserStore.getState().user;
      if (current) useUserStore.getState().setUser({ ...current, notificationSettings: updated });
    } catch (error: unknown) {
      if (useUserStore.getState().user?.id !== accountId) return;
      setSettings(previous);
      hapticFeedback.error();
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Couldn’t save notification settings', message);
    } finally {
      setSavingSetting(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={'#475569'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Notifications
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionDescription}>
          Choose which notifications you'd like to receive.
        </Text>

        <View style={styles.settingItem}>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Notifications on this device</Text>
            <Text style={styles.settingDescription}>
              Enable device notifications, then choose the updates you want below.
            </Text>
            {push.error && (
              <Text accessibilityRole="alert" style={styles.settingDescription}>
                {push.error}
              </Text>
            )}
          </View>
          <Switch
            value={push.enabled}
            disabled={push.isLoading || !user}
            accessibilityLabel="Notifications on this device"
            onValueChange={(value) => {
              void (value ? push.enable() : push.disable()).catch((reason) =>
                Alert.alert('Notification settings', reason.message)
              );
            }}
          />
        </View>
        <View style={styles.settingsList}>
          {notificationSettings.map((setting) => (
            <View key={setting.id} style={styles.settingItem}>
              <View style={styles.settingIconContainer}>
                <Ionicons name={setting.icon} size={20} color={colors.primary[400]} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{setting.title}</Text>
                <Text style={styles.settingDescription}>{setting.description}</Text>
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
                disabled={savingSetting !== null}
                accessibilityLabel={setting.title}
                accessibilityHint={setting.description}
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
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  scrollContent: {
    padding: 24,
  },
  sectionDescription: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 24,
  },
  settingsList: {
    gap: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF5F4',
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
    color: '#0f172a',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
});
