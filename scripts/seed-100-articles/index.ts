/**
 * Seed 100 standalone blog articles into Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed-100-articles/index.ts
 *   npx tsx scripts/seed-100-articles/index.ts --dry-run
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars (or .env.local)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { articles } from './articles';
import * as path from 'path';
import * as fs from 'fs';

// ── Config ──

const BUCKET = 'images';
const BATCH_SIZE = 50;
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
}

// ── Helpers ──

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isDryRun = process.argv.includes('--dry-run');

function assignPublishedDates(count: number): string[] {
  // Spread across Jan 2026 to Mar 2026
  const start = new Date('2026-01-15T00:00:00Z').getTime();
  const end = new Date('2026-03-15T23:59:59Z').getTime();
  const step = (end - start) / count;

  return Array.from({ length: count }, (_, i) => {
    const ts = start + step * i + Math.random() * step * 0.8;
    return new Date(ts).toISOString();
  });
}

// ── Image upload ──

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
    for (const file of data) existing.add(file.name);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return existing;
}

async function uploadImages(
  supabase: SupabaseClient,
  supabaseUrl: string,
): Promise<{ uploaded: number; skipped: number; failed: number }> {
  const imgIds = [...new Set(articles.map((a) => a.imgId))];
  console.log(`\nFound ${imgIds.length} unique images across ${articles.length} articles.`);

  const existingFiles = await getExistingBlogFiles(supabase);
  console.log(`  ${existingFiles.size} files already in blog/ folder.\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < imgIds.length; i++) {
    const imgId = imgIds[i];
    const storagePath = `blog/${imgId}.jpg`;
    const fileName = `${imgId}.jpg`;

    console.log(`Uploading images... ${i + 1}/${imgIds.length} [${imgId}]`);

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
          cacheControl: '31536000',
          upsert: false,
        });

      if (error) throw error;

      console.log(
        `  UP    ${storagePath} (${(buffer.byteLength / 1024).toFixed(0)} KB)`,
      );
      uploaded++;
    } catch (err: any) {
      console.error(`  FAIL  ${storagePath}: ${err.message}`);
      failed++;
    }

    if (i < imgIds.length - 1) await sleep(UNSPLASH_RATE_LIMIT_MS);
  }

  return { uploaded, skipped, failed };
}

// ── Database insertion ──

async function insertPosts(
  supabase: SupabaseClient,
  supabaseUrl: string,
): Promise<{ inserted: number; failed: number }> {
  const publishedDates = assignPublishedDates(articles.length);

  const rows = articles.map((post, i) => ({
    slug: post.slug,
    title: post.title,
    description: post.description,
    content: post.content,
    content_source: 'database' as const,
    author_slug: post.author_slug,
    category: post.category,
    tags: post.tags,
    cover_image: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/blog/${post.imgId}.jpg`,
    cover_image_alt: post.cover_image_alt,
    reading_time: post.reading_time,
    featured: false,
    cluster: post.cluster,
    status: 'published' as const,
    published_at: publishedDates[i],
    last_updated: publishedDates[i],
    view_count: 0,
  }));

  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchIdx = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`Inserting posts... batch ${batchIdx}/${totalBatches}`);

    try {
      const { error } = await supabase.from('blog_posts').upsert(batch, {
        onConflict: 'slug',
        ignoreDuplicates: false,
      });

      if (error) {
        console.error(`  Batch ${batchIdx} FAILED: ${error.message}`);
        failed += batch.length;
      } else {
        console.log(`  Batch ${batchIdx}: upserted ${batch.length} rows`);
        inserted += batch.length;
      }
    } catch (err: any) {
      console.error(`  Batch ${batchIdx} ERROR: ${err.message}`);
      failed += batch.length;
    }
  }

  return { inserted, failed };
}

// ── Main ──

async function main() {
  loadEnv();

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isDryRun && (!supabaseUrl || !serviceKey)) {
    console.error(
      'Missing SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.\n' +
        'Set them directly or in .env.local at the repo root.',
    );
    process.exit(1);
  }

  console.log('=== TripGenie Blog Seeder — 100 Standalone Articles ===\n');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Dry run:      ${isDryRun}`);
  console.log(`Articles:     ${articles.length}\n`);

  if (isDryRun) {
    const categories = new Map<string, number>();
    const clusters = new Map<string, number>();
    const uniqueImages = new Set<string>();

    for (const post of articles) {
      categories.set(post.category, (categories.get(post.category) || 0) + 1);
      const clusterKey = post.cluster || '(none)';
      clusters.set(clusterKey, (clusters.get(clusterKey) || 0) + 1);
      uniqueImages.add(post.imgId);
    }

    console.log('--- DRY RUN STATS ---\n');
    console.log(`Total articles:  ${articles.length}`);
    console.log(`Unique images:   ${uniqueImages.size}`);
    console.log(`Categories:      ${categories.size}`);
    console.log(`Clusters:        ${clusters.size}\n`);

    console.log('Articles per category:');
    for (const [cat, count] of [...categories.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(`  ${cat}: ${count}`);
    }

    console.log('\nArticles per cluster:');
    for (const [cluster, count] of [...clusters.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(`  ${cluster}: ${count}`);
    }

    console.log('\nAll articles:');
    for (const post of articles) {
      console.log(`  - [${post.category}] ${post.title}`);
      console.log(`    slug: ${post.slug} | cluster: ${post.cluster || 'none'} | ${post.reading_time} min`);
    }

    console.log('\n--- DRY RUN COMPLETE (no changes made) ---');
    return;
  }

  const supabase = createClient(supabaseUrl!, serviceKey!);

  console.log('\n--- Phase 1: Upload Cover Images ---\n');
  const imageResult = await uploadImages(supabase, supabaseUrl!);

  console.log('\n--- Phase 2: Insert Blog Posts ---\n');
  const insertResult = await insertPosts(supabase, supabaseUrl!);

  console.log('\n=== DONE ===');
  console.log(
    `Inserted ${insertResult.inserted} posts, uploaded ${imageResult.uploaded} images, ${imageResult.skipped} skipped, ${imageResult.failed} failed`,
  );

  const { count, error } = await supabase
    .from('blog_posts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published');

  if (!error && count !== null) {
    console.log(`Total published rows in blog_posts: ${count}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
