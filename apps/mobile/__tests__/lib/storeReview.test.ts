const mockOpenURL = jest.fn();
const mockIsAvailableAsync = jest.fn();
const mockRequestReview = jest.fn();
const mockStoreUrl = jest.fn();
let mockPlatformOS: 'ios' | 'android' | 'web' = 'ios';

jest.mock('react-native', () => ({
  Linking: {
    openURL: mockOpenURL,
  },
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

jest.mock('expo-store-review', () => ({
  isAvailableAsync: mockIsAvailableAsync,
  requestReview: mockRequestReview,
  storeUrl: mockStoreUrl,
}));

import {
  getStoreReviewFallbackUrl,
  hasRealStoreListing,
  isValidStoreUrl,
  requestStoreReview,
  STORE_REVIEW_SUPPORT_URL,
} from '../../lib/storeReview';

describe('store review utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatformOS = 'ios';
    mockIsAvailableAsync.mockResolvedValue(false);
    mockRequestReview.mockResolvedValue(undefined);
    mockStoreUrl.mockReturnValue(null);
    mockOpenURL.mockResolvedValue(undefined);
    delete process.env.EXPO_PUBLIC_APP_STORE_URL;
    delete process.env.EXPO_PUBLIC_PLAY_STORE_URL;
  });

  it('accepts real App Store and Play Store URLs', () => {
    expect(isValidStoreUrl('https://apps.apple.com/us/app/faroway/id123', 'ios')).toBe(true);
    expect(isValidStoreUrl('itms-apps://itunes.apple.com/app/id123', 'ios')).toBe(true);
    expect(
      isValidStoreUrl('https://play.google.com/store/apps/details?id=ai.faroway.app', 'android')
    ).toBe(true);
    expect(isValidStoreUrl('market://details?id=ai.faroway.app', 'android')).toBe(true);
  });

  it('rejects website URLs as store-review destinations', () => {
    expect(isValidStoreUrl('https://faroway.ai', 'ios')).toBe(false);
    expect(isValidStoreUrl('https://faroway.ai', 'android')).toBe(false);
  });

  it('uses support when no real store URL is configured', () => {
    expect(getStoreReviewFallbackUrl('ios')).toBe(STORE_REVIEW_SUPPORT_URL);
    expect(hasRealStoreListing('ios')).toBe(false);
  });

  it('rejects placeholder App Store ids as a real listing', () => {
    mockStoreUrl.mockReturnValue('https://apps.apple.com/app/faroway/id0000000000');
    expect(isValidStoreUrl('https://apps.apple.com/app/faroway/id0000000000', 'ios')).toBe(
      false
    );
    expect(hasRealStoreListing('ios')).toBe(false);
  });

  it('uses configured store URLs from Expo config before env values', async () => {
    mockStoreUrl.mockReturnValue('https://apps.apple.com/us/app/faroway/id123');
    process.env.EXPO_PUBLIC_APP_STORE_URL = 'https://faroway.ai';

    await expect(requestStoreReview()).resolves.toEqual({
      destination: 'store',
      url: 'https://apps.apple.com/us/app/faroway/id123',
    });
    expect(mockOpenURL).toHaveBeenCalledWith('https://apps.apple.com/us/app/faroway/id123');
  });

  it('falls back to support instead of opening invalid env store URLs', async () => {
    process.env.EXPO_PUBLIC_APP_STORE_URL = 'https://faroway.ai';

    await expect(requestStoreReview()).resolves.toEqual({
      destination: 'support',
      url: STORE_REVIEW_SUPPORT_URL,
    });
    expect(mockOpenURL).toHaveBeenCalledWith(STORE_REVIEW_SUPPORT_URL);
  });

  it('uses the native review prompt when available', async () => {
    mockIsAvailableAsync.mockResolvedValue(true);

    await expect(requestStoreReview()).resolves.toEqual({ destination: 'native' });
    expect(mockRequestReview).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).not.toHaveBeenCalled();
  });
});
