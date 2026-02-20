/**
 * Migrate all MDX blog posts into Supabase blog_posts table.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-blog-to-supabase.ts
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CONTENT_DIR = path.resolve(__dirname, '../apps/web/content/blog');
const BATCH_SIZE = 20;

interface MdxRow {
  slug: string;
  title: string;
  description: string;
  content: string;
  content_source: 'database';
  author_slug: string;
  category: string;
  tags: string[];
  cover_image: string;
  cover_image_alt: string | null;
  reading_time: number;
  featured: boolean;
  cluster: string | null;
  status: 'published';
  published_at: string;
  last_updated: string | null;
}

function parseFile(filePath: string): MdxRow | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);
    const slug = path.basename(filePath, '.mdx');

    const readingTime =
      data.readingTime || Math.ceil(content.split(/\s+/).length / 200);

    return {
      slug,
      title: data.title || slug,
      description: data.description || '',
      content,
      content_source: 'database',
      author_slug: data.author || 'tripgenie-team',
      category: data.category || 'Travel Tips',
      tags: data.tags || [],
      cover_image: data.coverImage || '',
      cover_image_alt: data.coverImageAlt || null,
      reading_time: readingTime,
      featured: data.featured || false,
      cluster: data.cluster || null,
      status: 'published',
      published_at: data.date || new Date().toISOString(),
      last_updated: data.lastUpdated || null,
    };
  } catch (err) {
    console.error(`  Failed to parse ${filePath}:`, err);
    return null;
  }
}

async function main() {
  console.log(`Reading MDX files from ${CONTENT_DIR}...`);

  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => path.join(CONTENT_DIR, f));

  console.log(`Found ${files.length} MDX files.\n`);

  const rows: MdxRow[] = [];
  for (const file of files) {
    const row = parseFile(file);
    if (row) rows.push(row);
  }

  console.log(`Parsed ${rows.length} posts successfully.\n`);

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const { error } = await supabase.from('blog_posts').upsert(batch, {
      onConflict: 'slug',
    });

    if (error) {
      console.error(`  Batch ${batchNum} FAILED:`, error.message);
      failed += batch.length;
    } else {
      console.log(`  Batch ${batchNum}: upserted ${batch.length} rows`);
      succeeded += batch.length;
    }
  }

  console.log(`\nDone! ${succeeded} succeeded, ${failed} failed.`);

  // Verify final count
  const { count, error } = await supabase
    .from('blog_posts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published');

  if (error) {
    console.error('Count verification failed:', error.message);
  } else {
    console.log(`Total published rows in blog_posts: ${count}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
