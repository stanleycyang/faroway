import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AFFILIATE_DISCLOSURE_SHORT } from '@faroway/constants';

const mockConfirmAndOpenAffiliateLink = jest.fn();

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  Modal: 'Modal',
  Alert: { alert: jest.fn() },
  Linking: { openURL: jest.fn() },
  Platform: { OS: 'ios' },
  StyleSheet: { create: (s: unknown) => s },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { AUTOMATIC: 'automatic' },
}));
jest.mock('../../utils/haptics', () => ({
  hapticFeedback: { light: jest.fn(), selection: jest.fn() },
}));
jest.mock('../../services/api', () => ({
  isAllowedAffiliateUrl: jest.fn((url: string) => url.startsWith('https://')),
}));
jest.mock('../../lib/affiliateCheckout', () => {
  const actual = jest.requireActual('../../lib/affiliateCheckout');
  return {
    ...actual,
    confirmAndOpenAffiliateLink: (...args: unknown[]) => mockConfirmAndOpenAffiliateLink(...args),
  };
});

import { OnTripCompanionCard } from '../../components/trip/OnTripCompanionCard';
import type { Trip } from '../../lib/tripTypes';

const trip: Trip = {
  id: '11111111-1111-4111-8111-111111111111',
  destination: 'Paris',
  country: 'France',
  startDate: '2099-06-01',
  endDate: '2099-06-04',
  travelers: 2,
  travelerType: 'couple',
  vibes: ['culture'],
  coverImage: '',
  createdAt: '2026-10-01',
  status: 'planned',
  days: [
    {
      dayNumber: 1,
      date: '2099-06-01',
      theme: 'Museums',
      activities: [
        {
          id: 'act-louvre',
          time: 'Morning',
          title: 'Louvre Museum',
          description: 'Art collection',
          location: 'Paris',
          duration: '2 hours',
          type: 'attraction',
          price: 'USD 30',
          bookingUrl: 'https://www.viator.com/tours/Paris/Louvre',
          affiliatePartner: 'viator',
        },
      ],
    },
  ],
};

describe('OnTripCompanionCard monetization & essentials', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
  });

  it('wires direct partner handoff on flagged readiness stops and Trip Essentials with FTC disclosure', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <OnTripCompanionCard
          trip={trip}
          selectedDayIndex={0}
          scheduleShiftMinutes={0}
          onShiftSchedule={jest.fn()}
          onTriggerRainSwap={jest.fn()}
        />
      );
    });

    const toggleChecklist = tree.root.findByProps({
      accessibilityLabel: 'View advance-booking checklist',
    });
    await act(async () => toggleChecklist.props.onPress());

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Trip essentials');
    expect(json).toContain('Airalo');
    expect(json).toContain('SafetyWing');
    expect(json).toContain(AFFILIATE_DISCLOSURE_SHORT);

    const stopBtn = tree.root.findByProps({
      accessibilityLabel: 'Check options for Louvre Museum',
    });
    await act(async () => stopBtn.props.onPress());
    expect(mockConfirmAndOpenAffiliateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'act-louvre',
        affiliatePartner: 'viator',
        affiliateUrl: 'https://www.viator.com/tours/Paris/Louvre',
      }),
      expect.any(Function)
    );

    const insuranceBtn = tree.root.findByProps({
      accessibilityLabel: 'Travel medical coverage via SafetyWing',
    });
    await act(async () => insuranceBtn.props.onPress());
    expect(mockConfirmAndOpenAffiliateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        affiliatePartner: 'safetywing',
        affiliateUrl: 'https://safetywing.com/nomad-insurance',
      }),
      expect.any(Function)
    );

    await act(async () => tree.unmount());
  });
});
