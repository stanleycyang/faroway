/**
 * Destination utility functions
 * Scoring, matching, and season logic for the destinations API
 */

export interface DestinationRow {
  id: string;
  slug: string;
  name: string;
  country: string;
  name_normalized: string;
  aliases: string[];
  description: string;
  image: string;
  tags: string[];
  seasons: { peak?: number[]; good?: number[]; off?: number[] };
  currency: string;
  language: string;
  best_time: string;
  base_popularity_score: number;
}

/**
 * JS mirror of the SQL normalize_destination() function.
 * lower(trim(split_part(raw, ',', 1)))
 */
export function normalizeDestination(raw: string): string {
  return raw.split(",")[0].trim().toLowerCase();
}

/**
 * Match a raw destination string to a known destination via normalized name or aliases.
 */
export function matchDestination(
  raw: string,
  destinations: DestinationRow[],
): DestinationRow | undefined {
  const normalized = normalizeDestination(raw);
  return destinations.find(
    (d) =>
      d.name_normalized === normalized ||
      d.aliases.some((a) => a.toLowerCase() === normalized),
  );
}

/**
 * Returns the current meteorological season and month number (1-12).
 * Northern hemisphere: winter=Dec-Feb, spring=Mar-May, summer=Jun-Aug, fall=Sep-Nov
 */
export function getCurrentSeason(): { season: string; month: number } {
  const month = new Date().getMonth() + 1; // 1-12
  let season: string;
  if (month >= 3 && month <= 5) season = "spring";
  else if (month >= 6 && month <= 8) season = "summer";
  else if (month >= 9 && month <= 11) season = "fall";
  else season = "winter";
  return { season, month };
}

/**
 * Compute popularity score for all-time ranking.
 * Formula: (tripCount * 3) + (searchCount * 1) + (baseScore * 0.5)
 */
export function computePopularScore(
  tripCount: number,
  searchCount: number,
  baseScore: number,
): number {
  return tripCount * 3 + searchCount * 1 + baseScore * 0.5;
}

/**
 * Compute trending score for recency-weighted ranking.
 * Formula: (recentTrips * 5) + (recentSearches * 2) + seasonBoost
 */
export function computeTrendingScore(
  recentTrips: number,
  recentSearches: number,
  seasonBoost: number,
): number {
  return recentTrips * 5 + recentSearches * 2 + seasonBoost;
}

/**
 * Calculate season boost for a destination given its seasons data and the current month.
 * +20 if current month is in peak, +10 if in good, 0 otherwise
 */
export function getSeasonBoost(
  seasons: { peak?: number[]; good?: number[]; off?: number[] },
  month: number,
): number {
  if (seasons.peak?.includes(month)) return 20;
  if (seasons.good?.includes(month)) return 10;
  return 0;
}
