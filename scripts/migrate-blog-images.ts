/**
 * Migrate blog cover images from Unsplash to Supabase Storage.
 *
 * For each MDX file in apps/web/content/blog/:
 * 1. If coverImage is already a Supabase URL -> skip
 * 2. If coverImage is an Unsplash URL -> test it, download, upload to Supabase
 * 3. If the Unsplash URL is broken -> assign a curated fallback photo
 *
 * Usage:
 *   npx tsx scripts/migrate-blog-images.ts
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL from apps/web/.env
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ── Config ──

const BUCKET = 'images';
const BLOG_DIR = path.resolve(__dirname, '../apps/web/content/blog');
const ENV_PATH = path.resolve(__dirname, '../apps/web/.env');
const SUPABASE_URL = 'https://jcnephijkxgtprsutgsf.supabase.co';
const CONCURRENCY = 5;

// ── Load env ──

function loadEnv(): string {
  const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
  if (!match) throw new Error('SUPABASE_SERVICE_ROLE_KEY not found in .env');
  return match[1].trim();
}

// ── Curated fallback pool of REAL Unsplash photos by category ──
// These are all confirmed-working photo IDs from the existing manifest

const FALLBACK_POOL: Record<string, string[]> = {
  'Budget Travel': [
    'photo-1507525428034-b723cf961d3e', // beach
    'photo-1469854523086-cc02fe5d8800', // road trip
    'photo-1488646953014-85cb44e25828', // travel
    'photo-1452421822248-d4c2b47f0c81', // travel desk
    'photo-1530789253388-582c481c54b0', // discovery
    'photo-1476514525535-07fb3b4ae5f1', // aerial
    'photo-1500835556837-99ac94a94552', // travel
    'photo-1527631746610-bca00a040d60', // passport
    'photo-1503220317375-aaad61436b1b', // train journey
    'photo-1504280390367-361c6d9f38f4', // camping
  ],
  'Destinations': [
    'photo-1502602898657-3e91760cbb34', // paris
    'photo-1513635269975-59663e0ac1ad', // london
    'photo-1552832230-c0197dd311b5', // rome
    'photo-1540959733332-eab4deabeeaf', // tokyo
    'photo-1508009603885-50cf7c579365', // bangkok
    'photo-1537996194471-e657df975ab4', // bali
    'photo-1583422409516-2895a77efded', // barcelona
    'photo-1506973035872-a4ec16b8e8d9', // sydney
    'photo-1534351590666-13e3e96b5017', // amsterdam
    'photo-1519677100203-a0e668c92439', // prague
    'photo-1524231757912-21f4fe3a7200', // istanbul
    'photo-1585208798174-6cedd86e019a', // lisbon
    'photo-1493976040374-85c8e12f0c0e', // kyoto
    'photo-1534274988757-a28bf1a57c17', // seoul
    'photo-1572252009286-268acec5ca0a', // cairo
    'photo-1512453979798-5ea266f8880c', // dubai
    'photo-1525625293386-3f8f99389edd', // singapore
    'photo-1613395877344-13d4a8e0d49e', // santorini
    'photo-1496442226666-8d4d0e62e6e9', // new york
    'photo-1597212618440-806262de4f6b', // marrakech
  ],
  'Travel Tips': [
    'photo-1501785888041-af3ef285b470', // lake landscape
    'photo-1488646953014-85cb44e25828', // travel
    'photo-1526304640581-d334cdbbf45e', // planning
    'photo-1476514525535-07fb3b4ae5f1', // aerial
    'photo-1469854523086-cc02fe5d8800', // road trip
    'photo-1527631746610-bca00a040d60', // passport
    'photo-1452421822248-d4c2b47f0c81', // travel desk
    'photo-1530789253388-582c481c54b0', // discovery
    'photo-1504280390367-361c6d9f38f4', // camping
    'photo-1559128010-7c1ad6e1b6a5', // ocean
  ],
  'Travel Planning': [
    'photo-1526304640581-d334cdbbf45e', // planning
    'photo-1488646953014-85cb44e25828', // travel
    'photo-1452421822248-d4c2b47f0c81', // travel desk
    'photo-1527631746610-bca00a040d60', // passport
    'photo-1530789253388-582c481c54b0', // discovery
    'photo-1500835556837-99ac94a94552', // travel
    'photo-1469854523086-cc02fe5d8800', // road trip
    'photo-1476514525535-07fb3b4ae5f1', // aerial
  ],
  'Technology': [
    'photo-1526304640581-d334cdbbf45e', // planning
    'photo-1488646953014-85cb44e25828', // travel
    'photo-1452421822248-d4c2b47f0c81', // desk
  ],
  'Group Travel': [
    'photo-1539635278303-d4002c07eae3', // group travel
    'photo-1469854523086-cc02fe5d8800', // road
    'photo-1507525428034-b723cf961d3e', // beach
    'photo-1506929562872-bb421503ef21', // beach2
    'photo-1504280390367-361c6d9f38f4', // camping
    'photo-1571896349842-33c89424de2d', // hotel
  ],
};

// Additional keyword-based fallbacks for specific article topics
const KEYWORD_FALLBACKS: Record<string, string> = {
  'beach': 'photo-1507525428034-b723cf961d3e',
  'ski': 'photo-1522199710521-72d69614c702',       // chamonix
  'mountain': 'photo-1464822759023-fed622ff2c3b',
  'food': 'photo-1504674900247-0877df9cc836',
  'coffee': 'photo-1504674900247-0877df9cc836',
  'wine': 'photo-1504674900247-0877df9cc836',
  'safari': 'photo-1547471080-7cc2caa01a7e',       // (we'll test this)
  'island': 'photo-1514282401047-d79a71a590e8',    // maldives
  'train': 'photo-1503220317375-aaad61436b1b',
  'road-trip': 'photo-1469854523086-cc02fe5d8800',
  'camping': 'photo-1504280390367-361c6d9f38f4',
  'yoga': 'photo-1518199266791-5375a83190b7',
  'art': 'photo-1518998053901-5348d3961a04',
  'music': 'photo-1514525253161-7a46d19cd819',
  'diving': 'photo-1506929562872-bb421503ef21',
  'surf': 'photo-1507525428034-b723cf961d3e',
  'christmas': 'photo-1519677100203-a0e668c92439',  // prague
  'honeymoon': 'photo-1518199266791-5375a83190b7',
  'japan': 'photo-1493976040374-85c8e12f0c0e',
  'cherry': 'photo-1493976040374-85c8e12f0c0e',
  'bali': 'photo-1537996194471-e657df975ab4',
  'thailand': 'photo-1508009603885-50cf7c579365',
  'australia': 'photo-1506973035872-a4ec16b8e8d9',
  'new-zealand': 'photo-1507699622108-4be3abd695ad',  // queenstown
  'portugal': 'photo-1585208798174-6cedd86e019a',
  'costa-rica': 'photo-1519999482648-25049ddd37b1',
  'egypt': 'photo-1572252009286-268acec5ca0a',
  'peru': 'photo-1483729558449-99ef09a8c325',       // rio (south america vibes)
  'croatia': 'photo-1534113414509-0eec2bfb493f',   // amalfi (mediterranean)
  'korea': 'photo-1534274988757-a28bf1a57c17',
  'mexico': 'photo-1510097467424-192d713fd8b2',
  'turkey': 'photo-1524231757912-21f4fe3a7200',
  'philippines': 'photo-1537996194471-e657df975ab4', // tropical
  'spain': 'photo-1583422409516-2895a77efded',
  'vietnam': 'photo-1509030450996-dd1a26dda07a',
  'india': 'photo-1477587458883-47145ed94245',       // jaipur
  'patagonia': 'photo-1464822759023-fed622ff2c3b',
  'northern-lights': 'photo-1504829857797-ddff29c27927', // reykjavik
  'lake': 'photo-1501785888041-af3ef285b470',
  'glamping': 'photo-1504280390367-361c6d9f38f4',
  'eco': 'photo-1501785888041-af3ef285b470',
  'dark-tourism': 'photo-1519677100203-a0e668c92439',
  'scuba': 'photo-1506929562872-bb421503ef21',
  'retire': 'photo-1559128010-7c1ad6e1b6a5',
  'wedding': 'photo-1518199266791-5375a83190b7',
  'gap-year': 'photo-1469854523086-cc02fe5d8800',
  'visa': 'photo-1527631746610-bca00a040d60',
  'global-entry': 'photo-1527631746610-bca00a040d60',
  'driving': 'photo-1469854523086-cc02fe5d8800',
  'vaccin': 'photo-1488646953014-85cb44e25828',
  'flight': 'photo-1476514525535-07fb3b4ae5f1',
  'long-haul': 'photo-1476514525535-07fb3b4ae5f1',
  'pack': 'photo-1452421822248-d4c2b47f0c81',
  'cold-weather': 'photo-1522199710521-72d69614c702',
  'tropical': 'photo-1507525428034-b723cf961d3e',
  'toddler': 'photo-1488646953014-85cb44e25828',
  'senior': 'photo-1488646953014-85cb44e25828',
  'accessible': 'photo-1488646953014-85cb44e25828',
  'pregnant': 'photo-1488646953014-85cb44e25828',
  'medication': 'photo-1488646953014-85cb44e25828',
  'layover': 'photo-1476514525535-07fb3b4ae5f1',
  'delay': 'photo-1476514525535-07fb3b4ae5f1',
  'budget': 'photo-1469854523086-cc02fe5d8800',
  'hotel': 'photo-1571896349842-33c89424de2d',
  'cruise': 'photo-1559128010-7c1ad6e1b6a5',
  'group': 'photo-1539635278303-d4002c07eae3',
  'girls-trip': 'photo-1539635278303-d4002c07eae3',
  'bachelor': 'photo-1539635278303-d4002c07eae3',
  'reunion': 'photo-1539635278303-d4002c07eae3',
  'team-building': 'photo-1539635278303-d4002c07eae3',
  'volunteer': 'photo-1488646953014-85cb44e25828',
  'school': 'photo-1488646953014-85cb44e25828',
  'teenager': 'photo-1488646953014-85cb44e25828',
  'couple': 'photo-1518199266791-5375a83190b7',
  'tourist-trap': 'photo-1552832230-c0197dd311b5',
  'tipping': 'photo-1504674900247-0877df9cc836',
  'currency': 'photo-1452421822248-d4c2b47f0c81',
  'etiquette': 'photo-1488646953014-85cb44e25828',
  'last-minute': 'photo-1476514525535-07fb3b4ae5f1',
  'compensation': 'photo-1476514525535-07fb3b4ae5f1',
  'offline': 'photo-1452421822248-d4c2b47f0c81',
  'google-maps': 'photo-1452421822248-d4c2b47f0c81',
  'reward': 'photo-1500835556837-99ac94a94552',
  'standby': 'photo-1476514525535-07fb3b4ae5f1',
  'vpn': 'photo-1452421822248-d4c2b47f0c81',
  'insurance': 'photo-1527631746610-bca00a040d60',
  'miles': 'photo-1476514525535-07fb3b4ae5f1',
  'hidden-city': 'photo-1476514525535-07fb3b4ae5f1',
  'loyalty': 'photo-1500835556837-99ac94a94552',
  'nightlife': 'photo-1514525253161-7a46d19cd819',
  'photography': 'photo-1501785888041-af3ef285b470',
  'digital-nomad': 'photo-1452421822248-d4c2b47f0c81',
  'solo': 'photo-1488646953014-85cb44e25828',
  'romantic': 'photo-1518199266791-5375a83190b7',
  'adventure': 'photo-1464822759023-fed622ff2c3b',
  'wellness': 'photo-1518199266791-5375a83190b7',
  'festival': 'photo-1514525253161-7a46d19cd819',
  'hiking': 'photo-1464822759023-fed622ff2c3b',
  'family': 'photo-1539635278303-d4002c07eae3',
  'hostel': 'photo-1469854523086-cc02fe5d8800',
  'luxury': 'photo-1571896349842-33c89424de2d',
  'cultural': 'photo-1518998053901-5348d3961a04',
  'national-park': 'photo-1501785888041-af3ef285b470',
  'street-food': 'photo-1504674900247-0877df9cc836',
  'backpack': 'photo-1469854523086-cc02fe5d8800',
  'overwater': 'photo-1514282401047-d79a71a590e8',
  'all-inclusive': 'photo-1507525428034-b723cf961d3e',
  'work-exchange': 'photo-1488646953014-85cb44e25828',
  'caribbean': 'photo-1507525428034-b723cf961d3e',
  'africa': 'photo-1547471080-7cc2caa01a7e',
  'south-america': 'photo-1483729558449-99ef09a8c325',
  'middle-east': 'photo-1548786811-dd6e453ccca7',
  'central-america': 'photo-1519999482648-25049ddd37b1',
  'europe': 'photo-1502602898657-3e91760cbb34',
  'greek': 'photo-1613395877344-13d4a8e0d49e',
  'morocco': 'photo-1597212618440-806262de4f6b',
  'iceland': 'photo-1504829857797-ddff29c27927',
  'italy': 'photo-1552832230-c0197dd311b5',
  'spiritual': 'photo-1493976040374-85c8e12f0c0e',
  'workation': 'photo-1452421822248-d4c2b47f0c81',
  'babymoon': 'photo-1518199266791-5375a83190b7',
};

// ── Helpers ──

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractPhotoId(url: string): string | null {
  const match = url.match(/photo-([a-zA-Z0-9_-]+)/);
  return match ? `photo-${match[1]}` : null;
}

function parseFrontmatter(content: string): {
  coverImage: string;
  category: string;
  slug: string;
} {
  const coverMatch = content.match(/coverImage:\s*"([^"]+)"/);
  const categoryMatch = content.match(/category:\s*"([^"]+)"/);
  return {
    coverImage: coverMatch?.[1] || '',
    category: categoryMatch?.[1] || 'Travel Tips',
    slug: '',
  };
}

function findFallbackPhoto(slug: string, category: string): string {
  // Try keyword matching on the slug first
  for (const [keyword, photoId] of Object.entries(KEYWORD_FALLBACKS)) {
    if (slug.includes(keyword)) {
      return photoId;
    }
  }

  // Fall back to category pool
  const pool = FALLBACK_POOL[category] || FALLBACK_POOL['Travel Tips'];
  // Deterministic selection based on slug hash
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = ((hash << 5) - hash + slug.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(hash) % pool.length];
}

async function testUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

async function downloadImage(url: string, retries = 3): Promise<Buffer> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      if (attempt === retries) throw err;
      const backoff = 1000 * 2 ** (attempt - 1);
      console.warn(`  Retry ${attempt}/${retries} after ${backoff}ms...`);
      await sleep(backoff);
    }
  }
  throw new Error('unreachable');
}

// Process items with limited concurrency
async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit: number,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── Main ──

interface BlogEntry {
  filePath: string;
  slug: string;
  currentUrl: string;
  category: string;
}

async function main() {
  const serviceKey = loadEnv();
  const supabase = createClient(SUPABASE_URL, serviceKey);

  console.log('Scanning blog MDX files...\n');

  // 1. Read all MDX files and identify ones needing migration
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'));
  const entries: BlogEntry[] = [];

  for (const file of files) {
    const filePath = path.join(BLOG_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { coverImage, category } = parseFrontmatter(content);
    const slug = file.replace('.mdx', '');

    if (coverImage.includes('supabase.co')) {
      // Already migrated
      continue;
    }

    if (coverImage.includes('unsplash.com')) {
      entries.push({ filePath, slug, currentUrl: coverImage, category });
    }
  }

  console.log(`Found ${entries.length} articles with Unsplash URLs to migrate.\n`);

  if (entries.length === 0) {
    console.log('Nothing to do!');
    return;
  }

  // 2. Check which files already exist in Supabase storage
  console.log('Checking existing files in Supabase storage...');
  const existingFiles = new Set<string>();
  const { data: blogFiles } = await supabase.storage.from(BUCKET).list('blog', { limit: 1000 });
  if (blogFiles) {
    for (const file of blogFiles) {
      existingFiles.add(`blog/${file.name}`);
    }
  }
  // Check if there are more (paginate)
  let offset = 1000;
  while (blogFiles && blogFiles.length === 1000) {
    const { data: moreFiles } = await supabase.storage.from(BUCKET).list('blog', { limit: 1000, offset });
    if (!moreFiles || moreFiles.length === 0) break;
    for (const file of moreFiles) {
      existingFiles.add(`blog/${file.name}`);
    }
    offset += 1000;
  }
  console.log(`  ${existingFiles.size} files already in blog/ folder.\n`);

  // 3. Test all Unsplash URLs concurrently
  console.log('Testing Unsplash URLs...');
  const testResults = await mapConcurrent(
    entries,
    async (entry) => {
      const works = await testUrl(entry.currentUrl);
      if (!works) {
        console.log(`  BROKEN  ${entry.slug}`);
      }
      return { ...entry, urlWorks: works };
    },
    10,
  );

  const working = testResults.filter((e) => e.urlWorks);
  const broken = testResults.filter((e) => !e.urlWorks);

  console.log(`\n  Working: ${working.length}`);
  console.log(`  Broken:  ${broken.length}\n`);

  // 4. Prepare download plan
  interface DownloadPlan {
    slug: string;
    filePath: string;
    downloadUrl: string;
    storagePath: string;
    photoId: string;
  }

  const downloadPlan: DownloadPlan[] = [];

  // For working URLs: use the original Unsplash URL
  for (const entry of working) {
    const photoId = extractPhotoId(entry.currentUrl) || 'photo-unknown';
    const storagePath = `blog/${entry.slug}-${photoId}.jpg`;
    // Use higher quality for download
    const downloadUrl = entry.currentUrl.replace(/\?.*$/, '?w=1920&q=85');
    downloadPlan.push({
      slug: entry.slug,
      filePath: entry.filePath,
      downloadUrl,
      storagePath,
      photoId,
    });
  }

  // For broken URLs: assign fallback photo
  for (const entry of broken) {
    const photoId = findFallbackPhoto(entry.slug, entry.category);
    const storagePath = `blog/${entry.slug}-${photoId}.jpg`;
    const downloadUrl = `https://images.unsplash.com/${photoId}?w=1920&q=85`;
    downloadPlan.push({
      slug: entry.slug,
      filePath: entry.filePath,
      downloadUrl,
      storagePath,
      photoId,
    });
  }

  // 5. Download and upload images
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const failures: string[] = [];
  const updatedFiles: Map<string, string> = new Map(); // filePath -> new supabase URL

  console.log('Downloading and uploading images...\n');

  await mapConcurrent(
    downloadPlan,
    async (plan) => {
      const newUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${plan.storagePath}`;

      // Skip if already in storage
      if (existingFiles.has(plan.storagePath)) {
        console.log(`  SKIP  ${plan.slug} (already uploaded)`);
        skipped++;
        updatedFiles.set(plan.filePath, newUrl);
        return;
      }

      try {
        const buffer = await downloadImage(plan.downloadUrl);
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(plan.storagePath, buffer, {
            contentType: 'image/jpeg',
            cacheControl: '31536000',
            upsert: true,
          });

        if (error) throw error;

        console.log(`  UP    ${plan.slug} (${(buffer.length / 1024).toFixed(0)} KB)`);
        uploaded++;
        updatedFiles.set(plan.filePath, newUrl);
      } catch (err: any) {
        console.error(`  FAIL  ${plan.slug}: ${err.message}`);
        failures.push(plan.slug);
        failed++;
        // Still update MDX to use what would be the correct URL
        // (the image can be re-uploaded later)
        updatedFiles.set(plan.filePath, newUrl);
      }

      await sleep(100); // Rate limit
    },
    CONCURRENCY,
  );

  // 6. Update MDX files
  console.log('\nUpdating MDX files...\n');

  let updatedCount = 0;
  for (const [filePath, newUrl] of updatedFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { coverImage } = parseFrontmatter(content);

    if (coverImage && coverImage !== newUrl) {
      const updatedContent = content.replace(
        `coverImage: "${coverImage}"`,
        `coverImage: "${newUrl}"`,
      );

      if (updatedContent !== content) {
        fs.writeFileSync(filePath, updatedContent, 'utf-8');
        updatedCount++;
      }
    }
  }

  // 7. Summary
  console.log('\n=== Migration Summary ===');
  console.log(`Total articles processed: ${entries.length}`);
  console.log(`URLs working:   ${working.length}`);
  console.log(`URLs broken:    ${broken.length} (assigned fallbacks)`);
  console.log(`Uploaded:       ${uploaded}`);
  console.log(`Skipped:        ${skipped} (already existed)`);
  console.log(`Failed:         ${failed}`);
  console.log(`MDX updated:    ${updatedCount}`);

  if (failures.length > 0) {
    console.error(`\nFailed uploads (${failures.length}):`);
    for (const f of failures) console.error(`  - ${f}`);
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
