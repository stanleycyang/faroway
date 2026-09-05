/**
 * Faroway API Service
 * Centralized API client for the mobile app
 */

import { API_BASE_URL } from '../constants/api';
import { parseViatorAffiliateUrl, normalizeAffiliatePartner } from '@faroway/constants';
import { getApiHeaders } from './authToken';
import { fetchWithTimeout } from './request';
import { buildTripUpdatePayload, type TripUpdateInput } from './tripPayload';
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

export { getAuthToken, setAuthToken } from './authToken';

/**
 * Base fetch wrapper with auth and error handling
 */
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const headers = await getApiHeaders(options.headers as Record<string, string> | undefined);

    const response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

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
const PARTNER_DOMAINS: Record<string, string[]> = {
  viator: ['viator.com'],
  booking: ['booking.com'],
  getyourguide: ['getyourguide.com'],
  tripadvisor: ['tripadvisor.com'],
  discovercars: ['discovercars.com'],
  hostelworld: ['hostelworld.com'],
  duffel: ['duffel.com'],
  opentable: ['opentable.com'],
};

export function isAllowedAffiliateUrl(url: string, partner: string): boolean {
  try {
    const parsed = new URL(url);
    const normalizedPartner = normalizeAffiliatePartner(partner);
    if (parsed.protocol !== 'https:' || !normalizedPartner) return false;
    if (normalizedPartner === 'viator') return parseViatorAffiliateUrl(url) !== null;
    return (
      PARTNER_DOMAINS[normalizedPartner]?.some(
        (d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`)
      ) ?? false
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
  updates: TripUpdateInput
): Promise<ApiResponse<{ trip: Trip }>> {
  return apiFetch<{ trip: Trip }>(`/api/trips/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(buildTripUpdatePayload(updates)),
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
    { method: 'POST' }
  );
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
