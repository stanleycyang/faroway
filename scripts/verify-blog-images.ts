/**
 * Verify all blog cover images are accessible.
 */
import * as fs from 'fs';
import * as path from 'path';

const BLOG_DIR = path.resolve(__dirname, '../apps/web/content/blog');

async function main() {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'));
  const broken: string[] = [];
  let checked = 0;

  // Extract all URLs
  const entries: { slug: string; url: string }[] = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8');
    const match = content.match(/coverImage:\s*"([^"]+)"/);
    if (match) {
      entries.push({ slug: file.replace('.mdx', ''), url: match[1] });
    }
  }

  console.log(`Checking ${entries.length} cover images...\n`);

  // Check in batches of 10
  for (let i = 0; i < entries.length; i += 10) {
    const batch = entries.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async (entry) => {
        try {
          const res = await fetch(entry.url, { method: 'HEAD', redirect: 'follow' });
          if (!res.ok) {
            console.log(`  BROKEN (${res.status}) ${entry.slug}`);
            return false;
          }
          return true;
        } catch (err: any) {
          console.log(`  ERROR  ${entry.slug}: ${err.message}`);
          return false;
        }
      }),
    );

    for (let j = 0; j < results.length; j++) {
      checked++;
      if (!results[j]) broken.push(batch[j].slug);
    }
  }

  console.log(`\nChecked: ${checked}`);
  console.log(`Working: ${checked - broken.length}`);
  console.log(`Broken:  ${broken.length}`);

  if (broken.length > 0) {
    console.log('\nBroken articles:');
    for (const slug of broken) console.log(`  - ${slug}`);
  } else {
    console.log('\nAll images verified!');
  }
}

main().catch(console.error);
