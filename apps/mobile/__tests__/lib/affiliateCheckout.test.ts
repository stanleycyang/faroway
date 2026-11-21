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

import { AFFILIATE_DISCLOSURE_SHORT } from '@faroway/constants';
import { openAffiliateLink } from '../../services/api';
import {
  buildAffiliateCheckoutCopy,
  confirmAndOpenAffiliateLink,
  formatAffiliatePartnerName,
  getBookableItemContextLabel,
  itemTypeForAffiliateActivityType,
  itemTypeForAffiliatePartner,
  resolveAffiliatePartnerForItem,
} from '../../lib/affiliateCheckout';
import { hapticFeedback } from '../../utils/haptics';

describe('affiliate checkout confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes common affiliate partner names across all partners', () => {
    expect(formatAffiliatePartnerName('viator')).toBe('Viator');
    expect(formatAffiliatePartnerName('Viator')).toBe('Viator');
    expect(formatAffiliatePartnerName('opentable')).toBe('OpenTable');
    expect(formatAffiliatePartnerName('stay22')).toBe('Stay22');
    expect(formatAffiliatePartnerName('booking')).toBe('Booking.com');
    expect(formatAffiliatePartnerName('safetywing')).toBe('SafetyWing');
    expect(formatAffiliatePartnerName('airalo')).toBe('Airalo');
    expect(formatAffiliatePartnerName('travelpayouts')).toBe('Travelpayouts');
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
    expect(itemTypeForAffiliatePartner('stay22')).toBe('hotel');
    expect(itemTypeForAffiliatePartner('booking')).toBe('hotel');
    expect(itemTypeForAffiliatePartner('expedia')).toBe('hotel');
    expect(itemTypeForAffiliatePartner('hostelworld')).toBe('hotel');
    expect(itemTypeForAffiliatePartner('discovercars')).toBe('transport');
    expect(itemTypeForAffiliatePartner('skyscanner')).toBe('flight');
    expect(itemTypeForAffiliatePartner('unknown-provider')).toBe('activity');
  });

  it('resolves partner from explicit alias or URL fallback', () => {
    expect(resolveAffiliatePartnerForItem('https://www.stay22.com/embed/gm', 'gyg')).toBe(
      'getyourguide'
    );
    expect(resolveAffiliatePartnerForItem('https://www.booking.com/hotel/fr/test.html')).toBe(
      'booking'
    );
    expect(resolveAffiliatePartnerForItem('https://www.airalo.com/')).toBe('airalo');
  });

  it('labels sheet-level booking items without exposing day zero', () => {
    expect(getBookableItemContextLabel(2, 'activity')).toBe('Day 2');
    expect(getBookableItemContextLabel(0, 'accommodation')).toBe('Hotel stay');
    expect(getBookableItemContextLabel(0, 'transport')).toBe('Transport');
    expect(getBookableItemContextLabel(0, 'activity')).toBe('Trip option');
  });

  it('builds copy with partner, price, cancellation, next step context, and FTC disclosure', () => {
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
    expect(copy.message).toContain(AFFILIATE_DISCLOSURE_SHORT);
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
