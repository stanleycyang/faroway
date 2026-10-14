import React from 'react';
import { Switch } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Switch: 'Switch',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: unknown) => styles },
  Alert: { alert: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../components/NotificationProvider', () => ({
  useNotificationContext: () => ({ enabled: false, isLoading: false }),
}));
jest.mock('../../utils/haptics', () => ({
  hapticFeedback: { selection: jest.fn(), error: jest.fn() },
}));
const mockUser = { id: 'account-a' };
const mockStore = { user: mockUser, accountRevision: 0, setUser: jest.fn() };
jest.mock('../../stores/userStore', () => ({
  useUserStore: Object.assign(() => mockStore, { getState: () => mockStore }),
}));
const mockRead = jest.fn();
const mockWrite = jest.fn();
jest.mock('../../services/pushConsentService', () => ({
  getVerifiedNotificationPreferences: (...args: unknown[]) => mockRead(...args),
  updateNotificationPreferences: (...args: unknown[]) => mockWrite(...args),
}));
import NotificationsScreen from '../../app/profile/notifications';

let renderer: ReactTestRenderer;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const choices = { trip_reminders: true, deals: true, itinerary_updates: false, app_updates: false };
function choiceSwitches() {
  return renderer.root
    .findAllByType(Switch)
    .filter((item) => item.props.accessibilityLabel !== 'Notifications on this device');
}
beforeEach(() => {
  jest.clearAllMocks();
  mockStore.user = mockUser;
  mockStore.accountRevision = 0;
  mockRead.mockResolvedValue(choices);
  mockWrite.mockResolvedValue(undefined);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});

it('keeps preference editing unavailable after a load failure and recovers the saved choices on retry', async () => {
  mockRead.mockRejectedValueOnce(new Error('Network unavailable'));
  await act(async () => {
    renderer = create(<NotificationsScreen />);
  });
  expect(choiceSwitches().every((item) => item.props.disabled)).toBe(true);
  expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
    'couldn’t be loaded'
  );
  await act(async () => {
    choiceSwitches()[0].props.onValueChange(false);
  });
  expect(mockWrite).not.toHaveBeenCalled();
  await act(async () => {
    renderer.root
      .findByProps({ accessibilityLabel: 'Retry notification preferences' })
      .props.onPress();
  });
  expect(choiceSwitches().every((item) => !item.props.disabled)).toBe(true);
  expect(choiceSwitches()[0].props.value).toBe(true);
  expect(choiceSwitches()[1].props.value).toBe(true);
  await act(async () => {
    choiceSwitches()[0].props.onValueChange(false);
  });
  expect(mockWrite).toHaveBeenCalledWith('account-a', { ...choices, trip_reminders: false });
});

it('serializes rapid preference changes so one save cannot erase another', async () => {
  mockWrite.mockReturnValue(new Promise(() => {}));
  await act(async () => {
    renderer = create(<NotificationsScreen />);
  });
  await act(async () => {
    const switches = choiceSwitches();
    switches[0].props.onValueChange(false);
    switches[1].props.onValueChange(false);
  });
  expect(mockWrite).toHaveBeenCalledTimes(1);
  expect(choiceSwitches().every((item) => item.props.disabled)).toBe(true);
});

it('ignores a delayed preference response from the previous account', async () => {
  let resolvePrevious: (value: typeof choices) => void = () => undefined;
  mockRead.mockReturnValueOnce(
    new Promise((resolve) => {
      resolvePrevious = resolve;
    })
  );
  await act(async () => {
    renderer = create(<NotificationsScreen />);
  });
  expect(choiceSwitches().every((item) => item.props.disabled)).toBe(true);
  mockStore.user = { id: 'account-b' };
  mockRead.mockResolvedValue({ ...choices, deals: false });
  await act(async () => {
    renderer.update(<NotificationsScreen />);
  });
  await act(async () => {
    resolvePrevious(choices);
  });
  expect(choiceSwitches()[1].props.value).toBe(false);
  await act(async () => {
    choiceSwitches()[0].props.onValueChange(false);
  });
  expect(mockWrite).toHaveBeenCalledWith('account-b', {
    ...choices,
    trip_reminders: false,
    deals: false,
  });
});

it('reloads notification choices after same-account reauthentication and ignores the old save', async () => {
  let finish: () => void = () => undefined;
  mockWrite.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    })
  );
  await act(async () => {
    renderer = create(<NotificationsScreen />);
  });
  await act(async () => {
    void choiceSwitches()[0].props.onValueChange(false);
  });
  mockStore.accountRevision += 2;
  mockRead.mockResolvedValue({ ...choices, deals: false });
  await act(async () => {
    renderer.update(<NotificationsScreen />);
  });
  expect(mockRead).toHaveBeenCalledTimes(2);
  expect(choiceSwitches()[1].props.value).toBe(false);
  await act(async () => {
    finish();
  });
  expect(mockStore.setUser).not.toHaveBeenCalled();
  expect(choiceSwitches()[0].props.value).toBe(true);
});
