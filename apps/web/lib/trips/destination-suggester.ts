import {
  IMAGE_PATHS,
  destinationCoverCatalog,
  getImageUrl,
} from "@faroway/constants";
import { z } from "zod";
import { VALID_BUDGETS, type BudgetTier, type VibeId } from "./prompt-parser";

type CatalogEntry = (typeof destinationCoverCatalog)[number];
export type CatalogSlug = CatalogEntry[0];

export type DestinationRegion =
  | "asia"
  | "europe"
  | "north-america"
  | "latin-america"
  | "middle-east"
  | "africa"
  | "oceania";

export type ClimateProfile =
  | "warm"
  | "mild"
  | "cool"
  | "tropical"
  | "alpine"
  | "desert";

export type HubRegion = "usWest" | "usEast" | "europe" | "asia";

interface DestinationProfile {
  region: DestinationRegion;
  climate: ClimateProfile;
  bestMonths: readonly number[];
  shoulderMonths: readonly number[];
  seasonSummary: string;
  vibes: readonly VibeId[];
  budgetFit: readonly BudgetTier[];
  idealDays: readonly [number, number];
  highlights: readonly string[];
  tags: readonly string[];
  flightHoursByHub: Record<HubRegion, number>;
}

const DESTINATION_PROFILES: Record<CatalogSlug, DestinationProfile> = {
  tokyo: {
    region: "asia",
    climate: "mild",
    bestMonths: [3, 4, 5, 10, 11],
    shoulderMonths: [2, 6, 9, 12],
    seasonSummary:
      "Crisp spring cherry blossoms (Mar–May) and autumn foliage (Oct–Nov) bring comfortable walking weather.",
    vibes: ["foodie", "cultural", "shopping", "nightlife", "photography"],
    budgetFit: ["moderate", "luxury", "budget"],
    idealDays: [5, 10],
    highlights: ["neighborhood dining", "historic shrines", "seamless transit"],
    tags: [
      "japan",
      "city",
      "walkable",
      "transit",
      "ramen",
      "sushi",
      "cherry blossom",
      "autumn",
      "family",
      "solo",
      "modern",
    ],
    flightHoursByHub: { usWest: 11, usEast: 14, europe: 13, asia: 4 },
  },
  bali: {
    region: "asia",
    climate: "tropical",
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    shoulderMonths: [3, 11],
    seasonSummary:
      "Dry season runs Apr–Oct with sunny coastal days and lush highland mornings.",
    vibes: ["wellness", "relaxation", "nature", "adventure", "romantic"],
    budgetFit: ["budget", "moderate", "luxury"],
    idealDays: [6, 12],
    highlights: ["rice terraces", "wellness retreats", "warm beaches"],
    tags: [
      "indonesia",
      "island",
      "beach",
      "warm",
      "surf",
      "yoga",
      "spa",
      "honeymoon",
      "jungle",
      "affordable",
    ],
    flightHoursByHub: { usWest: 18, usEast: 21, europe: 16, asia: 5 },
  },
  bangkok: {
    region: "asia",
    climate: "tropical",
    bestMonths: [11, 12, 1, 2],
    shoulderMonths: [3, 10],
    seasonSummary:
      "Cooler, drier winter months (Nov–Feb) are ideal for markets, river ferries, and temple walks.",
    vibes: ["foodie", "cultural", "nightlife", "shopping", "wellness"],
    budgetFit: ["budget", "moderate", "luxury"],
    idealDays: [3, 6],
    highlights: [
      "street-food markets",
      "ornate temples",
      "riverfront neighborhoods",
    ],
    tags: [
      "thailand",
      "warm",
      "street food",
      "markets",
      "affordable",
      "winter sun",
      "city",
      "solo",
    ],
    flightHoursByHub: { usWest: 17, usEast: 20, europe: 12, asia: 3 },
  },
  dubai: {
    region: "middle-east",
    climate: "desert",
    bestMonths: [11, 12, 1, 2, 3],
    shoulderMonths: [4, 10],
    seasonSummary:
      "Pleasant winter sunshine (Nov–Mar) makes beach clubs, souks, and desert evenings comfortable.",
    vibes: ["shopping", "relaxation", "foodie", "nightlife"],
    budgetFit: ["luxury", "moderate"],
    idealDays: [4, 6],
    highlights: [
      "winter beach warmth",
      "desert dunes",
      "contemporary architecture",
    ],
    tags: [
      "uae",
      "desert",
      "warm",
      "winter sun",
      "beach",
      "modern",
      "family",
      "luxury",
    ],
    flightHoursByHub: { usWest: 16, usEast: 13, europe: 7, asia: 7 },
  },
  paris: {
    region: "europe",
    climate: "mild",
    bestMonths: [4, 5, 6, 9, 10],
    shoulderMonths: [3, 7, 8, 11],
    seasonSummary:
      "Spring café terraces (Apr–Jun) and golden autumn avenues (Sep–Oct) balance mild weather with lighter crowds.",
    vibes: ["cultural", "foodie", "romantic", "shopping", "photography"],
    budgetFit: ["moderate", "luxury"],
    idealDays: [4, 7],
    highlights: [
      "world-class museums",
      "neighborhood bistros",
      "riverfront strolls",
    ],
    tags: [
      "france",
      "walkable",
      "city",
      "art",
      "wine",
      "bakery",
      "anniversary",
      "honeymoon",
      "architecture",
    ],
    flightHoursByHub: { usWest: 11, usEast: 7, europe: 2, asia: 13 },
  },
  barcelona: {
    region: "europe",
    climate: "warm",
    bestMonths: [5, 6, 9, 10],
    shoulderMonths: [4, 7, 8, 11],
    seasonSummary:
      "Late spring (May–Jun) and early fall (Sep–Oct) deliver warm Mediterranean sunshine without peak summer heat.",
    vibes: ["foodie", "cultural", "nightlife", "relaxation", "photography"],
    budgetFit: ["moderate", "budget", "luxury"],
    idealDays: [4, 7],
    highlights: [
      "modernist architecture",
      "coastal promenades",
      "tapas culture",
    ],
    tags: [
      "spain",
      "beach",
      "coast",
      "walkable",
      "tapas",
      "architecture",
      "friends",
      "warm",
      "city",
    ],
    flightHoursByHub: { usWest: 12, usEast: 8, europe: 2, asia: 14 },
  },
  santorini: {
    region: "europe",
    climate: "warm",
    bestMonths: [5, 6, 9, 10],
    shoulderMonths: [4, 7, 8],
    seasonSummary:
      "May–Jun and Sep–Oct pair warm Aegean seas and iconic sunsets with calmer cliffside paths.",
    vibes: ["romantic", "relaxation", "photography", "foodie", "wellness"],
    budgetFit: ["luxury", "moderate"],
    idealDays: [3, 5],
    highlights: ["caldera sunsets", "cliffside villages", "island wineries"],
    tags: [
      "greece",
      "island",
      "beach",
      "warm",
      "honeymoon",
      "anniversary",
      "coast",
      "wine",
      "sunset",
    ],
    flightHoursByHub: { usWest: 15, usEast: 11, europe: 4, asia: 13 },
  },
  london: {
    region: "europe",
    climate: "mild",
    bestMonths: [5, 6, 7, 8, 9],
    shoulderMonths: [4, 10, 12],
    seasonSummary:
      "May–Sep brings long park-filled days and outdoor markets; December shines for festive lights and theatre.",
    vibes: ["cultural", "foodie", "shopping", "nightlife", "photography"],
    budgetFit: ["moderate", "luxury"],
    idealDays: [4, 7],
    highlights: [
      "free national museums",
      "vibrant food halls",
      "walkable parks",
    ],
    tags: [
      "uk",
      "england",
      "walkable",
      "city",
      "museums",
      "theatre",
      "pubs",
      "family",
      "history",
    ],
    flightHoursByHub: { usWest: 10, usEast: 7, europe: 2, asia: 13 },
  },
  rome: {
    region: "europe",
    climate: "warm",
    bestMonths: [4, 5, 9, 10],
    shoulderMonths: [3, 6, 11],
    seasonSummary:
      "Spring (Apr–May) and autumn (Sep–Oct) keep outdoor ruins and piazza dinners breezy and pleasant.",
    vibes: ["cultural", "foodie", "romantic", "photography"],
    budgetFit: ["moderate", "budget", "luxury"],
    idealDays: [4, 6],
    highlights: ["ancient landmarks", "trattoria dining", "historic piazzas"],
    tags: [
      "italy",
      "history",
      "ruins",
      "pasta",
      "wine",
      "walkable",
      "city",
      "art",
      "family",
    ],
    flightHoursByHub: { usWest: 12, usEast: 9, europe: 2, asia: 13 },
  },
  lisbon: {
    region: "europe",
    climate: "warm",
    bestMonths: [4, 5, 6, 9, 10],
    shoulderMonths: [3, 7, 8, 11],
    seasonSummary:
      "Sunny Atlantic breezes make Apr–Jun and Sep–Oct wonderful for tiled neighborhoods and coastal day trips.",
    vibes: ["foodie", "cultural", "photography", "nightlife", "relaxation"],
    budgetFit: ["budget", "moderate"],
    idealDays: [4, 6],
    highlights: [
      "tiled viewpoints",
      "seafood & pastries",
      "easy coastal escapes",
    ],
    tags: [
      "portugal",
      "walkable",
      "coast",
      "warm",
      "affordable",
      "wine",
      "solo",
      "city",
      "autumn",
    ],
    flightHoursByHub: { usWest: 12, usEast: 7, europe: 3, asia: 15 },
  },
  reykjavik: {
    region: "europe",
    climate: "cool",
    bestMonths: [6, 7, 8, 9, 2, 3],
    shoulderMonths: [5, 10, 11],
    seasonSummary:
      "Summer (Jun–Aug) offers midnight sun and open highland roads; Sep–Mar brings northern lights and hot springs.",
    vibes: ["nature", "adventure", "wellness", "photography"],
    budgetFit: ["moderate", "luxury"],
    idealDays: [4, 7],
    highlights: [
      "geothermal lagoons",
      "waterfalls & glaciers",
      "scenic road loops",
    ],
    tags: [
      "iceland",
      "cool",
      "northern lights",
      "hot springs",
      "road trip",
      "hiking",
      "scenic",
      "short flight",
    ],
    flightHoursByHub: { usWest: 8, usEast: 6, europe: 3, asia: 14 },
  },
  "new-york": {
    region: "north-america",
    climate: "mild",
    bestMonths: [4, 5, 6, 9, 10],
    shoulderMonths: [3, 11, 12],
    seasonSummary:
      "Spring (Apr–Jun) and crisp fall (Sep–Oct) are prime for neighborhood walks and park afternoons.",
    vibes: ["foodie", "cultural", "shopping", "nightlife", "photography"],
    budgetFit: ["moderate", "luxury"],
    idealDays: [3, 6],
    highlights: ["global dining", "world-class arts", "iconic skyline walks"],
    tags: [
      "usa",
      "nyc",
      "walkable",
      "city",
      "museums",
      "theatre",
      "weekend",
      "solo",
      "friends",
    ],
    flightHoursByHub: { usWest: 5, usEast: 1, europe: 8, asia: 15 },
  },
  marrakech: {
    region: "africa",
    climate: "desert",
    bestMonths: [3, 4, 5, 10, 11],
    shoulderMonths: [2, 9, 12],
    seasonSummary:
      "Spring (Mar–May) and autumn (Oct–Nov) bring warm, sunny days ideal for courtyards, souks, and Atlas views.",
    vibes: ["cultural", "foodie", "shopping", "wellness", "photography"],
    budgetFit: ["budget", "moderate", "luxury"],
    idealDays: [3, 5],
    highlights: ["courtyard riads", "vibrant souks", "hammam & spice markets"],
    tags: [
      "morocco",
      "warm",
      "desert",
      "markets",
      "affordable",
      "halal",
      "architecture",
      "winter sun",
    ],
    flightHoursByHub: { usWest: 14, usEast: 8, europe: 4, asia: 15 },
  },
  "cape-town": {
    region: "africa",
    climate: "warm",
    bestMonths: [11, 12, 1, 2, 3],
    shoulderMonths: [4, 10],
    seasonSummary:
      "Southern-hemisphere summer (Nov–Mar) brings dry coastal sunshine, vineyards, and clear Table Mountain views.",
    vibes: ["nature", "adventure", "foodie", "photography", "relaxation"],
    budgetFit: ["moderate", "budget", "luxury"],
    idealDays: [5, 9],
    highlights: ["coastal mountains", "nearby wine valleys", "dramatic drives"],
    tags: [
      "south africa",
      "warm",
      "winter sun",
      "wine",
      "hiking",
      "coast",
      "beach",
      "wildlife",
      "scenic",
    ],
    flightHoursByHub: { usWest: 21, usEast: 15, europe: 12, asia: 16 },
  },
  singapore: {
    region: "asia",
    climate: "tropical",
    bestMonths: [2, 3, 4, 7, 8],
    shoulderMonths: [1, 5, 6, 9, 10],
    seasonSummary:
      "Warm year-round with slightly drier stretches in Feb–Apr and Jul–Aug; indoor gardens make showers easy.",
    vibes: ["foodie", "cultural", "shopping", "nature", "photography"],
    budgetFit: ["moderate", "luxury"],
    idealDays: [3, 5],
    highlights: [
      "hawker food centers",
      "futuristic gardens",
      "effortless transit",
    ],
    tags: [
      "warm",
      "city",
      "family",
      "accessible",
      "clean",
      "street food",
      "gardens",
      "halal",
    ],
    flightHoursByHub: { usWest: 17, usEast: 19, europe: 13, asia: 3 },
  },
  kyoto: {
    region: "asia",
    climate: "mild",
    bestMonths: [3, 4, 5, 10, 11],
    shoulderMonths: [2, 6, 9, 12],
    seasonSummary:
      "Cherry blossoms (late Mar–Apr) and glowing maple leaves (Nov) make Kyoto unforgettable.",
    vibes: ["cultural", "foodie", "romantic", "photography", "wellness"],
    budgetFit: ["moderate", "luxury", "budget"],
    idealDays: [4, 6],
    highlights: [
      "tranquil temples",
      "lantern-lit lanes",
      "tea houses & gardens",
    ],
    tags: [
      "japan",
      "temples",
      "gardens",
      "walkable",
      "autumn",
      "cherry blossom",
      "tea",
      "anniversary",
      "traditional",
    ],
    flightHoursByHub: { usWest: 12, usEast: 15, europe: 14, asia: 4 },
  },
  hanoi: {
    region: "asia",
    climate: "warm",
    bestMonths: [10, 11, 12, 3, 4],
    shoulderMonths: [1, 2, 9],
    seasonSummary:
      "Crisp autumn (Oct–Nov) and gentle spring (Mar–Apr) bring comfortable skies for Old Quarter strolls and bay cruises.",
    vibes: ["foodie", "cultural", "photography", "adventure"],
    budgetFit: ["budget", "moderate"],
    idealDays: [4, 7],
    highlights: [
      "coffee & street-food culture",
      "lakeside old quarter",
      "gateway to limestone bays",
    ],
    tags: [
      "vietnam",
      "affordable",
      "street food",
      "coffee",
      "history",
      "solo",
      "budget",
      "markets",
    ],
    flightHoursByHub: { usWest: 16, usEast: 19, europe: 12, asia: 3 },
  },
  phuket: {
    region: "asia",
    climate: "tropical",
    bestMonths: [11, 12, 1, 2, 3, 4],
    shoulderMonths: [10, 5],
    seasonSummary:
      "Dry season (Nov–Apr) offers calm Andaman waters for island hopping and warm sunset beaches.",
    vibes: ["relaxation", "wellness", "adventure", "foodie", "romantic"],
    budgetFit: ["budget", "moderate", "luxury"],
    idealDays: [5, 8],
    highlights: ["turquoise coves", "island boat days", "night markets & spas"],
    tags: [
      "thailand",
      "beach",
      "island",
      "warm",
      "winter sun",
      "resort",
      "affordable",
      "family",
    ],
    flightHoursByHub: { usWest: 18, usEast: 21, europe: 13, asia: 4 },
  },
  seoul: {
    region: "asia",
    climate: "mild",
    bestMonths: [4, 5, 9, 10],
    shoulderMonths: [3, 6, 11],
    seasonSummary:
      "Spring blossoms (Apr–May) and crisp autumn foliage (Sep–Oct) pair ideal temperatures with clear city views.",
    vibes: ["foodie", "shopping", "cultural", "nightlife", "photography"],
    budgetFit: ["moderate", "budget", "luxury"],
    idealDays: [4, 7],
    highlights: [
      "night markets & BBQ",
      "historic palaces",
      "design & café districts",
    ],
    tags: [
      "south korea",
      "korea",
      "city",
      "walkable",
      "cafes",
      "fashion",
      "solo",
      "friends",
      "autumn",
    ],
    flightHoursByHub: { usWest: 11, usEast: 14, europe: 12, asia: 3 },
  },
  jaipur: {
    region: "asia",
    climate: "desert",
    bestMonths: [10, 11, 12, 1, 2, 3],
    shoulderMonths: [9],
    seasonSummary:
      "Cool, dry winter months (Oct–Mar) are best for hilltop forts, heritage palaces, and colorful bazaars.",
    vibes: ["cultural", "photography", "shopping", "foodie"],
    budgetFit: ["budget", "moderate", "luxury"],
    idealDays: [3, 5],
    highlights: [
      "hilltop forts",
      "pink sandstone palaces",
      "artisan textiles & bazaars",
    ],
    tags: [
      "india",
      "history",
      "architecture",
      "affordable",
      "winter sun",
      "vegetarian",
      "warm",
    ],
    flightHoursByHub: { usWest: 18, usEast: 16, europe: 10, asia: 6 },
  },
  petra: {
    region: "middle-east",
    climate: "desert",
    bestMonths: [3, 4, 5, 10, 11],
    shoulderMonths: [2, 9, 12],
    seasonSummary:
      "Mild spring (Mar–May) and autumn (Oct–Nov) keep canyon walks and desert stargazing comfortable.",
    vibes: ["cultural", "adventure", "photography", "nature"],
    budgetFit: ["moderate", "budget"],
    idealDays: [3, 5],
    highlights: [
      "rose-red canyon ruins",
      "scenic desert hikes",
      "timeless heritage",
    ],
    tags: [
      "jordan",
      "desert",
      "ruins",
      "history",
      "hiking",
      "bucket list",
      "warm",
    ],
    flightHoursByHub: { usWest: 16, usEast: 12, europe: 5, asia: 10 },
  },
  amsterdam: {
    region: "europe",
    climate: "mild",
    bestMonths: [4, 5, 6, 9],
    shoulderMonths: [3, 7, 8, 10],
    seasonSummary:
      "April–May brings tulip season and canal-side patios; September offers golden light and calmer museums.",
    vibes: ["cultural", "photography", "foodie", "nightlife", "shopping"],
    budgetFit: ["moderate", "luxury"],
    idealDays: [3, 5],
    highlights: [
      "scenic canals",
      "masterpiece museums",
      "flat bike-friendly streets",
    ],
    tags: [
      "netherlands",
      "walkable",
      "flat",
      "canals",
      "tulips",
      "museums",
      "weekend",
      "solo",
      "friends",
    ],
    flightHoursByHub: { usWest: 10, usEast: 7, europe: 2, asia: 12 },
  },
  istanbul: {
    region: "europe",
    climate: "mild",
    bestMonths: [4, 5, 9, 10],
    shoulderMonths: [3, 6, 11],
    seasonSummary:
      "Spring (Apr–May) and autumn (Sep–Oct) bring mild Bosphorus breezes and comfortable sightseeing.",
    vibes: ["cultural", "foodie", "shopping", "photography", "wellness"],
    budgetFit: ["budget", "moderate"],
    idealDays: [4, 6],
    highlights: [
      "cross-continental ferries",
      "historic domes & bazaars",
      "meze & tea houses",
    ],
    tags: [
      "turkey",
      "history",
      "architecture",
      "affordable",
      "markets",
      "halal",
      "city",
    ],
    flightHoursByHub: { usWest: 13, usEast: 10, europe: 3, asia: 10 },
  },
  prague: {
    region: "europe",
    climate: "mild",
    bestMonths: [5, 6, 9, 10],
    shoulderMonths: [4, 7, 8, 12],
    seasonSummary:
      "May–Jun and Sep–Oct offer storybook walks with mild weather; December brings cozy winter markets.",
    vibes: ["cultural", "photography", "romantic", "nightlife", "foodie"],
    budgetFit: ["budget", "moderate"],
    idealDays: [3, 5],
    highlights: [
      "cobblestone bridges",
      "hilltop castles",
      "historic beer halls & cafés",
    ],
    tags: [
      "czech republic",
      "walkable",
      "affordable",
      "architecture",
      "history",
      "weekend",
      "winter markets",
    ],
    flightHoursByHub: { usWest: 12, usEast: 9, europe: 2, asia: 12 },
  },
  vienna: {
    region: "europe",
    climate: "mild",
    bestMonths: [4, 5, 6, 9, 10, 12],
    shoulderMonths: [3, 7, 8],
    seasonSummary:
      "Spring and early autumn shine for palace gardens and wine taverns; December glows with classic markets.",
    vibes: ["cultural", "foodie", "romantic", "relaxation", "photography"],
    budgetFit: ["moderate", "luxury"],
    idealDays: [3, 5],
    highlights: [
      "grand coffeehouses",
      "classical music heritage",
      "imperial palaces",
    ],
    tags: [
      "austria",
      "walkable",
      "art",
      "music",
      "coffee",
      "accessible",
      "history",
      "winter markets",
    ],
    flightHoursByHub: { usWest: 12, usEast: 9, europe: 2, asia: 11 },
  },
  dublin: {
    region: "europe",
    climate: "cool",
    bestMonths: [5, 6, 7, 8, 9],
    shoulderMonths: [4, 10],
    seasonSummary:
      "Late spring through September offers long daylight hours for coastal cliffs and literary pub walks.",
    vibes: ["cultural", "nightlife", "foodie", "nature"],
    budgetFit: ["moderate", "budget"],
    idealDays: [3, 5],
    highlights: [
      "warm pub music",
      "literary landmarks",
      "nearby coastal hikes",
    ],
    tags: [
      "ireland",
      "walkable",
      "pubs",
      "music",
      "coast",
      "short flight",
      "weekend",
      "solo",
    ],
    flightHoursByHub: { usWest: 10, usEast: 6, europe: 2, asia: 13 },
  },
  copenhagen: {
    region: "europe",
    climate: "cool",
    bestMonths: [5, 6, 7, 8, 9],
    shoulderMonths: [4, 10],
    seasonSummary:
      "May–Sep brings bright Scandinavian evenings, harbor swims, and lively outdoor bakeries.",
    vibes: ["foodie", "cultural", "shopping", "photography", "relaxation"],
    budgetFit: ["moderate", "luxury"],
    idealDays: [3, 5],
    highlights: [
      "Nordic bakeries & dining",
      "waterfront bike paths",
      "clean Scandinavian design",
    ],
    tags: [
      "denmark",
      "scandinavia",
      "walkable",
      "flat",
      "design",
      "bakery",
      "family",
      "summer",
    ],
    flightHoursByHub: { usWest: 11, usEast: 8, europe: 2, asia: 12 },
  },
  interlaken: {
    region: "europe",
    climate: "alpine",
    bestMonths: [6, 7, 8, 9, 1, 2],
    shoulderMonths: [5, 10, 12, 3],
    seasonSummary:
      "Jun–Sep opens panoramic alpine trails and emerald lakes; Jan–Feb is prime for snow-capped ski scenery.",
    vibes: ["nature", "adventure", "photography", "relaxation"],
    budgetFit: ["luxury", "moderate"],
    idealDays: [3, 6],
    highlights: [
      "turquoise alpine lakes",
      "mountain railways",
      "glacier viewpoints",
    ],
    tags: [
      "switzerland",
      "alps",
      "mountains",
      "hiking",
      "ski",
      "snow",
      "scenic",
      "trains",
      "lakes",
    ],
    flightHoursByHub: { usWest: 12, usEast: 8, europe: 2, asia: 12 },
  },
  "amalfi-coast": {
    region: "europe",
    climate: "warm",
    bestMonths: [5, 6, 9, 10],
    shoulderMonths: [4, 7, 8],
    seasonSummary:
      "May–Jun and Sep–Oct combine warm coastal swims and lemon-grove hikes with calmer ferries.",
    vibes: ["romantic", "foodie", "relaxation", "photography", "nature"],
    budgetFit: ["luxury", "moderate"],
    idealDays: [4, 6],
    highlights: [
      "cliffside villages",
      "coastal boat rides",
      "lemon groves & seafood",
    ],
    tags: [
      "italy",
      "coast",
      "beach",
      "warm",
      "honeymoon",
      "anniversary",
      "wine",
      "scenic",
    ],
    flightHoursByHub: { usWest: 13, usEast: 9, europe: 3, asia: 14 },
  },
  ibiza: {
    region: "europe",
    climate: "warm",
    bestMonths: [5, 6, 9, 10],
    shoulderMonths: [7, 8],
    seasonSummary:
      "May–Jun and Sep–Oct blend warm cove swimming and sunset energy with easier dining reservations.",
    vibes: ["nightlife", "relaxation", "wellness", "foodie"],
    budgetFit: ["luxury", "moderate"],
    idealDays: [3, 6],
    highlights: [
      "pine-lined coves",
      "sunset terraces",
      "bohemian markets & clubs",
    ],
    tags: [
      "spain",
      "island",
      "beach",
      "warm",
      "friends",
      "party",
      "yoga",
      "summer",
    ],
    flightHoursByHub: { usWest: 13, usEast: 9, europe: 2, asia: 14 },
  },
  chamonix: {
    region: "europe",
    climate: "alpine",
    bestMonths: [1, 2, 3, 6, 7, 8, 9],
    shoulderMonths: [12, 4, 10],
    seasonSummary:
      "Jan–Mar delivers legendary alpine skiing; Jun–Sep opens Mont Blanc trails and cable-car panoramas.",
    vibes: ["adventure", "nature", "wellness", "photography"],
    budgetFit: ["moderate", "luxury"],
    idealDays: [4, 7],
    highlights: ["Mont Blanc peaks", "alpine cable cars", "cozy chalet dining"],
    tags: [
      "france",
      "alps",
      "mountains",
      "ski",
      "snow",
      "hiking",
      "winter",
      "scenic",
    ],
    flightHoursByHub: { usWest: 12, usEast: 8, europe: 2, asia: 13 },
  },
  cancun: {
    region: "latin-america",
    climate: "tropical",
    bestMonths: [12, 1, 2, 3, 4],
    shoulderMonths: [5, 11],
    seasonSummary:
      "Dec–Apr brings bright, low-humidity Caribbean sunshine for beaches, cenotes, and Maya day trips.",
    vibes: ["relaxation", "adventure", "nightlife", "wellness", "foodie"],
    budgetFit: ["budget", "moderate", "luxury"],
    idealDays: [4, 7],
    highlights: [
      "turquoise beaches",
      "freshwater cenotes",
      "nearby Mayan heritage",
    ],
    tags: [
      "mexico",
      "caribbean",
      "beach",
      "warm",
      "winter sun",
      "short flight",
      "family",
      "resort",
      "friends",
    ],
    flightHoursByHub: { usWest: 6, usEast: 4, europe: 11, asia: 19 },
  },
  "rio-de-janeiro": {
    region: "latin-america",
    climate: "tropical",
    bestMonths: [12, 1, 2, 3, 5, 9, 10],
    shoulderMonths: [4, 6, 11],
    seasonSummary:
      "Warm coastal energy peaks in Dec–Mar; May and Sep–Oct offer sunny beaches with milder humidity.",
    vibes: ["nature", "nightlife", "adventure", "relaxation", "photography"],
    budgetFit: ["budget", "moderate"],
    idealDays: [4, 7],
    highlights: [
      "iconic beach culture",
      "granite peak views",
      "live samba & viewpoints",
    ],
    tags: [
      "brazil",
      "south america",
      "beach",
      "warm",
      "winter sun",
      "music",
      "hiking",
      "scenic",
    ],
    flightHoursByHub: { usWest: 13, usEast: 10, europe: 11, asia: 22 },
  },
  "costa-rica": {
    region: "latin-america",
    climate: "tropical",
    bestMonths: [12, 1, 2, 3, 4],
    shoulderMonths: [5, 11],
    seasonSummary:
      "Dry season (Dec–Apr) is prime for cloud forests, volcano hikes, wildlife spotting, and Pacific surf.",
    vibes: ["nature", "adventure", "wellness", "relaxation"],
    budgetFit: ["moderate", "budget", "luxury"],
    idealDays: [6, 10],
    highlights: [
      "rainforest wildlife",
      "volcanic hot springs",
      "surf-ready beaches",
    ],
    tags: [
      "central america",
      "warm",
      "winter sun",
      "wildlife",
      "jungle",
      "hiking",
      "beach",
      "family",
      "surf",
      "short flight",
    ],
    flightHoursByHub: { usWest: 7, usEast: 5, europe: 12, asia: 20 },
  },
  "buenos-aires": {
    region: "latin-america",
    climate: "mild",
    bestMonths: [10, 11, 3, 4],
    shoulderMonths: [9, 12, 2, 5],
    seasonSummary:
      "Spring jacarandas (Oct–Nov) and crisp autumn (Mar–Apr) bring comfortable café weather and lively evenings.",
    vibes: ["foodie", "cultural", "nightlife", "romantic", "shopping"],
    budgetFit: ["budget", "moderate"],
    idealDays: [4, 7],
    highlights: [
      "leafy café barrios",
      "parrilla dining & Malbec",
      "tango & architecture",
    ],
    tags: [
      "argentina",
      "south america",
      "walkable",
      "wine",
      "affordable",
      "city",
      "winter sun",
      "culture",
    ],
    flightHoursByHub: { usWest: 14, usEast: 11, europe: 13, asia: 23 },
  },
  havana: {
    region: "latin-america",
    climate: "tropical",
    bestMonths: [11, 12, 1, 2, 3, 4],
    shoulderMonths: [5, 10],
    seasonSummary:
      "Nov–Apr brings dry, breezy Caribbean warmth ideal for historic plazas and seaside evenings.",
    vibes: ["cultural", "photography", "nightlife", "foodie"],
    budgetFit: ["budget", "moderate"],
    idealDays: [3, 5],
    highlights: [
      "colorful historic plazas",
      "live music venues",
      "seafront promenades",
    ],
    tags: [
      "cuba",
      "caribbean",
      "warm",
      "winter sun",
      "music",
      "architecture",
      "history",
      "short flight",
    ],
    flightHoursByHub: { usWest: 7, usEast: 4, europe: 10, asia: 20 },
  },
  vancouver: {
    region: "north-america",
    climate: "mild",
    bestMonths: [6, 7, 8, 9],
    shoulderMonths: [5, 10],
    seasonSummary:
      "Jun–Sep brings dry coastal sunshine for seawall walks, island ferries, and mountain viewpoints.",
    vibes: ["nature", "foodie", "adventure", "relaxation", "photography"],
    budgetFit: ["moderate", "luxury"],
    idealDays: [3, 6],
    highlights: [
      "ocean-meets-mountain views",
      "diverse Pacific Rim dining",
      "waterfront park paths",
    ],
    tags: [
      "canada",
      "pacific northwest",
      "mountains",
      "walkable",
      "short flight",
      "family",
      "hiking",
      "summer",
    ],
    flightHoursByHub: { usWest: 2, usEast: 6, europe: 10, asia: 10 },
  },
  cairo: {
    region: "africa",
    climate: "desert",
    bestMonths: [10, 11, 12, 1, 2, 3],
    shoulderMonths: [4, 9],
    seasonSummary:
      "Cooler winter months (Oct–Mar) make pyramid plateaus, Nile walks, and historic bazaars comfortable.",
    vibes: ["cultural", "photography", "foodie", "adventure"],
    budgetFit: ["budget", "moderate"],
    idealDays: [3, 5],
    highlights: ["ancient wonders", "museum treasures", "evening Nile breezes"],
    tags: [
      "egypt",
      "history",
      "ruins",
      "desert",
      "affordable",
      "winter sun",
      "halal",
    ],
    flightHoursByHub: { usWest: 16, usEast: 11, europe: 5, asia: 11 },
  },
  zanzibar: {
    region: "africa",
    climate: "tropical",
    bestMonths: [6, 7, 8, 9, 10, 1, 2],
    shoulderMonths: [12, 3],
    seasonSummary:
      "Dry coastal seasons (Jun–Oct and Jan–Feb) pair clear Indian Ocean lagoons with spice-island heritage.",
    vibes: ["relaxation", "romantic", "cultural", "nature", "wellness"],
    budgetFit: ["moderate", "budget", "luxury"],
    idealDays: [5, 8],
    highlights: [
      "white-sand reefs",
      "historic Stone Town lanes",
      "spice-island cuisine",
    ],
    tags: [
      "tanzania",
      "island",
      "beach",
      "warm",
      "winter sun",
      "honeymoon",
      "coast",
    ],
    flightHoursByHub: { usWest: 21, usEast: 17, europe: 10, asia: 12 },
  },
  queenstown: {
    region: "oceania",
    climate: "alpine",
    bestMonths: [12, 1, 2, 3, 7, 8],
    shoulderMonths: [4, 11, 6, 9],
    seasonSummary:
      "Dec–Mar opens alpine lakes, vineyards, and fjord trips; Jul–Aug is prime southern-hemisphere ski season.",
    vibes: ["adventure", "nature", "photography", "foodie", "relaxation"],
    budgetFit: ["moderate", "luxury"],
    idealDays: [4, 7],
    highlights: [
      "fjord day trips",
      "alpine lakes & trails",
      "Central Otago wineries",
    ],
    tags: [
      "new zealand",
      "mountains",
      "hiking",
      "ski",
      "wine",
      "lakes",
      "scenic",
      "road trip",
    ],
    flightHoursByHub: { usWest: 15, usEast: 20, europe: 24, asia: 11 },
  },
  maldives: {
    region: "asia",
    climate: "tropical",
    bestMonths: [11, 12, 1, 2, 3, 4],
    shoulderMonths: [5, 10],
    seasonSummary:
      "Dry northeast monsoon (Nov–Apr) delivers glassy lagoons, clear reef visibility, and sunny skies.",
    vibes: ["relaxation", "romantic", "wellness", "nature"],
    budgetFit: ["luxury", "moderate"],
    idealDays: [4, 7],
    highlights: [
      "overwater lagoons",
      "coral reef snorkeling",
      "unhurried island serenity",
    ],
    tags: [
      "island",
      "beach",
      "warm",
      "winter sun",
      "honeymoon",
      "anniversary",
      "luxury",
      "spa",
      "resort",
    ],
    flightHoursByHub: { usWest: 21, usEast: 19, europe: 11, asia: 5 },
  },
  sydney: {
    region: "oceania",
    climate: "warm",
    bestMonths: [10, 11, 12, 1, 2, 3],
    shoulderMonths: [4, 9],
    seasonSummary:
      "Spring through early autumn (Oct–Mar) brings bright harbor ferries, coastal walks, and beach weather.",
    vibes: ["nature", "foodie", "relaxation", "cultural", "photography"],
    budgetFit: ["moderate", "luxury"],
    idealDays: [5, 8],
    highlights: [
      "iconic harbor ferries",
      "coastal cliff walks",
      "neighborhood brunch & dining",
    ],
    tags: [
      "australia",
      "beach",
      "coast",
      "warm",
      "winter sun",
      "city",
      "family",
      "walkable",
    ],
    flightHoursByHub: { usWest: 15, usEast: 20, europe: 22, asia: 9 },
  },
};

