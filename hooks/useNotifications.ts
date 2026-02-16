import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import {
  registerForPushNotificationsAsync,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  parseNotificationData,
  getLastNotificationResponse,
  clearBadge,
  NotificationData,
  PushTokenResult,
} from '../lib/notifications';

interface UseNotificationsOptions {
  /**
   * Whether to automatically request permissions on mount
   * @default false
   */
  autoRequestPermissions?: boolean;

  /**
   * Callback when a notification is received in foreground
   */
  onNotificationReceived?: (notification: Notifications.Notification, data: NotificationData | null) => void;

  /**
   * Callback when user interacts with a notification
   */
  onNotificationResponse?: (data: NotificationData | null) => void;
}

interface UseNotificationsReturn {
  /**
   * Expo Push Token (null if not registered)
   */
  pushToken: string | null;

  /**
   * Whether notifications are being initialized
   */
  isLoading: boolean;

  /**
   * Error message if registration failed
   */
  error: string | null;

  /**
   * Manually register for push notifications
   */
  registerForNotifications: () => Promise<PushTokenResult>;

  /**
   * Handle notification navigation based on notification data
   */
  handleNotificationNavigation: (data: NotificationData | null) => void;
}

export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const { autoRequestPermissions = false, onNotificationReceived, onNotificationResponse } = options;

  const router = useRouter();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notificationReceivedRef = useRef<Notifications.EventSubscription | null>(null);
  const notificationResponseRef = useRef<Notifications.EventSubscription | null>(null);
  const appStateRef = useRef(AppState.currentState);

  /**
   * Handle navigation based on notification data
   */
  const handleNotificationNavigation = useCallback(
    (data: NotificationData | null) => {
      if (!data) return;

      switch (data.type) {
        case 'trip_generation_complete':
          if (data.tripId) {
            router.push(`/trip/${data.tripId}` as `/trip/${string}`);
          }
          break;

        case 'trip_reminder':
          if (data.tripId) {
            router.push(`/trip/${data.tripId}` as `/trip/${string}`);
          }
          break;

        case 'activity_recommendation':
          if (data.tripId) {
            router.push(`/trip/${data.tripId}` as `/trip/${string}`);
          } else {
            // Navigate to explore/discover page if available
            router.push('/(tabs)');
          }
          break;

        default:
          // Unknown notification type - go to home
          console.log('Unknown notification type:', data.type);
          break;
      }
    },
    [router]
  );

  /**
   * Register for push notifications
   */
  const registerForNotifications = useCallback(async (): Promise<PushTokenResult> => {
    setIsLoading(true);
    setError(null);

    const result = await registerForPushNotificationsAsync();

    if (result.token) {
      setPushToken(result.token);
    } else if (result.error) {
      setError(result.error);
    }

    setIsLoading(false);
    return result;
  }, []);

  // Initialize notifications on mount
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      // Check for notification that opened the app (synchronous call)
      const lastResponse = getLastNotificationResponse();
      if (lastResponse && mounted) {
        const data = parseNotificationData(lastResponse.notification);
        if (onNotificationResponse) {
          onNotificationResponse(data);
        }
        handleNotificationNavigation(data);
      }

      // Auto-register if option is enabled
      if (autoRequestPermissions) {
        await registerForNotifications();
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRequestPermissions]); // callbacks are stable via useCallback

  // Set up notification listeners
  useEffect(() => {
    // Listener for notifications received while app is foregrounded
    notificationReceivedRef.current = addNotificationReceivedListener(
      (notification) => {
        const data = parseNotificationData(notification);
        console.log('Notification received:', data);

        if (onNotificationReceived) {
          onNotificationReceived(notification, data);
        }
      }
    );

    // Listener for user interactions with notifications
    notificationResponseRef.current = addNotificationResponseListener(
      (response) => {
        const data = parseNotificationData(response.notification);
        console.log('Notification response:', data);

        if (onNotificationResponse) {
          onNotificationResponse(data);
        }

        // Navigate based on notification data
        handleNotificationNavigation(data);
      }
    );

    return () => {
      if (notificationReceivedRef.current) {
        notificationReceivedRef.current.remove();
      }
      if (notificationResponseRef.current) {
        notificationResponseRef.current.remove();
      }
    };
  }, [onNotificationReceived, onNotificationResponse, handleNotificationNavigation]);

  // Clear badge when app becomes active
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // Clear badge when app becomes active
        clearBadge();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  return {
    pushToken,
    isLoading,
    error,
    registerForNotifications,
    handleNotificationNavigation,
  };
}

export default useNotifications;
