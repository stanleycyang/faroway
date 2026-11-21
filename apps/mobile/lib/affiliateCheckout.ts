import { Alert } from 'react-native';
import {
  AFFILIATE_DISCLOSURE_SHORT,
  formatAffiliatePartnerName as sharedFormatAffiliatePartnerName,
  itemTypeForAffiliatePartner as sharedItemTypeForAffiliatePartner,
  normalizeAffiliatePartner,
  resolveAffiliatePartnerByUrl,
} from '@faroway/constants';
import { isAllowedAffiliateUrl, openAffiliateLink, type TrackClickParams } from '../services/api';
import { hapticFeedback } from '../utils/haptics';

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

export interface TripEssentialOption {
  id: string;
  title: string;
  subtitle: string;
  partner: 'airalo' | 'safetywing';
  partnerLabel: string;
  url: string;
  icon: 'cellular-outline' | 'shield-checkmark-outline';
}

export const TRIP_ESSENTIALS: readonly TripEssentialOption[] = [
  {
    id: 'essential-airalo-esim',
    title: 'Travel eSIM data',
    subtitle: 'Local data plans before you land',
    partner: 'airalo',
    partnerLabel: 'Airalo',
    url: 'https://www.airalo.com/',
    icon: 'cellular-outline',
  },
  {
    id: 'essential-safetywing-insurance',
    title: 'Travel medical coverage',
    subtitle: 'Flexible trip & medical insurance',
    partner: 'safetywing',
    partnerLabel: 'SafetyWing',
    url: 'https://safetywing.com/nomad-insurance',
    icon: 'shield-checkmark-outline',
  },
];

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
  return sharedItemTypeForAffiliatePartner(partner);
}

export function formatAffiliatePartnerName(partner: string): string {
  return sharedFormatAffiliatePartnerName(partner);
}

export function resolveAffiliatePartnerForItem(url?: string, explicitPartner?: string): string {
  const normalizedExplicit = normalizeAffiliatePartner(explicitPartner);
  if (normalizedExplicit) return normalizedExplicit;
  if (url) {
    const inferred = resolveAffiliatePartnerByUrl(url);
    if (inferred) return inferred;
  }
  const trimmed = explicitPartner?.trim();
  return trimmed || 'partner';
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
    AFFILIATE_DISCLOSURE_SHORT,
  ];

  return {
    title: `Continue to ${partnerName}?`,
    message: lines.join('\n\n'),
    confirmLabel: 'Continue',
  };
}

export function confirmAndOpenAffiliateLink(
  params: ConfirmAffiliateOpenParams,
  openUrl: (url: string) => void | Promise<unknown>
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
            'Couldn’t open partner site',
            'Please try again or check your connection. Your trip stays saved in Faroway.'
          );
        });
      },
    },
  ]);
}
