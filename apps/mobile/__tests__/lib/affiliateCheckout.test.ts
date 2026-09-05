const mockAlert = jest.fn();

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Alert: {
    alert: mockAlert,
  },
}));

jest.mock('../../constants/api', () => ({ API_BASE_URL: 'https://api.faroway.example' }));

jest.mock('../../services/api', () => ({
  isAllowedAffiliateUrl: jest.fn(
    (url: string, partner: string) =>
      url.startsWith('https://booking.com') && partner.toLowerCase().startsWith('booking')
  ),
  openAffiliateLink: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../utils/haptics', () => ({
  hapticFeedback: {
    light: jest.fn(),
    warning: jest.fn(),
  },
}));

import { openAffiliateLink } from '../../services/api';
import { Platform } from 'react-native';
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
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const webConfirm = jest.fn();
  const webAlert = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { confirm: webConfirm, alert: webAlert },
    });
  });
  afterEach(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  });

  const webParams = {
    itemType: 'hotel' as const,
    itemId: 'hotel-1',
    itemName: 'Hotel One',
    affiliatePartner: 'booking',
    affiliateUrl: 'https://booking.com/hotel/1',
    priceLabel: '$240/night estimate',
    price: 240,
    source: 'itinerary' as const,
  };

  it.each([true, false])(
    'web confirmation %s opens a tracked link synchronously only on acceptance',
    (accepted) => {
      Platform.OS = 'web';
      webConfirm.mockReturnValueOnce(accepted);
      const openUrl = jest.fn();
      confirmAndOpenAffiliateLink(webParams, openUrl);
      expect(webConfirm).toHaveBeenCalledWith(
        expect.stringContaining('Faroway may earn a commission')
      );
      expect(mockAlert).not.toHaveBeenCalled();
      expect(openAffiliateLink).not.toHaveBeenCalled();
      expect(openUrl).toHaveBeenCalledTimes(accepted ? 1 : 0);
      if (accepted) {
        const url = new URL(openUrl.mock.calls[0][0]);
        expect(url.origin + url.pathname).toBe('https://api.faroway.example/api/track/click');
        expect(url.searchParams.get('affiliateUrl')).toBe(webParams.affiliateUrl);
        expect(url.searchParams.get('itemId')).toBe('hotel-1');
        expect(url.searchParams.get('price')).toBe('240');
        expect(url.searchParams.has('priceLabel')).toBe(false);
      }
    }
  );

  it('web rejects an invalid link before confirmation and navigation', () => {
    Platform.OS = 'web';
    const openUrl = jest.fn();
    confirmAndOpenAffiliateLink(
      { ...webParams, affiliateUrl: 'https://untrusted.example/' },
      openUrl
    );
    expect(webAlert).toHaveBeenCalledWith(expect.stringContaining('could not be verified'));
    expect(webConfirm).not.toHaveBeenCalled();
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('does not open links during web server rendering', () => {
    Platform.OS = 'web';
    Reflect.deleteProperty(globalThis, 'window');
    const openUrl = jest.fn();
    expect(() => confirmAndOpenAffiliateLink(webParams, openUrl)).not.toThrow();
    expect(openUrl).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('normalizes common affiliate partner names', () => {
    expect(formatAffiliatePartnerName('booking')).toBe('Booking.com');
    expect(formatAffiliatePartnerName('Booking.com')).toBe('Booking.com');
    expect(formatAffiliatePartnerName('opentable')).toBe('OpenTable');
  });

  it('maps rendered itinerary activity types to affiliate tracking item types', () => {
    expect(itemTypeForAffiliateActivityType('accommodation')).toBe('hotel');
    expect(itemTypeForAffiliateActivityType('restaurant')).toBe('restaurant');
    expect(itemTypeForAffiliateActivityType('transport')).toBe('transport');
    expect(itemTypeForAffiliateActivityType('experience')).toBe('activity');
  });

  it('maps generic booking providers to affiliate tracking item types', () => {
    expect(itemTypeForAffiliatePartner('Booking.com')).toBe('hotel');
    expect(itemTypeForAffiliatePartner('OpenTable')).toBe('restaurant');
    expect(itemTypeForAffiliatePartner('Duffel')).toBe('transport');
    expect(itemTypeForAffiliatePartner('Viator')).toBe('activity');
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
      affiliatePartner: 'booking',
      priceLabel: '$240/night estimate',
      cancellationLabel: 'Room rules are confirmed by Booking.com.',
    });

    expect(copy.title).toBe('Continue to Booking.com?');
    expect(copy.message).toContain('Hotel One');
    expect(copy.message).toContain('Partner: Booking.com');
    expect(copy.message).toContain('Estimated price: $240/night estimate');
    expect(copy.message).toContain('Room rules are confirmed by Booking.com.');
    expect(copy.message).toContain('Faroway may earn a commission at no extra cost');
    expect(copy.message).toContain('Availability, payment, and booking changes happen');
  });

  it('opens only after the user confirms', () => {
    const openUrl = jest.fn();

    confirmAndOpenAffiliateLink(
      {
        itemType: 'hotel',
        itemId: 'hotel-1',
        itemName: 'Hotel One',
        affiliatePartner: 'booking',
        affiliateUrl: 'https://booking.com/hotel/1',
        price: 240,
        priceLabel: '$240/night estimate',
        cancellationLabel: 'Room rules are confirmed by Booking.com.',
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
        affiliatePartner: 'booking',
        affiliateUrl: 'https://booking.com/hotel/1',
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
        affiliatePartner: 'booking',
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

  it('blocks a valid domain when it does not match the selected partner', () => {
    confirmAndOpenAffiliateLink(
      {
        itemType: 'activity',
        itemId: 'tour-1',
        itemName: 'Tour One',
        affiliatePartner: 'viator',
        affiliateUrl: 'https://booking.com/hotel/1',
        source: 'itinerary',
      },
      jest.fn()
    );

    expect(hapticFeedback.warning).toHaveBeenCalledTimes(1);
    expect(openAffiliateLink).not.toHaveBeenCalled();
  });
});
