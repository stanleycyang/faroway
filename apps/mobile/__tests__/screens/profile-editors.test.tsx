import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  TextInput: 'TextInput',
  Image: 'Image',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  ScrollView: 'ScrollView',
  Platform: { OS: 'ios' },
  StyleSheet: { create: (styles: unknown) => styles },
  Alert: { alert: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, replace: mockReplace }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../components/ui', () => ({ VibeSelector: 'VibeSelector' }));
jest.mock('../../utils/haptics', () => ({
  hapticFeedback: { selection: jest.fn(), success: jest.fn(), error: jest.fn() },
}));
const mockUpdate = jest.fn();
const mockRead = jest.fn();
jest.mock('../../services/api', () => ({
  updateUserProfile: (...args: unknown[]) => mockUpdate(...args),
  getVerifiedUserProfile: (...args: unknown[]) => mockRead(...args),
}));
const initialUser = {
  id: 'account-a',
  name: 'Ada',
  preferences: { vibes: ['cultural'], travelerType: undefined as string | undefined },
};
const mockStore = {
  user: initialUser,
  accountRevision: 0,
  setUser: jest.fn(),
  updatePreferences: jest.fn(),
};
jest.mock('../../stores/userStore', () => ({
  useUserStore: Object.assign(() => mockStore, { getState: () => mockStore }),
}));
import PreferencesScreen from '../../app/profile/preferences';
import EditProfileScreen from '../../app/profile/edit-profile';
let renderer: ReactTestRenderer;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
beforeEach(() => {
  jest.clearAllMocks();
  mockStore.user = initialUser;
  mockStore.accountRevision = 0;
  mockUpdate.mockResolvedValue({ data: { id: initialUser.id } });
  mockRead.mockImplementation(async () => ({
    data: { ...mockStore.user, email: 'qa@example.invalid' },
  }));
});

it.each([
  [PreferencesScreen, 'Save preferences'],
  [EditProfileScreen, 'Save profile'],
] as const)(
  'waits for saved fields instead of saving metadata defaults in %s',
  async (Screen, label) => {
    let finish!: (value: object) => void;
    mockRead.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    await act(async () => {
      renderer = create(<Screen />);
    });
    expect(renderer.root.findAllByProps({ accessibilityLabel: label })).toHaveLength(0);
    await act(async () => {
      finish({
        data: {
          id: 'account-a',
          email: 'qa@example.invalid',
          name: 'Saved name',
          preferences: { vibes: ['foodie'], budget: 'luxury', travelerType: 'family' },
        },
      });
    });
    await act(async () => {
      await renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      label === 'Save profile'
        ? { display_name: 'Saved name' }
        : { preferences: { vibes: ['foodie'], budget: 'luxury', travelerType: 'family' } },
      'account-a'
    );
  }
);

it.each([
  [PreferencesScreen, 'Save preferences'],
  [EditProfileScreen, 'Save profile'],
] as const)(
  'a prior session cannot reconcile profile edits after same-account sign-in in %s',
  async (Screen, label) => {
    let finish!: (value: { data: { id: string } }) => void;
    mockUpdate.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    await act(async () => {
      renderer = create(<Screen />);
    });
    await act(async () => {
      void renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
    });
    mockStore.setUser.mockClear();
    mockStore.accountRevision += 2;
    await act(async () => {
      finish({ data: { id: initialUser.id } });
    });
    expect(mockStore.setUser).not.toHaveBeenCalled();
    expect(mockStore.updatePreferences).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  }
);
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
it('allows saving vibes without manufacturing an invalid empty budget', async () => {
  await act(async () => {
    renderer = create(<PreferencesScreen />);
  });
  await act(async () => {
    await renderer.root.findByProps({ accessibilityLabel: 'Save preferences' }).props.onPress();
  });
  expect(mockUpdate).toHaveBeenCalledWith({ preferences: { vibes: ['cultural'] } }, 'account-a');
  expect(mockStore.updatePreferences).toHaveBeenCalledWith({ vibes: ['cultural'] });
  expect(mockBack).toHaveBeenCalledTimes(1);
});

it('keeps the existing traveler type when saving unrelated vibe and budget preferences', async () => {
  mockStore.user = { ...initialUser, preferences: { vibes: ['cultural'], travelerType: 'family' } };
  await act(async () => {
    renderer = create(<PreferencesScreen />);
  });
  await act(async () => {
    await renderer.root.findByProps({ accessibilityLabel: 'Save preferences' }).props.onPress();
  });
  expect(mockUpdate).toHaveBeenCalledWith(
    { preferences: { vibes: ['cultural'], travelerType: 'family' } },
    'account-a'
  );
});

it.each(['unavailable', 'unreadable', 'wrong owner'])(
  'blocks unsafe editing after %s saved profile and recovers on retry',
  async (scenario) => {
    mockRead.mockResolvedValueOnce(
      scenario === 'unavailable'
        ? { error: 'Network unavailable' }
        : {
            data: {
              ...initialUser,
              email: 'qa@example.invalid',
              ...(scenario === 'unreadable' ? { preferences: { vibes: {} } } : { id: 'account-b' }),
            },
          }
    );
    await act(async () => {
      renderer = create(<PreferencesScreen />);
    });
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Save preferences' })).toHaveLength(
      0
    );
    expect(renderer.root.findByProps({ accessibilityRole: 'alert' }).props.children).toContain(
      'couldn’t load'
    );
    expect(mockUpdate).not.toHaveBeenCalled();
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'Return to Profile' }).props.onPress();
    });
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/profile');
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'Retry saved profile' }).props.onPress();
    });
    expect(renderer.root.findByProps({ accessibilityLabel: 'Save preferences' })).toBeDefined();
  }
);

