/**
 * TripGenie Search Service
 * Connects mobile app to the backend search API
 */

import { API_BASE_URL } from '../constants/api';
import type {
  SearchInput,
  StartSearchResponse,
  SearchProgress,
  HotelResult,
  ActivityResult,
  DiningResult,
  SuggestedDay,
  SearchResults,
  SearchStatusResponse,
} from '@tripgenie/types';

// Re-export types for backward compatibility
export type {
  SearchInput,
  StartSearchResponse,
  SearchProgress,
  HotelResult,
  ActivityResult,
  DiningResult,
  SuggestedDay,
  SearchResults,
  SearchStatusResponse,
} from '@tripgenie/types';

/**
 * Start a new travel search
 */
export async function startSearch(
  input: SearchInput,
  authToken?: string
): Promise<StartSearchResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/search/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to start search');
  }

  return response.json();
}

/**
 * Get search status and results
 */
export async function getSearchStatus(searchId: string): Promise<SearchStatusResponse> {
  // Validate searchId to prevent path traversal
  if (!searchId || /[^a-zA-Z0-9_-]/.test(searchId)) {
    throw new Error('Invalid search ID');
  }

  const response = await fetch(`${API_BASE_URL}/api/search/${encodeURIComponent(searchId)}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to get search status');
  }

  return response.json();
}

/**
 * Poll search status until completed or error
 */
export async function pollSearchStatus(
  searchId: string,
  onProgress?: (status: SearchStatusResponse) => void,
  pollInterval: number = 2000,
  maxAttempts: number = 60
): Promise<SearchResults> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await getSearchStatus(searchId);

    if (onProgress) {
      onProgress(status);
    }

    if (status.status === 'completed' && status.results) {
      return status.results;
    }

    if (status.status === 'error') {
      throw new Error(status.error || 'Search failed');
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    attempts++;
  }

  throw new Error('Search timed out');
}

/**
 * Calculate progress percentage from SearchProgress
 */
export function calculateProgressPercent(progress: SearchProgress): number {
  const stages = ['orchestrator', 'hotels', 'activities', 'dining', 'aggregator'] as const;
  let completed = 0;

  for (const stage of stages) {
    if (progress[stage] === 'done') {
      completed += 20; // Each stage is 20%
    } else if (progress[stage] === 'searching') {
      completed += 10; // In progress counts as half
    }
  }

  return Math.min(100, completed);
}

/**
 * Get human-readable status message
 */
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
