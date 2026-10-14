import React from 'react';
import { act, create } from 'react-test-renderer';
import { PlacesAutocomplete } from '../../components/ui';
let mockRevision = 0;
let mockUser: { id: string } | null = null;
const mockClearDraft = jest.fn();
jest.mock('../../stores/userStore', () => ({
  useUserStore: Object.assign(
    (select: (value: unknown) => unknown) => select({ accountRevision: mockRevision }),
    { getState: () => ({ user: mockUser, accountRevision: mockRevision }) }
  ),
}));
let mockDraft: { travelers: number; destination?: string; country?: string } = { travelers: 2 };
const mockSetDraft = jest.fn((changes: Partial<typeof mockDraft>) => {
  mockDraft = { ...mockDraft, ...changes };
});
jest.mock('../../stores/tripStore', () => ({
  useTripStore: Object.assign(() => ({ draftInput: mockDraft, setDraftInput: mockSetDraft }), {
    getState: () => ({ draftInput: mockDraft, clearDraft: mockClearDraft }),
  }),
}));
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  Image: 'Image',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'ios' },
  Alert: { alert: jest.fn() },
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('../../components/ui', () => ({
  Button: 'Button',
  PlacesAutocomplete: 'PlacesAutocomplete',
  DateRangePicker: 'DateRangePicker',
  VibeSelector: 'VibeSelector',
}));
jest.mock('../../stores/promptStore', () => ({
  usePromptStore: () => ({
    tripGenerationCount: 0,
    hasDismissedCreateBanner: true,
    dismissCreateBanner: jest.fn(),
  }),
}));
jest.mock('../../components/AuthProvider', () => ({
  useAuthContext: () => ({ isAuthenticated: !!mockUser, user: mockUser }),
}));
jest.mock('../../components/AuthGate', () => ({ AuthGate: () => null }));
jest.mock('../../lib/tripCreationRecovery', () => ({
  savedTripCreationDraft: jest.fn(),
  discardReviewedTripCreation: jest.fn(),
  readTripCreationReceipt: jest.fn(async () => 'reviewed-receipt'),
}));
jest.mock('../../utils/haptics', () => ({
  hapticFeedback: { selection: jest.fn(), light: jest.fn(), error: jest.fn(), success: jest.fn() },
}));
import CreateTripScreen from '../../app/create';

it('reopening an existing brief shows its destination and permits a deliberate change', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockDraft = { travelers: 4, destination: 'Tokyo', country: 'Japan' };
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<CreateTripScreen />);
    });
    expect(renderer.root.findAllByType(PlacesAutocomplete)).toHaveLength(0);
    const change = renderer.root.findByProps({
      accessibilityLabel: 'Change destination from Tokyo, Japan',
    });
    await act(async () => change.props.onPress());
    expect(renderer.root.findAllByType(PlacesAutocomplete)).toHaveLength(1);
    expect(mockDraft.destination).toBe('Tokyo');
  } finally {
    await act(async () => renderer?.unmount());
    mockDraft = { travelers: 2 };
  }
});

it.each([
  { start: 2, label: 'Add one traveler', expected: 4 },
  { start: 9, label: 'Add one traveler', expected: 10 },
  { start: 2, label: 'Remove one traveler', expected: 1 },
])(
  'rapid native traveler presses preserve count and bounds: %j',
  async ({ start, label, expected }) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mockDraft = { travelers: start };
    mockSetDraft.mockClear();
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<CreateTripScreen />);
      });
      await act(async () => {
        const press = renderer.root.findByProps({ accessibilityLabel: label }).props.onPress;
        press();
        press();
      });
      expect(mockDraft.travelers).toBe(expected);
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
    }
  }
);