export const SuggestDestinationsInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(2, "Tell us a little about what you're craving.")
    .max(400, "Keep your description under 400 characters."),
  origin: z.string().trim().max(100).optional(),
  month: z.string().trim().max(40).optional(),
  budget: z.enum(VALID_BUDGETS).optional(),
  days: z.number().int().min(1).max(30).optional(),
});

export type SuggestDestinationsInput = z.infer<
  typeof SuggestDestinationsInputSchema
>;

export interface DestinationSuggestion {
  slug: CatalogSlug;
  name: string;
  country: string;
  region: DestinationRegion;
  heroImage: string;
  score: number;
  whyItFits: string;
  seasonNote: string;
  flightHint?: string;
  suggestedVibes: VibeId[];
  suggestedBudget: BudgetTier;
  suggestedDays: number;
  prefillParams: {
    destination: string;
    slug: CatalogSlug;
    budget: BudgetTier;
    vibes: VibeId[];
    startDate?: string;
    endDate?: string;
  };
}

const MONTH_INDEX: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const SEASON_MONTHS: Record<string, number> = {
  spring: 4,
  summer: 7,
  autumn: 10,
  fall: 10,
  winter: 1,
};

const HUB_LABELS: Record<HubRegion, string> = {
  usWest: "US West Coast",
  usEast: "US East Coast",
  europe: "Western Europe",
  asia: "East Asia",
};

