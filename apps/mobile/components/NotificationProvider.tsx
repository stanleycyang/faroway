import { cleanupDeletedAccount } from '../services/deletedAccountCleanup';
import { reconcileCompletedAccountDeletion } from '../services/accountDeletionService';
import React, { useEffect, useCallback, createContext, useContext, useState, useRef } from 'react';
import { AppState } from 'react-native';
import { useNotifications } from '../hooks/useNotifications';
import { useUserStore } from '../stores/userStore';
import { devicePushConsent } from '../services/pushConsentService';

// ============================================
// Context
// ============================================

interface NotificationContextType {
  enabled: boolean;
  isLoading: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
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
  const { user } = useUserStore();
  const [enabled, setEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef(0);
  useNotifications(); // Listen for received messages; never prompts or registers.
  const run = useCallback(async (action: () => Promise<boolean>) => {
    const attempt = ++operation.current;
    const accountId = useUserStore.getState().user?.id;
    const current = () =>
      operation.current === attempt && useUserStore.getState().user?.id === accountId;
    setIsLoading(true);
    setError(null);
    try {
      const value = await action();
      if (current()) setEnabled(value);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Couldn’t update notifications.';
      if (current()) {
        setEnabled(false);
        setError(message);
      }
      throw new Error(message);
    } finally {
      if (current()) setIsLoading(false);
    }
  }, []);
  useEffect(() => {
    setEnabled(false);
    const restore = () => {
      void run(async () => {
        await reconcileCompletedAccountDeletion(cleanupDeletedAccount);
        return devicePushConsent.restore();
      }).catch(() => {});
    };
    restore();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') restore();
    });
    return () => subscription.remove();
  }, [user?.id, run]);
  return (
    <NotificationContext.Provider
      value={{
        enabled,
        isLoading,
        error,
        enable: () => run(() => devicePushConsent.enable()),
        disable: () => run(() => devicePushConsent.disable()),
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export default NotificationProvider;
