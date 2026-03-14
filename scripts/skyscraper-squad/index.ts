/**
 * Faroway Skyscraper Squad — SEO content generation to outrank wanderlog, roadtrippers, tripit
 *
 * Usage:
 *   npx tsx scripts/skyscraper-squad/index.ts
 *   npx tsx scripts/skyscraper-squad/index.ts --dry-run
 *   npx tsx scripts/skyscraper-squad/index.ts --cluster itinerary-guides
 *   npx tsx scripts/skyscraper-squad/index.ts --batch 1
 *   npx tsx scripts/skyscraper-squad/index.ts --batch 2 --dry-run
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars (or .env.local)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { destinations } from './destinations';
import type { BlogEntry } from '../seed-500-blogs/templates';
import * as path from 'path';
import * as fs from 'fs';

// Import all template functions
import {
  template3DayItinerary,
  template5DayItinerary,
  template7DayItinerary,
  template10DayItinerary,
  templateWeekendItinerary,
} from './templates-itinerary';

import {
  templateCityVsCity,
  templateWhichCity,
} from './templates-vs';

import {
  templatePackingChecklist,
  templateTravelChecklist,
} from './templates-checklist';

import {
  templateGettingAround,
  templateAirportGuide,
} from './templates-transport';

import {
  templateFoodGuide,
  templateMustEat,
  templateFoodieItinerary,
} from './templates-foodie';

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
}

// ── Helpers ──

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isDryRun = process.argv.includes('--dry-run');

const clusterArg = process.argv.find(a => a.startsWith('--cluster'));
const clusterFilter = clusterArg ? process.argv[process.argv.indexOf(clusterArg) + 1] : null;

const batchArg = process.argv.find(a => a.startsWith('--batch'));
const batchNum = batchArg ? parseInt(process.argv[process.argv.indexOf(batchArg) + 1] || '1') : 1;

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
 * Assign published_at dates distributed across March 2026 to September 2026.
 */
function assignPublishedDates(count: number, batch: number = 1): string[] {
  const ranges: Record<number, [string, string]> = {
    1: ['2026-03-01T00:00:00Z', '2026-06-30T23:59:59Z'],
    2: ['2026-06-01T00:00:00Z', '2026-09-30T23:59:59Z'],
  };
  const [startStr, endStr] = ranges[batch] || ranges[1];
  const start = new Date(startStr).getTime();
  const end = new Date(endStr).getTime();
  const step = (end - start) / count;

  return Array.from({ length: count }, (_, i) => {
    const ts = start + step * i + Math.random() * step * 0.8;
    return new Date(ts).toISOString();
  });
}

// ── Image upload ──

async function ensureBlogFolder(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list('blog', { limit: 1 });

  if (error) {
    console.log('Blog folder will be created on first upload.');
  } else {
    console.log(`Blog folder exists (${data?.length ?? 0} files found).`);
  }
}

async function getExistingBlogFiles(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const existing = new Set<string>();
  let offset = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data } = await supabase.storage
      .from(BUCKET)
      .list('blog', { limit: PAGE_SIZE, offset });

    if (!data || data.length === 0) break;

    for (const file of data) {
      existing.add(file.name);
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return existing;
}

interface ImageUploadResult {
  uploaded: number;
  skipped: number;
  failed: number;
}

async function uploadImages(
  supabase: SupabaseClient,
  posts: BlogEntry[],
  supabaseUrl: string,
): Promise<ImageUploadResult> {
  const imgIdToSlug = new Map<string, string>();
  for (const post of posts) {
    if (!imgIdToSlug.has(post.imgId)) {
      imgIdToSlug.set(post.imgId, post.slug);
    }
  }

  const uniqueImgIds = Array.from(imgIdToSlug.keys());
  console.log(`\nFound ${uniqueImgIds.length} unique images across ${posts.length} posts.`);

  const existingFiles = await getExistingBlogFiles(supabase);
  console.log(`  ${existingFiles.size} files already in blog/ folder.\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < uniqueImgIds.length; i++) {
    const imgId = uniqueImgIds[i];
    const storagePath = `blog/${imgId}.jpg`;
    const fileName = `${imgId}.jpg`;

    console.log(`Uploading images... ${i + 1}/${uniqueImgIds.length} [${imgId}]`);

    if (existingFiles.has(fileName)) {
      console.log(`  SKIP  ${storagePath} (already exists)`);
      skipped++;
      continue;
    }

    try {
      const downloadUrl = `https://images.unsplash.com/${imgId}?w=1200&q=80`;
      const buffer = await downloadWithRetry(downloadUrl);

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      console.log(`  OK    ${storagePath}`);
      uploaded++;
      await sleep(UNSPLASH_RATE_LIMIT_MS);
    } catch (err: any) {
      console.error(`  FAIL  ${storagePath}: ${err.message}`);
      failed++;
    }
  }

  return { uploaded, skipped, failed };
}

