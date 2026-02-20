/**
 * Retry uploading the 8 failed blog images.
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const BUCKET = 'images';
const SUPABASE_URL = 'https://jcnephijkxgtprsutgsf.supabase.co';
const ENV_PATH = path.resolve(__dirname, '../apps/web/.env');

function loadEnv(): string {
  const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
  if (!match) throw new Error('SUPABASE_SERVICE_ROLE_KEY not found');
  return match[1].trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// These 8 failed. Map: storagePath -> unsplash download URL
const RETRIES = [
  {
    storagePath: 'blog/best-coffee-cities-world-photo-1495474472287-4d71bcdd2085.jpg',
    downloadUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1920&q=85',
  },
  {
    storagePath: 'blog/best-national-parks-world-photo-1472396961693-142e6e269027.jpg',
    downloadUrl: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?w=1920&q=85',
  },
  {
    storagePath: 'blog/best-photography-destinations-photo-1506929562872-bb421503ef21.jpg',
    downloadUrl: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1920&q=85',
  },
  {
    storagePath: 'blog/how-to-complain-airline-compensation-photo-1476514525535-07fb3b4ae5f1.jpg',
    downloadUrl: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920&q=85',
  },
  {
    storagePath: 'blog/how-to-eat-well-on-budget-abroad-photo-1504674900247-0877df9cc836.jpg',
    downloadUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=85',
  },
  {
    storagePath: 'blog/travel-budgeting-spreadsheet-guide-photo-1454165804606-c3d57bc86b40.jpg',
    downloadUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1920&q=85',
  },
  {
    storagePath: 'blog/travel-with-pets-guide-photo-1450778869180-e77b4edad7e4.jpg',
    downloadUrl: 'https://images.unsplash.com/photo-1450778869180-e77b4edad7e4?w=1920&q=85',
  },
  {
    storagePath: 'blog/secret-booking-tricks-photo-1500835556837-99ac94a94552.jpg',
    downloadUrl: 'https://images.unsplash.com/photo-1500835556837-99ac94a94552?w=1920&q=85',
  },
];

async function main() {
  const serviceKey = loadEnv();
  const supabase = createClient(SUPABASE_URL, serviceKey);

  for (const item of RETRIES) {
    try {
      console.log(`Downloading ${item.storagePath}...`);
      const res = await fetch(item.downloadUrl, { redirect: 'follow' });
      if (!res.ok) {
        // Try fallback if original fails
        console.log(`  Original failed (${res.status}), using known-good fallback...`);
        const fallbackUrl = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=85';
        const fallbackRes = await fetch(fallbackUrl, { redirect: 'follow' });
        if (!fallbackRes.ok) throw new Error(`Fallback also failed: ${fallbackRes.status}`);
        const buffer = Buffer.from(await fallbackRes.arrayBuffer());
        const { error } = await supabase.storage.from(BUCKET).upload(item.storagePath, buffer, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
          upsert: true,
        });
        if (error) throw error;
        console.log(`  UP (fallback) ${item.storagePath} (${(buffer.length / 1024).toFixed(0)} KB)`);
      } else {
        const buffer = Buffer.from(await res.arrayBuffer());
        const { error } = await supabase.storage.from(BUCKET).upload(item.storagePath, buffer, {
          contentType: 'image/jpeg',
          cacheControl: '31536000',
          upsert: true,
        });
        if (error) throw error;
        console.log(`  UP ${item.storagePath} (${(buffer.length / 1024).toFixed(0)} KB)`);
      }
    } catch (err: any) {
      console.error(`  FAIL ${item.storagePath}: ${err.message}`);
    }
    await sleep(500);
  }

  console.log('\nDone!');
}

main().catch(console.error);
