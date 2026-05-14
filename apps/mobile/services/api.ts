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

    const data = await response.json();

    if (!response.ok) {
      return {
        error: data.error || 'Request failed',
        code: data.code || 'UNKNOWN_ERROR',
      };
    }

    return { data };
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
  updates: Partial<Trip>
): Promise<ApiResponse<{ trip: Trip }>> {
  return apiFetch<{ trip: Trip }>(`/api/trips/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
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