function detectOriginHub(originText?: string): HubRegion | undefined {
  if (!originText) return undefined;
  const q = originText.toLowerCase();
  if (
    /\b(?:sea|seattle|sfo|san\s+francisco|lax|los\s+angeles|san|san\s+diego|pdx|portland|den|denver|yvr|vancouver|las|phx|slc|west\s+coast|california)\b/i.test(
      q,
    )
  ) {
    return "usWest";
  }
  if (
    /\b(?:nyc|new\s+york|jfk|ewr|lga|bos|boston|iad|dca|washington|mia|miami|atl|atlanta|ord|chicago|yyz|toronto|phl|philadelphia|yul|montreal|east\s+coast|dfw|iah|aus|austin)\b/i.test(
      q,
    )
  ) {
    return "usEast";
  }
  if (
    /\b(?:lon|london|lhr|lgw|par|paris|cdg|ams|amsterdam|fra|frankfurt|mad|madrid|bcn|barcelona|dub|dublin|ber|berlin|zrh|zurich|rom|rome|lis|lisbon|uk|europe)\b/i.test(
      q,
    )
  ) {
    return "europe";
  }
  if (
    /\b(?:tyo|tokyo|hnd|nrt|sin|singapore|hkg|hong\s+kong|icn|seoul|bkk|bangkok|syd|sydney|mel|melbourne|tpe|taipei|asia)\b/i.test(
      q,
    )
  ) {
    return "asia";
  }
  return undefined;
}

