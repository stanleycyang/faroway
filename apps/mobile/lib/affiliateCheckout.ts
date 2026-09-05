import { Alert, Platform } from 'react-native';
import { isAllowedAffiliateUrl, openAffiliateLink, type TrackClickParams } from '../services/api';
import { hapticFeedback } from '../utils/haptics';
import { API_BASE_URL } from '../constants/api';

const PARTNER_NAMES: Record<string, string> = {
  booking: 'Booking.com',
  bookingcom: 'Booking.com',
  viator: 'Viator',
  getyourguide: 'GetYourGuide',
  tripadvisor: 'Tripadvisor',
  opentable: 'OpenTable',
  duffel: 'Duffel',
};

export const AFFILIATE_DISCLOSURE =
  'Affiliate link: Faroway may earn a commission at no extra cost to you.';

interface CheckoutCopyInput {
  itemName: string;
  affiliatePartner: string;
  priceLabel?: string;
  cancellationLabel?: string;
}

export interface ConfirmAffiliateOpenParams extends TrackClickParams {
  priceLabel?: string;
  cancellationLabel?: string;
}

export function itemTypeForAffiliateActivityType(
  activityType: string
): TrackClickParams['itemType'] {
  switch (activityType) {
    case 'accommodation':
      return 'hotel';
    case 'restaurant':
      return 'restaurant';
    case 'transport':
      return 'transport';
    default:
      return 'activity';
  }
}

export function itemTypeForAffiliatePartner(partner: string): TrackClickParams['itemType'] {
  const normalized = partner.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normalized === 'booking' || normalized === 'bookingcom') return 'hotel';
  if (normalized === 'opentable') return 'restaurant';
  if (normalized === 'duffel' || normalized === 'amadeus') return 'transport';

  return 'activity';
}

export function formatAffiliatePartnerName(partner: string): string {
  const normalized = partner.toLowerCase().replace(/[^a-z0-9]/g, '');
  return PARTNER_NAMES[normalized] || partner;
}

export function getBookableItemContextLabel(dayNumber: number, activityType?: string): string {
  if (dayNumber > 0) return `Day ${dayNumber}`;
  if (activityType === 'accommodation') return 'Hotel stay';
  if (activityType === 'transport') return 'Transport';
  return 'Trip option';
}

export function buildAffiliateCheckoutCopy({
  itemName,
  affiliatePartner,
  priceLabel,
  cancellationLabel,
}: CheckoutCopyInput) {
  const partnerName = formatAffiliatePartnerName(affiliatePartner);
  const lines = [
    itemName,
    `Partner: ${partnerName}`,
    priceLabel ? `Estimated price: ${priceLabel}` : 'Final price: confirmed by the partner',
    cancellationLabel || 'Cancellation terms are confirmed by the partner before payment.',
    AFFILIATE_DISCLOSURE,
    `Faroway will open ${partnerName} and keep your trip saved here. Availability, payment, and booking changes happen with the partner.`,
  ];

  return {
    title: `Continue to ${partnerName}?`,
    message: lines.join('\n\n'),
    confirmLabel: 'Continue',
  };
}

export function confirmAndOpenAffiliateLink(
  params: ConfirmAffiliateOpenParams,
  openUrl: (url: string) => void
): void {
  // Alert.alert is a no-op on react-native-web. Do not invoke browser APIs
  // during Expo's server render either.
  if (Platform.OS === 'web' && typeof window === 'undefined') return;
  if (!isAllowedAffiliateUrl(params.affiliateUrl, params.affiliatePartner)) {
    hapticFeedback.warning();
    const title = 'Partner Link Unavailable';
    const message =
      'This partner link could not be verified. Try another booking option from the itinerary.';
    if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
    else Alert.alert(title, message);
    return;
  }

  hapticFeedback.light();

  const { priceLabel, cancellationLabel, ...trackingParams } = params;
  const copy = buildAffiliateCheckoutCopy({
    itemName: params.itemName,
    affiliatePartner: params.affiliatePartner,
    priceLabel,
    cancellationLabel,
  });

  if (Platform.OS === 'web') {
    if (window.confirm(`${copy.title}\n\n${copy.message}`)) {
      // Navigate within the user gesture. Awaiting POST tracking first can
      // cause Linking.openURL's new tab to be blocked by the browser.
      const redirect = new URL('/api/track/click', API_BASE_URL);
      for (const [key, value] of Object.entries(trackingParams)) {
        if (value !== undefined && value !== null) redirect.searchParams.set(key, String(value));
      }
      openUrl(redirect.toString());
    }
    return;
  }

  Alert.alert(copy.title, copy.message, [
    { text: 'Not Now', style: 'cancel' },
    {
      text: copy.confirmLabel,
      onPress: () => {
        void openAffiliateLink(trackingParams, openUrl);
      },
    },
  ]);
}
