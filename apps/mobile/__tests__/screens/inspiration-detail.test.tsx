import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockPush = jest.fn();

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  Image: 'Image',
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  Platform: { OS: 'ios', select: (opts: Record<string, unknown>) => opts.ios ?? opts.default },
  Animated: {
    View: 'AnimatedView',
    ScrollView: 'AnimatedScrollView',
    Image: 'AnimatedImage',
    event: () => jest.fn(),
    spring: () => ({ start: jest.fn() }),
    stagger: jest.fn(),
    Value: jest.fn().mockImplementation(() => ({ interpolate: () => 0, setValue: jest.fn() })),
  },
  StyleSheet: { create: (s: unknown) => s },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ slug: 'art-and-culture' }),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('../../hooks/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('../../utils/haptics', () => ({
  hapticFeedback: { light: jest.fn(), medium: jest.fn(), heavy: jest.fn() },
}));

import InspirationDetailScreen from '../../app/inspiration/[slug]';

describe('InspirationDetailScreen canonical vibes & WCAG contrast', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mockPush.mockClear();
  });

  it('passes canonical culture vibes (never cultural) and uses accessible contrast', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<InspirationDetailScreen />);
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).not.toContain('#94a3b8');
    expect(json).not.toContain('#F97066');

    const surpriseBtn = tree.root.findByProps({ accessibilityLabel: 'Find a destination' });
    await act(async () => surpriseBtn.props.onPress());

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/create',
        params: expect.objectContaining({
          vibes: expect.stringContaining('culture'),
        }),
      })
    );
    const passedVibes = mockPush.mock.calls[0][0].params.vibes as string;
    expect(passedVibes).not.toContain('cultural');
    await act(async () => tree.unmount());
  });
});
