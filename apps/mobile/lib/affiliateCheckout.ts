import { Alert } from 'react-native';
import { isAllowedAffiliateUrl, openAffiliateLink, type TrackClickParams } from '../services/api';
import { hapticFeedback } from '../utils/haptics';

const PARTNER_NAMES: Record<string, string> = {
  viator: 'Viator',
  getyourguide: 'GetYourGuide',
  tripadvisor: 'Tripadvisor',
  opentable: 'OpenTable',
  duffel: 'Duffel',
};

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

  if (normalized === 'opentable') return 'restaurant';
  if (normalized === 'duffel') return 'transport';

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
  if (!isAllowedAffiliateUrl(params.affiliateUrl)) {
    hapticFeedback.warning();
    Alert.alert(
      'Partner Link Unavailable',
      'This partner link could not be verified. Try another booking option from the itinerary.'
    );
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

  Alert.alert(copy.title, copy.message, [
    { text: 'Not Now', style: 'cancel' },
    {
      text: copy.confirmLabel,
      onPress: () => {
        void openAffiliateLink(trackingParams, openUrl).catch(() => {
          Alert.alert(
            'Review your saved trip',
            'Open your saved trip on Faroway to review current booking options.'
          );
        });
      },
    },
  ]);
}
