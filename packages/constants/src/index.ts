/**
 * @faroway/constants
 * Shared constants for Faroway web and mobile apps.
 */

export {
  popularDestinations,
  travelVibes,
  travelerTypes,
} from "./destinations";
export type {
  Destination,
  TravelVibe,
  TravelerTypeOption,
} from "./destinations";
export { VIBE_KEYWORDS, BUDGET_RANGES } from "./search";
export { INSPIRATION_CATEGORIES, getInspirationBySlug } from "./inspirations";
export type { InspirationCategory } from "./inspirations";
export { IMAGE_PATHS } from "./images";
export { getImageUrl } from "./storage";

export * from "./pricing";
export * from "./hotel-search";
