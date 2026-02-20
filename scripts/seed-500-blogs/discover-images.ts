/**
 * Discover unique Unsplash photo IDs for each destination × template.
 *
 * Usage:
 *   npx tsx scripts/seed-500-blogs/discover-images.ts
 *
 * Outputs: scripts/seed-500-blogs/image-map.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { destinations } from './destinations';

const RESULTS_PER_PAGE = 30;
const RATE_LIMIT_MS = 350; // be polite to Unsplash
const OUTPUT = path.resolve(__dirname, 'image-map.json');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Template-specific search suffixes to find thematically appropriate photos
const TEMPLATE_QUERIES = [
  'landscape scenic',     // 0: Best Time to Visit
  'landmarks sightseeing', // 1: Itinerary
  'street market budget',  // 2: Budget
  'hotel neighborhood',    // 3: Where to Stay
  'food cuisine restaurant', // 4: Food
  'travel tips culture',   // 5: First Time Tips
  'hidden gems nature',    // 6: Hidden Gems
  'solo traveler street',  // 7: Safety & Solo
  'transportation train',  // 8: Transport
  'day trip excursion',    // 9: Day Trips
];

interface SearchResult {
  urls: { raw: string };
}

async function searchUnsplash(query: string, page = 1): Promise<string[]> {
  const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=${RESULTS_PER_PAGE}&page=${page}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TripGenie-BlogImageDiscovery/1.0',
      },
    });
    if (!res.ok) {
      console.warn(`  HTTP ${res.status} for query: ${query}`);
      return [];
    }
    const data = await res.json();
    const results: SearchResult[] = data.results || [];

    // Filter to images.unsplash.com only (skip premium/plus photos)
    // Extract the photo-{id} portion
    return results
      .map((r) => {
        const raw = r.urls.raw.split('?')[0];
        if (!raw.includes('images.unsplash.com/photo-')) return null;
        return raw.replace('https://images.unsplash.com/', '');
      })
      .filter((id): id is string => id !== null);
  } catch (err: any) {
    console.warn(`  Fetch error for query "${query}": ${err.message}`);
    return [];
  }
}

async function main() {
  const globalUsed = new Set<string>();
  const imageMap: Record<string, string[]> = {};

  // Also add all currently-used imgIds to the global set so we get truly new images
  for (const dest of destinations) {
    globalUsed.add(dest.imgId);
  }

  console.log(`Discovering images for ${destinations.length} destinations...\n`);

  for (let di = 0; di < destinations.length; di++) {
    const dest = destinations[di];
    const destImages: string[] = [];
    console.log(`[${di + 1}/${destinations.length}] ${dest.name} (${dest.country})`);

    // For each template, search with a themed query
    for (let ti = 0; ti < TEMPLATE_QUERIES.length; ti++) {
      if (destImages.length >= 10) break;

      const query = `${dest.name} ${dest.country} ${TEMPLATE_QUERIES[ti]}`;
      const ids = await searchUnsplash(query);
      await sleep(RATE_LIMIT_MS);

      // Pick the first unused ID from results
      let found = false;
      for (const id of ids) {
        if (!globalUsed.has(id) && !destImages.includes(id)) {
          destImages.push(id);
          globalUsed.add(id);
          found = true;
          break;
        }
      }

      // If themed query didn't find unique results, try broader queries
      if (!found) {
        const fallbackQuery = `${dest.name} travel photography`;
        const fallbackIds = await searchUnsplash(fallbackQuery, 2 + ti);
        await sleep(RATE_LIMIT_MS);

        for (const id of fallbackIds) {
          if (!globalUsed.has(id) && !destImages.includes(id)) {
            destImages.push(id);
            globalUsed.add(id);
            found = true;
            break;
          }
        }
      }

      if (!found) {
        console.warn(`  WARNING: Could not find unique image for template ${ti}`);
      }
    }

    // If we still don't have 10, try additional general searches
    let extraPage = 3;
    while (destImages.length < 10 && extraPage <= 10) {
      const query = `${dest.name} ${dest.country}`;
      const ids = await searchUnsplash(query, extraPage);
      await sleep(RATE_LIMIT_MS);

      for (const id of ids) {
        if (!globalUsed.has(id) && !destImages.includes(id)) {
          destImages.push(id);
          globalUsed.add(id);
          if (destImages.length >= 10) break;
        }
      }
      extraPage++;
    }

    imageMap[dest.id] = destImages;
    console.log(`  Found ${destImages.length}/10 unique images`);
  }

  // Write output
  fs.writeFileSync(OUTPUT, JSON.stringify(imageMap, null, 2));
  console.log(`\nDone! Wrote image map to ${OUTPUT}`);

  // Stats
  const totalImages = Object.values(imageMap).reduce((sum, arr) => sum + arr.length, 0);
  const allIds = Object.values(imageMap).flat();
  const uniqueIds = new Set(allIds);
  console.log(`Total images: ${totalImages}`);
  console.log(`Unique images: ${uniqueIds.size}`);
  console.log(`Destinations with <10 images: ${Object.values(imageMap).filter(a => a.length < 10).length}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
