/**
 * Seed 1000 blog posts into Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed-1000-blogs/index.ts
 *   npx tsx scripts/seed-1000-blogs/index.ts --dry-run
 *   npx tsx scripts/seed-1000-blogs/index.ts --batch 1
 *   npx tsx scripts/seed-1000-blogs/index.ts --batch 2
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars (or .env.local)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { destinations, type Destination } from './destinations';
import { templateWeekendGuide, templateSoloTravel, templateDigitalNomad, type BlogEntry } from './templates';
import { templateBudgetTravel, templateLuxuryTravel, templateAdventureTravel } from './templates-v2';
import { templateFamilyTravel, templateCouplesTravel, templateFirstTimer } from './templates-v3';
import { templateSafetyGuide, templateNeighborhoods, templateHiddenGems } from './templates-v4';
import * as path from 'path';
import * as fs from 'fs';

// ── Config ──

const BUCKET = 'images';
const BATCH_SIZE = 50;
const UNSPLASH_RATE_LIMIT_MS = 300;
const MAX_DOWNLOAD_RETRIES = 3;
const FAILURE_THRESHOLD = 0.1;

// ── Env loading ──

function loadEnvFile(envPath: string): void {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function loadEnv(): void {
  loadEnvFile(path.resolve(__dirname, '../../.env.local'));
  loadEnvFile(path.resolve(__dirname, '../../apps/web/.env'));
  loadEnvFile(path.resolve(__dirname, '../../apps/web/.env.local'));
}

// ── Helpers ──

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isDryRun = process.argv.includes('--dry-run');

const batchArg = process.argv.find(a => a.startsWith('--batch'));
const batchNum = batchArg ? parseInt(process.argv[process.argv.indexOf(batchArg) + 1] || '1') : 0; // 0 = all

async function downloadWithRetry(
  url: string,
  retries = MAX_DOWNLOAD_RETRIES,
): Promise<ArrayBuffer> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);
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

/**
 * Assign published_at dates spread across the target months.
 */
function assignPublishedDates(count: number, batch: number = 0): string[] {
  const ranges: Record<number, [string, string]> = {
    0: ['2026-03-01T00:00:00Z', '2026-09-30T23:59:59Z'], // All batches
    1: ['2026-03-01T00:00:00Z', '2026-05-31T23:59:59Z'],
    2: ['2026-06-01T00:00:00Z', '2026-09-30T23:59:59Z'],
  };
  const [startStr, endStr] = ranges[batch] || ranges[0];
  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  const step = (end - start) / count;

  return Array.from({ length: count }, (_, i) => {
    const ts = start + step * i + Math.random() * step * 0.8;
    return new Date(ts).toISOString();
  });
}

// ── All template functions ──

type TemplateFn = (dest: Destination) => BlogEntry;

const allTemplates: TemplateFn[] = [
  templateWeekendGuide,
  templateSoloTravel,
  templateDigitalNomad,
  templateBudgetTravel,
  templateLuxuryTravel,
  templateAdventureTravel,
  templateFamilyTravel,
  templateCouplesTravel,
  templateFirstTimer,
  templateSafetyGuide,
  templateNeighborhoods,
  templateHiddenGems,
];

// ── Generate all blog entries ──

function generateAllEntries(): BlogEntry[] {
  const entries: BlogEntry[] = [];
  
  for (const dest of destinations) {
    for (const templateFn of allTemplates) {
      try {
        entries.push(templateFn(dest));
      } catch (err) {
        console.error(`Error generating ${templateFn.name} for ${dest.id}:`, err);
      }
    }
  }
  
  return entries;
}

// ── Image handling ──

