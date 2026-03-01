export interface PackingItem {
  name: string;
  essential?: boolean;
}

export interface PackingCategory {
  category: string;
  emoji: string;
  items: PackingItem[];
}

// ─── Base categories (always included) ────────────────────────────────────────

const BASE_ESSENTIALS: PackingCategory = {
  category: "Essentials",
  emoji: "🎒",
  items: [
    { name: "Passport / ID", essential: true },
    { name: "Travel insurance documents", essential: true },
    { name: "Phone & charger", essential: true },
    { name: "Wallet & cards", essential: true },
    { name: "Copies of bookings", essential: true },
    { name: "Travel adapter" },
    { name: "Day bag / backpack" },
    { name: "Reusable water bottle" },
    { name: "Snacks for transit" },
  ],
};

const BASE_TOILETRIES: PackingCategory = {
  category: "Toiletries",
  emoji: "🧴",
  items: [
    { name: "Toothbrush & toothpaste" },
    { name: "Deodorant" },
    { name: "Shampoo & conditioner (travel size)" },
    { name: "Sunscreen SPF 50+" },
    { name: "Lip balm with SPF" },
    { name: "Hand sanitizer" },
    { name: "Medications & first aid basics" },
    { name: "Tissues / wet wipes" },
  ],
};

const BASE_TECH: PackingCategory = {
  category: "Tech & Gadgets",
  emoji: "📱",
  items: [
    { name: "Portable power bank" },
    { name: "Headphones / earbuds" },
    { name: "Camera (optional)" },
    { name: "E-reader / tablet" },
  ],
};

const BASE_COMFORT: PackingCategory = {
  category: "Comfort & Extras",
  emoji: "😴",
  items: [
    { name: "Neck pillow" },
    { name: "Eye mask & earplugs" },
    { name: "Packing cubes" },
    { name: "Laundry bag" },
    { name: "Ziplock bags" },
  ],
};

// ─── Trip type additions ──────────────────────────────────────────────────────

const TRIP_TYPE_ITEMS: Record<string, PackingCategory[]> = {
  beach: [
    {
      category: "Beach Gear",
      emoji: "🏖️",
      items: [
        { name: "Swimsuit(s)" },
        { name: "Cover-up / sarong" },
        { name: "Flip flops / sandals" },
        { name: "Beach towel" },
        { name: "Sunglasses" },
        { name: "Waterproof phone pouch" },
        { name: "Aloe vera gel" },
        { name: "Snorkel gear (or rent locally)" },
      ],
    },
  ],
  city: [
    {
      category: "City Essentials",
      emoji: "🏙️",
      items: [
        { name: "Comfortable walking shoes" },
        { name: "Light jacket / blazer" },
        { name: "Crossbody bag (anti-theft)" },
        { name: "Umbrella (compact)" },
        { name: "Smart casual outfit for dinners" },
        { name: "City map / transit card" },
      ],
    },
  ],
  hiking: [
    {
      category: "Hiking Gear",
      emoji: "🥾",
      items: [
        { name: "Hiking boots (broken in)" },
        { name: "Moisture-wicking base layers" },
        { name: "Rain jacket / windbreaker" },
        { name: "Hiking socks (merino)" },
        { name: "Trekking poles (optional)" },
        { name: "Headlamp" },
        { name: "Trail snacks & energy bars" },
        { name: "Insect repellent" },
      ],
    },
  ],
  business: [
    {
      category: "Business Attire",
      emoji: "💼",
      items: [
        { name: "Suit / business outfit" },
        { name: "Dress shoes" },
        { name: "Laptop & charger" },
        { name: "Business cards" },
        { name: "Garment bag" },
        { name: "Iron / steamer (portable)" },
      ],
    },
  ],
  wellness: [
    {
      category: "Wellness & Yoga",
      emoji: "🧘",
      items: [
        { name: "Yoga mat (travel)" },
        { name: "Workout clothes" },
        { name: "Resistance bands" },
        { name: "Journal / notebook" },
        { name: "Essential oils" },
        { name: "Meditation app (downloaded)" },
      ],
    },
  ],
};

