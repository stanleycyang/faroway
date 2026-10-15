import {
  destinationGuides,
  type DestinationGuide,
} from "@/lib/destination-guides";

export interface DestinationMention {
  title: string;
  description?: string;
  tags?: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word match. "India" does not match "Indian"; "USA" does not match "usage". */
export function hasWholeWord(haystack: string, phrase: string): boolean {
  if (!phrase.trim() || !haystack) return false;
  const pattern = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i");
  return pattern.test(haystack);
}

function wordIndex(haystack: string, phrase: string): number {
  if (!phrase.trim() || !haystack) return -1;
  const match = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i").exec(haystack);
  return match ? match.index : -1;
}

interface Hit {
  guide: DestinationGuide;
  score: number;
  index: number;
}

function bestHit(hits: Hit[]): DestinationGuide | null {
  if (hits.length === 0) return null;
  hits.sort((a, b) => b.score - a.score || a.index - b.index);
  return hits[0].guide;
}

/**
 * Link a post to one destination guide.
 * City names win over countries, longer names win over shorter ones, and a
 * country is used only when a single guide has that country.
 */
export function matchDestination(
  mention: DestinationMention,
  guides: DestinationGuide[] = destinationGuides,
): DestinationGuide | null {
  const fields = [
    { text: (mention.tags ?? []).join(" "), weight: 3 },
    { text: mention.title ?? "", weight: 2 },
    { text: mention.description ?? "", weight: 1 },
  ];

  const cityHits: Hit[] = [];
  for (const guide of guides) {
    for (const field of fields) {
      const index = wordIndex(field.text, guide.name);
      if (index < 0) continue;
      cityHits.push({
        guide,
        score: field.weight * 1000 + guide.name.length,
        index,
      });
    }
  }
  const city = bestHit(cityHits);
  if (city) return city;

  const countryCount = new Map<string, number>();
  for (const guide of guides) {
    const key = guide.country.toLowerCase();
    countryCount.set(key, (countryCount.get(key) ?? 0) + 1);
  }

  const countryHits: Hit[] = [];
  for (const guide of guides) {
    if ((countryCount.get(guide.country.toLowerCase()) ?? 0) !== 1) continue;
    for (const field of fields) {
      const index = wordIndex(field.text, guide.country);
      if (index < 0) continue;
      countryHits.push({
        guide,
        score: field.weight * 1000 + guide.country.length,
        index,
      });
    }
  }
  return bestHit(countryHits);
}

export function postMatchesDestination(
  mention: DestinationMention,
  destinationSlug: string,
  guides: DestinationGuide[] = destinationGuides,
): boolean {
  return matchDestination(mention, guides)?.slug === destinationSlug;
}
