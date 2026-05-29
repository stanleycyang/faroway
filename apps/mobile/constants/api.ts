/**
 * API Configuration
 * The mobile app uses the web app (apps/web) as its unified backend.
 * Set EXPO_PUBLIC_API_URL to the web app's deployment URL.
 *
 * In development, we auto-detect the dev machine's LAN IP from Expo's
 * dev server so that physical devices can reach the Next.js server.
 * `localhost` only works in simulators — real phones need the LAN IP.
 */

import Constants from 'expo-constants';

export const PRODUCTION_API_URL = 'https://faroway.ai';

export interface ResolveApiBaseUrlOptions {
  isDev: boolean;
  envUrl?: string;
  hostUri?: string;
}

/**
 * Pure resolver — exported separately so it can be unit-tested without
 * depending on global flags (`__DEV__`, `process.env`, `Constants.*`).
 */
export function resolveApiBaseUrl({ isDev, envUrl, hostUri }: ResolveApiBaseUrlOptions): string {
  // 1. Explicit env var always wins, in any environment.
  if (envUrl) return envUrl;

  // 2. Dev: derive LAN IP from Expo's host so physical devices can reach
  //    the Next.js dev server. Falls back to localhost for simulators.
  if (isDev) {
    if (hostUri) {
      const host = hostUri.split(':')[0];
      return `http://${host}:3000`;
    }
    return 'http://localhost:3000';
  }

  // 3. Production: ship-time default.
  return PRODUCTION_API_URL;
}

declare const __DEV__: boolean | undefined;
const isDevEnv = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export const API_BASE_URL = resolveApiBaseUrl({
  isDev: !!isDevEnv,
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
});

export const API_TIMEOUT = 90000; // 90 seconds for long-running AI searches
