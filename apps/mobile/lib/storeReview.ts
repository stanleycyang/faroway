import { Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { logger } from './logger';

export const STORE_REVIEW_SUPPORT_URL = 'https://faroway.ai/support';

export type StoreReviewDestination = 'native' | 'store' | 'support' | 'unavailable';

export interface StoreReviewResult {
  destination: StoreReviewDestination;
  url?: string;
}

function envStoreUrl(platform: typeof Platform.OS) {
  if (platform === 'ios') return process.env.EXPO_PUBLIC_APP_STORE_URL;
  if (platform === 'android') return process.env.EXPO_PUBLIC_PLAY_STORE_URL;
  return undefined;
}

export function isValidStoreUrl(url: string, platform: typeof Platform.OS = Platform.OS) {
  try {
    const parsed = new URL(url);

    if (platform === 'ios') {
      return (
        parsed.protocol === 'itms-apps:' ||
        parsed.hostname === 'apps.apple.com' ||
        parsed.hostname === 'itunes.apple.com'
      );
    }

    if (platform === 'android') {
      return parsed.protocol === 'market:' || parsed.hostname === 'play.google.com';
    }

    return false;
  } catch {
    return false;
  }
}

export function getStoreReviewFallbackUrl(platform: typeof Platform.OS = Platform.OS) {
  const configuredUrl = StoreReview.storeUrl() || envStoreUrl(platform);

  if (configuredUrl && isValidStoreUrl(configuredUrl, platform)) {
    return configuredUrl;
  }

  return STORE_REVIEW_SUPPORT_URL;
}

export async function requestStoreReview(): Promise<StoreReviewResult> {
  try {
    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
      return { destination: 'native' };
    }
  } catch (error) {
    logger.warn('[StoreReview] Native review prompt failed:', error);
  }

  const fallbackUrl = getStoreReviewFallbackUrl();

  try {
    await Linking.openURL(fallbackUrl);
    return {
      destination: fallbackUrl === STORE_REVIEW_SUPPORT_URL ? 'support' : 'store',
      url: fallbackUrl,
    };
  } catch (error) {
    logger.warn('[StoreReview] Failed to open review fallback:', error);
    return { destination: 'unavailable', url: fallbackUrl };
  }
}
