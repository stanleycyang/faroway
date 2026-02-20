/**
 * Seed 500 blog posts into Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed-500-blogs/index.ts
 *   npx tsx scripts/seed-500-blogs/index.ts --dry-run
 *
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars (or .env.local)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { destinations } from './destinations';
import { generateAllPosts, type BlogEntry } from './templates';
import * as path from 'path';
import * as fs from 'fs';

// ── Config ──

const BUCKET = 'images';
const BATCH_SIZE = 50;
const UNSPLASH_RATE_LIMIT_MS = 300;
const MAX_DOWNLOAD_RETRIES = 3;
const FAILURE_THRESHOLD = 0.1; // exit if >10% of operations fail

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
 * Assign published_at dates distributed across Dec 2025 to Feb 2026.
 * Posts are spread evenly across the date range.
 */
function assignPublishedDates(count: number): string[] {
  const start = new Date('2025-12-01T00:00:00Z').getTime();
  const end = new Date('2026-02-28T23:59:59Z').getTime();
  const step = (end - start) / count;

  return Array.from({ length: count }, (_, i) => {
    const ts = start + step * i + Math.random() * step * 0.8;
    return new Date(ts).toISOString();
  });
}

// ── Image upload ──

async function ensureBlogFolder(supabase: SupabaseClient): Promise<void> {
  // Attempt to list the blog folder. If it doesn't exist, upload a tiny
  // placeholder to create the path (Supabase storage creates folders implicitly).
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list('blog', { limit: 1 });

  if (error) {
    console.log(
      'Blog folder may not exist yet in storage, it will be created on first upload.',
    );
  } else {
    console.log(
      `Blog folder exists in storage (${data?.length ?? 0} files found).`,
    );
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
  // Collect unique imgIds
  const imgIdToSlug = new Map<string, string>();
  for (const post of posts) {
    if (!imgIdToSlug.has(post.imgId)) {
      imgIdToSlug.set(post.imgId, post.slug);
    }
  }

  const uniqueImgIds = Array.from(imgIdToSlug.keys());
  console.log(
    `\nFound ${uniqueImgIds.length} unique images across ${posts.length} posts.`,
  );

  // Check existing files
  const existingFiles = await getExistingBlogFiles(supabase);
  console.log(`  ${existingFiles.size} files already in blog/ folder.\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < uniqueImgIds.length; i++) {
    const imgId = uniqueImgIds[i];
    const storagePath = `blog/${imgId}.jpg`;
    const fileName = `${imgId}.jpg`;

    console.log(
      `Uploading images... ${i + 1}/${uniqueImgIds.length} [${imgId}]`,
    );

    // Idempotent: skip if already exists
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

    // Rate limit between Unsplash downloads
    if (i < uniqueImgIds.length - 1) {
      await sleep(UNSPLASH_RATE_LIMIT_MS);
    }
  }

  return { uploaded, skipped, failed };
}

// ── Database insertion ──

interface InsertResult {
  inserted: number;
  failed: number;
}

async function insertPosts(
  supabase: SupabaseClient,
  posts: BlogEntry[],
  supabaseUrl: string,
): Promise<InsertResult> {
  const publishedDates = assignPublishedDates(posts.length);

  const rows = posts.map((post, i) => ({
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
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`Inserting posts... batch ${batchNum}/${totalBatches}`);

    try {
      const { error } = await supabase.from('blog_posts').upsert(batch, {
        onConflict: 'slug',
        ignoreDuplicates: false,
      });

      if (error) {
        console.error(`  Batch ${batchNum} FAILED: ${error.message}`);
        failed += batch.length;
      } else {
        console.log(`  Batch ${batchNum}: upserted ${batch.length} rows`);
        inserted += batch.length;
      }
    } catch (err: any) {
      console.error(`  Batch ${batchNum} ERROR: ${err.message}`);
      failed += batch.length;
    }
  }

  return { inserted, failed };
}

// ── Main ──

async function main() {
  loadEnv();

  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isDryRun && (!supabaseUrl || !serviceKey)) {
    console.error(
      'Missing SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.\n' +
        'Set them directly or in .env.local at the repo root.',
    );
    process.exit(1);
  }

  console.log('=== TripGenie Blog Seeder ===\n');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Dry run:      ${isDryRun}\n`);

  // Load per-template image map if available
  const imageMapPath = path.resolve(__dirname, 'image-map.json');
  if (fs.existsSync(imageMapPath)) {
    const imageMap: Record<string, string[]> = JSON.parse(
      fs.readFileSync(imageMapPath, 'utf-8'),
    );
    let mapped = 0;
    for (const dest of destinations) {
      if (imageMap[dest.id] && imageMap[dest.id].length > 0) {
        dest.imgIds = imageMap[dest.id];
        mapped++;
      }
    }
    console.log(`Loaded image map: ${mapped} destinations with unique per-template images.`);
  }

  // Generate all posts
  console.log(`Generating posts from ${destinations.length} destinations...`);
  const posts = generateAllPosts(destinations);
  console.log(`Generated ${posts.length} blog posts.\n`);

  // Dry-run: show stats and exit
  if (isDryRun) {
    const categories = new Map<string, number>();
    const clusters = new Map<string, number>();
    const uniqueImages = new Set<string>();

    for (const post of posts) {
      categories.set(post.category, (categories.get(post.category) || 0) + 1);
      const clusterKey = post.cluster || '(none)';
      clusters.set(clusterKey, (clusters.get(clusterKey) || 0) + 1);
      uniqueImages.add(post.imgId);
    }

    console.log('--- DRY RUN STATS ---\n');
    console.log(`Total posts:    ${posts.length}`);
    console.log(`Unique images:  ${uniqueImages.size}`);
    console.log(`Categories:     ${categories.size}`);
    console.log(`Clusters:       ${clusters.size}\n`);

    console.log('Posts per category:');
    for (const [cat, count] of [...categories.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(`  ${cat}: ${count}`);
    }

    console.log('\nPosts per cluster:');
    for (const [cluster, count] of [...clusters.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(`  ${cluster}: ${count}`);
    }

    console.log('\nSample posts:');
    for (const post of posts.slice(0, 5)) {
      console.log(`  - [${post.category}] ${post.title}`);
      console.log(`    slug: ${post.slug}`);
      console.log(`    imgId: ${post.imgId}`);
    }

    console.log('\n--- DRY RUN COMPLETE (no changes made) ---');
    return;
  }

  // Connect to Supabase
  const supabase = createClient(supabaseUrl, serviceKey);

  // Ensure the blog folder exists in storage
  await ensureBlogFolder(supabase);

  // Upload images
  console.log('\n--- Phase 1: Upload Cover Images ---\n');
  const imageResult = await uploadImages(supabase, posts, supabaseUrl);

  // Insert posts
  console.log('\n--- Phase 2: Insert Blog Posts ---\n');
  const insertResult = await insertPosts(supabase, posts, supabaseUrl);

  // Final summary
  console.log('\n=== DONE ===');
  console.log(
    `Done! Inserted ${insertResult.inserted} posts, uploaded ${imageResult.uploaded} images, ${imageResult.skipped} skipped`,
  );

  // Verify final count
  const { count, error } = await supabase
    .from('blog_posts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published');

  if (!error && count !== null) {
    console.log(`Total published rows in blog_posts: ${count}`);
  }

  // Check failure threshold
  const totalOps =
    imageResult.uploaded +
    imageResult.skipped +
    imageResult.failed +
    insertResult.inserted +
    insertResult.failed;
  const totalFailures = imageResult.failed + insertResult.failed;

  if (totalOps > 0 && totalFailures / totalOps > FAILURE_THRESHOLD) {
    console.error(
      `\nERROR: ${totalFailures} failures out of ${totalOps} operations (${((totalFailures / totalOps) * 100).toFixed(1)}%) exceeds ${FAILURE_THRESHOLD * 100}% threshold.`,
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
