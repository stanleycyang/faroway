import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { proposedVisitNote } from '@faroway/types';
import { ActivityCardSchema, RestaurantCardSchema } from '../../lib/json-render/catalog';
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  TouchableOpacity: 'Button',
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn().mockResolvedValue({ type: 'cancel' }),
}));
jest.mock('../../lib/savedTripBooking', () => ({ reviewSavedTripBooking: jest.fn() }));
import { ActivityCard, RestaurantCard } from '../../lib/json-render/registry';
import * as WebBrowser from 'expo-web-browser';

const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousActEnvironment = environment.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => {
  environment.IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  environment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

it.each(['ordinary_entry', 'exterior_walk', 'guided_tour', 'event', 'unknown'])(
  'renders shared confirmation text for streamed %s',
  (proposedVisitType) => {
    const props = ActivityCardSchema.parse({
      name: 'Visit',
      description: 'Explore',
      duration: '1 hour',
      time: 'Morning',
      proposedVisitType,
    });
    let tree: ReactTestRenderer | undefined;
    act(() => {
      tree = create(<ActivityCard {...props} />);
    });
    expect(JSON.stringify(tree!.toJSON())).toContain(proposedVisitNote(proposedVisitType));
    act(() => tree!.unmount());
  }
);

it('retains source attribution through the streamed meal schema and opens only on tap', async () => {
  jest.clearAllMocks();
  const source = { url: 'https://example.org/cafe', retrievedOn: '2026-11-02' };
  const props = RestaurantCardSchema.parse({ name: 'Cafe', cuisine: 'Local', source });
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(<RestaurantCard {...props} />);
  });
  const content = JSON.stringify(tree!.toJSON());
  expect(content).toContain('View source');
  expect(content).toContain(source.retrievedOn);
  expect(content).toContain('Confirm opening hours and availability');
  expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  const link = tree!.root.findByProps({ accessibilityRole: 'link' });
  await act(async () => {
    await link.props.onPress();
  });
  expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(source.url);
  act(() => tree!.unmount());
});

it('does not render malformed source metadata as a clickable attribution', () => {
  const props = RestaurantCardSchema.parse({
    name: 'Cafe',
    cuisine: 'Local',
    source: { url: 'https://example.org', retrievedOn: '2026-02-30' },
  });
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(<RestaurantCard {...props} />);
  });
  expect(tree!.root.findAllByProps({ accessibilityRole: 'link' })).toHaveLength(0);
  act(() => tree!.unmount());
});
