/**
 * Affiliate Partner Integrations
 *
 * This module provides integrations with travel affiliate partners:
 * - Viator (tours & experiences) - commission depends on the approved agreement
 * - Booking.com (hotels) - 25-40% commission
 * - Click tracking for commission attribution
 */

// Viator (Tours & Experiences)
export {
  isViatorConfigured,
  searchViatorProducts,
  getViatorProduct,
  checkViatorAvailability,
  generateViatorAffiliateUrl,
  mapViatorCategoryToVibe,
  type ViatorSearchParams,
  type ViatorProduct,
  type ViatorAvailability,
} from "./viator";

// GetYourGuide (Tours & Activities)
export {
  isGYGConfigured,
  searchGYGActivities,
  getGYGActivity,
  checkGYGAvailability,
  generateGYGAffiliateUrl,
  mapGYGCategoryToVibe,
  type GYGSearchParams,
  type GYGActivity,
  type GYGAvailability,
} from "./getyourguide";

// Booking.com (Hotels)
export {
  isBookingConfigured,
  getBookingDestinationId,
  searchBookingHotels,
  getBookingHotel,
  generateBookingAffiliateUrl,
  generateBookingSearchUrl,
  mapBookingAmenitiesToVibe,
  calculateHotelVibeScore,
  type BookingSearchParams,
  type BookingHotel,
  type BookingAvailability,
} from "./booking";

// Amadeus (Flights & Hotels)
export {
  isAmadeusConfigured,
  searchAmadeusFlights,
  searchAmadeusHotels,
  generateAmadeusAffiliateUrl,
  type AmadeusFlightSearchParams,
  type AmadeusFlightOffer,
  type AmadeusHotelSearchParams,
  type AmadeusHotel,
} from "./amadeus";

// Duffel (Flights via Links)
export {
  isDuffelConfigured,
  searchDuffelFlights,
  generateDuffelLink,
  type DuffelFlightSearchParams,
  type DuffelOffer,
} from "./duffel";

// TripAdvisor Content API (Enrichment)
export {
  isTripAdvisorConfigured,
  searchTripAdvisorLocations,
  getTripAdvisorDetails,
  getTripAdvisorReviews,
  enrichWithTripAdvisor,
  generateTripAdvisorAffiliateUrl,
  type TripAdvisorLocation,
  type TripAdvisorDetails,
  type TripAdvisorReview,
} from "./tripadvisor";