async function ensureImageUploaded(
  supabase: SupabaseClient,
  imgId: string,
  slug: string,
): Promise<string | null> {
  if (!imgId || imgId === 'photo-1234567890123') {
    // Placeholder ID - use a default travel image
    return 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80';
  }

  const storagePath = `blog/${slug}.jpg`;

  // Check if already exists
  const { data: existing } = await supabase.storage.from(BUCKET).list('blog', {
    search: `${slug}.jpg`,
  });

  if (existing && existing.length > 0) {
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return urlData.publicUrl;
  }

  // Download from Unsplash
  try {
    const unsplashUrl = `https://images.unsplash.com/${imgId}?w=1200&q=80`;
    await sleep(UNSPLASH_RATE_LIMIT_MS);
    const imageBuffer = await downloadWithRetry(unsplashUrl);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(
      storagePath,
      imageBuffer,
      {
        contentType: 'image/jpeg',
        upsert: true,
      },
    );

    if (uploadError) {
      console.warn(`  Upload error for ${slug}:`, uploadError.message);
      return null;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return urlData.publicUrl;
  } catch (err) {
    console.warn(`  Image download failed for ${slug}:`, err);
    return null;
  }
}

// ── Main seeding logic ──

async function seedBatch(
  supabase: SupabaseClient,
  entries: BlogEntry[],
  publishedDates: string[],
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const publishedAt = publishedDates[i];

    console.log(`[${i + 1}/${entries.length}] ${entry.slug}`);

    if (isDryRun) {
      console.log(`  [DRY RUN] Would upsert: ${entry.title}`);
      success++;
      continue;
    }

    try {
      // Get or upload cover image
      const coverImageUrl = await ensureImageUploaded(supabase, entry.imgId, entry.slug);

      // Upsert blog post
      const { error } = await supabase.from('blog_posts').upsert(
        {
          slug: entry.slug,
          title: entry.title,
          description: entry.description,
          content: entry.content,
          category: entry.category,
          tags: entry.tags,
          author_slug: entry.author_slug,
          reading_time: entry.reading_time,
          cover_image_url: coverImageUrl,
          cover_image_alt: entry.cover_image_alt,
          cluster: entry.cluster,
          published_at: publishedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'slug' },
      );

      if (error) {
        console.error(`  Error: ${error.message}`);
        failed++;
      } else {
        console.log(`  ✓ Upserted`);
        success++;
      }
    } catch (err) {
      console.error(`  Exception:`, err);
      failed++;
    }

    // Check failure threshold
    if (failed / (success + failed) > FAILURE_THRESHOLD && success + failed > 10) {
      console.error(`\nFailure threshold exceeded (${failed} failures). Stopping.`);
      break;
    }
  }

  return { success, failed };
}

// ── Main ──

async function main() {
  console.log('=== Faroway Blog Seeder (1000 Posts) ===\n');

  loadEnv();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Generate all entries
  console.log(`Generating entries from ${destinations.length} destinations × ${allTemplates.length} templates...`);
  const allEntries = generateAllEntries();
  console.log(`Generated ${allEntries.length} blog entries\n`);

  // Select batch
  let entriesToSeed: BlogEntry[];
  if (batchNum === 1) {
    entriesToSeed = allEntries.slice(0, 500);
    console.log(`Batch 1: Seeding entries 1-500`);
  } else if (batchNum === 2) {
    entriesToSeed = allEntries.slice(500);
    console.log(`Batch 2: Seeding entries 501-${allEntries.length}`);
  } else {
    entriesToSeed = allEntries;
    console.log(`Seeding all ${allEntries.length} entries`);
  }

  if (isDryRun) {
    console.log('[DRY RUN MODE - No changes will be made]\n');
  }

  // Assign dates
  const publishedDates = assignPublishedDates(entriesToSeed.length, batchNum);

  // Seed in batches
  let totalSuccess = 0;
  let totalFailed = 0;

  for (let i = 0; i < entriesToSeed.length; i += BATCH_SIZE) {
    const batch = entriesToSeed.slice(i, i + BATCH_SIZE);
    const batchDates = publishedDates.slice(i, i + BATCH_SIZE);
    
    console.log(`\n--- Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} entries) ---\n`);
    
    const { success, failed } = await seedBatch(supabase, batch, batchDates);
    totalSuccess += success;
    totalFailed += failed;
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Total generated: ${allEntries.length}`);
  console.log(`Attempted: ${entriesToSeed.length}`);
  console.log(`Success: ${totalSuccess}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
