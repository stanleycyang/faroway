/**
 * Migrate Unsplash images to Supabase Storage.
 *
 * Usage: npx tsx scripts/migrate-images-to-supabase.ts
 *
 * Requires environment variables:
 *   SUPABASE_URL          — your Supabase project URL
 *   SUPABASE_SERVICE_KEY  — service role key (not anon key)
 */

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'images';

interface ImageManifestEntry {
  unsplashUrl: string;
  storagePath: string;
}

// ---------- Complete image manifest ----------

const MANIFEST: ImageManifestEntry[] = [
  // ── Destinations (1920px for hero usage) ──
  { unsplashUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1920&q=85', storagePath: 'destinations/tokyo-photo-1540959733332-eab4deabeeaf.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1920&q=85', storagePath: 'destinations/paris-photo-1502602898657-3e91760cbb34.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1920&q=85', storagePath: 'destinations/bali-photo-1537996194471-e657df975ab4.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1920&q=85', storagePath: 'destinations/new-york-photo-1496442226666-8d4d0e62e6e9.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1920&q=85', storagePath: 'destinations/barcelona-photo-1583422409516-2895a77efded.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=1920&q=85', storagePath: 'destinations/reykjavik-photo-1504829857797-ddff29c27927.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1920&q=85', storagePath: 'destinations/dubai-photo-1512453979798-5ea266f8880c.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=1920&q=85', storagePath: 'destinations/santorini-photo-1613395877344-13d4a8e0d49e.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1920&q=85', storagePath: 'destinations/london-photo-1513635269975-59663e0ac1ad.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1920&q=85', storagePath: 'destinations/rome-photo-1552832230-c0197dd311b5.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1920&q=85', storagePath: 'destinations/bangkok-photo-1508009603885-50cf7c579365.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1920&q=85', storagePath: 'destinations/sydney-photo-1506973035872-a4ec16b8e8d9.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1920&q=85', storagePath: 'destinations/amsterdam-photo-1534351590666-13e3e96b5017.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1920&q=85', storagePath: 'destinations/singapore-photo-1525625293386-3f8f99389edd.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1920&q=85', storagePath: 'destinations/cape-town-photo-1580060839134-75a5edca2e99.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1920&q=85', storagePath: 'destinations/kyoto-photo-1493976040374-85c8e12f0c0e.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1920&q=85', storagePath: 'destinations/lisbon-photo-1585208798174-6cedd86e019a.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=1920&q=85', storagePath: 'destinations/marrakech-photo-1597212618440-806262de4f6b.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1510097467424-192d713fd8b2?w=1920&q=85', storagePath: 'destinations/cancun-photo-1510097467424-192d713fd8b2.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1920&q=85', storagePath: 'destinations/istanbul-photo-1524231757912-21f4fe3a7200.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=1920&q=85', storagePath: 'destinations/prague-photo-1519677100203-a0e668c92439.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1920&q=85', storagePath: 'destinations/maldives-photo-1514282401047-d79a71a590e8.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=1920&q=85', storagePath: 'destinations/interlaken-photo-1530122037265-a5f1f91d3b99.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1534113414509-0eec2bfb493f?w=1920&q=85', storagePath: 'destinations/amalfi-coast-photo-1534113414509-0eec2bfb493f.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1920&q=85', storagePath: 'destinations/ibiza-photo-1539037116277-4db20889f2d4.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1522199710521-72d69614c702?w=1920&q=85', storagePath: 'destinations/chamonix-photo-1522199710521-72d69614c702.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?w=1920&q=85', storagePath: 'destinations/hanoi-photo-1509030450996-dd1a26dda07a.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=1920&q=85', storagePath: 'destinations/rio-de-janeiro-photo-1483729558449-99ef09a8c325.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=1920&q=85', storagePath: 'destinations/vienna-photo-1516550893923-42d28e5677af.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1519999482648-25049ddd37b1?w=1920&q=85', storagePath: 'destinations/costa-rica-photo-1519999482648-25049ddd37b1.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1612294037637-ec328d0e075e?w=1920&q=85', storagePath: 'destinations/buenos-aires-photo-1612294037637-ec328d0e075e.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1549918864-48ac978761a4?w=1920&q=85', storagePath: 'destinations/dublin-photo-1549918864-48ac978761a4.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=1920&q=85', storagePath: 'destinations/phuket-photo-1589394815804-964ed0be2eb5.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?w=1920&q=85', storagePath: 'destinations/cairo-photo-1572252009286-268acec5ca0a.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=1920&q=85', storagePath: 'destinations/seoul-photo-1534274988757-a28bf1a57c17.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1548786811-dd6e453ccca7?w=1920&q=85', storagePath: 'destinations/petra-photo-1548786811-dd6e453ccca7.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1559511260-66a654ae982a?w=1920&q=85', storagePath: 'destinations/vancouver-photo-1559511260-66a654ae982a.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1586861635167-e5223aadc9fe?w=1920&q=85', storagePath: 'destinations/zanzibar-photo-1586861635167-e5223aadc9fe.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=1920&q=85', storagePath: 'destinations/queenstown-photo-1507699622108-4be3abd695ad.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1500759285222-a95626b934cb?w=1920&q=85', storagePath: 'destinations/havana-photo-1500759285222-a95626b934cb.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=1920&q=85', storagePath: 'destinations/jaipur-photo-1477587458883-47145ed94245.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?w=1920&q=85', storagePath: 'destinations/copenhagen-photo-1513622470522-26c3c8a854bc.jpg' },

  // ── Inspirations (1200px) ──
  { unsplashUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=85', storagePath: 'inspirations/beach-getaway-photo-1507525428034-b723cf961d3e.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=85', storagePath: 'inspirations/mountain-escape-photo-1464822759023-fed622ff2c3b.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=85', storagePath: 'inspirations/foodie-adventure-photo-1504674900247-0877df9cc836.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=1920&q=85', storagePath: 'inspirations/art-and-culture-photo-1518998053901-5348d3961a04.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1920&q=85', storagePath: 'inspirations/party-weekend-photo-1514525253161-7a46d19cd819.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=1920&q=85', storagePath: 'inspirations/romantic-trip-photo-1518199266791-5375a83190b7.jpg' },

  // ── Blog covers ──
  { unsplashUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=85', storagePath: 'blog/ultimate-guide-photo-1488646953014-85cb44e25828.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=1920&q=85', storagePath: 'blog/hidden-gems-photo-1552465011-b4e21bf6e79a.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1556388158-158ea5ccacbd?w=1920&q=85', storagePath: 'blog/save-money-flights-photo-1556388158-158ea5ccacbd.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1920&q=85', storagePath: 'blog/best-time-japan-photo-1493976040374-85c8e12f0c0e.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=85', storagePath: 'blog/default-photo-1507525428034-b723cf961d3e.jpg' },
  // Blog cluster heroes
  { unsplashUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=1920&q=85', storagePath: 'blog/cluster-travel-planning-photo-1526304640581-d334cdbbf45e.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1920&q=85', storagePath: 'blog/cluster-destinations-photo-1506929562872-bb421503ef21.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=85', storagePath: 'blog/cluster-budget-travel-photo-1507525428034-b723cf961d3e.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=85', storagePath: 'blog/cluster-adventure-photo-1501785888041-af3ef285b470.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=1920&q=85', storagePath: 'blog/cluster-group-travel-photo-1539635278303-d4002c07eae3.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=85', storagePath: 'blog/cluster-solo-travel-photo-1488646953014-85cb44e25828.jpg' },

  // ── Marketing ──
  { unsplashUrl: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1920&q=85', storagePath: 'marketing/gallery-maldives-photo-1506929562872-bb421503ef21.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=85', storagePath: 'marketing/gallery-swiss-alps-photo-1464822759023-fed622ff2c3b.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?w=1920&q=85', storagePath: 'marketing/gallery-venice-photo-1523906834658-6e24ef2386f9.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=85', storagePath: 'marketing/gallery-lake-bled-photo-1501785888041-af3ef285b470.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=85', storagePath: 'marketing/beach-hero-photo-1507525428034-b723cf961d3e.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=85', storagePath: 'marketing/aerial-travel-photo-1476514525535-07fb3b4ae5f1.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=1920&q=85', storagePath: 'marketing/travel-discovery-photo-1530789253388-582c481c54b0.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1920&q=85', storagePath: 'marketing/hotel-feature-photo-1571896349842-33c89424de2d.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=85', storagePath: 'marketing/travel-planning-photo-1488646953014-85cb44e25828.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=85', storagePath: 'marketing/road-trip-photo-1469854523086-cc02fe5d8800.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1920&q=85', storagePath: 'marketing/camping-adventure-photo-1504280390367-361c6d9f38f4.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1452421822248-d4c2b47f0c81?w=1920&q=85', storagePath: 'marketing/travel-desk-photo-1452421822248-d4c2b47f0c81.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=1920&q=85', storagePath: 'marketing/passport-journey-photo-1527631746610-bca00a040d60.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?w=1920&q=85', storagePath: 'marketing/train-journey-photo-1503220317375-aaad61436b1b.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=1920&q=85', storagePath: 'marketing/cta-background-photo-1500835556837-99ac94a94552.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=1920&q=85', storagePath: 'marketing/ocean-hero-photo-1559128010-7c1ad6e1b6a5.jpg' },

  // ── Placeholders ──
  { unsplashUrl: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1920&q=85', storagePath: 'placeholders/paris-photo-1499856871958-5b9627545d1a.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=1920&q=85', storagePath: 'placeholders/tokyo-photo-1513407030348-c983a97b98d8.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1920&q=85', storagePath: 'placeholders/nyc-photo-1534430480872-3498386e7856.jpg' },
  { unsplashUrl: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1920&q=85', storagePath: 'placeholders/italy-photo-1516483638261-f4dbaf036963.jpg' },
];

// ---------- Helpers ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function downloadWithRetry(
  url: string,
  retries = 3,
): Promise<ArrayBuffer> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.arrayBuffer();
    } catch (err) {
      if (attempt === retries) throw err;
      const backoff = 1000 * 2 ** (attempt - 1);
      console.warn(`  Retry ${attempt}/${retries} after ${backoff}ms...`);
      await sleep(backoff);
    }
  }
  throw new Error('unreachable');
}

// ---------- Main ----------

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.',
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Dedupe manifest entries (some Unsplash photos map to multiple storage paths)
  const uniquePaths = new Set<string>();
  const dedupedManifest = MANIFEST.filter((entry) => {
    if (uniquePaths.has(entry.storagePath)) return false;
    uniquePaths.add(entry.storagePath);
    return true;
  });

  console.log(`\nMigrating ${dedupedManifest.length} images to Supabase Storage...\n`);

  // Check which files already exist
  const existingFiles = new Set<string>();
  for (const folder of ['destinations', 'inspirations', 'blog', 'marketing', 'placeholders']) {
    const { data } = await supabase.storage.from(BUCKET).list(folder, { limit: 1000 });
    if (data) {
      for (const file of data) {
        existingFiles.add(`${folder}/${file.name}`);
      }
    }
  }

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const entry of dedupedManifest) {
    // Idempotent: skip if already exists
    if (existingFiles.has(entry.storagePath)) {
      console.log(`  SKIP  ${entry.storagePath} (already exists)`);
      skipped++;
      continue;
    }

    try {
      console.log(`  DOWN  ${entry.storagePath}...`);
      const buffer = await downloadWithRetry(entry.unsplashUrl);

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(entry.storagePath, buffer, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
          upsert: false,
        });

      if (error) throw error;

      console.log(`  UP    ${entry.storagePath} (${(buffer.byteLength / 1024).toFixed(0)} KB)`);
      uploaded++;
    } catch (err: any) {
      console.error(`  FAIL  ${entry.storagePath}: ${err.message}`);
      failures.push(entry.storagePath);
      failed++;
    }

    // Rate-limit: 200ms between downloads
    await sleep(200);
  }

  // ── Verification ──
  console.log('\n--- Verification ---');
  const allExpected = new Set(dedupedManifest.map((e) => e.storagePath));
  const allFound = new Set<string>();

  for (const folder of ['destinations', 'inspirations', 'blog', 'marketing', 'placeholders']) {
    const { data } = await supabase.storage.from(BUCKET).list(folder, { limit: 1000 });
    if (data) {
      for (const file of data) {
        allFound.add(`${folder}/${file.name}`);
      }
    }
  }

  const missing = [...allExpected].filter((p) => !allFound.has(p));

  console.log(`\nTotal expected: ${allExpected.size}`);
  console.log(`Total found:    ${allFound.size}`);
  console.log(`Uploaded:       ${uploaded}`);
  console.log(`Skipped:        ${skipped}`);
  console.log(`Failed:         ${failed}`);

  if (missing.length > 0) {
    console.error(`\nMISSING FILES (${missing.length}):`);
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  } else {
    console.log('\nAll images verified in Supabase Storage.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
