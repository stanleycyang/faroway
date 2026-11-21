import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { logger } from './logger';

export interface OpenSafeHttpsUrlOptions {
  fallbackTitle?: string;
  fallbackMessage?: string;
  browserOptions?: WebBrowser.WebBrowserOpenOptions;
  silent?: boolean;
}

/**
 * Validates that a URL is a well-formed https:// URL with no embedded credentials.
 * Blocks tel:, mailto:, javascript:, file:, data:, custom app schemes, and cleartext http:.
 */
export function isSafeHttpsUrl(rawUrl: string): boolean {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === 'https:' &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

/**
 * Opens an https:// URL in an in-app browser with scheme validation and error handling.
 * Returns true if the URL was valid and opened without throwing; false otherwise.
 */
export async function openSafeHttpsUrl(
  rawUrl: string,
  options: OpenSafeHttpsUrlOptions = {}
): Promise<boolean> {
  const {
    fallbackTitle = 'Unable to open link',
    fallbackMessage = 'This link could not be opened right now. Please try again later.',
    browserOptions,
    silent = false,
  } = options;

  const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!isSafeHttpsUrl(trimmed)) {
    logger.warn('[openSafeHttpsUrl] Blocked unsafe or invalid URL');
    if (!silent) {
      Alert.alert(fallbackTitle, 'This link is not a valid secure web address.');
    }
    return false;
  }

  try {
    await WebBrowser.openBrowserAsync(trimmed, browserOptions);
    return true;
  } catch (error) {
    logger.error('[openSafeHttpsUrl] Failed to open browser:', error);
    if (!silent) {
      Alert.alert(fallbackTitle, fallbackMessage);
    }
    return false;
  }
}
