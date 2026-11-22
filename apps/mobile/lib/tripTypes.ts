import type { TravelerRequirements } from '@faroway/types';
import type { TripDay, Hotel } from './itineraryTypes';

export interface Trip {
  planNeedsRefresh?: boolean;
  id: string;
  destination: string;
  country: string;
  placeId?: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelerType: string;
  originCity?: string;
  originAirport?: string;
  flightConsent?: boolean;
  requirements?: TravelerRequirements | null;
  vibes: string[];
  budget?: string;
  days: TripDay[];
  hotel?: Hotel;
  coverImage: string;
  createdAt: string;
  updatedAt?: string;
  status: 'draft' | 'planned' | 'active' | 'completed';
}

export interface TripInput {
  destination: string;
  country?: string;
  placeId?: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelerType: string;
  originCity?: string;
  originAirport?: string;
  flightConsent?: boolean;
  requirements?: TravelerRequirements | null;
  vibes: string[];
  budget?: string;
}
