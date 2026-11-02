import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { proposedVisitNote } from '@faroway/types';
import { ActivityCardSchema } from '../../lib/json-render/catalog';
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  TouchableOpacity: 'Button',
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('../../lib/savedTripBooking', () => ({ reviewSavedTripBooking: jest.fn() }));
import { ActivityCard } from '../../lib/json-render/registry';

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
