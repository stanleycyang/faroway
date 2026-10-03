/**
 * Faroway API Service
 * Centralized API client for the mobile app
 */

import { API_BASE_URL, API_TIMEOUT } from '../constants/api';
import type {
  ApiResponse,
  Trip,
  UserProfile,
  TrackClickParams,
  TrackClickResponse,
  DestinationsResponse,
} from '@faroway/types';

// Re-export types for backward compatibility
export type {
  ApiResponse,
  Trip,
  UserProfile,
  TrackClickParams,
  TrackClickResponse,
  DestinationsResponse,
} from '@faroway/types';

// Auth token managed via Supabase SecureStore - this is an in-memory cache only.
// Do NOT persist this token to AsyncStorage or other insecure storage.
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

/**
 * Base fetch wrapper with auth and error handling
 */
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const parsed = await parseApiResponseBody(response);

    if (!parsed.ok) {
      return {
        error: parsed.error,
        code: parsed.code,
      };
    }

    if (!response.ok) {
      const errorData = parsed.data as Record<string, unknown> | null;
      return {
        error: typeof errorData?.error === 'string' ? errorData.error : 'Request failed',
        code: typeof errorData?.code === 'string' ? errorData.code : 'UNKNOWN_ERROR',
      };
    }

    return { data: parsed.data as T };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { error: 'Request timed out', code: 'TIMEOUT' };
      }
      return { error: error.message, code: 'NETWORK_ERROR' };
    }

    return { error: 'Unknown error occurred', code: 'UNKNOWN_ERROR' };
  }
}

async function parseApiResponseBody(
  response: Response
): Promise<{ ok: true; data: unknown } | { ok: false; error: string; code: string }> {
  try {
    if (typeof response.text === 'function') {
      const text = await response.text();
      if (!text.trim()) {
        return { ok: true, data: null };
      }
      return { ok: true, data: JSON.parse(text) };
    }

    // Test mocks and older React Native fetch shims may expose json() only.
    if (typeof response.json === 'function') {
      return { ok: true, data: await response.json() };
    }

    return { ok: true, data: null };
  } catch {
    return {
      ok: false,
      error: 'Invalid server response',
      code: 'INVALID_RESPONSE',
    };
  }
}

// ============================================
// User Profile APIs
// ============================================

export async function getUserProfile(): Promise<ApiResponse<UserProfile>> {
  return apiFetch<UserProfile>('/api/user/profile');
}

