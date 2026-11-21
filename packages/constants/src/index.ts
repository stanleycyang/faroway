/**
 * @faroway/constants
 * Shared constants for Faroway web and mobile apps.
 */

export {
  popularDestinations,
  CANONICAL_TRAVEL_VIBE_IDS,
  travelVibes,
  VIBE_ALIASES,
  normalizeVibeId,
  normalizeVibeList,
  travelerTypes,
} from "./destinations";
export type {
  Destination,
  TravelVibeId,
  TravelVibe,
  TravelerTypeOption,
} from "./destinations";
export {
  VIBE_KEYWORDS,
  BUDGET_RANGES,
  BUDGET_TIERS,
  BUDGET_LABELS,
  BUDGET_TIER_ALIASES,
  normalizeBudgetTier,
  formatBudgetLabel,
} from "./search";
export type {
  BudgetTierId,
  BudgetTierLabel,
  BudgetTierOption,
} from "./search";
export { INSPIRATION_CATEGORIES, getInspirationBySlug } from "./inspirations";
export type { InspirationCategory } from "./inspirations";
export { IMAGE_PATHS } from "./images";
export { getImageUrl } from "./storage";

export * from "./pricing";
export * from "./affiliates";

export {
  tripDatePhase,
  localCalendarDate,
  type TripDatePhase,
} from "./trip-dates";

export * from "./hotel-search";
export * from "./flight-search";
export * from "./flight-quote";

export {
  destinationImage,
  destinationCoverCatalog,
  supplementalDestinationPhotos,
} from "./destination-covers";
