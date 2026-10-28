const mockAlert = jest.fn();

jest.mock('react-native', () => ({
  Alert: {
    alert: mockAlert,
  },
}));

jest.mock('../../services/api', () => ({
  isAllowedAffiliateUrl: jest.fn((url: string) => url.startsWith('https://viator.com')),
  openAffiliateLink: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../utils/haptics', () => ({
  hapticFeedback: {
    light: jest.fn(),
    warning: jest.fn(),
  },
}));

import { openAffiliateLink } from '../../services/api';
import {
  buildAffiliateCheckoutCopy,
  confirmAndOpenAffiliateLink,
  formatAffiliatePartnerName,
  getBookableItemContextLabel,
  itemTypeForAffiliateActivityType,
  itemTypeForAffiliatePartner,
} from '../../lib/affiliateCheckout';
import { hapticFeedback } from '../../utils/haptics';

describe('affiliate checkout confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes common affiliate partner names', () => {
    expect(formatAffiliatePartnerName('viator')).toBe('Viator');
    expect(formatAffiliatePartnerName('Viator')).toBe('Viator');
    expect(formatAffiliatePartnerName('opentable')).toBe('OpenTable');
  });

  it('maps rendered itinerary activity types to affiliate tracking item types', () => {
    expect(itemTypeForAffiliateActivityType('accommodation')).toBe('hotel');
    expect(itemTypeForAffiliateActivityType('restaurant')).toBe('restaurant');
    expect(itemTypeForAffiliateActivityType('transport')).toBe('transport');
    expect(itemTypeForAffiliateActivityType('experience')).toBe('activity');
  });

  it('maps generic booking providers to affiliate tracking item types', () => {
    expect(itemTypeForAffiliatePartner('Viator')).toBe('activity');
    expect(itemTypeForAffiliatePartner('OpenTable')).toBe('restaurant');
    expect(itemTypeForAffiliatePartner('Duffel')).toBe('transport');
    expect(itemTypeForAffiliatePartner('unknown-provider')).toBe('activity');
  });

  it('labels sheet-level booking items without exposing day zero', () => {
    expect(getBookableItemContextLabel(2, 'activity')).toBe('Day 2');
    expect(getBookableItemContextLabel(0, 'accommodation')).toBe('Hotel stay');
    expect(getBookableItemContextLabel(0, 'transport')).toBe('Transport');
    expect(getBookableItemContextLabel(0, 'activity')).toBe('Trip option');
  });

  it('builds copy with partner, price, cancellation, and next step context', () => {
    const copy = buildAffiliateCheckoutCopy({
      itemName: 'Hotel One',
      affiliatePartner: 'viator',
      priceLabel: '$240/night estimate',
      cancellationLabel: 'Room rules are confirmed by Viator.',
    });

    expect(copy.title).toBe('Continue to Viator?');
    expect(copy.message).toContain('Hotel One');
    expect(copy.message).toContain('Partner: Viator');
    expect(copy.message).toContain('Estimated price: $240/night estimate');
    expect(copy.message).toContain('Room rules are confirmed by Viator.');
    expect(copy.message).toContain('Availability, payment, and booking changes happen');
  });

  it('opens only after the user confirms', () => {
    const openUrl = jest.fn();

    confirmAndOpenAffiliateLink(
      {
        itemType: 'hotel',
        itemId: 'hotel-1',
        itemName: 'Hotel One',
        affiliatePartner: 'viator',
        affiliateUrl: 'https://viator.com/hotel/1',
        price: 240,
        priceLabel: '$240/night estimate',
        cancellationLabel: 'Room rules are confirmed by Viator.',
        source: 'itinerary',
      },
      openUrl
    );

    expect(hapticFeedback.light).toHaveBeenCalledTimes(1);
    expect(openAffiliateLink).not.toHaveBeenCalled();

    const buttons = mockAlert.mock.calls[0][2];
    buttons?.[1]?.onPress?.();

    expect(openAffiliateLink).toHaveBeenCalledWith(
      {
        itemType: 'hotel',
        itemId: 'hotel-1',
        itemName: 'Hotel One',
        affiliatePartner: 'viator',
        affiliateUrl: 'https://viator.com/hotel/1',
        price: 240,
        source: 'itinerary',
      },
      openUrl
    );
  });

  it('blocks unverified partner links before confirmation', () => {
    const openUrl = jest.fn();

    confirmAndOpenAffiliateLink(
      {
        itemType: 'hotel',
        itemId: 'hotel-1',
        itemName: 'Hotel One',
        affiliatePartner: 'viator',
        affiliateUrl: 'https://example.com/hotel/1',
        source: 'itinerary',
      },
      openUrl
    );

    expect(hapticFeedback.warning).toHaveBeenCalledTimes(1);
    expect(mockAlert).toHaveBeenCalledWith(
      'Partner Link Unavailable',
      expect.stringContaining('could not be verified')
    );
    expect(openAffiliateLink).not.toHaveBeenCalled();
  });
});
