import React, { useEffect, useCallback, createContext, useContext, useState } from 'react';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNotifications } from '../hooks/useNotifications';
import { useUserStore } from '../stores/userStore';
import { NotificationData } from '../lib/notifications';

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

  // Handle notification received in foreground
  const handleNotificationReceived = useCallback(
    (notification: Notifications.Notification, data: NotificationData | null) => {
      console.log('[Notifications] Received in foreground:', {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data,
      });

      // Optionally show custom in-app notification UI here
      // For now, the system notification will show (configured in setNotificationHandler)
    },
    []
  );

  // Handle notification interaction (user tapped)
  const handleNotificationResponse = useCallback(
    (data: NotificationData | null) => {
      console.log('[Notifications] User interacted with notification:', data);

      // Navigation is handled automatically by useNotifications hook
      // Add any additional logic here (analytics, etc.)
    },
    []
  );

  const { pushToken, isLoading, error, registerForNotifications } = useNotifications({
    autoRequestPermissions: false, // We'll request manually after onboarding
    onNotificationReceived: handleNotificationReceived,
    onNotificationResponse: handleNotificationResponse,
  });

  // Request permissions (called after onboarding or first auth)
  const requestPermissions = useCallback(async () => {
    if (hasRequestedPermissions) return;

    const result = await registerForNotifications();
    setHasRequestedPermissions(true);

    if (result.token) {
      console.log('[Notifications] Push token obtained:', result.token);

      // Store token in Supabase if user is authenticated
      if (isAuthenticated && user?.id) {
        // TODO: Implement Supabase storage when client is set up
        // await storePushTokenInSupabase(supabaseClient, user.id, result.token);
        console.log('[Notifications] Would store token for user:', user.id);
      }
    } else if (result.error) {
      console.log('[Notifications] Failed to get push token:', result.error);
    }
  }, [hasRequestedPermissions, registerForNotifications, isAuthenticated, user?.id]);

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
      // TODO: Implement Supabase storage when client is set up
      // storePushTokenInSupabase(supabaseClient, user.id, pushToken);
      console.log('[Notifications] Would store existing token for newly authenticated user:', user.id);
    }
  }, [isAuthenticated, user?.id, pushToken]);

  const contextValue: NotificationContextType = {
    pushToken,
    isLoading,
    error,
    registerForNotifications,
    requestPermissions,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export default NotificationProvider;