// ─── Climate adjustments ──────────────────────────────────────────────────────

const CLIMATE_ITEMS: Record<string, PackingCategory> = {
  hot: {
    category: "Hot Weather",
    emoji: "☀️",
    items: [
      { name: "Light, breathable clothing" },
      { name: "Wide-brim hat" },
      { name: "Cooling towel" },
      { name: "Extra sunscreen" },
      { name: "Light cotton scarves" },
    ],
  },
  cold: {
    category: "Cold Weather",
    emoji: "❄️",
    items: [
      { name: "Thermal base layers" },
      { name: "Warm jacket / puffer" },
      { name: "Beanie & gloves" },
      { name: "Warm scarf" },
      { name: "Thick socks" },
      { name: "Hand warmers" },
    ],
  },
  rainy: {
    category: "Rainy Weather",
    emoji: "🌧️",
    items: [
      { name: "Waterproof jacket" },
      { name: "Waterproof bag cover" },
      { name: "Quick-dry clothing" },
      { name: "Umbrella (compact)" },
      { name: "Waterproof shoes / boots" },
    ],
  },
  mild: {
    category: "Mild Weather",
    emoji: "🌤️",
    items: [
      { name: "Layers (t-shirt + light sweater)" },
      { name: "Light rain jacket" },
      { name: "Comfortable jeans / trousers" },
      { name: "Sneakers" },
    ],
  },
};

// ─── Destination-specific items ───────────────────────────────────────────────

const DESTINATION_ITEMS: Record<string, PackingCategory> = {
  tokyo: {
    category: "Tokyo Specifics",
    emoji: "🗼",
    items: [
      { name: "IC card (Suica/Pasmo) — buy at airport" },
      { name: "Pocket Wi-Fi / eSIM" },
      { name: "Slip-on shoes (temple visits)" },
      { name: "Small towel (not provided everywhere)" },
    ],
  },
  bali: {
    category: "Bali Specifics",
    emoji: "🌺",
    items: [
      { name: "Sarong (temple visits)" },
      { name: "Mosquito repellent (DEET)" },
      { name: "Reef-safe sunscreen" },
      { name: "International driving permit (for scooter)" },
    ],
  },
  bangkok: {
    category: "Bangkok Specifics",
    emoji: "🛕",
    items: [
      { name: "Modest clothing for temples" },
      { name: "Mosquito repellent" },
      { name: "Grab app (downloaded)" },
      { name: "Cash in small bills (THB)" },
    ],
  },
  dubai: {
    category: "Dubai Specifics",
    emoji: "🏗️",
    items: [
      { name: "Modest clothing (shoulders & knees)" },
      { name: "High SPF sunscreen" },
      { name: "Light cardigan (AC indoors)" },
    ],
  },
  paris: {
    category: "Paris Specifics",
    emoji: "🗼",
    items: [
      { name: "Museum Pass (buy in advance)" },
      { name: "Comfortable walking shoes (cobblestones)" },
      { name: "Reusable shopping bag" },
      { name: "French phrasebook / app" },
    ],
  },
  barcelona: {
    category: "Barcelona Specifics",
    emoji: "🦎",
    items: [
      { name: "Sagrada Familia tickets (pre-booked)" },
      { name: "Anti-theft crossbody bag" },
      { name: "T-Casual metro card" },
    ],
  },
  santorini: {
    category: "Santorini Specifics",
    emoji: "🏛️",
    items: [
      { name: "Sturdy sandals (steep paths)" },
      { name: "Wind-resistant hat" },
      { name: "Light layers (breezy evenings)" },
    ],
  },
  london: {
    category: "London Specifics",
    emoji: "🇬🇧",
    items: [
      { name: "Oyster card / contactless card" },
      { name: "Compact umbrella (essential)" },
      { name: "Warm layers (weather changes fast)" },
    ],
  },
  rome: {
    category: "Rome Specifics",
    emoji: "🏟️",
    items: [
      { name: "Modest clothing for Vatican" },
      { name: "Refillable water bottle (free nasoni fountains)" },
      { name: "Comfortable shoes (cobblestones)" },
    ],
  },
  lisbon: {
    category: "Lisbon Specifics",
    emoji: "🚃",
    items: [
      { name: "Grippy shoes (cobblestone hills)" },
      { name: "Light layers (coastal breeze)" },
      { name: "Sintra tickets (pre-booked)" },
    ],
  },
  reykjavik: {
    category: "Iceland Specifics",
    emoji: "🌌",
    items: [
      { name: "Windproof / waterproof outer shell" },
      { name: "Thermal underlayers" },
      { name: "Swimsuit (hot springs!)" },
      { name: "Eye mask (midnight sun in summer)" },
    ],
  },
  "new-york": {
    category: "NYC Specifics",
    emoji: "🗽",
    items: [
      { name: "MetroCard / OMNY tap" },
      { name: "Layers (subway is warm, outside varies)" },
      { name: "Broadway show outfit" },
    ],
  },
  marrakech: {
    category: "Marrakech Specifics",
    emoji: "🕌",
    items: [
      { name: "Modest clothing (cover shoulders & knees)" },
      { name: "Cash in small MAD bills (for souks)" },
      { name: "Scarf / shawl (dust & sun)" },
      { name: "Earplugs (medina noise)" },
    ],
  },
  "cape-town": {
    category: "Cape Town Specifics",
    emoji: "⛰️",
    items: [
      { name: "Layers (weather changes rapidly)" },
      { name: "Binoculars (wildlife & views)" },
      { name: "Rental car booking confirmation" },
    ],
  },
  sydney: {
    category: "Sydney Specifics",
    emoji: "🐨",
    items: [
      { name: "Opal card (transit)" },
      { name: "Reef-safe sunscreen (SPF 50+)" },
      { name: "Rashguard / swim shirt" },
    ],
  },
};

