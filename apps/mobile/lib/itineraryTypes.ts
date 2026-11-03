import type {
  DayTimingProposal,
  VenueSource,
  DiningReviewOption,
  ActivityResult,
} from '@faroway/types';
import type { VenuePhotoCredit } from './venuePhotos';

export interface Activity {
  venueAddress?: string;
  imageCredit?: VenuePhotoCredit;
  proposedVisitType?: ActivityResult['proposedVisitType'];
  source?: VenueSource;
  scheduleSlot?: 'morning' | 'afternoon' | 'evening';
  durationMinutes?: number;
  id: string;
  time: string;
  title: string;
  description: string;
  location: string;
  duration: string;
  type: 'activity' | 'restaurant' | 'transport' | 'accommodation' | 'attraction' | 'experience';
  price?: string;
  estimatedCost?: { amount: number; currency: string; perPerson?: boolean };
  bookingUrl?: string;
  affiliatePartner?: string;
  image?: string;
  rating?: number;
  reviewCount?: number;
  topReview?: string;
  freeCancellation?: boolean;
  isSaved?: boolean;
}

// Alias for backward compatibility
export type TripActivity = Activity;

export interface Hotel {
  id: string;
  name: string;
  description: string;
  pricePerNight: number;
  currency?: string;
  totalPrice: number;
  rating: number;
  reviewCount: number;
  amenities: string[];
  images: string[];
  bookingUrl: string;
  location: {
    name: string;
    address: string;
    lat: number;
    lng: number;
    neighborhood?: string;
  };
}

export interface TripDay {
  diningOptions?: DiningReviewOption[];
  timingProposal?: DayTimingProposal;
  date: string;
  dayNumber: number;
  theme: string;
  tips?: string[];
  activities: Activity[];
  transport?: {
    expiresAt?: string;
    type: 'flight' | 'train' | 'bus' | 'ferry';
    provider: string;
    departure: { airport: string; city: string; dateTime: string };
    arrival: { airport: string; city: string; dateTime: string };
    duration?: number;
    stops?: number;
    price?: number;
    currency: string;
    bookingUrl?: string;
    affiliatePartner?: string;
  };
}