function detectMonth(explicitMonth?: string, query = ""): number | undefined {
  const combined = `${explicitMonth ?? ""} ${query}`.toLowerCase();
  for (const [token, num] of Object.entries(MONTH_INDEX)) {
    if (token === "may") {
      if (
        explicitMonth?.toLowerCase().includes("may") ||
        /\b(?:in|during|next|around|early|mid|late)\s+may\b/i.test(query)
      ) {
        return 5;
      }
      continue;
    }
    if (new RegExp(`\\b${token}\\b`, "i").test(combined)) return num;
  }
  for (const [season, num] of Object.entries(SEASON_MONTHS)) {
    if (new RegExp(`\\b${season}\\b`, "i").test(combined)) return num;
  }
  return undefined;
}

function detectBudget(
  explicitBudget?: BudgetTier,
  query = "",
): BudgetTier | undefined {
  if (explicitBudget) return explicitBudget;
  if (
    /\b(?:budget|cheap|affordable|backpack|frugal|inexpensive|low[\s-]?cost)\b/i.test(
      query,
    )
  ) {
    return "budget";
  }
  if (
    /\b(?:luxury|luxurious|5[\s-]?star|splurge|upscale|high[\s-]?end|pamper)\b/i.test(
      query,
    )
  ) {
    return "luxury";
  }
  if (/\b(?:moderate|mid[\s-]?range|comfortable|comfort)\b/i.test(query)) {
    return "moderate";
  }
  return undefined;
}

