import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ============================================
// Types
// ============================================

export type NotificationType =
  | 'trip_generation_complete'
  | 'trip_reminder'
  | 'activity_recommendation';

export interface NotificationData {
  type: NotificationType;
  tripId?: string;
  title?: string;
  message?: string;
  [key: string]: unknown;
}

export interface PushTokenResult {
  token: string | null;
  error?: string;
}

// ============================================
// Configuration
// ============================================

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ============================================
// Permission Handling
// ============================================

/**
 * Request notification permissions from the user
 * Returns true if permissions were granted
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('Notifications require a physical device');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Notification permissions not granted');
    return false;
  }

  return true;
}

/**
 * Check if notification permissions are currently granted
 */
export async function checkNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// ============================================
// Push Token Registration
// ============================================

/**
 * Register for push notifications and get Expo Push Token
 */
export async function registerForPushNotificationsAsync(): Promise<PushTokenResult> {
  // Check if running on a physical device
  if (!Device.isDevice) {
    return {
      token: null,
      error: 'Push notifications require a physical device',
    };
  }

  // Request permissions
  const permissionGranted = await requestNotificationPermissions();
  if (!permissionGranted) {
    return {
      token: null,
      error: 'Notification permissions not granted',
    };
  }

  try {
    // Get the project ID from Constants
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      // For development, we can still get a token but it won't work in production
      console.warn('No projectId found - push notifications may not work in production');
    }

    // Get Expo Push Token
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    const token = tokenResponse.data;
    console.log('Expo Push Token:', token);

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await setupAndroidNotificationChannel();
    }

    return { token };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error getting push token:', errorMessage);
    return {
      token: null,
      error: errorMessage,
    };
  }
}

/**
 * Setup Android notification channel (required for Android 8.0+)
 */
async function setupAndroidNotificationChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B6B',
    sound: 'default',
  });

  // Create a channel for trip reminders
  await Notifications.setNotificationChannelAsync('trip-reminders', {
    name: 'Trip Reminders',
    description: 'Reminders about upcoming trips',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });

  // Create a channel for trip generation updates
  await Notifications.setNotificationChannelAsync('trip-generation', {
    name: 'Trip Generation',
    description: 'Updates about AI trip generation',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

// ============================================
// Notification Handlers
// ============================================

export type NotificationReceivedHandler = (
  notification: Notifications.Notification
) => void;

export type NotificationResponseHandler = (
  response: Notifications.NotificationResponse
) => void;

/**
 * Subscribe to notifications received while app is in foreground
 */
export function addNotificationReceivedListener(
  handler: NotificationReceivedHandler
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(handler);
}

/**
 * Subscribe to notification interactions (user taps notification)
 */
export function addNotificationResponseListener(
  handler: NotificationResponseHandler
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Parse notification data from a notification
 */
export function parseNotificationData(
  notification: Notifications.Notification
): NotificationData | null {
  try {
    const data = notification.request.content.data as NotificationData;
    return data;
  } catch {
    return null;
  }
}

/**
 * Get the last notification response (for handling app opens from notification)
 */
export function getLastNotificationResponse(): Notifications.NotificationResponse | null {
  return Notifications.getLastNotificationResponse();
}

// ============================================
// Local Notifications (for testing/scheduling)
// ============================================

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: NotificationData,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string> {
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as Record<string, unknown>,
      sound: true,
    },
    trigger: trigger || null, // null = immediate
  });

  return notificationId;
}

/**
 * Schedule a trip reminder notification
 */
export async function scheduleTripReminder(
  tripId: string,
  tripTitle: string,
  tripDate: Date
): Promise<string | null> {
  // Calculate reminder time (1 day before at 9 AM)
  const reminderDate = new Date(tripDate);
  reminderDate.setDate(reminderDate.getDate() - 1);
  reminderDate.setHours(9, 0, 0, 0);

  // Don't schedule if the reminder time has already passed
  if (reminderDate <= new Date()) {
    console.log('Trip reminder time has already passed');
    return null;
  }

  const notificationId = await scheduleLocalNotification(
    '✈️ Trip Tomorrow!',
    `Your trip "${tripTitle}" starts tomorrow. Make sure you're all set!`,
    {
      type: 'trip_reminder',
      tripId,
      title: tripTitle,
    },
    {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    }
  );

  return notificationId;
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<
  Notifications.NotificationRequest[]
> {
  return Notifications.getAllScheduledNotificationsAsync();
}

// ============================================
// Badge Management
// ============================================

/**
 * Set app badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear app badge
 */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

// ============================================
// Supabase Integration
// ============================================

/**
 * Store push token in Supabase
 * This should be called after successful authentication
 */
export async function storePushTokenInSupabase(
  supabaseClient: {
    from: (table: string) => {
      upsert: (data: Record<string, unknown>, options?: Record<string, unknown>) => Promise<{ error: Error | null }>;
    };
  },
  userId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseClient
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS,
          device_name: Device.deviceName || 'Unknown',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' }
      );

    if (error) {
      console.error('Error storing push token:', error);
      return { success: false, error: error.message };
    }

    console.log('Push token stored successfully');
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error storing push token:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Remove push token from Supabase (call on logout)
 */
export async function removePushTokenFromSupabase(
  supabaseClient: {
    from: (table: string) => {
      delete: () => {
        eq: (column: string, value: string) => Promise<{ error: Error | null }>;
      };
    };
  },
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseClient
      .from('push_tokens')
      .delete()
      .eq('token', token);

    if (error) {
      console.error('Error removing push token:', error);
      return { success: false, error: error.message };
    }

    console.log('Push token removed successfully');
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error removing push token:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
