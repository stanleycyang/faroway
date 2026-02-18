/**
 * Affiliate Partner Integrations
 * 
 * This module provides integrations with travel affiliate partners:
 * - Viator (tours & experiences) - 15-20% commission
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
} from './viator';

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
} from './booking';

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
} from './tracking';