// ─── Climate mapping per destination ──────────────────────────────────────────

const DESTINATION_CLIMATE: Record<string, string> = {
  tokyo: "mild",
  bali: "hot",
  bangkok: "hot",
  dubai: "hot",
  paris: "mild",
  barcelona: "mild",
  santorini: "hot",
  london: "rainy",
  rome: "mild",
  lisbon: "mild",
  reykjavik: "cold",
  "new-york": "mild",
  marrakech: "hot",
  "cape-town": "mild",
  sydney: "mild",
};

// ─── Generator function ───────────────────────────────────────────────────────

export type TripType = "beach" | "city" | "hiking" | "business" | "wellness";

export const TRIP_TYPES: { id: TripType; label: string; emoji: string }[] = [
  { id: "beach", label: "Beach", emoji: "🏖️" },
  { id: "city", label: "City Break", emoji: "🏙️" },
  { id: "hiking", label: "Hiking", emoji: "🥾" },
  { id: "business", label: "Business", emoji: "💼" },
  { id: "wellness", label: "Wellness", emoji: "🧘" },
];

export function generatePackingList(
  destinationSlug: string,
  tripType: TripType,
): PackingCategory[] {
  const categories: PackingCategory[] = [
    // Deep clone base categories
    structuredClone(BASE_ESSENTIALS),
    structuredClone(BASE_TOILETRIES),
    structuredClone(BASE_TECH),
    structuredClone(BASE_COMFORT),
  ];

  // Add trip type items
  const typeItems = TRIP_TYPE_ITEMS[tripType];
  if (typeItems) {
    categories.push(...structuredClone(typeItems));
  }

  // Add climate items
  const climate = DESTINATION_CLIMATE[destinationSlug] || "mild";
  const climateCategory = CLIMATE_ITEMS[climate];
  if (climateCategory) {
    categories.push(structuredClone(climateCategory));
  }

  // Add destination-specific items
  const destCategory = DESTINATION_ITEMS[destinationSlug];
  if (destCategory) {
    categories.push(structuredClone(destCategory));
  }

  return categories;
}
