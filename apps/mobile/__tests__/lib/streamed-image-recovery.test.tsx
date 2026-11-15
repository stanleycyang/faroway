import React from 'react';
import { act, create } from 'react-test-renderer';
import { Image, Text } from 'react-native';
let mockListener: ((state: { status: string }) => void) | undefined;
jest.mock('../../lib/offline/network', () => ({
  networkMonitor: {
    subscribe: (callback: typeof mockListener) => {
      mockListener = callback;
      callback?.({ status: 'offline' });
      return jest.fn();
    },
  },
}));
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  TouchableOpacity: 'Button',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {}, absoluteFillObject: {} },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('../../lib/savedTripBooking', () => ({ reviewSavedTripBooking: jest.fn() }));
import { HeroImage, HotelCard, ActivityCard, RestaurantCard } from '../../lib/json-render/registry';
const url = 'https://images.example.test/venue.jpg';
it.each([
  ['hero', <HeroImage url={url} alt="Destination" />],
  ['hotel', <HotelCard name="Hotel" amenities={[]} image={url} />],
  [
    'activity',
    <ActivityCard name="Museum" description="Visit" time="Morning" duration="1 hour" image={url} />,
  ],
  ['restaurant', <RestaurantCard name="Restaurant" cuisine="Local" image={url} />],
] as const)('recovers the streamed %s photo without remounting its card', async (_, card) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let screen!: ReturnType<typeof create>;
  try {
    await act(async () => {
      screen = create(card);
    });
    await act(async () =>
      screen.root.findByType(Image).props.onError({ nativeEvent: { error: 'offline' } })
    );
    expect(screen.root.findAllByType(Image)).toHaveLength(0);
    expect(
      screen.root.findAllByType(Text).some((node) => node.props.children === 'Photo unavailable')
    ).toBe(true);
    await act(async () => mockListener?.({ status: 'online' }));
    expect(screen.root.findByType(Image).props.source.uri).toBe(url);
  } finally {
    await act(async () => screen?.unmount());
  }
});
