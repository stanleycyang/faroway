/**
 * @faroway/types
 * Shared type definitions for Faroway web and mobile apps.
 * Pure TypeScript interfaces — zero runtime dependencies.
 */

// =============================================================================
// Common / Utility Types
// =============================================================================

export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// =============================================================================
// User Types
// =============================================================================

export interface User {
  id: string;
  email: string;
  name?: string;
  authProvider?: string;
  subscriptionTier?: "free" | "pro" | "premium";
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type UserPublic = Omit<User, "password_hash">;

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  authProvider: string;
  subscriptionTier: "free" | "pro" | "premium";
  preferences?: {
    vibes?: string[];
    budget?: string;
    travelerType?: string;
  };
  notificationSettings?: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Trip Types
// =============================================================================

/**
 * Unified Trip status superset.
 * Web statuses: draft, planning, booked, in_progress, completed, canceled
 * Mobile statuses: draft, planned, active, completed
 */
export type TripStatus =
  | "draft"
  | "planning"
  | "planned"
  | "generating"
  | "generated"
  | "failed"
  | "booked"
  | "active"
  | "in_progress"
  | "completed"
  | "canceled"
  | "cancelled"
  | "paid";

export interface Trip {
  id: string;
  user_id?: string;
  destination: string;
  country?: string;
  start_date?: string;
  end_date?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  travelerType?: string;
  vibes?: string[];
  budget?: number | string | null;
  status: TripStatus;
  share_token?: string | null;
  is_shared?: boolean;
  shared_at?: string | null;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
}

export interface CreateTripInput {
  destination: string;
  start_date?: string;
  end_date?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  status?: TripStatus;
  travelers?: number;
  preferences?: {
    travelerType?: TravelerType;
    vibes?: string[];
    originCity?: string;
    originAirport?: string;
  };
}

export interface UpdateTripInput {
  destination?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
  status?: TripStatus;
}

// =============================================================================
// Travel Style & Preferences
// =============================================================================

export type TravelStyle =
  | "budget"
  | "mid_range"
  | "luxury"
  | "backpacker"
  | "business";

export type BudgetLevel = "budget" | "moderate" | "luxury";

export type TravelerType =
  | "solo"
  | "couple"
  | "family"
  | "friends"
  | "business";

export type TimeOfDay = "morning" | "afternoon" | "evening";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface Preferences {
  id: string;
  user_id: string;
  interests: string[];
  travel_style: TravelStyle | null;
  dietary_restrictions: string[];
  created_at?: string;
  updated_at?: string;
}

export interface TripPreferences {
  destination: string;
  startDate: string;
  endDate: string;
  budget: BudgetLevel;
  vibes: string[];
  travelers: {
    adults: number;
    children: number;
  };
  interests?: string[];
  dietaryRestrictions?: string[];
  mobilityNeeds?: string;
}

// =============================================================================
// Location Types
// =============================================================================

export interface LocationInfo {
  name: string;
  address: string;
  lat: number;
  lng: number;
  neighborhood?: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

// =============================================================================
// Itinerary Types (AI-generated)
// =============================================================================

export interface ItineraryActivity {
  id: string;
  name: string;
  description: string;
  duration: number;
  estimatedCost: {
    amount: number;
    currency: string;
  };
  timeOfDay: TimeOfDay;
  category:
    | "sightseeing"
    | "adventure"
    | "cultural"
    | "relaxation"
    | "entertainment"
    | "shopping";
  location: {
    name: string;
    address?: string;
    coordinates?: Coordinates;
  };
  vibeMatch: {
    matchedVibes: string[];
    reasoning: string;
  };
  bookingInfo?: {
    requiresReservation: boolean;
    bookingUrl?: string;
    affiliateId?: string;
  };
  rating?: number;
  reviewCount?: number;
  images?: string[];
  tripadvisorRating?: number;
  tripadvisorReviewCount?: number;
  tripadvisorUrl?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisineType: string[];
  priceLevel: 1 | 2 | 3 | 4;
  description: string;
  estimatedCost: {
    amount: number;
    currency: string;
    perPerson: boolean;
  };
  mealType: MealType;
  location: {
    name: string;
    address?: string;
    coordinates?: Coordinates;
  };
  dietaryOptions: string[];
  vibeMatch: {
    matchedVibes: string[];
    reasoning: string;
  };
  reservationInfo?: {
    recommended: boolean;
    url?: string;
  };
  rating?: number;
  reviewCount?: number;
  tripadvisorRating?: number;
  tripadvisorReviewCount?: number;
  tripadvisorUrl?: string;
}

export interface TripDayTransport {
  type: "flight" | "train" | "bus" | "ferry";
  provider: string;
  departure: { airport: string; city: string; dateTime: string };
  arrival: { airport: string; city: string; dateTime: string };
  duration: number;
  stops: number;
  price: number;
  currency: string;
  affiliateUrl?: string;
  affiliatePartner?: string;
}

export interface TripDay {
  dayNumber: number;
  date: string;
  title: string;
  summary: string;
  morning: {
    activities: ItineraryActivity[];
    meals: Restaurant[];
  };
  afternoon: {
    activities: ItineraryActivity[];
    meals: Restaurant[];
  };
  evening: {
    activities: ItineraryActivity[];
    meals: Restaurant[];
  };
  transport?: TripDayTransport;
  totalEstimatedCost: {
    amount: number;
    currency: string;
  };
  tips: string[];
}

export interface GeneratedItinerary {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  days: TripDay[];
  totalEstimatedCost: {
    amount: number;
    currency: string;
  };
  overview: string;
  packingList?: string[];
  generalTips?: string[];
  generatedAt: string;
}

export interface ItineraryGenerationRequest {
  preferences: TripPreferences;
  userId: string;
  additionalNotes?: string;
}

export interface StreamingProgress {
  status: "started" | "processing" | "completed" | "error";
  currentDay?: number;
  totalDays: number;
  message: string;
  partialItinerary?: Partial<GeneratedItinerary>;
}

export interface AIGenerationError {
  code: string;
  message: string;
  details?: unknown;
}

// =============================================================================
// Search Types
// =============================================================================

export interface SearchInput {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelerType?: TravelerType;
  vibes: string[];
  budget?: BudgetLevel;
  userId?: string;
  originCity?: string;
  originAirport?: string;
}

export type SearchStatus = "pending" | "searching" | "completed" | "error";

export type AgentStatus = "pending" | "searching" | "done" | "error";

export interface SearchProgress {
  orchestrator: AgentStatus;
  hotels: AgentStatus;
  activities: AgentStatus;
  dining: AgentStatus;
  transport: AgentStatus;
  enrichment?: AgentStatus;
  aggregator: AgentStatus;
}

export interface SearchRecord {
  id: string;
  user_id: string | null;
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  traveler_type: string | null;
  vibes: string[];
  budget: string;
  status: SearchStatus;
  workflow_run_id: string | null;
  progress: SearchProgress;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface SearchPlan {
  destination: string;
  country: string;
  dates: {
    start: string;
    end: string;
    nights: number;
  };
  searchPriorities: ("hotels" | "activities" | "dining" | "transport")[];
  hotelCriteria: {
    priceRange: { min: number; max: number };
    starRating: number[];
    amenities: string[];
    neighborhoods: string[];
  };
  activityCriteria: {
    categories: string[];
    pacePreference: "relaxed" | "moderate" | "packed";
    mustSee: string[];
    interests: string[];
  };
  diningCriteria: {
    cuisineTypes: string[];
    priceRange: "budget" | "moderate" | "upscale";
    dietaryNeeds: string[];
    mealPriorities: ("breakfast" | "lunch" | "dinner")[];
  };
  vibeInterpretation: {
    vibes: string[];
    searchKeywords: string[];
    avoidKeywords: string[];
  };
  transportCriteria?: {
    originCity?: string;
    originAirport?: string;
    destinationAirport?: string;
    cabinClass: "economy" | "premium_economy" | "business" | "first";
    maxStops: number;
    maxPrice?: number;
    preferredAirlines?: string[];
  };
}

// =============================================================================
// Search Result Types
// =============================================================================

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
  location: LocationInfo;
  images: string[];
  affiliateUrl: string;
  affiliatePartner: string;
  vibeScore: number;
  vibeMatch: string[];
  tripadvisorRating?: number;
  tripadvisorReviewCount?: number;
  tripadvisorUrl?: string;
  tripadvisorRankingString?: string;
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
  location: LocationInfo;
  images: string[];
  affiliateUrl?: string;
  affiliatePartner?: string;
  bestTimeOfDay: "morning" | "afternoon" | "evening" | "any";
  vibeScore: number;
  vibeMatch: string[];
  bookingRequired: boolean;
  tripadvisorRating?: number;
  tripadvisorReviewCount?: number;
  tripadvisorUrl?: string;
}

export interface DiningResult {
  id: string;
  name: string;
  description: string;
  cuisineTypes: string[];
  priceLevel: 1 | 2 | 3 | 4;
  rating: number;
  reviewCount: number;
  location: LocationInfo;
  images: string[];
  reservationUrl?: string;
  affiliatePartner?: string;
  mealTypes: ("breakfast" | "lunch" | "dinner")[];
  vibeScore: number;
  vibeMatch: string[];
  dietaryOptions: string[];
  tripadvisorRating?: number;
  tripadvisorReviewCount?: number;
  tripadvisorUrl?: string;
}

// =============================================================================
// Transport Result Types
// =============================================================================

export interface TransportSegment {
  carrier: string;
  flightNumber?: string;
  departure: { airport: string; dateTime: string };
  arrival: { airport: string; dateTime: string };
  duration: number;
  cabinClass?: string;
}

export interface TransportResult {
  id: string;
  type: "flight" | "train" | "bus" | "ferry";
  provider: string;
  departure: {
    airport: string;
    city: string;
    dateTime: string;
    terminal?: string;
  };
  arrival: {
    airport: string;
    city: string;
    dateTime: string;
    terminal?: string;
  };
  duration: number;
  stops: number;
  price: number;
  currency: string;
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  airlines: string[];
  segments: TransportSegment[];
  affiliateUrl: string;
  affiliatePartner: string;
  source: "amadeus" | "duffel";
  vibeScore: number;
  vibeMatch: string[];
}

export interface SearchResults {
  searchId: string;
  hotels: HotelResult[];
  activities: ActivityResult[];
  dining: DiningResult[];
  transport: TransportResult[];
  itinerary: SuggestedDay[];
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
  transport?: TransportResult;
  estimatedCost: number;
  currency: string;
  tips: string[];
}

// =============================================================================
// Search API Response Types
// =============================================================================

export interface StartSearchResponse {
  searchId: string;
  workflowRunId: string;
  status: "started";
  estimatedTime: number;
}

export interface SearchStatusResponse {
  searchId: string;
  status: SearchStatus;
  progress: SearchProgress;
  results?: SearchResults;
  jsonRenderSpec?: unknown;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

// =============================================================================
// Affiliate Types
// =============================================================================

export interface TrackClickParams {
  itemType: "hotel" | "activity" | "restaurant" | "flight" | "transport";
  itemId: string;
  itemName: string;
  affiliatePartner: string;
  affiliateUrl: string;
  searchId?: string;
  tripId?: string;
  price?: number;
  currency?: string;
  source?: "search_results" | "trip_view" | "itinerary" | "email";
}

export interface TrackClickResponse {
  clickId: string;
  redirectUrl: string;
}

// =============================================================================
// Destination Types
// =============================================================================

export interface DestinationInfo {
  id: string;
  slug: string;
  name: string;
  country: string;
  description: string;
  image: string;
  tags: string[];
  seasons: {
    peak: number[];
    good: number[];
    off: number[];
  };
  currency: string;
  language: string;
  bestTime: string;
  score: number;
  tripCount?: number;
  searchCount?: number;
}

export interface DestinationsResponse {
  destinations: DestinationInfo[];
  total: number;
  limit: number;
  offset: number;
}

// =============================================================================
// Legacy Activity type (from Express backend, used in itinerary CRUD)
// =============================================================================

export interface Activity {
  time: string;
  title: string;
  description: string;
  location?: string;
  duration_minutes?: number;
  cost?: number;
  category?: string;
}

export interface Itinerary {
  id: string;
  trip_id: string;
  day_number: number;
  activities: Activity[];
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}
