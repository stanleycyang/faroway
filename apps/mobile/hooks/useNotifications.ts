import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
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
  EventSubscription,
} from '../lib/notifications';

interface UseNotificationsOptions {
  autoRequestPermissions?: boolean;
  onNotificationReceived?: (notification: unknown, data: NotificationData | null) => void;
  onNotificationResponse?: (data: NotificationData | null) => void;
}

interface UseNotificationsReturn {
  pushToken: string | null;
  isLoading: boolean;
  error: string | null;
  registerForNotifications: () => Promise<PushTokenResult>;
  handleNotificationNavigation: (data: NotificationData | null) => void;
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const {
    autoRequestPermissions = false,
    onNotificationReceived,
    onNotificationResponse,
  } = options;

  const router = useRouter();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notificationReceivedRef = useRef<EventSubscription | null>(null);
  const notificationResponseRef = useRef<EventSubscription | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const handleNotificationNavigation = useCallback(
    (data: NotificationData | null) => {
      if (!data) return;

      // Validate tripId is a valid UUID before navigating
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isValidTripId = data.tripId && UUID_REGEX.test(data.tripId);

      switch (data.type) {
        case 'trip_generation_complete':
        case 'trip_reminder':
          if (isValidTripId) {
            router.push(`/trip/${data.tripId}` as `/trip/${string}`);
          }
          break;

        case 'activity_recommendation':
          if (isValidTripId) {
            router.push(`/trip/${data.tripId}` as `/trip/${string}`);
          } else {
            router.push('/(tabs)');
          }
          break;

        default:
          console.log('Unknown notification type:', data.type);
          break;
      }
    },
    [router]
  );

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
      // Check for notification that opened the app
      const lastResponse = await getLastNotificationResponse();
      if (lastResponse && mounted) {
        const data = parseNotificationData(lastResponse);
        if (onNotificationResponse) {
          onNotificationResponse(data);
        }
        handleNotificationNavigation(data);
      }

      if (autoRequestPermissions) {
        await registerForNotifications();
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRequestPermissions]);

  // Set up notification listeners
  useEffect(() => {
    let mounted = true;

    const setupListeners = async () => {
      const receivedSub = await addNotificationReceivedListener((notification) => {
        const data = parseNotificationData(notification);
        console.log('Notification received:', data);
        if (onNotificationReceived) {
          onNotificationReceived(notification, data);
        }
      });

      const responseSub = await addNotificationResponseListener((response) => {
        const data = parseNotificationData(response.notification);
        console.log('Notification response:', data);
        if (onNotificationResponse) {
          onNotificationResponse(data);
        }
        handleNotificationNavigation(data);
      });

      if (mounted) {
        notificationReceivedRef.current = receivedSub;
        notificationResponseRef.current = responseSub;
      } else {
        receivedSub.remove();
        responseSub.remove();
      }
    };

    setupListeners();

    return () => {
      mounted = false;
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
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
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