function detectMaxFlightHours(query: string): number | undefined {
  const explicit = query.match(
    /\b(?:under|within|less\s+than|max(?:imum)?)\s+(\d{1,2})\s*(?:h|hr|hrs|hours?)\b/i,
  );
  if (explicit) {
    const hours = Number(explicit[1]);
    if (hours >= 2 && hours <= 20) return hours;
  }
  if (
    /\b(?:short\s+flight|quick\s+flight|no\s+jet\s*lag|close\s+by|nearby)\b/i.test(
      query,
    )
  ) {
    return 7;
  }
  return undefined;
}

function detectVibeSignals(query: string): VibeId[] {
  const signals: Array<{ id: VibeId; regex: RegExp }> = [
    {
      id: "foodie",
      regex:
        /\b(?:food|foodie|culinary|eat|dining|wine|ramen|tapas|coffee|street\s+food|markets?|bakery)\b/i,
    },
    {
      id: "cultural",
      regex:
        /\b(?:culture|cultural|history|historic|museums?|art|temples?|architecture|ruins|heritage)\b/i,
    },
    {
      id: "relaxation",
      regex:
        /\b(?:relax|relaxed|relaxing|beach|beaches|chill|unwind|resort|sun|sunny|warm|laid[\s-]?back|island)\b/i,
    },
    {
      id: "romantic",
      regex:
        /\b(?:romantic|romance|anniversary|honeymoon|couples?|sunset|intimate)\b/i,
    },
    {
      id: "adventure",
      regex:
        /\b(?:adventure|hik(?:e|ing)|surf|ski|snow|active|outdoor|trek|snorkel|dive|kayak)\b/i,
    },
    {
      id: "nature",
      regex:
        /\b(?:nature|mountains?|wildlife|jungle|forest|lakes?|scenic|fjords?|alps|island|coast)\b/i,
    },
    {
      id: "wellness",
      regex:
        /\b(?:wellness|spa|yoga|hot\s+springs?|onsen|retreat|hammam|thermal)\b/i,
    },
    {
      id: "nightlife",
      regex:
        /\b(?:nightlife|bars?|clubs?|party|music|pubs?|cocktails?|live\s+music)\b/i,
    },
    {
      id: "shopping",
      regex: /\b(?:shopping|boutiques?|fashion|design|markets?|vintage)\b/i,
    },
    {
      id: "photography",
      regex: /\b(?:photo|photography|photogenic|views?|viewpoints?|scenic)\b/i,
    },
  ];
  return signals.filter((s) => s.regex.test(query)).map((s) => s.id);
}

