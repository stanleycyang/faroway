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
export const PRODUCTION_WEB_URL = 'https://www.faroway.ai';

export interface ResolveApiBaseUrlOptions {
  isDev: boolean;
  envUrl?: string;
  hostUri?: string;
}

export interface ResolveWebBaseUrlOptions {
  envWebUrl?: string;
  envApiUrl?: string;
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

function isApiOnlyHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower.startsWith('api.') || lower.startsWith('api-');
}

function parseSafeWebOrigin(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      !isApiOnlyHostname(parsed.hostname)
    ) {
      return parsed.origin;
    }
  } catch {
    // Ignore malformed URL and fall back.
  }
  return null;
}

/**
 * Resolve the canonical browser-facing web origin (`www.faroway.ai`),
 * ignoring `api.*` / `api-*` origins and unsafe URLs so web fallbacks never hit API-only hosts.
 */
export function resolveWebBaseUrl({ envWebUrl, envApiUrl }: ResolveWebBaseUrlOptions): string {
  const explicitOrigin = parseSafeWebOrigin(envWebUrl);
  if (explicitOrigin) return explicitOrigin;

  const apiDerivedOrigin = parseSafeWebOrigin(envApiUrl);
  if (apiDerivedOrigin) return apiDerivedOrigin;

  return PRODUCTION_WEB_URL;
}

declare const __DEV__: boolean | undefined;
const isDevEnv = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export const API_BASE_URL = resolveApiBaseUrl({
  isDev: !!isDevEnv,
  envUrl: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
});

export const WEB_BASE_URL = resolveWebBaseUrl({
  envWebUrl: process.env.EXPO_PUBLIC_WEB_URL,
  envApiUrl: process.env.EXPO_PUBLIC_API_URL,
});

export const API_TIMEOUT = 90000; // 90 seconds for long-running AI searches