export async function updateUserProfile(updates: {
  email?: string;
  subscription_tier?: string;
  display_name?: string;
  avatar_url?: string;
  preferences?: {
    vibes?: string[];
    budget?: string;
    travelerType?: string;
  };
  notification_settings?: Record<string, boolean>;
}): Promise<ApiResponse<UserProfile>> {
  return apiFetch<UserProfile>('/api/user/profile', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/**
 * Permanently delete the signed-in user's account and all owned data.
 * Caller is responsible for clearing local state and signing out.
 */
export async function deleteAccount(): Promise<ApiResponse<{ deleted: boolean }>> {
  return apiFetch<{ deleted: boolean }>('/api/user/profile', {
    method: 'DELETE',
  });
}

// ============================================
// Push Notification APIs
// ============================================

type PushTokenPlatform = 'ios' | 'android' | 'web' | 'unknown';

export async function registerPushToken(params: {
  token: string;
  platform?: PushTokenPlatform;
  deviceName?: string | null;
}): Promise<
  ApiResponse<{
    token: string;
    platform: PushTokenPlatform;
    deviceName: string | null;
    updatedAt: string;
    lastSeenAt: string;
  }>
> {
  return apiFetch('/api/user/push-token', {
    method: 'POST',
    body: JSON.stringify({
      token: params.token,
      platform: params.platform || 'unknown',
      deviceName: params.deviceName || null,
    }),
  });
}

export async function removePushToken(token?: string): Promise<ApiResponse<{ deleted: boolean }>> {
  return apiFetch('/api/user/push-token', {
    method: 'DELETE',
    body: JSON.stringify(token ? { token } : {}),
  });
}

// ============================================
// Affiliate URL allowlist
// ============================================

// Mirror of the backend allowlist (apps/web/app/api/track/click/route.ts).
// Mobile validates before showing the confirm sheet so we don't ship a
// trustworthy-looking CTA for a URL the backend will reject as SSRF.
const ALLOWED_AFFILIATE_DOMAINS = [
  'viator.com',
  'booking.com',
  'getyourguide.com',
  'tripadvisor.com',
  'discovercars.com',
  'hostelworld.com',
  'amadeus.com',
  'duffel.com',
];

export function isAllowedAffiliateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_AFFILIATE_DOMAINS.some(
      (d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`)
    );
  } catch {
    return false;
  }
}

// ============================================
// Trips APIs
// ============================================

export async function getTrips(): Promise<ApiResponse<{ trips: Trip[] }>> {
  return apiFetch<{ trips: Trip[] }>('/api/trips');
}

export async function getTrip(id: string): Promise<ApiResponse<{ trip: Trip }>> {
  return apiFetch<{ trip: Trip }>(`/api/trips/${encodeURIComponent(id)}`);
}

export async function createTrip(trip: {
  destination: string;
  startDate: string;
  endDate: string;
  travelers?: number;
  preferences?: {
    travelerType?: string;
    vibes?: string[];
    originCity?: string;
    originAirport?: string;
  };
}): Promise<ApiResponse<{ trip: Trip }>> {
  return apiFetch<{ trip: Trip }>('/api/trips', {
    method: 'POST',
    body: JSON.stringify({
      destination: trip.destination,
      start_date: trip.startDate,
      end_date: trip.endDate,
      travelers: trip.travelers || 2,
      preferences: trip.preferences,
    }),
  });
}

export async function updateTrip(
  id: string,
  updates: Partial<Trip>,
  expectedUpdatedAt?: string
): Promise<ApiResponse<{ trip: Trip }>> {
  return apiFetch<{ trip: Trip }>(`/api/trips/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...updates, expectedUpdatedAt }),
  });
}

export async function deleteTrip(id: string): Promise<ApiResponse<void>> {
  return apiFetch<void>(`/api/trips/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ============================================
// Trip Sharing APIs
// ============================================

export async function shareTrip(
  id: string
): Promise<ApiResponse<{ shareUrl: string; shareToken: string }>> {
  return apiFetch<{ shareUrl: string; shareToken: string }>(
    `/api/trips/${encodeURIComponent(id)}/share`,
    { method: 'POST', body: JSON.stringify({ publicConsent: true }) }
  );
}

export async function revokeTripShare(id: string): Promise<ApiResponse<{ success: boolean }>> {
  return apiFetch<{ success: boolean }>(`/api/trips/${encodeURIComponent(id)}/share`, {
    method: 'DELETE',
  });
}

// ============================================
// Destinations APIs
// ============================================

export async function getPopularDestinations(
  params: { limit?: number; offset?: number; tags?: string } = {}
): Promise<ApiResponse<DestinationsResponse>> {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  if (params.tags) query.set('tags', params.tags);
  const qs = query.toString();
  return apiFetch<DestinationsResponse>(`/api/destinations/popular${qs ? `?${qs}` : ''}`);
}

export async function getTrendingDestinations(
  params: { limit?: number; offset?: number } = {}
): Promise<ApiResponse<DestinationsResponse>> {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  if (params.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return apiFetch<DestinationsResponse>(`/api/destinations/trending${qs ? `?${qs}` : ''}`);
}

// ============================================
// Search APIs (re-exported from searchService)
// ============================================

export { startSearch, getSearchStatus, pollSearchStatus } from './searchService';

// ============================================
// Affiliate Tracking APIs
// ============================================

export async function trackAffiliateClick(
  params: TrackClickParams
): Promise<ApiResponse<TrackClickResponse>> {
  return apiFetch<TrackClickResponse>('/api/track/click', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Track click and open the booking URL
 * Use this when user taps on a booking button
 */
export async function openAffiliateLink(
  params: TrackClickParams,
  openUrl: (url: string) => void
): Promise<void> {
  const result = await trackAffiliateClick(params);

  if (result.data?.redirectUrl) {
    openUrl(result.data.redirectUrl);
  } else {
    // Fallback to original URL if tracking fails
    openUrl(params.affiliateUrl);
  }
}
