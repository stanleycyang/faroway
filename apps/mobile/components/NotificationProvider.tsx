import React, {
  useEffect,
  useCallback,
  createContext,
  useContext,
  useState,
} from "react";
import { useNotifications } from "../hooks/useNotifications";
import { useUserStore } from "../stores/userStore";
import {
  NotificationData,
  storePushTokenInSupabase,
} from "../lib/notifications";
import { supabase } from "../lib/supabase";

// ============================================
// Context
// ============================================

interface NotificationContextType {
  pushToken: string | null;
  isLoading: boolean;
  error: string | null;
  registerForNotifications: () => Promise<{
    token: string | null;
    error?: string;
  }>;
  requestPermissions: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotificationContext(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotificationContext must be used within NotificationProvider",
    );
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
    (notification: any, data: NotificationData | null) => {
      console.log("[Notifications] Received in foreground:", {
        title: notification.request.content.title,
        body: notification.request.content.body,
        data,
      });

      // Optionally show custom in-app notification UI here
      // For now, the system notification will show (configured in setNotificationHandler)
    },
    [],
  );

  // Handle notification interaction (user tapped)
  const handleNotificationResponse = useCallback(
    (data: NotificationData | null) => {
      console.log("[Notifications] User interacted with notification:", data);

      // Navigation is handled automatically by useNotifications hook
      // Add any additional logic here (analytics, etc.)
    },
    [],
  );

  const { pushToken, isLoading, error, registerForNotifications } =
    useNotifications({
      autoRequestPermissions: false, // We'll request manually after onboarding
      onNotificationReceived: handleNotificationReceived,
      onNotificationResponse: handleNotificationResponse,
    });

  // Caller-driven permission request (Settings screen, post-action contextual prompt).
  // We deliberately do NOT auto-request on auth — Apple/Google reviewers flag
  // notification prompts that fire outside of a clear user-initiated action.
  const requestPermissions = useCallback(async () => {
    if (hasRequestedPermissions) return;

    const result = await registerForNotifications();
    setHasRequestedPermissions(true);

    if (result.token && isAuthenticated && user?.id) {
      await storePushTokenInSupabase(supabase, user.id, result.token);
    }
  }, [
    hasRequestedPermissions,
    registerForNotifications,
    isAuthenticated,
    user?.id,
  ]);

  // If a token is already cached locally when the user signs in, persist it
  // server-side so the user can be reached on this device.
  useEffect(() => {
    if (isAuthenticated && user?.id && pushToken) {
      storePushTokenInSupabase(supabase, user.id, pushToken);
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
