/**
 * Shared Mixpanel event names and property types for web and mobile.
 *
 * Keep event names consistent across platforms by importing from here.
 */

// ── Navigation & Page Views ──────────────────────────────────────────
export const EVENTS = {
  // Pages / Screens
  PAGE_VIEW: "Page View",
  SCREEN_VIEW: "Screen View",

  // Auth
  SIGN_UP: "Sign Up",
  SIGN_IN: "Sign In",
  SIGN_OUT: "Sign Out",

  // Trip creation flow
  TRIP_CREATE_STARTED: "Trip Create Started",
  TRIP_DESTINATION_SELECTED: "Trip Destination Selected",
  TRIP_DATES_SELECTED: "Trip Dates Selected",
  TRIP_PREFERENCES_SET: "Trip Preferences Set",
  TRIP_GENERATING: "Trip Generating",
  TRIP_CREATED: "Trip Created",

  // Trip engagement
  TRIP_VIEWED: "Trip Viewed",
  TRIP_SHARED: "Trip Shared",
  TRIP_DELETED: "Trip Deleted",

  // Itinerary
  ITINERARY_DAY_VIEWED: "Itinerary Day Viewed",
  ACTIVITY_VIEWED: "Activity Viewed",
  ACTIVITY_LINK_CLICKED: "Activity Link Clicked",

  // Affiliate
  AFFILIATE_CLICK: "Affiliate Click",
  AFFILIATE_CONVERSION: "Affiliate Conversion",

  // Blog
  BLOG_POST_VIEWED: "Blog Post Viewed",

  // Inspiration / Templates
  INSPIRATION_VIEWED: "Inspiration Viewed",

  // Onboarding
  ONBOARDING_STARTED: "Onboarding Started",
  ONBOARDING_COMPLETED: "Onboarding Completed",
  ONBOARDING_STEP_VIEWED: "Onboarding Step Viewed",

  // Engagement
  SEARCH_PERFORMED: "Search Performed",
  MAP_INTERACTED: "Map Interacted",
  CTA_CLICKED: "CTA Clicked",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// ── Common property types ────────────────────────────────────────────

export interface UserProperties {
  $name?: string;
  $email?: string;
  platform: "web" | "ios" | "android";
  app_version?: string;
}

export interface TripEventProperties {
  trip_id?: string;
  destination?: string;
  country?: string;
  duration_days?: number;
  traveler_count?: number;
  travel_style?: string;
}

export interface AffiliateEventProperties {
  partner: string;
  product_id: string;
  product_name: string;
  trip_id?: string;
}
