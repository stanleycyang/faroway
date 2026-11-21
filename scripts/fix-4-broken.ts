/**
 * Fix the 4 remaining broken blog images by uploading to exact paths the MDX files reference.
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const BUCKET = 'images';
const ENV_PATHS = [
  path.resolve(__dirname, '../apps/web/.env.local'),
  path.resolve(__dirname, '../apps/web/.env'),
];

function loadEnvValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  for (const envPath of ENV_PATHS) {
    if (!fs.existsSync(envPath)) continue;
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(new RegExp(`^${name}=(.+)$`, 'm'));
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  }
  return undefined;
}

function loadConfig(): { supabaseUrl: string; serviceKey: string } {
  const supabaseUrl =
    loadEnvValue('SUPABASE_URL') || loadEnvValue('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = loadEnvValue('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl) {
    throw new Error(
      'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL not found in environment or apps/web/.env(.local)',
    );
  }
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY not found in environment or apps/web/.env(.local)',
    );
  }
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ''), serviceKey };
}

// The exact storage paths referenced by the MDX files,
// paired with real Unsplash photo URLs to download
const FIXES = [
  {
    storagePath: 'blog/how-to-complain-airline-compensation-photo-1530521954074-e64f6810b32d.jpg',
    downloadUrl: 'https://images.unsplash.com/photo-1530521954074-e64f6810b32d?w=1920&q=85',
    fallback: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=85',
  },
  {
    storagePath: 'blog/travel-budgeting-spreadsheet-guide-photo-1554224155-6726b3ff858f.jpg',
    downloadUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1920&q=85',
    fallback: 'https://images.unsplash.com/photo-1452421822248-d4c2b47f0c81?w=1920&q=85',
  },
  {
    storagePath: 'blog/secret-booking-tricks-photo-1527631746610-bca00a040d60.jpg',
    downloadUrl: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=1920&q=85',
    fallback: 'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=1920&q=85',
  },
  {
    storagePath: 'blog/travel-with-pets-guide-photo-1587300003388-59208cc962cb.jpg',
    downloadUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1920&q=85',
    fallback: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=85',
  },
];

async function download(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function main() {
  const { supabaseUrl, serviceKey } = loadConfig();
  const supabase = createClient(supabaseUrl, serviceKey);

  for (const fix of FIXES) {
    console.log(`Processing ${fix.storagePath}...`);

    let buffer = await download(fix.downloadUrl);
    if (!buffer) {
      console.log(`  Primary URL failed, trying fallback...`);
      buffer = await download(fix.fallback);
    }

    if (!buffer) {
      console.error(`  FAIL: Both URLs failed for ${fix.storagePath}`);
      continue;
    }

    const { error } = await supabase.storage.from(BUCKET).upload(fix.storagePath, buffer, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: true,
    });

    if (error) {
      console.error(`  Upload error: ${error.message}`);
    } else {
      console.log(`  UP (${(buffer.length / 1024).toFixed(0)} KB)`);
    }
  }

  // Verify
  console.log('\nVerifying...');
  for (const fix of FIXES) {
    const url = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${fix.storagePath}`;
    const res = await fetch(url, { method: 'HEAD' });
    console.log(`  ${res.status} ${fix.storagePath}`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