function detectRegionPreference(query: string): DestinationRegion | undefined {
  if (/\b(?:europe|european|mediterranean|scandinavia|alps)\b/i.test(query))
    return "europe";
  if (
    /\b(?:asia|asian|southeast\s+asia|east\s+asia|japan|thailand)\b/i.test(
      query,
    )
  )
    return "asia";
  if (
    /\b(?:latin\s+america|south\s+america|central\s+america|caribbean|mexico)\b/i.test(
      query,
    )
  )
    return "latin-america";
  if (/\b(?:africa|african|morocco|safari)\b/i.test(query)) return "africa";
  if (/\b(?:middle\s+east|desert|arabian)\b/i.test(query)) return "middle-east";
  if (/\b(?:oceania|australia|new\s+zealand)\b/i.test(query)) return "oceania";
  if (/\b(?:north\s+america|canada|usa|united\s+states)\b/i.test(query))
    return "north-america";
  return undefined;
}

function detectExcludedSlugs(query: string): Set<string> {
  const excluded = new Set<string>();
  for (const [slug, name] of destinationCoverCatalog) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (
      new RegExp(
        `\\b(?:not|except|other\\s+than|skip|avoid|been\\s+to)\\s+${escaped}\\b`,
        "i",
      ).test(query)
    ) {
      excluded.add(slug);
    }
  }
  return excluded;
}

