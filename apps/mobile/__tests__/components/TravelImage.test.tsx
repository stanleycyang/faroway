let mockNetworkListener: ((state: { status: string }) => void) | undefined;
const mockUnsubscribe = jest.fn();
jest.mock('../../lib/offline/network', () => ({
  networkMonitor: {
    subscribe: jest.fn((listener) => {
      mockNetworkListener = listener;
      listener({ status: 'online' });
      return mockUnsubscribe;
    }),
  },
}));
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Image, Text } from 'react-native';
import { TravelImage } from '../../components/ui/TravelImage';
jest.mock('react-native', () => ({
  Image: 'Image',
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {}, absoluteFillObject: {} },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
it('renders missing photos, handles errors, and recovers for a new URL', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let screen!: ReturnType<typeof create>;
  try {
    await act(async () => {
      screen = create(<TravelImage source={{ uri: '' }} />);
    });
    expect(screen.root.findAllByType(Image)).toHaveLength(0);
    expect(screen.root.findByType(Text).props.children).toBe('Photo unavailable');
    await act(async () => {
      screen.update(<TravelImage source={{ uri: 'https://example.test/one.jpg' }} />);
    });
    await act(async () => {
      screen.root.findByType(Image).props.onError({ nativeEvent: { error: 'offline' } });
    });
    expect(screen.root.findAllByType(Image)).toHaveLength(0);
    await act(async () => {
      screen.update(<TravelImage source={{ uri: 'https://example.test/two.jpg' }} />);
    });
    expect(screen.root.findByType(Image).props.source.uri).toBe('https://example.test/two.jpg');
    await act(async () => {
      screen.root.findByType(Image).props.onError({ nativeEvent: { error: 'offline' } });
    });
    await act(async () => {
      screen.update(<TravelImage source={42} />);
    });
    expect(screen.root.findByType(Image).props.source).toBe(42);
    await act(async () => {
      screen.root.findByType(Image).props.onError({ nativeEvent: { error: 'missing asset' } });
    });
    const sources = [{ uri: 'https://example.test/three.jpg' }];
    await act(async () => {
      screen.update(<TravelImage source={sources} />);
    });
    expect(screen.root.findByType(Image).props.source).toEqual(sources);
  } finally {
    await act(async () => screen?.unmount());
  }
});

it('retries a failed image once connectivity returns, without looping on online errors', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockUnsubscribe.mockClear();
  let screen!: ReturnType<typeof create>;
  try {
    await act(async () => {
      screen = create(<TravelImage source={{ uri: 'https://example.test/retry.jpg' }} />);
    });
    await act(async () => {
      screen.root.findByType(Image).props.onError({ nativeEvent: { error: 'offline' } });
    });
    expect(screen.root.findAllByType(Image)).toHaveLength(0);
    await act(async () => mockNetworkListener?.({ status: 'online' }));
    expect(screen.root.findAllByType(Image)).toHaveLength(0);
    await act(async () => mockNetworkListener?.({ status: 'offline' }));
    await act(async () => mockNetworkListener?.({ status: 'online' }));
    expect(screen.root.findAllByType(Image)).toHaveLength(1);
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => screen?.unmount());
  }
});

it('preserves an explicit photo label and announces when that photo is unavailable', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let screen!: ReturnType<typeof create>;
  try {
    await act(async () => {
      screen = create(
        <TravelImage
          source={{ uri: 'https://example.test/hero.jpg' }}
          accessibilityLabel="Lisbon riverfront"
        />
      );
    });
    expect(screen.root.findByProps({ accessibilityRole: 'image' }).props.accessible).toBe(true);
    await act(async () =>
      screen.root.findByType(Image).props.onError({ nativeEvent: { error: 'offline' } })
    );
    expect(screen.root.findByProps({ accessibilityRole: 'image' }).props.accessibilityLabel).toBe(
      'Lisbon riverfront. Photo unavailable'
    );
  } finally {
    await act(async () => screen?.unmount());
  }
});
