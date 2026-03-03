/**
 * Seed 100 high-quality blog posts into Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed-100-quality-blogs/index.ts
 *   npx tsx scripts/seed-100-quality-blogs/index.ts --dry-run
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars (or .env.local)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { destinations } from './destinations';
import {
  templateItineraryPlanning,
  templateFoodGuide,
  templateTransportGuide,
  templatePhotographyGuide,
  templateVisaGuide,
  templateBestTime,
  templateSustainable,
  templateNightlife,
  templateDayTrips,
  templatePacking,
  type BlogEntry,
} from './templates';
import * as path from 'path';
import * as fs from 'fs';

// ── Config ──

const BUCKET = 'images';
const UNSPLASH_RATE_LIMIT_MS = 300;
const MAX_DOWNLOAD_RETRIES = 3;

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

async function downloadWithRetry(
  url: string,
  retries = MAX_DOWNLOAD_RETRIES,
): Promise<ArrayBuffer> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
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

function assignPublishedDates(count: number): string[] {
  const start = new Date('2025-09-01T00:00:00Z').getTime();
  const end = new Date('2026-08-31T23:59:59Z').getTime();
  const step = (end - start) / count;
  return Array.from({ length: count }, (_, i) => {
    const ts = start + step * i + Math.random() * step * 0.8;
    return new Date(ts).toISOString();
  });
}

// ── Template functions ──

const allTemplates = [
  templateItineraryPlanning,
  templateFoodGuide,
  templateTransportGuide,
  templatePhotographyGuide,
  templateVisaGuide,
  templateBestTime,
  templateSustainable,
  templateNightlife,
  templateDayTrips,
  templatePacking,
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
  if (!imgId) {
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

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(
      storagePath,
      imageBuffer,
      { contentType: 'image/jpeg', upsert: true },
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

async function seedEntries(
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
      const coverImageUrl = await ensureImageUploaded(supabase, entry.imgId, entry.slug);

      const { error } = await supabase.from('blog_posts').upsert(
        {
          slug: entry.slug,
          title: entry.title,
          description: entry.description,
          content: entry.content,
          content_source: 'database',
          category: entry.category,
          tags: entry.tags,
          author_slug: entry.author_slug,
          reading_time: entry.reading_time,
          cover_image: coverImageUrl,
          cover_image_alt: entry.cover_image_alt,
          cluster: entry.cluster,
          featured: false,
          status: 'published',
          published_at: publishedAt,
          last_updated: new Date().toISOString(),
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
  }

  return { success, failed };
}

// ── Main ──

async function main() {
  console.log('=== Faroway Quality Blog Seeder (100 Posts) ===\n');

  loadEnv();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY');
    console.error('');
    console.error('Add these to one of:');
    console.error('  - /Users/stanleyyang/.openclaw/workspace/faroway/.env.local');
    console.error('  - /Users/stanleyyang/.openclaw/workspace/faroway/apps/web/.env.local');
    console.error('');
    console.error('Required variables:');
    console.error('  SUPABASE_URL=https://your-project.supabase.co');
    console.error('  SUPABASE_SERVICE_KEY=your-service-role-key  (or SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`Generating entries from ${destinations.length} destinations × ${allTemplates.length} templates...`);
  const allEntries = generateAllEntries();
  console.log(`Generated ${allEntries.length} blog entries\n`);

  if (isDryRun) {
    console.log('[DRY RUN MODE — no changes will be made]\n');
    allEntries.slice(0, 5).forEach(e => {
      console.log(`  ${e.slug} (${e.cluster})`);
    });
    console.log(`  ... and ${allEntries.length - 5} more`);
    console.log('\nDry run complete. Remove --dry-run to seed for real.');
    return;
  }

  const publishedDates = assignPublishedDates(allEntries.length);
  const { success, failed } = await seedEntries(supabase, allEntries, publishedDates);

  console.log('\n=== Summary ===');
  console.log(`Total generated: ${allEntries.length}`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log(`Destinations: ${destinations.map(d => d.name).join(', ')}`);
  console.log(`Clusters: destination-guides, food-travel, travel-tips, travel-inspiration, responsible-travel`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
