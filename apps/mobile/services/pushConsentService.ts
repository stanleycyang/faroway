import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../constants/api';
import { registerForPushNotificationsAsync } from '../lib/notifications';
import { PushConsent, type PushConsentRecord } from '../lib/pushConsent';

const KEY = 'faroway-device-push-consent-v1';
const REVISION_KEY = 'faroway-device-push-operation-revision';
async function nextRevision() {
  const raw = await AsyncStorage.getItem(REVISION_KEY);
  const previous = Number(raw);
  const revision = Math.max(Date.now(), (Number.isSafeInteger(previous) ? previous : 0) + 1);
  await AsyncStorage.setItem(REVISION_KEY, String(revision));
  return revision;
}
export async function updateNotificationPreferences(
  userId: string,
  settings: Record<string, boolean>
) {
  const { data, error } = await supabase.auth.getSession();
  if (error || data.session?.user.id !== userId)
    throw new Error('Your account changed. Please try again.');
  const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({
      notification_settings: settings,
      notification_consent_version: 'notifications-v2',
    }),
  });
  if (!response.ok)
    throw new Error('Couldn’t save notification settings. Please try again online.');
}
export const devicePushConsent = new PushConsent({
  identity: async () => {
    const { data, error } = await supabase.auth.getSession();
    return !error && data.session
      ? { id: data.session.user.id, accessToken: data.session.access_token }
      : null;
  },
  read: async () => {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as PushConsentRecord;
    if (
      typeof value?.userId !== 'string' ||
      typeof value.token !== 'string' ||
      typeof value.enabled !== 'boolean'
    )
      throw new Error('Device notification settings could not be read.');
    return value;
  },
  write: async (record) => {
    if (record) await AsyncStorage.setItem(KEY, JSON.stringify(record));
    else await AsyncStorage.removeItem(KEY);
  },
  acquire: (prompt) => registerForPushNotificationsAsync({ requestPermission: prompt }),
  send: async (method, token, identity) => {
    const revision = await nextRevision();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/push-token`, {
        method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${identity.accessToken}`,
        },
        body: JSON.stringify({
          token,
          revision,
          consentVersion: 'notifications-v2',
          ...(method === 'POST'
            ? {
                platform:
                  Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown',
              }
            : {}),
        }),
      });
      if (!response.ok)
        throw new Error(
          'Couldn’t update device notifications. Try again online, or turn notifications off in device Settings.'
        );
    } finally {
      clearTimeout(timeout);
    }
  },
});

// Invalidate in-flight OS prompts even if the same account signs in again.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') devicePushConsent.invalidate();
});

export async function getVerifiedNotificationPreferences(userId: string) {
  const current = await supabase.auth.getSession();
  if (current.error || current.data.session?.user.id !== userId)
    throw new Error('Your account changed. Please try again.');
  const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
    headers: { Authorization: `Bearer ${current.data.session.access_token}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Couldn’t load notification preferences.');
  const profile = await response.json();
  const defaults = {
    trip_reminders: false,
    deals: false,
    itinerary_updates: false,
    app_updates: false,
  };
  if (profile.id !== userId || profile.notificationConsentVersion !== 'notifications-v2')
    return defaults;
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [key, profile.notificationSettings?.[key] === true])
  );
}
