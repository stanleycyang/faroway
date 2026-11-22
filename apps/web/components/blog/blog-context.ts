import { popularDestinations } from "@faroway/constants";
import { getAllGuides } from "@/lib/destination-guides";
import type { BlogPostMeta } from "@/lib/blog/types";

export interface BlogMonetizationContext {
  destination?: string;
  country?: string;
  currency?: string;
  destinationLabel?: string;
  isFinancialContent: boolean;
  isFlightFocus: boolean;
  isHotelFocus: boolean;
  plannerHref: string;
}

const REGION_FALLBACKS: Array<{
  pattern: RegExp;
  destination: string;
  country: string;
  currency?: string;
}> = [
  {
    pattern: /\bsoutheast asia\b/i,
    destination: "Bangkok, Thailand",
    country: "Thailand",
    currency: "THB",
  },
  {
    pattern: /\beurope\b/i,
    destination: "Paris, France",
    country: "France",
    currency: "EUR",
  },
  {
    pattern: /\bjapan\b/i,
    destination: "Tokyo, Japan",
    country: "Japan",
    currency: "JPY",
  },
  {
    pattern: /\bthailand\b/i,
    destination: "Bangkok, Thailand",
    country: "Thailand",
    currency: "THB",
  },
  {
    pattern: /\bitaly\b/i,
    destination: "Rome, Italy",
    country: "Italy",
    currency: "EUR",
  },
  {
    pattern: /\bfrance\b/i,
    destination: "Paris, France",
    country: "France",
    currency: "EUR",
  },
  {
    pattern: /\bspain\b/i,
    destination: "Barcelona, Spain",
    country: "Spain",
    currency: "EUR",
  },
  {
    pattern: /\bgreece\b/i,
    destination: "Santorini, Greece",
    country: "Greece",
    currency: "EUR",
  },
  {
    pattern: /\bindonesia\b/i,
    destination: "Bali, Indonesia",
    country: "Indonesia",
    currency: "IDR",
  },
  {
    pattern: /\bportugal\b/i,
    destination: "Lisbon, Portugal",
    country: "Portugal",
    currency: "EUR",
  },
  {
    pattern: /\biceland\b/i,
    destination: "Reykjavik, Iceland",
    country: "Iceland",
    currency: "ISK",
  },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsWholeTerm(haystack: string, needle: string): boolean {
  const clean = needle.trim();
  if (!clean) return false;
  const re = new RegExp(`\\b${escapeRegex(clean)}\\b`, "i");
  return re.test(haystack);
}

export function extractBlogMonetizationContext(
  post: Pick<
    BlogPostMeta,
    "slug" | "title" | "description" | "category" | "tags"
  >,
): BlogMonetizationContext {
  const categorySlug = post.category.toLowerCase().replace(/\s+/g, "-");
  const isFinancialContent =
    categorySlug === "money" ||
    post.tags.some((tag) => /credit|finance|bank|rewards/i.test(tag));

  const haystack = [
    post.slug.replace(/-/g, " "),
    post.title,
    post.description,
    post.tags.join(" "),
  ].join(" ");

  const isFlightFocus = /\b(flight|flights|airfare|airline|airport)\b/i.test(
    haystack,
  );
  const isHotelFocus =
    /\b(hotel|hotels|stay|stays|hostel|resort|ryokan)\b/i.test(haystack);

  // 1. Check curated 42 destination guides first (city name, then country)
  const guides = getAllGuides();
  for (const guide of guides) {
    if (containsWholeTerm(haystack, guide.name)) {
      const currencyMatch = guide.quickFacts.currency.match(/\b([A-Z]{3})\b/);
      return {
        destination: `${guide.name}, ${guide.country}`,
        country: guide.country,
        currency: currencyMatch?.[1],
        destinationLabel: guide.name,
        isFinancialContent,
        isFlightFocus,
        isHotelFocus,
        plannerHref: `/create?destination=${encodeURIComponent(guide.name)}`,
      };
    }
  }

  // 2. Check popularDestinations
  for (const dest of popularDestinations) {
    if (
      containsWholeTerm(haystack, dest.name) ||
      containsWholeTerm(haystack, dest.country)
    ) {
      return {
        destination: `${dest.name}, ${dest.country}`,
        country: dest.country,
        currency: dest.currency,
        destinationLabel: dest.name,
        isFinancialContent,
        isFlightFocus,
        isHotelFocus,
        plannerHref: `/create?destination=${encodeURIComponent(dest.name)}`,
      };
    }
  }

  // 3. Check country names from guides
  for (const guide of guides) {
    if (containsWholeTerm(haystack, guide.country)) {
      const currencyMatch = guide.quickFacts.currency.match(/\b([A-Z]{3})\b/);
      return {
        destination: `${guide.name}, ${guide.country}`,
        country: guide.country,
        currency: currencyMatch?.[1],
        destinationLabel: guide.country,
        isFinancialContent,
        isFlightFocus,
        isHotelFocus,
        plannerHref: `/create?destination=${encodeURIComponent(guide.name)}`,
      };
    }
  }

  // 4. Regional fallbacks
  for (const region of REGION_FALLBACKS) {
    if (region.pattern.test(haystack)) {
      return {
        destination: region.destination,
        country: region.country,
        currency: region.currency,
        destinationLabel: region.destination.split(",")[0],
        isFinancialContent,
        isFlightFocus,
        isHotelFocus,
        plannerHref: `/create?destination=${encodeURIComponent(region.destination)}`,
      };
    }
  }

  return {
    isFinancialContent,
    isFlightFocus,
    isHotelFocus,
    plannerHref: "/create",
  };
}
