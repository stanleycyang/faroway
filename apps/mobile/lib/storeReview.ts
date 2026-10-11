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

    if (parsed.username || parsed.password) return false;
    if (platform === 'ios') {
      const validHost = ['apps.apple.com', 'itunes.apple.com'].includes(parsed.hostname);
      return (
        validHost &&
        ['https:', 'itms-apps:'].includes(parsed.protocol) &&
        /(?:^|\/)id[1-9][0-9]*(?:$|\/)/.test(parsed.pathname)
      );
    }
    if (platform === 'android') {
      const listing =
        parsed.protocol === 'market:'
          ? parsed.hostname === 'details'
          : parsed.protocol === 'https:' &&
            parsed.hostname === 'play.google.com' &&
            parsed.pathname === '/store/apps/details';
      return (
        listing &&
        /^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(
          parsed.searchParams.get('id') || ''
        )
      );
    }

    return false;
  } catch {
    return false;
  }
}

export function hasRealStoreListing(platform: typeof Platform.OS = Platform.OS) {
  const url = StoreReview.storeUrl() || envStoreUrl(platform);
  return Boolean(url && isValidStoreUrl(url, platform));
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