function buildPrefillDates(
  targetMonth: number | undefined,
  days: number,
  referenceDate: Date,
): { startDate?: string; endDate?: string } {
  if (!targetMonth) return {};
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth() + 1;
  const year =
    targetMonth < refMonth ||
    (targetMonth === refMonth && 10 < referenceDate.getDate())
      ? refYear + 1
      : refYear;
  const start = new Date(year, targetMonth - 1, 10);
  const end = new Date(year, targetMonth - 1, 10 + Math.max(1, days) - 1);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
  return { startDate: fmt(start), endDate: fmt(end) };
}

function buildWhyItFits(
  name: string,
  profile: DestinationProfile,
  matchedVibes: VibeId[],
  wantsWarm: boolean,
  wantsSnowOrMountains: boolean,
  targetBudget?: BudgetTier,
): string {
  const reasons: string[] = [];
  if (profile.highlights.length >= 2) {
    reasons.push(
      `Combines ${profile.highlights[0]} and ${profile.highlights[1]}`,
    );
  }
  if (matchedVibes.length > 0) {
    const nice = matchedVibes.slice(0, 2).join(" & ");
    reasons.push(`a strong match for ${nice}`);
  } else if (
    wantsWarm &&
    (profile.climate === "warm" ||
      profile.climate === "tropical" ||
      profile.climate === "desert")
  ) {
    reasons.push("reliable warm sunshine");
  } else if (wantsSnowOrMountains && profile.climate === "alpine") {
    reasons.push("dramatic alpine scenery");
  }
  if (targetBudget && profile.budgetFit[0] === targetBudget) {
    reasons.push(
      targetBudget === "budget"
        ? "great value for a budget trip"
        : targetBudget === "luxury"
          ? "standout luxury stays"
          : "comfortable mid-range balance",
    );
  }
  if (reasons.length === 0) {
    return `${name} stands out for ${profile.highlights.join(", ")}.`;
  }
  return `${reasons[0]}${reasons.length > 1 ? ` — ${reasons.slice(1).join(", ")}` : ""}.`;
}

/**
 * Scores all 42 destinations in @faroway/constants destinationCoverCatalog
 * and returns the top 3 tailored destination pitches with /create prefillParams.
 */
