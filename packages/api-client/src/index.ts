/**
 * @faroway/api-client
 * Platform-agnostic API client for Faroway.
 * Accepts baseUrl + getAuthToken for platform injection.
 */

import type {
  ApiResponse,
  Trip,
  UserProfile,
  TrackClickParams,
  TrackClickResponse,
  SearchInput,
  StartSearchResponse,
  SearchStatusResponse,
  SearchResults,
  SearchProgress,
} from '@faroway/types';

export type { ApiResponse } from '@faroway/types';

// =============================================================================
// Client Configuration
// =============================================================================

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken: () => string | null | Promise<string | null>;
  timeout?: number;
}

// =============================================================================
// API Client Class
// =============================================================================

export class FarowayClient {
  private baseUrl: string;
  private getAuthToken: () => string | null | Promise<string | null>;
  private timeout: number;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
    this.getAuthToken = config.getAuthToken;
    this.timeout = config.timeout ?? 90000;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const token = await this.getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data: any = await response.json();

      if (!response.ok) {
        return {
          error: data.error || 'Request failed',
          code: data.code || 'UNKNOWN_ERROR',
        };
      }

      return { data: data as T };
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

  // ===========================================================================
  // User Profile
  // ===========================================================================

  async getUserProfile(): Promise<ApiResponse<UserProfile>> {
    return this.fetch<UserProfile>('/api/user/profile');
  }

  async updateUserProfile(
    updates: Partial<Pick<UserProfile, 'email' | 'subscriptionTier'>>
  ): Promise<ApiResponse<UserProfile>> {
    return this.fetch<UserProfile>('/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // ===========================================================================
  // Trips
  // ===========================================================================

  async getTrips(): Promise<ApiResponse<{ trips: Trip[] }>> {
    return this.fetch<{ trips: Trip[] }>('/api/trips');
  }

  async getTrip(id: string): Promise<ApiResponse<{ trip: Trip }>> {
    return this.fetch<{ trip: Trip }>(`/api/trips/${encodeURIComponent(id)}`);
  }

  async createTrip(trip: {
    destination: string;
    startDate: string;
    endDate: string;
    travelers?: number;
    preferences?: {
      travelerType?: string;
      vibes?: string[];
    };
  }): Promise<ApiResponse<{ trip: Trip }>> {
    return this.fetch<{ trip: Trip }>('/api/trips', {
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

  async updateTrip(
    id: string,
    updates: Partial<Trip>
  ): Promise<ApiResponse<{ trip: Trip }>> {
    return this.fetch<{ trip: Trip }>(`/api/trips/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteTrip(id: string): Promise<ApiResponse<void>> {
    return this.fetch<void>(`/api/trips/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // ===========================================================================
  // Search
  // ===========================================================================

  async startSearch(input: SearchInput): Promise<ApiResponse<StartSearchResponse>> {
    return this.fetch<StartSearchResponse>('/api/search/start', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getSearchStatus(searchId: string): Promise<ApiResponse<SearchStatusResponse>> {
    if (!searchId || /[^a-zA-Z0-9_-]/.test(searchId)) {
      return { error: 'Invalid search ID', code: 'INVALID_INPUT' };
    }
    return this.fetch<SearchStatusResponse>(`/api/search/${encodeURIComponent(searchId)}`);
  }

  async pollSearchStatus(
    searchId: string,
    onProgress?: (status: SearchStatusResponse) => void,
    pollInterval = 2000,
    maxAttempts = 60
  ): Promise<SearchResults> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const result = await this.getSearchStatus(searchId);

      if (result.error) {
        throw new Error(result.error);
      }

      const status = result.data!;

      if (onProgress) {
        onProgress(status);
      }

      if (status.status === 'completed' && status.results) {
        return status.results;
      }

      if (status.status === 'error') {
        throw new Error(status.error || 'Search failed');
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    }

    throw new Error('Search timed out');
  }

  // ===========================================================================
  // Affiliate Tracking
  // ===========================================================================

  async trackAffiliateClick(
    params: TrackClickParams
  ): Promise<ApiResponse<TrackClickResponse>> {
    return this.fetch<TrackClickResponse>('/api/track/click', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async openAffiliateLink(
    params: TrackClickParams,
    openUrl: (url: string) => void
  ): Promise<void> {
    const result = await this.trackAffiliateClick(params);

    if (result.data?.redirectUrl) {
      openUrl(result.data.redirectUrl);
    } else {
      openUrl(params.affiliateUrl);
    }
  }
}

// =============================================================================
// Search Progress Helpers
// =============================================================================

export function calculateProgressPercent(progress: SearchProgress): number {
  const stages = ['orchestrator', 'hotels', 'activities', 'dining', 'aggregator'] as const;
  let completed = 0;

  for (const stage of stages) {
    if (progress[stage] === 'done') {
      completed += 20;
    } else if (progress[stage] === 'searching') {
      completed += 10;
    }
  }

  return Math.min(100, completed);
}

export function getStatusMessage(progress: SearchProgress): string {
  if (progress.aggregator === 'searching' || progress.aggregator === 'done') {
    return 'Creating your perfect itinerary...';
  }
  if (progress.dining === 'searching') {
    return 'Finding the best restaurants...';
  }
  if (progress.activities === 'searching') {
    return 'Discovering activities & attractions...';
  }
  if (progress.hotels === 'searching') {
    return 'Searching for hotels...';
  }
  if (progress.orchestrator === 'searching') {
    return 'Understanding your preferences...';
  }
  return 'Starting your search...';
}
