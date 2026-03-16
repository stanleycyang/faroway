/**
 * Fix title + meta description for 6 high-impression, near-zero CTR blog posts.
 *
 * Usage:
 *   npx tsx scripts/fix-seo-titles.ts
 *
 * Requires: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes
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
  console.error('❌ Missing env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const UPDATES = [
  {
    slug: 'best-glamping-destinations',
    title: '20 Best Glamping Spots 2026: Treehouses, Safari Tents & Overwater Huts',
    description: 'Safari tents in Kenya. Treehouses in Costa Rica. Ice hotels in Norway. The 20 best glamping spots worldwide — with real prices and booking links.',
  },
  {
    slug: 'fiji-3-day-itinerary-weekend-trip',
    title: '3 Days in Fiji: Exactly What to Do (2026 Itinerary + Costs)',
    description: 'Your perfect 3-day Fiji itinerary: island-hopping, snorkeling, and where to stay from $80/night. Includes exact costs and what to skip.',
  },
  {
    slug: 'taipei-trip-cost-budget-guide',
    title: 'Taipei Trip Cost 2026: Exactly How Much to Budget (Real Numbers)',
    description: '$40/day or $120/day? Here\'s the real cost of a trip to Taipei — flights, hotels, food, transport. Based on actual traveler data.',
  },
  {
    slug: 'cheapest-beach-vacations-usa',
    title: '15 Cheapest US Beach Vacations 2026 (From $50/night)',
    description: 'Budget beach vacation? These 15 US destinations deliver sand, sun, and low bills — Gulf Coast gems, Outer Banks, and spots most travelers overlook.',
  },
  {
    slug: 'best-apps-splitting-costs',
    title: '7 Best Apps for Splitting Travel Costs in 2026 (Tested & Ranked)',
    description: 'Splitwise vs. Tricount vs. the rest — we tested every major cost-splitting app so your group trip doesn\'t end in drama. Our pick for 2026.',
  },
  {
    slug: 'best-airport-lounges-access',
    title: 'Best Airport Lounges 2026: How to Get In Without Paying $50 at the Door',
    description: 'Priority Pass, credit card perks, or pay-per-visit? Here\'s how to access the best airport lounges in 2026 — including free options most travelers miss.',
  },
];

async function main() {
  console.log('🔧 Fixing SEO titles + descriptions for 6 high-impression pages...\n');

  let successCount = 0;

  for (const update of UPDATES) {
    const { error } = await supabase
      .from('blog_posts')
      .update({ title: update.title, description: update.description })
      .eq('slug', update.slug);

    if (error) {
      console.error(`❌ Failed to update ${update.slug}: ${error.message}`);
    } else {
      console.log(`✅ ${update.slug}`);
      console.log(`   Title: ${update.title}`);
      successCount++;
    }
  }

  console.log(`\n✅ Done — ${successCount}/${UPDATES.length} posts updated.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
