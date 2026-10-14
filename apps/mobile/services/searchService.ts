import { requestWithTimeout } from './request';
import { captureTripAccount } from '../lib/tripAccountScope';
import { withPlanningConsent } from '../lib/planningConsent';
/**
 * Faroway Search Service
 * Connects mobile app to the backend search API
 */

import { API_BASE_URL } from '../constants/api';
import type {
  SearchInput,
  StartSearchResponse,
  SearchProgress,
  SearchResults,
  SearchStatusResponse,
} from '@faroway/types';

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
} from '@faroway/types';

/**
 * Start a new travel search
 */
export async function startSearch(
  input: SearchInput,
  authToken?: string
): Promise<StartSearchResponse> {
  // A caller-supplied token cannot transfer consent to a different account.
  void authToken;
  const body = JSON.stringify(input);
  return withPlanningConsent(async ({ headers, signal }) =>
    requestWithTimeout(
      `${API_BASE_URL}/api/search/start`,
      { method: 'POST', headers: await headers(), signal, body },
      async (response) => {
        const data = await response.json().catch((error: unknown) => {
          if (!response.ok) return { error: 'Unknown error' };
          throw error;
        });
        if (!response.ok) throw new Error(data?.error || 'Failed to start search');
        return data;
      },
      25_000
    )
  );
}

/**
 * Get search status and results
 */
export async function getSearchStatus(searchId: string): Promise<SearchStatusResponse> {
  // Validate searchId to prevent path traversal
  if (!searchId || /[^a-zA-Z0-9_-]/.test(searchId)) {
    throw new Error('Invalid search ID');
  }

  return readSearchStatus(searchId, captureTripAccount());
}

async function readSearchStatus(
  searchId: string,
  account: ReturnType<typeof captureTripAccount>
): Promise<SearchStatusResponse> {
  const headers = await account.headers();
  account.assertCurrent();
  const result = await requestWithTimeout(
    `${API_BASE_URL}/api/search/${encodeURIComponent(searchId)}`,
    { headers },
    async (response) => {
      account.assertCurrent();
      const data = await response.json().catch((error: unknown) => {
        if (!response.ok) return { error: 'Unknown error' };
        throw error;
      });
      account.assertCurrent();
      if (!response.ok)
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Failed to get search status'
        );
      if (
        !data ||
        data.searchId !== searchId ||
        !['pending', 'searching', 'completed', 'error'].includes(data.status)
      ) {
        throw new Error('Search status could not be verified. Try again.');
      }
      return data as SearchStatusResponse;
    }
  );
  account.assertCurrent();
  return result;
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
  if (!searchId || /[^a-zA-Z0-9_-]/.test(searchId)) throw new Error('Invalid search ID');
  if (
    !Number.isFinite(pollInterval) ||
    pollInterval < 0 ||
    pollInterval > 2_147_483_647 ||
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1
  ) {
    throw new Error('Invalid search polling options');
  }
  const account = captureTripAccount();
  account.assertCurrent();
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await readSearchStatus(searchId, account);
    account.assertCurrent();

    if (onProgress) {
      onProgress(status);
    }

    account.assertCurrent();
    if (status.status === 'completed' && status.results) {
      return status.results;
    }

    if (status.status === 'error') {
      throw new Error(status.error || 'Search failed');
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
    attempts++;
  }

  throw new Error('Search timed out');
}

/**
 * Calculate progress percentage from SearchProgress
 */
export function calculateProgressPercent(progress: SearchProgress): number {
  const stages = [
    'orchestrator',
    'hotels',
    'activities',
    'dining',
    'transport',
    'enrichment',
    'aggregator',
  ] as const;
  const doneWeight = 100 / stages.length;
  const searchingWeight = doneWeight / 2;
  let completed = 0;

  for (const stage of stages) {
    if (progress[stage] === 'done') {
      completed += doneWeight;
    } else if (progress[stage] === 'searching') {
      completed += searchingWeight;
    }
  }

  return Math.min(100, Math.round(completed));
}

/**
 * Get human-readable status message
 */
export function getStatusMessage(progress: SearchProgress): string {
  if (progress.aggregator === 'searching' || progress.aggregator === 'done') {
    return 'Creating your perfect itinerary...';
  }
  if (progress.transport === 'searching') {
    return 'Searching for flights...';
  }
  if (progress.enrichment === 'searching') {
    return 'Adding local gems...';
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
