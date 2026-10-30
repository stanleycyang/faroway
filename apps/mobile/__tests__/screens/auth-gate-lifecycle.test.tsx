import React from 'react';
import { Modal } from 'react-native';
import { act, create } from 'react-test-renderer';
const mockGoogle = jest.fn();
const mockAlert = jest.fn();
jest.mock('react-native', () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Modal: 'Modal',
  Image: 'Image',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (s: unknown) => s },
  Dimensions: { get: () => ({ height: 800 }) },
  Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
  Linking: { openURL: jest.fn() },
  Platform: { OS: 'ios' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('../../hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('../../components/AuthProvider', () => ({
  useAuthContext: () => ({ signInWithGoogle: mockGoogle, signInWithApple: mockGoogle }),
}));
import { AuthGate } from '../../components/AuthGate';

it('dismissal invalidates late auth callbacks and same-tick provider presses are serialized', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let release!: () => void;
  mockGoogle.mockReturnValue(
    new Promise<void>((resolve) => {
      release = resolve;
    })
  );
  const onClose = jest.fn();
  const onAuthenticated = jest.fn();
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<AuthGate visible onClose={onClose} onAuthenticated={onAuthenticated} />);
    });
    const google = renderer.root.findByProps({ accessibilityLabel: 'Continue with Google' });
    let signing!: Promise<void>;
    await act(async () => {
      signing = google.props.onPress();
      void google.props.onPress();
    });
    expect(mockGoogle).toHaveBeenCalledTimes(1);
    await act(async () => {
      renderer.root.findByType(Modal).props.onRequestClose();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
      await signing;
    });
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockAlert).not.toHaveBeenCalled();
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});

it.each(['hidden', 'changed trip', 'unmounted'])(
  'ignores a provider failure after the sheet is %s',
  async (change) => {
    jest.clearAllMocks();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    let reject!: (error: Error) => void;
    mockGoogle.mockReturnValue(
      new Promise<void>((_resolve, fail) => {
        reject = fail;
      })
    );
    const onClose = jest.fn();
    const onAuthenticated = jest.fn();
    let renderer!: ReturnType<typeof create>;
    const props = {
      visible: true,
      tripPreview: { destination: 'Tokyo', coverImage: '' },
      onClose,
      onAuthenticated,
    };
    try {
      await act(async () => {
        renderer = create(<AuthGate {...props} />);
      });
      let signing!: Promise<void>;
      await act(async () => {
        signing = renderer.root
          .findByProps({ accessibilityLabel: 'Continue with Apple' })
          .props.onPress();
      });
      await act(async () => {
        if (change === 'unmounted') renderer.unmount();
        else
          renderer.update(
            <AuthGate
              {...props}
              visible={change !== 'hidden'}
              tripPreview={{
                destination: change === 'changed trip' ? 'Paris' : 'Tokyo',
                coverImage: '',
              }}
            />
          );
      });
      await act(async () => {
        reject(new Error('Provider unavailable'));
        await signing;
      });
      expect(mockAlert).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(onAuthenticated).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
    }
  }
);

it('a current provider success preserves the generation draft handoff and closes once', async () => {
  jest.clearAllMocks();
  mockGoogle.mockResolvedValue(undefined);
  const onClose = jest.fn();
  const onAuthenticated = jest.fn();
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <AuthGate visible trigger="generate" onClose={onClose} onAuthenticated={onAuthenticated} />
      );
    });
    await act(async () => {
      await renderer.root
        .findByProps({ accessibilityLabel: 'Continue with Google' })
        .props.onPress();
    });
    expect(mockGoogle).toHaveBeenCalledWith({
      redirectTo: '/create/generating',
      preserveTripDraft: true,
    });
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});
