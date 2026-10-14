import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { requestWithTimeout } from './request';
import { captureTripAccount, readTripSession } from '../lib/tripAccountScope';
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
function notificationAccount(userId: string) {
  const account = captureTripAccount();
  const assertCurrent = () => {
    if (account.ownerId !== userId || !account.isCurrent())
      throw new Error('Your account changed. Reopen notification settings and try again.');
  };
  return {
    assertCurrent,
    async headers() {
      assertCurrent();
      const headers = await account.headers();
      assertCurrent();
      return headers;
    },
  };
}

export async function updateNotificationPreferences(
  userId: string,
  settings: Record<string, boolean>
) {
  const account = notificationAccount(userId);
  const headers = await account.headers();
  await requestWithTimeout(
    `${API_BASE_URL}/api/user/profile`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        notification_settings: settings,
        notification_consent_version: 'notifications-v2',
      }),
    },
    async (response) => {
      if (!response.ok)
        throw new Error('Couldn’t save notification settings. Please try again online.');
      account.assertCurrent();
      const receipt = await response.json().catch(() => null);
      account.assertCurrent();
      if (
        !receipt ||
        receipt.id !== userId ||
        Object.entries(settings).some(
          ([key, value]) => receipt.notificationSettings?.[key] !== value
        ) ||
        (Object.values(settings).some(Boolean) &&
          receipt.notificationConsentVersion !== 'notifications-v2')
      ) {
        throw new Error(
          'Your notification choices could not be confirmed. Reopen settings to check your saved choices before trying again.'
        );
      }
    },
    15_000
  );
  account.assertCurrent();
}
export const devicePushConsent = new PushConsent({
  identity: async () => {
    const { data, error } = await readTripSession();
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
    await requestWithTimeout(
      `${API_BASE_URL}/api/user/push-token`,
      {
        method,
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
      },
      (response) => {
        if (!response.ok)
          throw new Error(
            'Couldn’t update device notifications. Try again online, or turn notifications off in device Settings.'
          );
      },
      15_000
    );
  },
});

// Invalidate in-flight OS prompts even if the same account signs in again.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') devicePushConsent.invalidate();
});

export async function getVerifiedNotificationPreferences(userId: string) {
  const account = notificationAccount(userId);
  const headers = await account.headers();
  const profile = await requestWithTimeout(
    `${API_BASE_URL}/api/user/profile`,
    {
      headers,
      cache: 'no-store',
    },
    async (response) => {
      if (!response.ok) throw new Error('Couldn’t load notification preferences.');
      return response.json();
    },
    15_000
  );
  account.assertCurrent();
  if (!profile || typeof profile !== 'object' || profile.id !== userId)
    throw new Error('Your notification settings could not be verified. Please try again.');
  const defaults = {
    trip_reminders: false,
    deals: false,
    itinerary_updates: false,
    app_updates: false,
  };
  if (profile.notificationConsentVersion !== 'notifications-v2') return defaults;
  return Object.fromEntries(
    Object.keys(defaults).map((key) => [key, profile.notificationSettings?.[key] === true])
  );
}
