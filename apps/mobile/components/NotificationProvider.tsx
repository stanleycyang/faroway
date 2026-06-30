import React, { useEffect, useCallback, createContext, useContext, useRef, useState } from 'react';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { useNotifications } from '../hooks/useNotifications';
import { useUserStore } from '../stores/userStore';
import { NotificationData } from '../lib/notifications';
import { logger } from '../lib/logger';
import { registerPushToken } from '../services/api';

// ============================================
// Context
// ============================================

interface NotificationContextType {
  pushToken: string | null;
  isLoading: boolean;
  error: string | null;
  registerForNotifications: () => Promise<{ token: string | null; error?: string }>;
  requestPermissions: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotificationContext(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider');
  }
  return context;
}

// ============================================
// Provider Component
// ============================================

interface NotificationProviderProps {
  children: React.ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { isAuthenticated, user } = useUserStore();
  const [hasRequestedPermissions, setHasRequestedPermissions] = useState(false);
  const registeredTokenRef = useRef<string | null>(null);

  // Handle notification received in foreground
  const handleNotificationReceived = useCallback(
    (notification: unknown, data: NotificationData | null) => {
      logger.debug('[Notifications] Received in foreground:', {
        type: data?.type,
        tripId: data?.tripId,
        hasNotification: !!notification,
      });

      // Optionally show custom in-app notification UI here
      // For now, the system notification will show (configured in setNotificationHandler)
    },
    []
  );

  // Handle notification interaction (user tapped)
  const handleNotificationResponse = useCallback((data: NotificationData | null) => {
    logger.debug('[Notifications] User interacted with notification:', {
      type: data?.type,
      tripId: data?.tripId,
    });

    // Navigation is handled automatically by useNotifications hook
    // Add any additional logic here (analytics, etc.)
  }, []);

  const { pushToken, isLoading, error, registerForNotifications } = useNotifications({
    autoRequestPermissions: false, // We'll request manually after onboarding
    onNotificationReceived: handleNotificationReceived,
    onNotificationResponse: handleNotificationResponse,
  });

  const registerTokenForCurrentUser = useCallback(
    async (token: string) => {
      if (!isAuthenticated || !user?.id) return;

      const registrationKey = `${user.id}:${token}`;
      if (registeredTokenRef.current === registrationKey) return;

      const result = await registerPushToken({
        token,
        platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown',
        deviceName: Device.deviceName || null,
      });

      if (result.error) {
        logger.warn('[Notifications] Failed to register push token:', result.error);
        return;
      }

      registeredTokenRef.current = registrationKey;
      logger.info('[Notifications] Push token registered for current user');
    },
    [isAuthenticated, user?.id]
  );

  // Request permissions (called after onboarding or first auth)
  const requestPermissions = useCallback(async () => {
    if (hasRequestedPermissions) return;

    const result = await registerForNotifications();
    setHasRequestedPermissions(true);

    if (result.token) {
      await registerTokenForCurrentUser(result.token);
    } else if (result.error) {
      logger.warn('[Notifications] Failed to get push token:', result.error);
    }
  }, [hasRequestedPermissions, registerForNotifications, registerTokenForCurrentUser]);

  // Register for notifications when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && user?.id && !pushToken && !hasRequestedPermissions) {
      // Small delay to ensure smooth UX after auth
      const timer = setTimeout(() => {
        requestPermissions();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user?.id, pushToken, hasRequestedPermissions, requestPermissions]);

  // Store push token when user authenticates (if we already have a token)
  useEffect(() => {
    if (isAuthenticated && user?.id && pushToken) {
      registerTokenForCurrentUser(pushToken);
    }
  }, [isAuthenticated, user?.id, pushToken, registerTokenForCurrentUser]);

  const contextValue: NotificationContextType = {
    pushToken,
    isLoading,
    error,
    registerForNotifications,
    requestPermissions,
  };

  return (
    <NotificationContext.Provider value={contextValue}>{children}</NotificationContext.Provider>
  );
}

export default NotificationProvider;
