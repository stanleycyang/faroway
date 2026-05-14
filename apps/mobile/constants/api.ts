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

function getDevServerUrl(): string {
  // 1. Explicit env var always wins
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. In dev, derive LAN IP from Expo's dev server host
  //    Constants.expoConfig.hostUri is e.g. "192.168.1.5:8081"
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0]; // extract IP, drop Expo port
    return `http://${host}:3000`;
  }

  // 3. Fallback for simulators
  return 'http://localhost:3000';
}

export const API_BASE_URL = __DEV__
  ? getDevServerUrl()
  : process.env.EXPO_PUBLIC_API_URL || 'https://faroway.vercel.app';

export const API_TIMEOUT = 90000; // 90 seconds for long-running AI searches
