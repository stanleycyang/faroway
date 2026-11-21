/**
 * Affiliate Partner Integrations
 *
 * This module provides integrations with travel affiliate partners:
 * - Viator & GetYourGuide & Klook & Tiqets (tours & experiences)
 * - Stay22, Booking.com, Expedia, Hostelworld (hotels & stays)
 * - Duffel, Skyscanner, Aviasales (flights)
 * - SafetyWing, Airalo, DiscoverCars, iVisa/Sherpa, Wise (trip essentials)
 * - Travelpayouts wrapper & click tracking for commission attribution
 */

export {
  envTrim,
  envFlag,
  finalizeAffiliateLink,
  type AffiliateLinkResult,
} from "./types";

// Travelpayouts (Multi-vertical affiliate network wrapper)
export {
  isTravelpayoutsConfigured,
  buildTravelpayoutsLink,
} from "./travelpayouts";

// Hotels (Stay22, Booking.com, Expedia, Hostelworld + LiteAPI gate status)
export {
  buildStay22Url,
  buildBookingUrl,
  buildExpediaHotelUrl,
  buildHostelworldUrl,
  buildHotelPartnerLinks,
  type HotelDeepLinkParams,
} from "./hotels";

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
export { buildViatorHandoffUrl, buildViatorSearchUrl } from "./viator-link";

// GetYourGuide (Tours & Activities)
export {
  isGYGConfigured,
  searchGYGActivities,
  getGYGActivity,
  checkGYGAvailability,
  buildGYGAffiliateUrl,
  generateGYGAffiliateUrl,
  buildGYGSearchUrl,
  mapGYGCategoryToVibe,
  type GYGSearchParams,
  type GYGActivity,
  type GYGAvailability,
} from "./getyourguide";

// Additional Activity Fallbacks (Klook, Tiqets via Travelpayouts)
export {
  buildKlookActivitySearchUrl,
  buildTiqetsActivitySearchUrl,
  buildActivityFallbackLinks,
} from "./activities";

// Duffel (Flights via Links) & Flight Search Fallbacks
export {
  isDuffelConfigured,
  searchDuffelFlights,
  generateDuffelLink,
  parseDuffelReturnStatus,
  type DuffelFlightSearchParams,
  type DuffelOffer,
  type DuffelOfferSlice,
  type DuffelReturnStatus,
} from "./duffel";
export {
  buildSkyscannerFlightUrl,
  buildAviasalesFlightUrl,
  buildFlightFallbackLinks,
  type FlightFallbackParams,
} from "./flights";

// Trip Essentials (SafetyWing, Airalo, DiscoverCars, iVisa/Sherpa, Wise)
export {
  resolveDestinationTravelMeta,
  buildSafetyWingUrl,
  buildAiraloUrl,
  buildDiscoverCarsUrl,
  buildVisaToolUrl,
  buildWiseUrl,
  buildTripEssentials,
} from "./essentials";

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

// Click Tracking
export {
  generateTrackingId,
  detectDeviceType,
  trackClick,
  recordConversion,
  getClickByTrackingId,
  getUserClicks,
  getAffiliateAnalytics,
  type AffiliatePartner,
  type AffiliateClick,
  type TrackClickInput,
  type TrackClickResult,
  type ConversionInput,
} from "./tracking";
