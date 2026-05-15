import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Lazy-load expo-notifications to avoid crashes in Expo Go (SDK 53+)
// where remote notification support was removed.
let _notifications: typeof import("expo-notifications") | null = null;
let _initPromise: Promise<typeof import("expo-notifications") | null> | null =
  null;

async function getNotifications() {
  if (_notifications) return _notifications;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const mod = await import("expo-notifications");
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      _notifications = mod;
      return mod;
    } catch (e) {
      console.warn("[Notifications] expo-notifications not available:", e);
      return null;
    }
  })();

  return _initPromise;
}

// ============================================
// Types
// ============================================

export type NotificationType =
  | "trip_generation_complete"
  | "trip_reminder"
  | "activity_recommendation";

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

// Re-export types that consumers need (use `any` for the lazy-loaded module's types)
export type NotificationReceivedHandler = (notification: any) => void;
export type NotificationResponseHandler = (response: any) => void;
export type EventSubscription = { remove: () => void };

// ============================================
// Permission Handling
// ============================================

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log("Notifications require a physical device");
    return false;
  }

  const Notifications = await getNotifications();
  if (!Notifications) return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Notification permissions not granted");
    return false;
  }

  return true;
}

export async function checkNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

// ============================================
// Push Token Registration
// ============================================

export async function registerForPushNotificationsAsync(): Promise<PushTokenResult> {
  if (!Device.isDevice) {
    return {
      token: null,
      error: "Push notifications require a physical device",
    };
  }

  const Notifications = await getNotifications();
  if (!Notifications) {
    return {
      token: null,
      error: "Notifications not available in this environment",
    };
  }

  const permissionGranted = await requestNotificationPermissions();
  if (!permissionGranted) {
    return { token: null, error: "Notification permissions not granted" };
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn(
        "No projectId found - push notifications may not work in production",
      );
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    const token = tokenResponse.data;

    if (Platform.OS === "android") {
      await setupAndroidNotificationChannel();
    }

    return { token };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error getting push token:", errorMessage);
    return { token: null, error: errorMessage };
  }
}

async function setupAndroidNotificationChannel(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF6B6B",
    sound: "default",
  });

  await Notifications.setNotificationChannelAsync("trip-reminders", {
    name: "Trip Reminders",
    description: "Reminders about upcoming trips",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
  });

  await Notifications.setNotificationChannelAsync("trip-generation", {
    name: "Trip Generation",
    description: "Updates about AI trip generation",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

// ============================================
// Notification Handlers
// ============================================

export async function addNotificationReceivedListener(
  handler: NotificationReceivedHandler,
): Promise<EventSubscription> {
  const Notifications = await getNotifications();
  if (!Notifications) return { remove: () => {} };
  return Notifications.addNotificationReceivedListener(handler);
}

export async function addNotificationResponseListener(
  handler: NotificationResponseHandler,
): Promise<EventSubscription> {
  const Notifications = await getNotifications();
  if (!Notifications) return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export function parseNotificationData(
  notification: any,
): NotificationData | null {
  try {
    const data = notification.request.content.data as NotificationData;
    return data;
  } catch {
    return null;
  }
}

export async function getLastNotificationResponse(): Promise<any | null> {
  const Notifications = await getNotifications();
  if (!Notifications) return null;
  return Notifications.getLastNotificationResponse();
}

// ============================================
// Local Notifications (for testing/scheduling)
// ============================================

export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: NotificationData,
  trigger?: any,
): Promise<string> {
  const Notifications = await getNotifications();
  if (!Notifications) return "";

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data as Record<string, unknown>,
      sound: true,
    },
    trigger: trigger || null,
  });

  return notificationId;
}

export async function scheduleTripReminder(
  tripId: string,
  tripTitle: string,
  tripDate: Date,
): Promise<string | null> {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  const reminderDate = new Date(tripDate);
  reminderDate.setDate(reminderDate.getDate() - 1);
  reminderDate.setHours(9, 0, 0, 0);

  if (reminderDate <= new Date()) {
    console.log("Trip reminder time has already passed");
    return null;
  }

  const notificationId = await scheduleLocalNotification(
    "✈️ Trip Tomorrow!",
    `Your trip "${tripTitle}" starts tomorrow. Make sure you're all set!`,
    {
      type: "trip_reminder",
      tripId,
      title: tripTitle,
    },
    {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    },
  );

  return notificationId;
}

export async function cancelNotification(
  notificationId: string,
): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllNotifications(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledNotifications(): Promise<any[]> {
  const Notifications = await getNotifications();
  if (!Notifications) return [];
  return Notifications.getAllScheduledNotificationsAsync();
}

// ============================================
// Badge Management
// ============================================

export async function setBadgeCount(count: number): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.setBadgeCountAsync(count);
}

export async function clearBadge(): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.setBadgeCountAsync(0);
}

// ============================================
// Supabase Integration
// ============================================

interface MinimalSupabaseClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

export async function storePushTokenInSupabase(
  supabaseClient: MinimalSupabaseClient,
  userId: string,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseClient.from("push_tokens").upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS,
        device_name: Device.deviceName || "Unknown",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" },
    );

    if (error) {
      console.error("Error storing push token:", error);
      return { success: false, error: error.message };
    }

    console.log("Push token stored successfully");
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error storing push token:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function removePushTokenFromSupabase(
  supabaseClient: MinimalSupabaseClient,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseClient
      .from("push_tokens")
      .delete()
      .eq("token", token);

    if (error) {
      console.error("Error removing push token:", error);
      return { success: false, error: error.message };
    }

    console.log("Push token removed successfully");
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error removing push token:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
