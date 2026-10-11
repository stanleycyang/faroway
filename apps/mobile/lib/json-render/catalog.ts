import { z } from 'zod';

/**
 * Faroway Component Catalog
 *
 * This catalog defines all the components that can be used in the json-render
 * itinerary generation. Each component has a Zod schema for type safety and
 * a description to help the AI understand when to use it.
 */

// =============================================================================
// Trip Summary Component
// =============================================================================

export const TripSummarySchema = z.object({
  destination: z.string().describe('The destination city or location'),
  dates: z.string().describe('Date range for the trip (e.g., "Mar 15 - Mar 22, 2024")'),
  travelers: z.number().describe('Number of travelers'),
  budget: z.string().optional().describe('Budget level (e.g., "moderate", "luxury")'),
});

export const TripSummary = {
  name: 'TripSummary',
  schema: TripSummarySchema,
  description:
    'Display a summary card at the top of the itinerary with key trip details. Use this once at the beginning of the itinerary.',
};

// =============================================================================
// Hero Image Component
// =============================================================================

export const HeroImageSchema = z.object({
  url: z.string().url().describe('URL of the destination hero image'),
  alt: z.string().describe('Alt text for the image'),
  overlay: z.boolean().optional().describe('Whether to show a gradient overlay'),
});

export const HeroImage = {
  name: 'HeroImage',
  schema: HeroImageSchema,
  description:
    'A large hero image showcasing the destination. Use once at the top of the itinerary.',
};

// =============================================================================
// Section Component
// =============================================================================

export const SectionSchema = z.object({
  title: z.string().describe('Section header text'),
});

export const Section = {
  name: 'Section',
  schema: SectionSchema,
  description:
    'A section header to organize content. Use to separate different parts of the itinerary (e.g., "Accommodation", "Day 1", "Transportation").',
};

// =============================================================================
// Text Component
// =============================================================================

export const TextSchema = z.object({
  content: z.string().describe('The text content to display'),
  variant: z
    .enum(['body', 'caption', 'subtitle', 'title'])
    .optional()
    .describe('Text style variant'),
});

export const Text = {
  name: 'Text',
  schema: TextSchema,
  description: 'Generic text component for descriptions, notes, or any text content.',
};

// =============================================================================
// Hotel Card Component
// =============================================================================

export const HotelCardSchema = z.object({
  name: z.string().describe('Hotel or accommodation name'),
  rating: z.number().min(0).max(5).optional().describe('Verified rating, when known'),
  pricePerNight: z
    .number()
    .optional()
    .describe('Estimated price per night in the supplied currency'),
  currency: z.string().optional().describe('Explicit currency code; omit when unknown'),
  image: z.string().url().optional().describe('Hotel image URL'),
  bookingUrl: z.string().url().optional().describe('Booking URL (booking.com, etc.)'),
  amenities: z.array(z.string()).describe('List of amenities (e.g., ["WiFi", "Pool", "Gym"])'),
  description: z.string().optional().describe('Brief hotel description'),
  reviewCount: z.number().optional().describe('Number of reviews'),
});

export const HotelCard = {
  name: 'HotelCard',
  schema: HotelCardSchema,
  description:
    'Display hotel or accommodation details with booking CTA. Use once per trip to show the recommended hotel.',
};

// =============================================================================
// Itinerary Day Component
// =============================================================================

export const ItineraryDaySchema = z.object({
  dayNumber: z.number().describe('Day number in the trip (1, 2, 3, ...)'),
  date: z.string().describe('The date for this day (e.g., "2024-03-15")'),
  title: z.string().describe('Theme or title for the day (e.g., "Historic Sites & Culture")'),
});

export const ItineraryDay = {
  name: 'ItineraryDay',
  schema: ItineraryDaySchema,
  description:
    'A container/header for a day in the itinerary. Use before listing activities for each day. Activities should be added after this component.',
};

// =============================================================================
// Activity Card Component
// =============================================================================

export const ActivityCardSchema = z.object({
  name: z.string().describe('Activity name'),
  description: z.string().describe('Activity description'),
  duration: z.string().describe('Duration (e.g., "2 hours", "3-4 hours")'),
  price: z.number().optional().describe('Estimated price in the supplied currency'),
  currency: z.string().optional().describe('Explicit currency code; omit when unknown'),
  priceStatus: z.enum(['unknown', 'estimate']).optional(),
  rating: z.number().min(0).max(5).optional().describe('Rating (0-5)'),
  reviewCount: z.number().optional().describe('Number of reviews'),
  image: z.string().url().optional().describe('Activity image URL'),
  bookingUrl: z.string().url().optional().describe('Viator or booking URL'),
  time: z.string().describe('Suggested time (e.g., "09:00", "14:30")'),
  location: z.string().optional().describe('Location name or address'),
});

