/**
 * TripGenie Search Service
 * Connects mobile app to the backend search API
 */

import { API_BASE_URL } from '../constants/api';

export interface SearchInput {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelerType?: 'solo' | 'couple' | 'family' | 'friends' | 'business';
  vibes: string[];
  budget?: 'budget' | 'moderate' | 'luxury';
}

export interface StartSearchResponse {
  searchId: string;
  workflowRunId: string;
  status: 'started';
  estimatedTime: number;
}

export interface SearchProgress {
  orchestrator: 'pending' | 'searching' | 'done' | 'error';
  hotels: 'pending' | 'searching' | 'done' | 'error';
  activities: 'pending' | 'searching' | 'done' | 'error';
  dining: 'pending' | 'searching' | 'done' | 'error';
  aggregator: 'pending' | 'searching' | 'done' | 'error';
}

export interface HotelResult {
  id: string;
  name: string;
  description: string;
  starRating: number;
  userRating: number;
  reviewCount: number;
  pricePerNight: number;
  totalPrice: number;
  currency: string;
  amenities: string[];
  location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    neighborhood?: string;
  };
  images: string[];
  affiliateUrl: string;
  affiliatePartner: string;
  vibeScore: number;
  vibeMatch: string[];
}

export interface ActivityResult {
  id: string;
  name: string;
  description: string;
  category: string;
  duration: number;
  price: number;
  currency: string;
  rating: number;
  reviewCount: number;
  location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  images: string[];
  affiliateUrl: string;
  affiliatePartner: string;
  bestTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'any';
  vibeScore: number;
  vibeMatch: string[];
  bookingRequired: boolean;
}

export interface DiningResult {
  id: string;
  name: string;
  description: string;
  cuisineTypes: string[];
  priceLevel: 1 | 2 | 3 | 4;
  rating: number;
  reviewCount: number;
  location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  images: string[];
  reservationUrl?: string;
  mealTypes: ('breakfast' | 'lunch' | 'dinner')[];
  vibeScore: number;
  vibeMatch: string[];
  dietaryOptions: string[];
}

export interface SuggestedDay {
  dayNumber: number;
  date: string;
  title: string;
  summary: string;
  hotel?: HotelResult;
  morning: {
    activities: ActivityResult[];
    meal?: DiningResult;
  };
  afternoon: {
    activities: ActivityResult[];
    meal?: DiningResult;
  };
  evening: {
    activities: ActivityResult[];
    meal?: DiningResult;
  };
  estimatedCost: number;
  currency: string;
  tips: string[];
}

export interface SearchResults {
  searchId: string;
  hotels: HotelResult[];
  activities: ActivityResult[];
  dining: DiningResult[];
  itinerary: SuggestedDay[];
}

export interface SearchStatusResponse {
  searchId: string;
  status: 'pending' | 'searching' | 'completed' | 'error';
  progress: SearchProgress;
  results?: SearchResults;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

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
