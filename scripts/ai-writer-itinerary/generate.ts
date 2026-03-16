/**
 * Faroway AI Writer — itinerary-guides cluster
 * Generates genuine, AI-written travel itinerary posts using Claude.
 *
 * Usage:
 *   npx tsx scripts/ai-writer-itinerary/generate.ts
 *   npx tsx scripts/ai-writer-itinerary/generate.ts --limit 10  (for testing)
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ── Destination imports ──
import { destinations as d500 } from "../seed-500-blogs/destinations";
import { destinations as d1000 } from "../seed-1000-blogs/destinations";
import { destinations as dsquad } from "../skyscraper-squad/destinations";
import type { Destination } from "../seed-500-blogs/destinations";

// ── Config ──

const OUTPUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "output"
);
const CONCURRENCY = 5;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const AUTHOR_ROTATION = [
  "alex-chen",
  "maria-garcia",
  "james-wilson",
  "sofia-costa",
  "omar-hassan",
  "yuki-tanaka",
];

const POST_TYPES = [
  {
    key: "3-days",
    slug: (id: string) => `3-days-in-${id}`,
    title: (name: string) => `3 Days in ${name}: The Perfect Weekend Itinerary`,
    days: 3,
  },
  {
    key: "5-days",
    slug: (id: string) => `5-days-in-${id}`,
    title: (name: string) => `5 Days in ${name}: The Complete Itinerary`,
    days: 5,
  },
  {
    key: "7-days",
    slug: (id: string) => `7-days-in-${id}`,
    title: (name: string) => `7 Days in ${name}: The Ultimate Week Itinerary`,
    days: 7,
  },
  {
    key: "10-days",
    slug: (id: string) => `10-days-in-${id}`,
    title: (name: string) => `10 Days in ${name}: An In-Depth Exploration`,
    days: 10,
  },
  {
    key: "weekend",
    slug: (id: string) => `${id}-weekend-itinerary`,
    title: (name: string) =>
      `${name} Weekend Itinerary: Make the Most of 48 Hours`,
    days: 2,
  },
] as const;

// ── Anthropic client ──

const client = new Anthropic({
  authToken: process.env.CLAUDE_CODE_OAUTH_TOKEN,
});

// ── Destination deduplication ──

function mergeDestinations(): Destination[] {
  const seen = new Set<string>();
  const merged: Destination[] = [];
  for (const d of [...d500, ...d1000, ...dsquad]) {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      merged.push(d);
    }
  }
  return merged;
}

// ── Prompt builder ──

function buildPrompt(
  dest: Destination,
  postType: (typeof POST_TYPES)[number]
): string {
  const [budgetLow, budgetMid, budgetLux] = dest.budget;
  const isWeekend = postType.key === "weekend";

  const dayCount = isWeekend ? "2" : postType.days.toString();
  const focusNote = isWeekend
    ? "This is a 48-hour weekend trip — focus on hitting the absolute highlights efficiently. Assume the traveler arrives Friday evening and leaves Sunday night."
    : `This is a ${postType.days}-day trip — give each day a distinct focus and geographic logic so travelers minimize backtracking.`;

  return `You are a seasoned travel writer who has lived in and deeply explored ${dest.name}. Write a genuine, specific, and practically useful travel itinerary blog post.

## Post Details
- **Title**: ${postType.title(dest.name)}
- **Duration**: ${dayCount} days
- **Destination**: ${dest.name}, ${dest.country}

## Destination Data (use this to write specific, accurate content)
\`\`\`json
${JSON.stringify(dest, null, 2)}
\`\`\`

## Writing Instructions

${focusNote}

Write **1,500–2,000 words** of genuine travel advice. Structure the post as follows:

### 1. Opening Hook (2–3 sentences)
A vivid, specific scene that captures why ${dest.name} is worth this trip. Avoid clichés like "a city of contrasts" or "something for everyone."

### 2. Quick Facts Table (markdown table)
| | |
|---|---|
| **Country** | ${dest.country} |
| **Language** | ${dest.lang} |
| **Currency** | ${dest.currency} |
| **Best time to visit** | ${dest.bestTime} |
| **Climate** | ${dest.climate} |
| **Daily budget** | Budget: $${budgetLow}/day · Mid: $${budgetMid}/day · Luxury: $${budgetLux}/day |
| **Peak season** | ${dest.peakSeason} |

### 3. Day-by-Day Itinerary
For each day, write **Morning / Afternoon / Evening** sections with:
- Specific place names from the destination data (not generic "visit a temple")
- Practical logistics: how to get there, how long to spend, what time to arrive
- At least one meal recommendation per day using foods[] data
- Where to stay that night (use areas[] data)
- Real tips from tips[] that apply to that day

${isWeekend ? "Day 1 = Saturday, Day 2 = Sunday. Include a Friday evening arrival tip." : ""}

### 4. Where to Stay Section
3–4 neighborhoods from areas[] with honest pros/cons and budget range for each tier.

### 5. Getting Around
Practical transport advice from transport[] data. Be specific about routes, costs, and apps.

### 6. Budget Breakdown
Real numbers. Budget/mid/luxury daily breakdowns covering accommodation + food + activities + transport.

### 7. Pro Tips (3–5 bullets)
Genuinely insider advice from tips[], safety[], and etiquette[] — the kind a local would tell you.

### 8. Internal Links + CTA
End with:
- "For more ${dest.name} planning, see our [complete ${dest.name} travel guide](/destinations/${dest.id})."
- "**Plan your ${dest.name} trip with AI →** [Build your perfect itinerary on Faroway](/) in 60 seconds."

## Tone & Style Rules
- Write like a knowledgeable friend who has been there multiple times, not a generic travel bot
- Use specific restaurant names, neighborhood names, and attraction names from the data
- Include at least one genuinely useful tip the average travel blog skips (draw from hidden[], tips[], etiquette[])
- Do NOT pad with vague filler sentences. Every sentence must earn its place.
- Do NOT use the phrases "hidden gem", "off the beaten path", "vibrant", "bustling", or "world-class" more than once each
- Write in second person ("you'll", "your morning")
- Headers should use ## for days and ### for Morning/Afternoon/Evening

Output ONLY the markdown content (no frontmatter — that will be added separately). Start directly with the opening hook paragraph.`;
}

// ── Frontmatter builder ──

function buildFrontmatter(
  slug: string,
  title: string,
  dest: Destination,
  content: string,
  authorIndex: number
): string {
  const wordCount = content.split(/\s+/).length;
  const readingTime = Math.max(4, Math.ceil(wordCount / 230));
  const description = `${title}. Day-by-day guide with real budget info, where to stay, what to eat, and insider tips for ${dest.name}, ${dest.country}.`.slice(
    0,
    160
  );
  const author = AUTHOR_ROTATION[authorIndex % AUTHOR_ROTATION.length];

  return `---
slug: ${slug}
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
category: Guides
tags: [${dest.name}, ${dest.country}, itinerary, travel guide, trip planning]
author_slug: ${author}
cluster: itinerary-guides
imgId: ${dest.imgId}
reading_time: ${readingTime}
---`;
}

// ── Retry logic ──

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = MAX_RETRIES,
  delayMs = RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      const isLast = attempt === maxRetries;
      if (!isLast) {
        const wait = delayMs * attempt;
        console.error(
          `  ⚠ ${label} — attempt ${attempt} failed: ${lastError.message}. Retrying in ${wait}ms...`
        );
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError;
}

// ── Content generation ──

async function generatePost(
  dest: Destination,
  postType: (typeof POST_TYPES)[number],
  slug: string,
  title: string,
  authorIndex: number
): Promise<{ slug: string; wordCount: number } | null> {
  const outputPath = path.join(OUTPUT_DIR, `${slug}.md`);

  // Skip if already generated
  if (fs.existsSync(outputPath)) {
    return null; // signals "skipped"
  }

  const prompt = buildPrompt(dest, postType);

  const content = await withRetry(
    async () => {
      const message = await client.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      const text = message.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n");
      if (!text || text.length < 500) {
        throw new Error(`Response too short (${text.length} chars)`);
      }
      return text;
    },
    slug
  );

  const frontmatter = buildFrontmatter(slug, title, dest, content, authorIndex);
  const fullPost = `${frontmatter}\n\n${content}\n`;

  fs.writeFileSync(outputPath, fullPost, "utf-8");

  const wordCount = content.split(/\s+/).length;
  return { slug, wordCount };
}

// ── Concurrency limiter ──

function createLimiter(concurrency: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (running >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    running++;
    try {
      return await fn();
    } finally {
      running--;
      if (queue.length > 0) {
        const next = queue.shift()!;
        next();
      }
    }
  };
}

// ── Main ──

async function main() {
  // Parse --limit flag for testing
  const limitArg = process.argv.indexOf("--limit");
  const postLimit =
    limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    console.error(
      "Error: CLAUDE_CODE_OAUTH_TOKEN environment variable is not set."
    );
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const destinations = mergeDestinations();
  console.log(`\n📍 Loaded ${destinations.length} unique destinations`);

  // Build all post jobs
  type PostJob = {
    dest: Destination;
    postType: (typeof POST_TYPES)[number];
    slug: string;
    title: string;
    authorIndex: number;
  };

  const jobs: PostJob[] = [];
  let authorIndex = 0;
  for (const dest of destinations) {
    for (const pt of POST_TYPES) {
      const slug = pt.slug(dest.id);
      const title = pt.title(dest.name);
      jobs.push({ dest, postType: pt, slug, title, authorIndex });
      authorIndex++;
    }
  }

  const totalJobs = Math.min(jobs.length, postLimit);
  console.log(`📝 Total posts to generate: ${totalJobs}`);
  console.log(`⚡ Concurrency: ${CONCURRENCY} parallel requests\n`);

  const limit = createLimiter(CONCURRENCY);

  let written = 0;
  let skipped = 0;
  let failed = 0;
  const failedSlugs: string[] = [];

  const activeJobs = jobs.slice(0, totalJobs);

  await Promise.all(
    activeJobs.map(({ dest, postType, slug, title, authorIndex }) =>
      limit(async () => {
        // Pre-check skip before logging
        const outputPath = path.join(OUTPUT_DIR, `${slug}.md`);
        if (fs.existsSync(outputPath)) {
          skipped++;
          return;
        }

        console.log(`  Writing: ${slug}...`);
        try {
          const result = await generatePost(
            dest,
            postType,
            slug,
            title,
            authorIndex
          );
          if (result === null) {
            skipped++;
          } else {
            written++;
            console.log(`  ✓ ${result.slug} (${result.wordCount} words)`);
          }
        } catch (err) {
          failed++;
          failedSlugs.push(slug);
          console.error(`  ✗ ${slug} — FAILED: ${(err as Error).message}`);
        }
      })
    )
  );

  console.log(`\n${"─".repeat(60)}`);
  console.log(`✅ Done!`);
  console.log(`   Written:  ${written}`);
  console.log(`   Skipped:  ${skipped} (already existed)`);
  console.log(`   Failed:   ${failed}`);
  if (failedSlugs.length > 0) {
    console.log(`\n   Failed slugs:`);
    failedSlugs.forEach((s) => console.log(`     - ${s}`));
  }
  console.log(`${"─".repeat(60)}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