// ── Database upsert ──

interface UpsertResult {
  inserted: number;
  updated: number;
  failed: number;
}

async function upsertPosts(
  supabase: SupabaseClient,
  posts: BlogEntry[],
  publishedDates: string[],
  supabaseUrl: string,
): Promise<UpsertResult> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    console.log(`\nUpserting posts ${i + 1}–${Math.min(i + BATCH_SIZE, posts.length)}...`);

    for (let j = 0; j < batch.length; j++) {
      const post = batch[j];
      const publishedAt = publishedDates[i + j];

      const coverImageUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/blog/${post.imgId}.jpg`;

      const row = {
        slug: post.slug,
        title: post.title,
        description: post.description,
        content: post.content,
        category: post.category,
        tags: post.tags,
        author_slug: post.author_slug,
        reading_time: post.reading_time,
        cover_image: coverImageUrl,
        cover_image_alt: post.cover_image_alt,
        published_at: publishedAt,
        cluster: post.cluster,
      };

      try {
        const { error } = await supabase
          .from('blog_posts')
          .upsert(row, { onConflict: 'slug' });

        if (error) throw error;

        console.log(`  OK    ${post.slug}`);
        // Simplification: assume all upserts are inserts (we could query first to differentiate)
        inserted++;
      } catch (err: any) {
        console.error(`  FAIL  ${post.slug}: ${err.message}`);
        failed++;
      }
    }
  }

  return { inserted, updated, failed };
}

// ── Generate posts ──

function generatePosts(): BlogEntry[] {
  const posts: BlogEntry[] = [];

  console.log(`\nGenerating posts for ${destinations.length} destinations...`);

  // 1. Itinerary templates (5 × 100 = 500)
  if (!clusterFilter || clusterFilter === 'itinerary-guides') {
    console.log('  Generating itinerary-guides (5 templates × 100 destinations = 500 posts)...');
    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      posts.push(template3DayItinerary(dest, i));
      posts.push(template5DayItinerary(dest, i));
      posts.push(template7DayItinerary(dest, i));
      posts.push(template10DayItinerary(dest, i));
      posts.push(templateWeekendItinerary(dest, i));
    }
  }

  // 2. City vs City comparisons (2 templates × 13 pairs = 26)
  if (!clusterFilter || clusterFilter === 'destination-comparisons') {
    console.log('  Generating destination-comparisons (2 templates × 13 pairs = 26 posts)...');
    const pairs: [string, string][] = [
      ['tokyo', 'kyoto'],
      ['paris', 'barcelona'],
      ['rome', 'athens'],
      ['new-york', 'los-angeles'],
      ['london', 'amsterdam'],
      ['bali', 'bangkok'],
      ['dubai', 'singapore'],
      ['prague', 'budapest'],
      ['sydney', 'melbourne'],
      ['miami', 'new-orleans'],
      ['lisbon', 'porto'],
      ['seoul', 'tokyo'],
      ['bangkok', 'bali'],
    ];

    const destMap = new Map(destinations.map(d => [d.id, d]));

    for (let i = 0; i < pairs.length; i++) {
      const [id1, id2] = pairs[i];
      const dest1 = destMap.get(id1);
      const dest2 = destMap.get(id2);

      if (dest1 && dest2) {
        posts.push(templateCityVsCity(dest1, dest2, i));
        posts.push(templateWhichCity(dest1, dest2, i));
      }
    }
  }

  // 3. Checklists (2 templates × 100 = 200)
  if (!clusterFilter || clusterFilter === 'travel-checklists') {
    console.log('  Generating travel-checklists (2 templates × 100 destinations = 200 posts)...');
    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      posts.push(templatePackingChecklist(dest, i));
      posts.push(templateTravelChecklist(dest, i));
    }
  }

  // 4. Transport guides (2 templates × 100 = 200)
  if (!clusterFilter || clusterFilter === 'travel-logistics') {
    console.log('  Generating travel-logistics (2 templates × 100 destinations = 200 posts)...');
    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      posts.push(templateGettingAround(dest, i));
      posts.push(templateAirportGuide(dest, i));
    }
  }

  // 5. Food guides (3 templates × 100 = 300)
  if (!clusterFilter || clusterFilter === 'food-travel') {
    console.log('  Generating food-travel (3 templates × 100 destinations = 300 posts)...');
    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      posts.push(templateFoodGuide(dest, i));
      posts.push(templateMustEat(dest, i));
      posts.push(templateFoodieItinerary(dest, i));
    }
  }

  console.log(`\nGenerated ${posts.length} posts total.\n`);
  return posts;
}

// ── Main ──

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Faroway Skyscraper Content Squad        ║');
  console.log('╚════════════════════════════════════════════╝\n');

  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Batch: ${batchNum}`);
  console.log(`Cluster filter: ${clusterFilter || 'ALL'}`);
  console.log(`Destinations: ${destinations.length}\n`);

  // Generate posts
  const allPosts = generatePosts();

  // Apply batch filtering if --batch is specified
  let posts = allPosts;
  if (batchArg) {
    const half = Math.ceil(allPosts.length / 2);
    posts = batchNum === 1 ? allPosts.slice(0, half) : allPosts.slice(half);
    console.log(`Batch ${batchNum}: ${posts.length} posts (of ${allPosts.length} total)\n`);
  }

  const publishedDates = assignPublishedDates(posts.length, batchNum);

  if (isDryRun) {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║       DRY RUN — No changes made            ║');
    console.log('╚════════════════════════════════════════════╝\n');
    console.log(`Would process ${posts.length} posts.`);
    console.log(`Sample slugs:`);
    posts.slice(0, 10).forEach(p => console.log(`  - ${p.slug} [${p.cluster}]`));
    return;
  }

  // Ensure blog folder
  await ensureBlogFolder(supabase);

  // Upload images
  console.log('\n📸 Uploading images to Supabase Storage...');
  const imgResult = await uploadImages(supabase, posts, supabaseUrl);

  console.log('\n📊 Image Upload Summary:');
  console.log(`  Uploaded: ${imgResult.uploaded}`);
  console.log(`  Skipped:  ${imgResult.skipped}`);
  console.log(`  Failed:   ${imgResult.failed}`);

  if (imgResult.failed / (imgResult.uploaded + imgResult.failed + imgResult.skipped) > FAILURE_THRESHOLD) {
    console.error(`\n❌ Too many image failures (>${FAILURE_THRESHOLD * 100}%). Aborting.`);
    process.exit(1);
  }

  // Upsert posts
  console.log('\n📝 Upserting posts to Supabase blog_posts table...');
  const dbResult = await upsertPosts(supabase, posts, publishedDates, supabaseUrl);

  console.log('\n📊 Database Upsert Summary:');
  console.log(`  Inserted: ${dbResult.inserted}`);
  console.log(`  Updated:  ${dbResult.updated}`);
  console.log(`  Failed:   ${dbResult.failed}`);

  if (dbResult.failed / (dbResult.inserted + dbResult.updated + dbResult.failed) > FAILURE_THRESHOLD) {
    console.error(`\n❌ Too many DB failures (>${FAILURE_THRESHOLD * 100}%). Check logs.`);
    process.exit(1);
  }

  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║       ✅ Skyscraper Squad Complete!        ║');
  console.log('╚════════════════════════════════════════════╝\n');
  console.log(`Total posts: ${posts.length}`);
  console.log(`Images uploaded: ${imgResult.uploaded}`);
  console.log(`Posts upserted: ${dbResult.inserted + dbResult.updated}`);
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