it.each(['account', 'unmount'])(
  'does not publish a late saved profile after %s boundary',
  async (scenario) => {
    let finish!: (value: object) => void;
    mockRead.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    await act(async () => {
      renderer = create(<EditProfileScreen />);
    });
    if (scenario === 'unmount') await act(async () => renderer.unmount());
    else mockStore.accountRevision += 2;
    await act(async () => {
      finish({ data: { ...initialUser, email: 'qa@example.invalid' } });
    });
    expect(mockStore.setUser).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  }
);
it.each([
  [PreferencesScreen, 'Save preferences'],
  [EditProfileScreen, 'Save profile'],
] as const)('ignores stale saves and prevents duplicate submits in %s', async (Screen, label) => {
  let resolveSave: (value: { data: { id: string } }) => void = () => undefined;
  mockUpdate.mockReturnValue(
    new Promise((resolve) => {
      resolveSave = resolve;
    })
  );
  await act(async () => {
    renderer = create(<Screen />);
  });
  await act(async () => {
    const button = renderer.root.findByProps({ accessibilityLabel: label });
    void button.props.onPress();
    void button.props.onPress();
  });
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  mockStore.setUser.mockClear();
  mockStore.user = { ...initialUser, id: 'account-b', name: 'Bea' };
  await act(async () => {
    resolveSave({ data: { id: 'account-a' } });
  });
  expect(mockStore.setUser).not.toHaveBeenCalled();
  expect(mockStore.updatePreferences).not.toHaveBeenCalled();
  expect(mockBack).not.toHaveBeenCalled();
});

it('lets a traveler clear an optional saved budget and clears the local preference', async () => {
  mockRead.mockResolvedValue({
    data: {
      id: 'account-a',
      email: 'qa@example.invalid',
      name: 'Ada',
      preferences: { vibes: ['culture'], budget: 'moderate', travelerType: 'family' },
    },
  });
  await act(async () => {
    renderer = create(<PreferencesScreen />);
  });
  const label = 'Moderate budget. Balance of comfort & cost';
  await act(async () => {
    renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
  });
  expect(
    renderer.root.findByProps({ accessibilityLabel: label }).props.accessibilityState.selected
  ).toBe(false);
  await act(async () => {
    await renderer.root.findByProps({ accessibilityLabel: 'Save preferences' }).props.onPress();
  });
  expect(mockUpdate).toHaveBeenCalledWith(
    { preferences: { vibes: ['culture'], travelerType: 'family' } },
    'account-a'
  );
  expect(mockStore.updatePreferences).toHaveBeenCalledWith({
    vibes: ['culture'],
    travelerType: 'family',
    budget: undefined,
  });
});
