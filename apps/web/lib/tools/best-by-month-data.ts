import { climateData } from "./climate-data";
import { getGuideBySlug } from "@/lib/destination-guides";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MonthDestination {
  slug: string;
  name: string;
  country: string;
  continent: string;
  tagline: string;
  heroImage: string;
  avgTempC: number;
  avgTempF: number;
  season: "peak" | "shoulder" | "off";
  crowdLevel: number;
  events: string[];
  pros: string[];
  vibes: string[];
}

export interface MonthGuide {
  month: string; // "january", "february", etc.
  monthShort: string; // "Jan", "Feb", etc.
  monthIndex: number; // 0-11
  title: string;
  description: string;
  destinations: MonthDestination[];
}

// ─── Month mapping ───────────────────────────────────────────────────────────

const MONTHS = [
  { full: "january", short: "Jan", label: "January" },
  { full: "february", short: "Feb", label: "February" },
  { full: "march", short: "Mar", label: "March" },
  { full: "april", short: "Apr", label: "April" },
  { full: "may", short: "May", label: "May" },
  { full: "june", short: "Jun", label: "June" },
  { full: "july", short: "Jul", label: "July" },
  { full: "august", short: "Aug", label: "August" },
  { full: "september", short: "Sep", label: "September" },
  { full: "october", short: "Oct", label: "October" },
  { full: "november", short: "Nov", label: "November" },
  { full: "december", short: "Dec", label: "December" },
] as const;

// ─── Curated top picks per month (ordered by editorial priority) ─────────────

const MONTH_TOP_PICKS: Record<string, string[]> = {
  Jan: [
    "maldives",
    "bangkok",
    "dubai",
    "zanzibar",
    "sydney",
    "cape-town",
    "rio-de-janeiro",
    "singapore",
    "jaipur",
    "queenstown",
    "costa-rica",
    "phuket",
  ],
  Feb: [
    "maldives",
    "rio-de-janeiro",
    "dubai",
    "bali",
    "zanzibar",
    "singapore",
    "jaipur",
    "costa-rica",
    "havana",
    "phuket",
    "queenstown",
    "cape-town",
  ],
  Mar: [
    "tokyo",
    "marrakech",
    "barcelona",
    "dubai",
    "jaipur",
    "costa-rica",
    "cancun",
    "bali",
    "cape-town",
    "havana",
    "lisbon",
    "sydney",
  ],
  Apr: [
    "tokyo",
    "paris",
    "barcelona",
    "lisbon",
    "marrakech",
    "amsterdam",
    "rome",
    "istanbul",
    "petra",
    "bali",
    "kyoto",
    "dublin",
  ],
  May: [
    "santorini",
    "barcelona",
    "lisbon",
    "rome",
    "amalfi-coast",
    "paris",
    "prague",
    "amsterdam",
    "bali",
    "dublin",
    "vienna",
    "istanbul",
  ],
  Jun: [
    "reykjavik",
    "santorini",
    "ibiza",
    "amalfi-coast",
    "barcelona",
    "copenhagen",
    "chamonix",
    "interlaken",
    "vancouver",
    "london",
    "prague",
    "vienna",
  ],
  Jul: [
    "reykjavik",
    "santorini",
    "ibiza",
    "london",
    "interlaken",
    "chamonix",
    "amalfi-coast",
    "barcelona",
    "vancouver",
    "copenhagen",
    "bali",
    "cancun",
  ],
  Aug: [
    "reykjavik",
    "ibiza",
    "santorini",
    "bali",
    "interlaken",
    "chamonix",
    "vancouver",
    "london",
    "copenhagen",
    "cancun",
    "barcelona",
    "cape-town",
  ],
  Sep: [
    "tokyo",
    "barcelona",
    "lisbon",
    "santorini",
    "rome",
    "amalfi-coast",
    "paris",
    "istanbul",
    "marrakech",
    "bali",
    "prague",
    "vienna",
  ],
  Oct: [
    "tokyo",
    "rome",
    "lisbon",
    "marrakech",
    "barcelona",
    "istanbul",
    "cairo",
    "buenos-aires",
    "seoul",
    "bali",
    "paris",
    "hanoi",
  ],
  Nov: [
    "tokyo",
    "bangkok",
    "hanoi",
    "marrakech",
    "dubai",
    "jaipur",
    "cairo",
    "buenos-aires",
    "maldives",
    "zanzibar",
    "singapore",
    "seoul",
  ],
  Dec: [
    "maldives",
    "dubai",
    "bangkok",
    "phuket",
    "new-york",
    "london",
    "vienna",
    "prague",
    "zanzibar",
    "cape-town",
    "sydney",
    "singapore",
  ],
};

// ─── Month descriptions (SEO-rich) ──────────────────────────────────────────