import { Alert } from 'react-native';
import {
  discardReviewedTripCreation,
  savedTripCreationDraft,
} from '../../lib/tripCreationRecovery';
it.each(['same-owner reauthentication', 'unmount', 'confirmed', 'changed receipt'])(
  'fresh-trip confirmation handles %s',
  async (scenario) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    mockUser = { id: 'account-a' };
    mockRevision = 0;
    jest.mocked(savedTripCreationDraft).mockResolvedValue(null);
    jest.mocked(discardReviewedTripCreation).mockResolvedValue(undefined);
    if (scenario === 'changed receipt')
      jest
        .mocked(discardReviewedTripCreation)
        .mockRejectedValue(new Error('Your pending trip changed. Review it again.'));
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<CreateTripScreen />);
      });
      await act(async () => {
        renderer.root.findByProps({ accessibilityLabel: 'Start a new trip' }).props.onPress();
      });
      const confirm = jest.mocked(Alert.alert).mock.calls[0][2]![1].onPress!;
      if (scenario === 'same-owner reauthentication')
        await act(async () => {
          mockRevision += 2;
          renderer.update(<CreateTripScreen />);
        });
      if (scenario === 'unmount')
        await act(async () => {
          renderer.unmount();
        });
      await act(async () => {
        confirm();
        confirm();
      });
      if (scenario === 'confirmed') {
        expect(discardReviewedTripCreation).toHaveBeenCalledTimes(1);
        expect(discardReviewedTripCreation).toHaveBeenCalledWith('account-a', 'reviewed-receipt');
        expect(mockClearDraft).toHaveBeenCalledTimes(1);
      } else if (scenario === 'changed receipt') {
        expect(discardReviewedTripCreation).toHaveBeenCalledTimes(1);
        expect(mockClearDraft).not.toHaveBeenCalled();
        expect(Alert.alert).toHaveBeenLastCalledWith(
          'Could not clear pending trip',
          'Your pending trip changed. Review it again.'
        );
      } else {
        expect(discardReviewedTripCreation).not.toHaveBeenCalled();
        expect(mockClearDraft).not.toHaveBeenCalled();
      }
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      mockUser = null;
      mockRevision = 0;
    }
  }
);

import { readTripCreationReceipt } from '../../lib/tripCreationRecovery';
it.each(['receipt read', 'discard'])(
  'late %s cannot act after revision changes before a render',
  async (phase) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    mockUser = { id: 'account-a' };
    mockRevision = 0;
    jest.mocked(savedTripCreationDraft).mockResolvedValue(null);
    let release!: (value: string | null) => void;
    const delayed = new Promise<string | null>((yes) => {
      release = yes;
    });
    jest
      .mocked(readTripCreationReceipt)
      .mockImplementation(() =>
        phase === 'receipt read' ? delayed : Promise.resolve('reviewed-receipt')
      );
    jest.mocked(discardReviewedTripCreation).mockImplementation(async () => {
      if (phase === 'discard') await delayed;
    });
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<CreateTripScreen />);
      });
      await act(async () => {
        void renderer.root.findByProps({ accessibilityLabel: 'Start a new trip' }).props.onPress();
      });
      if (phase === 'discard')
        await act(async () => {
          jest.mocked(Alert.alert).mock.calls[0][2]![1].onPress!();
        });
      mockRevision += 2;
      await act(async () => {
        release('reviewed-receipt');
      });
      expect(mockClearDraft).not.toHaveBeenCalled();
      if (phase === 'receipt read') expect(Alert.alert).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      mockUser = null;
      mockRevision = 0;
      jest.mocked(readTripCreationReceipt).mockResolvedValue('reviewed-receipt');
      jest.mocked(discardReviewedTripCreation).mockResolvedValue(undefined);
    }
  }
);

it('failed receipt read preserves the draft and permits a later review', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.clearAllMocks();
  mockUser = { id: 'account-a' };
  mockRevision = 0;
  jest.mocked(savedTripCreationDraft).mockResolvedValue(null);
  jest
    .mocked(readTripCreationReceipt)
    .mockReset()
    .mockRejectedValueOnce(new Error('Storage failed'))
    .mockResolvedValue('reviewed-receipt');
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<CreateTripScreen />);
    });
    await act(async () => {
      await renderer.root.findByProps({ accessibilityLabel: 'Start a new trip' }).props.onPress();
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('Your pending request couldn’t be checked');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockClearDraft).not.toHaveBeenCalled();
    await act(async () => {
      await renderer.root.findByProps({ accessibilityLabel: 'Start a new trip' }).props.onPress();
    });
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    await act(async () => {
      mockRevision += 2;
      renderer.update(<CreateTripScreen />);
    });
    expect(JSON.stringify(renderer.toJSON())).not.toContain(
      'Your pending request couldn’t be checked'
    );
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    mockUser = null;
    mockRevision = 0;
  }
});
