const sessionMock = jest.fn();
const acquireMock = jest.fn();
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: sessionMock, onAuthStateChange: jest.fn() } },
}));
jest.mock('../../lib/notifications', () => ({ registerForPushNotificationsAsync: acquireMock }));
jest.mock('../../constants/api', () => ({ API_BASE_URL: 'https://staging.example' }));
import { useUserStore } from '../../stores/userStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  devicePushConsent,
  updateNotificationPreferences,
  getVerifiedNotificationPreferences,
} from '../../services/pushConsentService';
const fetchMock = jest.fn();

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useUserStore
    .getState()
    .setUser({ id: 'a', name: 'Fixture', email: 'a@example.invalid', preferences: { vibes: [] } });
  sessionMock.mockResolvedValue({
    data: { session: { user: { id: 'a' }, access_token: 'a-token' } },
  });
  acquireMock.mockResolvedValue({ token: 'ExpoPushToken[device]' });
  fetchMock.mockResolvedValue({ ok: true });
  global.fetch = fetchMock;
});

it('does not request permissions on restoration but explicit enable passes prompt=true', async () => {
  await devicePushConsent.restore();
  expect(acquireMock).not.toHaveBeenCalled();
  await devicePushConsent.enable();
  expect(acquireMock).toHaveBeenCalledWith({ requestPermission: true });
  expect(fetchMock).toHaveBeenCalledWith(
    'https://staging.example/api/user/push-token',
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer a-token' },
    })
  );
  acquireMock.mockClear();
  await devicePushConsent.restore();
  expect(acquireMock).toHaveBeenCalledWith({ requestPermission: false });
});

it('does not persist bearer credentials with device consent', async () => {
  await devicePushConsent.enable();
  const stored = await AsyncStorage.getItem('faroway-device-push-consent-v1');
  expect(stored).not.toContain('a-token');
  expect(JSON.parse(stored!)).toEqual({
    userId: 'a',
    token: 'ExpoPushToken[device]',
    enabled: true,
  });
});

it('prevents settings saved from an old screen from changing another account', async () => {
  await expect(updateNotificationPreferences('old-account', { deals: true })).rejects.toThrow(
    'account changed'
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

it('pins notification preference writes to the matching authenticated session', async () => {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      id: 'a',
      notificationSettings: { itinerary_updates: true },
      notificationConsentVersion: 'notifications-v2',
    }),
  });
  await updateNotificationPreferences('a', { itinerary_updates: true });
  expect(fetchMock).toHaveBeenCalledWith(
    'https://staging.example/api/user/profile',
    expect.objectContaining({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer a-token' },
      body: JSON.stringify({
        notification_settings: { itinerary_updates: true },
        notification_consent_version: 'notifications-v2',
      }),
    })
  );
});

it('orders opt-out after a timed-out registration even when the device clock moves backwards', async () => {
  const clock = jest.spyOn(Date, 'now').mockReturnValue(10000);
  fetchMock.mockRejectedValueOnce(new Error('timeout'));
  await expect(devicePushConsent.enable()).rejects.toThrow('timeout');
  clock.mockReturnValue(9000);
  await devicePushConsent.disable();
  const bodies = fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body));
  expect(bodies[1].revision).toBeGreaterThan(bodies[0].revision);
  expect(bodies.every((b) => b.consentVersion === 'notifications-v2')).toBe(true);
  clock.mockRestore();
});

it('does not treat legacy default-true categories or cached settings as explicit consent', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'a', notificationSettings: { itinerary_updates: true } }),
  });
  expect((await getVerifiedNotificationPreferences('a')).itinerary_updates).toBe(false);
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      id: 'a',
      notificationConsentVersion: 'notifications-v2',
      notificationSettings: { itinerary_updates: true },
    }),
  });
  expect((await getVerifiedNotificationPreferences('a')).itinerary_updates).toBe(true);
});

it.each(['read', 'write'])(
  'a stalled notification preference %s settles at its deadline',
  async (operation) => {
    jest.useFakeTimers();
    try {
      fetchMock.mockImplementation(() => new Promise(() => {}));
      let failure: unknown;
      const request = (
        operation === 'read'
          ? getVerifiedNotificationPreferences('a')
          : updateNotificationPreferences('a', { deals: true })
      ).catch((error) => {
        failure = error;
      });
      await jest.advanceTimersByTimeAsync(15_001);
      expect(failure).toBeInstanceOf(Error);
      await request;
    } finally {
      jest.useRealTimers();
    }
  }
);

it('the read deadline includes a stalled profile body', async () => {
  jest.useFakeTimers();
  try {
    fetchMock.mockResolvedValue({ ok: true, json: () => new Promise(() => {}) });
    const request = getVerifiedNotificationPreferences('a');
    const rejected = expect(request).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(15_001);
    await rejected;
  } finally {
    jest.useRealTimers();
  }
});

it.each(['read', 'write'])(
  'a late preference %s cannot confirm after logout and same-account sign-in',
  async (operation) => {
    let release!: (response: unknown) => void;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const request =
      operation === 'read'
        ? getVerifiedNotificationPreferences('a')
        : updateNotificationPreferences('a', { deals: true });
    const rejected = expect(request).rejects.toThrow('account changed');
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    useUserStore.getState().logout();
    useUserStore.getState().setUser({
      id: 'a',
      name: 'Fixture',
      email: 'a@example.invalid',
      preferences: { vibes: [] },
    });
    release({
      ok: true,
      json: async () => ({
        id: 'a',
        notificationConsentVersion: 'notifications-v2',
        notificationSettings: { deals: true },
      }),
    });
    await rejected;
  }
);

it('stalled device registration releases the queue so opt-out can retry', async () => {
  jest.useFakeTimers();
  try {
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    const registration = devicePushConsent.enable();
    const rejected = expect(registration).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(15_001);
    await rejected;
    fetchMock.mockResolvedValue({ ok: true });
    await devicePushConsent.disable();
    expect(fetchMock.mock.calls.at(-1)[1].method).toBe('DELETE');
  } finally {
    jest.useRealTimers();
  }
});

it.each([
  {
    id: 'another-owner',
    notificationSettings: { deals: true },
    notificationConsentVersion: 'notifications-v2',
  },
  {
    id: 'a',
    notificationSettings: { deals: false },
    notificationConsentVersion: 'notifications-v2',
  },
  { id: 'a', notificationSettings: { deals: true }, notificationConsentVersion: null },
])('rejects unconfirmed notification preference receipt %j', async (receipt) => {
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => receipt });
  await expect(updateNotificationPreferences('a', { deals: true })).rejects.toThrow(
    'could not be confirmed'
  );
});