const MONTH_DESCRIPTIONS: Record<string, string> = {
  Jan: "January is peak season in the Southern Hemisphere and tropical destinations. While much of Europe and North America shivers through winter, places like the Maldives, Southeast Asia, and Oceania bask in perfect weather. Prices drop in colder regions, making it ideal for budget-friendly European city breaks too.",
  Feb: "February offers the last stretch of tropical dry seasons and Southern Hemisphere summer. It's carnival season in Rio, ideal weather in the Indian Ocean, and surprisingly affordable for European cities before spring crowds arrive. Valentine's Day makes it popular for romantic getaways.",
  Mar: "March signals the start of spring in the Northern Hemisphere. Cherry blossoms begin in Japan, Mediterranean cities warm up, and tropical destinations enjoy their final dry-season weeks. It's a sweet spot before peak-season prices kick in across Europe.",
  Apr: "April brings spring blooms across Europe and Japan, pleasant temperatures in the Mediterranean, and shoulder-season pricing in many destinations. It's one of the best months for sightseeing — mild weather, fewer crowds than summer, and landscapes at their most vibrant.",
  May: "May is a golden month for travel — warm weather blankets southern Europe and the Mediterranean, crowds haven't peaked yet, and airfares remain reasonable. Greek islands open for the season, European terraces come alive, and Southeast Asia's dry season lingers.",
  Jun: "June marks the official start of summer in the Northern Hemisphere. Iceland's midnight sun, Mediterranean beach season, and Alpine hiking trails all reach their prime. It's also the beginning of monsoon season in parts of Asia, so tropical destinations see fewer tourists.",
  Jul: "July is peak summer across Europe and North America. Long sunny days make it ideal for island hopping, music festivals, road trips, and outdoor adventures. Expect higher prices and bigger crowds, but also the best weather many destinations see all year.",
  Aug: "August is the heart of European summer and peak holiday season. Mediterranean islands, Alpine adventures, and Scandinavian fjords are at their best. It's also a great time for Southern Hemisphere destinations entering late winter with lower prices.",
  Sep: "September is arguably the best month to travel. European summer crowds thin out while the weather stays warm. Japan's autumn colors begin, Mediterranean water is still warm from summer, and prices drop across the board. It's the sweet spot for value and weather.",
  Oct: "October brings spectacular autumn foliage to Japan, New England, and Central Europe. Mediterranean destinations still enjoy warm weather with fraction-of-summer crowds. It's the start of the dry season in parts of Southeast Asia and North Africa.",
  Nov: "November marks the beginning of high season in Southeast Asia and the Middle East as temperatures cool to perfection. European Christmas markets start opening, and tropical destinations enter their prime. It's a fantastic month for cultural immersion before holiday crowds.",
  Dec: "December is magical for travel — Christmas markets glow across Europe, tropical resorts hit peak season, and iconic cities dress up for the holidays. The Maldives, Gulf states, and Southeast Asia offer perfect escape-the-cold weather.",
};

// ─── Build month guides from climate data ────────────────────────────────────

function buildMonthGuide(monthIndex: number): MonthGuide {
  const monthInfo = MONTHS[monthIndex];
  const topPicks = MONTH_TOP_PICKS[monthInfo.short] || [];

  const destinations: MonthDestination[] = [];
  for (const slug of topPicks) {
    const guide = getGuideBySlug(slug);
    const climate = climateData.find((c) => c.slug === slug);
    if (!guide || !climate) continue;

    const monthData = climate.months[monthIndex];
    if (!monthData) continue;

    destinations.push({
      slug: guide.slug,
      name: guide.name,
      country: guide.country,
      continent: guide.continent,
      tagline: guide.tagline,
      heroImage: guide.heroImage,
      avgTempC: monthData.avgTempC,
      avgTempF: monthData.avgTempF,
      season: monthData.season,
      crowdLevel: monthData.crowdLevel,
      events: monthData.events,
      pros: monthData.pros,
      vibes: guide.vibes,
    });
  }

  return {
    month: monthInfo.full,
    monthShort: monthInfo.short,
    monthIndex,
    title: `Best Places to Travel in ${monthInfo.label}`,
    description:
      MONTH_DESCRIPTIONS[monthInfo.short] ||
      `Discover the best destinations to visit in ${monthInfo.label}.`,
    destinations,
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export function getMonthGuide(monthSlug: string): MonthGuide | undefined {
  const index = MONTHS.findIndex((m) => m.full === monthSlug);
  if (index === -1) return undefined;
  return buildMonthGuide(index);
}

export function getAllMonthSlugs(): string[] {
  return MONTHS.map((m) => m.full);
}

export function getAllMonthGuides(): MonthGuide[] {
  return MONTHS.map((_, i) => buildMonthGuide(i));
}

export function getMonthLabel(monthSlug: string): string {
  const m = MONTHS.find((m) => m.full === monthSlug);
  return m ? m.label : monthSlug;
}

export function getAdjacentMonths(monthSlug: string): {
  prev: { slug: string; label: string };
  next: { slug: string; label: string };
} {
  const index = MONTHS.findIndex((m) => m.full === monthSlug);
  const prevIndex = index <= 0 ? 11 : index - 1;
  const nextIndex = index >= 11 ? 0 : index + 1;
  return {
    prev: { slug: MONTHS[prevIndex].full, label: MONTHS[prevIndex].label },
    next: { slug: MONTHS[nextIndex].full, label: MONTHS[nextIndex].label },
  };
}