export const ActivityCard = {
  name: 'ActivityCard',
  schema: ActivityCardSchema,
  description:
    'Display an activity, attraction, or experience with booking details. Use for tours, museums, attractions, shows, experiences.',
};

// =============================================================================
// Restaurant Card Component
// =============================================================================

export const RestaurantCardSchema = z.object({
  name: z.string().describe('Restaurant name'),
  cuisine: z.string().describe('Cuisine type (e.g., "Italian", "Seafood", "Local")'),
  priceLevel: z.number().min(1).max(4).optional().describe('Estimated price level, when known'),
  priceStatus: z.enum(['unknown', 'estimate']).optional(),
  rating: z.number().min(0).max(5).optional().describe('Rating (0-5)'),
  reviewCount: z.number().optional().describe('Number of reviews'),
  image: z.string().url().optional().describe('Restaurant image URL'),
  reservationUrl: z.string().url().optional().describe('OpenTable or reservation URL'),
  description: z.string().optional().describe('Brief description of the restaurant'),
  time: z.string().optional().describe('Suggested meal time (e.g., "12:30", "19:00")'),
});

export const RestaurantCard = {
  name: 'RestaurantCard',
  schema: RestaurantCardSchema,
  description:
    'Display a restaurant recommendation with reservation link. Use for breakfast, lunch, dinner, or cafe recommendations.',
};

// =============================================================================
// Day Timeline Component
// =============================================================================

export const DayTimelineSchema = z.object({
  items: z
    .array(
      z.object({
        time: z.string().describe('Time (e.g., "09:00")'),
        title: z.string().describe('Activity/meal title'),
        type: z
          .enum(['activity', 'restaurant', 'transport', 'rest'])
          .describe('Type of timeline item'),
      })
    )
    .describe('Timeline items for the day'),
});

export const DayTimeline = {
  name: 'DayTimeline',
  schema: DayTimelineSchema,
  description:
    'Show a vertical timeline of all events for a day. Use as an overview/summary of a day before showing detailed cards.',
};

// =============================================================================
// Booking Button Component
// =============================================================================

export const BookingButtonSchema = z.object({
  label: z.string().describe('Button label (e.g., "Book on Viator", "Reserve Table")'),
  url: z.string().url().describe('Booking URL'),
  provider: z.string().optional().describe('Provider name (e.g., "Viator", "Booking.com")'),
  price: z.number().optional().describe('Price in the supplied currency (optional)'),
  currency: z.string().optional().describe('Explicit currency code; omit when unknown'),
});

export const BookingButton = {
  name: 'BookingButton',
  schema: BookingButtonSchema,
  description:
    'A prominent call-to-action button for booking. Can be used standalone or within other components.',
};

// =============================================================================
// Price Tag Component
// =============================================================================

export const PriceTagSchema = z.object({
  amount: z.number().describe('Price amount'),
  currency: z.string().optional().describe('Explicit currency code; omit when unknown'),
  period: z.string().optional().describe('Period (e.g., "per person", "per night", "total")'),
});

export const PriceTag = {
  name: 'PriceTag',
  schema: PriceTagSchema,
  description: 'Display a price in a styled format. Use for showing costs in any component.',
};

// =============================================================================
// Rating Stars Component
// =============================================================================

export const RatingStarsSchema = z.object({
  rating: z.number().min(0).max(5).describe('Rating value (0-5)'),
  reviewCount: z.number().optional().describe('Number of reviews'),
});

export const RatingStars = {
  name: 'RatingStars',
  schema: RatingStarsSchema,
  description:
    'Display a star rating with optional review count. Use within other components or standalone.',
};

// =============================================================================
// Map Preview Component
// =============================================================================

export const MapPreviewSchema = z.object({
  markers: z
    .array(
      z.object({
        lat: z.number().describe('Latitude'),
        lng: z.number().describe('Longitude'),
        label: z.string().describe('Marker label'),
      })
    )
    .describe('Array of location markers to show on the map'),
  center: z
    .object({
      lat: z.number().describe('Center latitude'),
      lng: z.number().describe('Center longitude'),
    })
    .optional()
    .describe('Map center (defaults to first marker)'),
  zoom: z.number().optional().describe('Zoom level (default: 13)'),
});

export const MapPreview = {
  name: 'MapPreview',
  schema: MapPreviewSchema,
  description:
    'Show a map with location markers. Use to visualize hotel location or day activities on a map.',
};

// =============================================================================
// Catalog Export
// =============================================================================

export const catalog = {
  TripSummary,
  HeroImage,
  Section,
  Text,
  HotelCard,
  ItineraryDay,
  ActivityCard,
  RestaurantCard,
  DayTimeline,
  BookingButton,
  PriceTag,
  RatingStars,
  MapPreview,
};

export type CatalogComponents = typeof catalog;
