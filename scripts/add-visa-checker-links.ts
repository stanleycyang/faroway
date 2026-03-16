/**
 * Add Visa Checker internal link to destination articles.
 *
 * Finds posts whose slug contains destination keywords (bali, fiji, japan, etc.)
 * and appends a "Planning Your Trip" section with a link to /tools/visa-checker
 * if not already present.
 *
 * Usage:
 *   npx tsx scripts/add-visa-checker-links.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(envPath: string): void {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(__dirname, '../apps/web/.env.local'));
loadEnvFile(path.resolve(__dirname, '../apps/web/.env'));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TARGET_KEYWORDS = [
  'cartagena', 'colombia', 'fiji', 'taipei', 'taiwan',
  'bali', 'indonesia', 'thailand', 'vietnam', 'japan',
  'india', 'mexico', 'morocco', 'peru', 'brazil',
];

const VISA_CHECKER_SECTION = `

## Planning Your Trip

Before you go, check if you need a visa. Use the [Faroway Visa Checker](/tools/visa-checker) to instantly see visa requirements for your passport.
`;

async function main() {
  console.log('🔗 Adding Visa Checker links to destination articles...\n');

  // Fetch all published posts (slug + content only)
  const { data, error } = await supabase
    .from('blog_posts')
    .select('slug, content')
    .eq('status', 'published');

  if (error || !data) {
    console.error('❌ Failed to fetch posts:', error?.message);
    process.exit(1);
  }

  console.log(`Found ${data.length} published posts. Scanning for destination keywords...`);

  const toUpdate: { slug: string; content: string }[] = [];

  for (const post of data) {
    // Check if slug matches any target keyword
    const slugLower = post.slug.toLowerCase();
    const matchesKeyword = TARGET_KEYWORDS.some((kw) => slugLower.includes(kw));
    if (!matchesKeyword) continue;

    // Skip if already has visa checker link
    if (post.content && post.content.includes('/tools/visa-checker')) continue;

    toUpdate.push({
      slug: post.slug,
      content: (post.content || '') + VISA_CHECKER_SECTION,
    });
  }

  console.log(`\nFound ${toUpdate.length} posts to update.\n`);

  let successCount = 0;

  // Update in batches of 10
  const BATCH_SIZE = 10;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async ({ slug, content }) => {
        const { error: updateError } = await supabase
          .from('blog_posts')
          .update({ content })
          .eq('slug', slug);

        if (updateError) {
          console.error(`  ❌ ${slug}: ${updateError.message}`);
        } else {
          console.log(`  ✅ ${slug}`);
          successCount++;
        }
      })
    );
  }

  console.log(`\n✅ Done — ${successCount}/${toUpdate.length} posts updated with Visa Checker links.`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
