const sessionMock = jest.fn();
const acquireMock = jest.fn();
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: sessionMock, onAuthStateChange: jest.fn() } },
}));
jest.mock('../../lib/notifications', () => ({ registerForPushNotificationsAsync: acquireMock }));
jest.mock('../../constants/api', () => ({ API_BASE_URL: 'https://staging.example' }));
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  devicePushConsent,
  updateNotificationPreferences,
} from '../../services/pushConsentService';
const fetchMock = jest.fn();

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
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
  await updateNotificationPreferences('a', { itinerary_updates: true });
  expect(fetchMock).toHaveBeenCalledWith(
    'https://staging.example/api/user/profile',
    expect.objectContaining({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer a-token' },
      body: JSON.stringify({ notification_settings: { itinerary_updates: true } }),
    })
  );
});