export function suggestDestinations(
  input: SuggestDestinationsInput,
  referenceDate: Date = new Date(),
): DestinationSuggestion[] {
  const query = input.query.trim();
  const lowerQuery = query.toLowerCase();
  const targetMonth = detectMonth(input.month, query);
  const targetBudget = detectBudget(input.budget, query);
  const targetVibes = detectVibeSignals(query);
  const regionPref = detectRegionPreference(query);
  const excludedSlugs = detectExcludedSlugs(query);

  // Extract origin from explicit param or "from <city>" in query
  const fromMatch = query.match(
    /\bfrom\s+([A-Za-z]{3}\b|[A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
  );
  const originHub =
    detectOriginHub(input.origin) ?? detectOriginHub(fromMatch?.[1]);
  const maxFlightHours = detectMaxFlightHours(query);

  const wantsWarm =
    /\b(?:warm|sunny|sunshine|tropical|beach|beaches|winter\s+sun|escape\s+the\s+cold|hot)\b/i.test(
      query,
    );
  const wantsCoolOrAlpine =
    /\b(?:cool|cold|snow|ski|skiing|mountains?|alps|alpine|glacier|northern\s+lights)\b/i.test(
      query,
    );
  const wantsWalkable = /\b(?:walkable|no\s+car|transit|train|stroll)\b/i.test(
    query,
  );
  const wantsFamily = /\b(?:family|kids?|children|toddler)\b/i.test(query);
  const wantsIsland = /\b(?:island|islands|reef|snorkel)\b/i.test(query);

  const queryWords = lowerQuery
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);

  const scored = destinationCoverCatalog
    .filter(([slug]) => !excludedSlugs.has(slug))
    .map(([slug, name, country]) => {
      const profile = DESTINATION_PROFILES[slug];
      let score = 20;

      // 1. Vibe overlap
      const matchedVibes = targetVibes.filter((v) => profile.vibes.includes(v));
      score += matchedVibes.length * 14;

      // 2. Direct tag / country / name keyword hits
      for (const tag of profile.tags) {
        if (lowerQuery.includes(tag)) {
          score += 10;
        }
      }
      if (lowerQuery.includes(country.toLowerCase())) {
        score += 18;
      }
      if (lowerQuery.includes(name.toLowerCase())) {
        score += 20;
      }
      for (const word of queryWords) {
        if (profile.highlights.some((h) => h.toLowerCase().includes(word))) {
          score += 5;
        }
      }

      // 3. Region preference
      if (regionPref) {
        score += profile.region === regionPref ? 22 : -6;
      }

      // 4. Climate & season fit
      if (wantsWarm) {
        if (profile.climate === "tropical" || profile.climate === "warm") {
          score += 14;
        } else if (profile.climate === "desert") {
          score += 10;
        } else if (profile.climate === "alpine" || profile.climate === "cool") {
          score -= 10;
        }
      }
      if (wantsCoolOrAlpine) {
        if (profile.climate === "alpine" || profile.climate === "cool") {
          score += 16;
        } else if (profile.climate === "tropical") {
          score -= 10;
        }
      }
      if (wantsWalkable && profile.tags.includes("walkable")) score += 12;
      if (wantsFamily && profile.tags.includes("family")) score += 10;
      if (wantsIsland && profile.tags.includes("island")) score += 14;

      if (targetMonth !== undefined) {
        if (profile.bestMonths.includes(targetMonth)) {
          score += 16;
        } else if (profile.shoulderMonths.includes(targetMonth)) {
          score += 7;
        } else {
          score -= 7;
        }
      }

      // 5. Budget fit
      if (targetBudget) {
        const fitIdx = profile.budgetFit.indexOf(targetBudget);
        if (fitIdx === 0) score += 14;
        else if (fitIdx === 1) score += 6;
        else if (fitIdx === 2) score += 2;
        else score -= 10;
      }

      // 6. Duration & flight-time fit
      const requestedDays = input.days;
      if (requestedDays) {
        const [minD, maxD] = profile.idealDays;
        if (requestedDays >= minD && requestedDays <= maxD) score += 8;
        if (
          requestedDays <= 4 &&
          originHub &&
          profile.flightHoursByHub[originHub] >= 13
        ) {
          score -= 10;
        }
      }

      let flightHint: string | undefined;
      if (originHub) {
        const hours = profile.flightHoursByHub[originHub];
        flightHint = `~${hours}h flight from ${HUB_LABELS[originHub]}`;
        if (maxFlightHours !== undefined) {
          if (hours <= maxFlightHours) score += 18;
          else if (hours <= maxFlightHours + 2) score += 4;
          else score -= 14;
        }
      } else if (
        maxFlightHours !== undefined &&
        profile.tags.includes("short flight")
      ) {
        score += 10;
      }

      const suggestedDays =
        requestedDays ??
        Math.round((profile.idealDays[0] + profile.idealDays[1]) / 2);
      const suggestedBudget = targetBudget ?? profile.budgetFit[0];
      const suggestedVibes: VibeId[] = [
        ...new Set([...matchedVibes, ...profile.vibes]),
      ].slice(0, 3);
      const prefillDates = buildPrefillDates(
        targetMonth,
        suggestedDays,
        referenceDate,
      );

      return {
        slug,
        name,
        country,
        region: profile.region,
        heroImage: getImageUrl(IMAGE_PATHS.destinations[slug]),
        score,
        whyItFits: buildWhyItFits(
          name,
          profile,
          matchedVibes,
          wantsWarm,
          wantsCoolOrAlpine,
          targetBudget,
        ),
        seasonNote: profile.seasonSummary,
        flightHint,
        suggestedVibes,
        suggestedBudget,
        suggestedDays,
        prefillParams: {
          destination: name,
          slug,
          budget: suggestedBudget,
          vibes: suggestedVibes,
          ...prefillDates,
        },
      } satisfies DestinationSuggestion;
    });

  // Sort deterministically by score desc, then slug asc
  scored.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.slug.localeCompare(b.slug),
  );

  // Pick top 3 with country diversity when scores are close (unless user explicitly asked for a country)
  const picks: DestinationSuggestion[] = [];
  const usedCountries = new Set<string>();
  const explicitCountryQuery = destinationCoverCatalog.some(([, , c]) =>
    lowerQuery.includes(c.toLowerCase()),
  );

  for (const candidate of scored) {
    if (picks.length >= 3) break;
    if (
      !explicitCountryQuery &&
      usedCountries.has(candidate.country) &&
      picks.length < 3
    ) {
      // Allow same country only if there isn't a close alternative from another country
      const nextDistinct = scored.find(
        (alt) =>
          !picks.includes(alt) &&
          !usedCountries.has(alt.country) &&
          candidate.score - alt.score <= 8,
      );
      if (nextDistinct) continue;
    }
    picks.push(candidate);
    usedCountries.add(candidate.country);
  }

  // Fallback fill if needed
  for (const candidate of scored) {
    if (picks.length >= 3) break;
    if (!picks.includes(candidate)) picks.push(candidate);
  }

  return picks;
}

export const SUGGESTER_CATALOG_COUNT = Object.keys(DESTINATION_PROFILES).length;
