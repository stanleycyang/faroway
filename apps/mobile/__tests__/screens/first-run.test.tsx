import React from 'react';
import { act, create } from 'react-test-renderer';
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockComplete = jest.fn();
let mockState = {
  hasCompletedOnboarding: false,
  isAuthenticated: false,
  setOnboardingComplete: mockComplete,
};
jest.mock('../../stores/userStore', () => ({
  useUserStore: (select?: (s: typeof mockState) => unknown) =>
    select ? select(mockState) : mockState,
}));
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  ScrollView: 'ScrollView',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
  useWindowDimensions: () => ({ height: 800 }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 44 }),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../components/ui/Button', () => ({ Button: 'Button' }));
jest.mock('../../components/VenuePhotoCredit', () => ({ VenuePhotoCredit: 'Credit' }));
import Welcome from '../../app/index';
import Onboarding from '../../app/onboarding';
import { firstRunDestinations } from '../../lib/firstRunDestinations';
import { tripInputFromLink } from '../../lib/tripLinkInput';
let renderer: ReturnType<typeof create>;
beforeEach(() => {
  jest.clearAllMocks();
  mockState = { ...mockState, hasCompletedOnboarding: false, isAuthenticated: false };
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});
async function render(screen: React.ReactElement) {
  await act(async () => {
    renderer = create(screen);
  });
}
it('lets a first-time guest start planning without completing onboarding prematurely', async () => {
  await render(<Welcome />);
  await act(async () => renderer.root.findByProps({ title: 'Plan my trip' }).props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith('/onboarding');
  expect(mockComplete).not.toHaveBeenCalled();
});
it('allows exploration without an account', async () => {
  await render(<Welcome />);
  await act(async () =>
    renderer.root.findByProps({ title: 'Explore destinations' }).props.onPress()
  );
  expect(mockComplete).toHaveBeenCalledWith(true);
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
});
it('lets returning guests go directly to their planner and existing users sign in', async () => {
  mockState.hasCompletedOnboarding = true;
  await render(<Welcome />);
  await act(async () => renderer.root.findByProps({ title: 'Plan my trip' }).props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith('/create');
  await act(async () =>
    renderer.root.findByProps({ title: 'Already have an account? Sign in' }).props.onPress()
  );
  expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/login');
});
it('takes returning signed-in users to the app', async () => {
  mockState.hasCompletedOnboarding = true;
  mockState.isAuthenticated = true;
  await render(<Welcome />);
  expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
});
it.each(firstRunDestinations)(
  'passes $name into the existing planner contract',
  async (destination) => {
    await render(<Onboarding />);
    await act(async () =>
      renderer.root
        .findByProps({
          accessibilityLabel: `Plan a trip to ${destination.name}, ${destination.country}`,
        })
        .props.onPress()
    );
    expect(mockComplete).toHaveBeenCalledWith(true);
    const route = mockRouter.replace.mock.calls[0][0];
    expect(route.pathname).toBe('/create');
    expect(tripInputFromLink(route.params)).toEqual({
      destination: destination.name,
      country: destination.country,
    });
  }
);
it('supports a custom destination without selecting a suggestion', async () => {
  await render(<Onboarding />);
  await act(async () =>
    renderer.root.findByProps({ title: 'Find my destination' }).props.onPress()
  );
  expect(mockRouter.replace).toHaveBeenCalledWith('/create');
  expect(mockComplete).toHaveBeenCalledWith(true);
});
it('ships all first-run photography locally with attribution', () => {
  for (const destination of firstRunDestinations) {
    expect(typeof destination.source).toBe('number');
    expect(destination.credit.sourceUrl).toMatch(/^https:/);
    expect(destination.credit.licenseUrl).toMatch(/^https:/);
  }
});
