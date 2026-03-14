/**
 * Faroway AI Writer — travel-logistics cluster
 * Generates genuine, AI-written transportation & airport guide posts using Claude.
 *
 * Usage:
 *   npx tsx scripts/ai-writer-logistics/generate.ts
 *   npx tsx scripts/ai-writer-logistics/generate.ts --limit 10  (for testing)
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
    key: "getting-around",
    slug: (id: string) => `getting-around-${id}`,
    title: (name: string) => `Getting Around ${name}: Complete Transportation Guide`,
    minWords: 1200,
    maxWords: 1600,
  },
  {
    key: "airport-guide",
    slug: (id: string) => `${id}-airport-guide`,
    title: (name: string) => `${name} Airport Guide: Getting to the City`,
    minWords: 1000,
    maxWords: 1400,
  },
] as const;

// ── Anthropic client ──
// Prefer ANTHROPIC_API_KEY; fall back to CLAUDE_CODE_OAUTH_TOKEN as Bearer

const client = new Anthropic(
  process.env.ANTHROPIC_API_KEY
    ? { apiKey: process.env.ANTHROPIC_API_KEY }
    : { authToken: process.env.CLAUDE_CODE_OAUTH_TOKEN }
);

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

// ── Prompt builders ──

function buildGettingAroundPrompt(dest: Destination): string {
  const [budgetLow, budgetMid, budgetLux] = dest.budget;

  return `You are a seasoned travel writer who has lived in and deeply explored ${dest.name}. Write a genuine, specific, and practically useful transportation guide blog post.

## Post Details
- **Title**: Getting Around ${dest.name}: Complete Transportation Guide
- **Destination**: ${dest.name}, ${dest.country}

## Destination Data (use this to write specific, accurate content)
\`\`\`json
${JSON.stringify(dest, null, 2)}
\`\`\`

## Writing Instructions

Write **1,200–1,600 words** of genuine, practical transportation advice. Structure the post as follows:

### 1. Opening Hook (2–3 sentences)
A vivid, specific scene about navigating ${dest.name} — the moment a traveler realizes how to move through this city like a local. Avoid clichés.

### 2. Transport Overview
Quick summary of how most travelers get around, which modes are most practical, and the general vibe of getting around ${dest.name}. Pull from dest.transport[] for real specifics.

### 3. Metro / Subway
- Line names, key stations, how the system works
- Ticket types: single ride, day pass, tourist card — exact price ranges in local currency (${dest.currency}) and USD equivalent
- Hours of operation, frequency, crowding tips
- Apps to download (local transit apps, maps)
- Budget context: $${budgetLow}–$${budgetMid}/day traveler perspective

### 4. Bus System
- Main routes useful for tourists, how to navigate them
- How to pay (cash, card, app), price per ride in local currency and USD
- Practical tips: which routes to know, when to avoid buses

### 5. Taxi & Rideshare
- Licensed taxi info: how to hail, price ranges, metering
- Rideshare apps available in ${dest.name} (Uber, Grab, local alternatives)
- Typical fare examples: airport to city center, neighborhood to neighborhood
- Common scams to avoid: meter tampering, unofficial taxis, overcharging tourists
- Safety tips from dest.safety[]: ${dest.safety.slice(0, 3).join("; ")}

### 6. Bicycle & Scooter
- Bike-sharing schemes available, how to access them, cost per hour/day
- Cycling infrastructure: dedicated lanes, safety considerations
- Electric scooter rentals if available
- Best areas to cycle, areas to avoid

### 7. Walking
- Most walkable neighborhoods from dest.areas[]
- Average walking times between key attractions
- When walking makes more sense than transit
- Pedestrian safety considerations

### 8. Day Trip Transport
- How to reach nearby destinations from dest.dayTrips[]: ${dest.dayTrips.slice(0, 4).join(", ")}
- Train vs. bus vs. car for each option, with journey times and costs
- Whether to book in advance

### 9. Apps to Download + Tourist Passes
- 3–5 specific apps that will help: transit apps, maps, rideshare, payment
- Any tourist transport passes worth buying (price, what's included, break-even point)

### 10. Internal Links + CTA
End with:
- "Explore more about ${dest.name} in our [complete ${dest.name} travel guide](/destinations/${dest.id})."
- "Ready to plan your ${dest.name} trip? [Build your perfect itinerary on Faroway](/) in 60 seconds."

## Tone & Style Rules
- Write like a knowledgeable friend who has been there multiple times, not a generic travel bot
- Use specific route names, station names, and app names — never vague references
- Include at least one genuinely useful tip the average travel blog skips (draw from transport[], tips[], safety[])
- Do NOT pad with vague filler sentences. Every sentence must earn its place.
- Do NOT use the phrases "hidden gem", "off the beaten path", "vibrant", "bustling", or "world-class"
- Write in second person ("you'll", "your commute")
- Use ## for major sections, ### for subsections

Output ONLY the markdown content (no frontmatter — that will be added separately). Start directly with the opening hook paragraph.`;
}

function buildAirportGuidePrompt(dest: Destination): string {
  const [budgetLow, budgetMid] = dest.budget;

  return `You are a seasoned travel writer who has passed through ${dest.name}'s airport many times. Write a genuine, specific, and practically useful airport guide blog post.

## Post Details
- **Title**: ${dest.name} Airport Guide: Getting to the City
- **Destination**: ${dest.name}, ${dest.country}

## Destination Data (use this to write specific, accurate content)
\`\`\`json
${JSON.stringify(dest, null, 2)}
\`\`\`

## Writing Instructions

Write **1,000–1,400 words** of genuine, practical airport guide content. Structure the post as follows:

### 1. Opening Hook (2–3 sentences)
A vivid, specific moment at the airport — the feeling of landing and figuring out how to get to the city. Specific, not generic.

### 2. Airport Overview
- Which airport(s) serve ${dest.name} — official name(s), IATA code(s)
- Number of terminals, basic layout
- Key facilities: lounges, duty-free, food options, WiFi, currency exchange locations, ATMs
- Which airlines operate here and from which regions

### 3. Transport Options Table

Create a proper markdown table with these columns: Mode | Journey Time | Price Range | Notes

Include all relevant options:
- **Airport Train/Metro**: journey time, ticket price in ${dest.currency} + USD, where to buy tickets, which terminal
- **Airport Bus/Shuttle**: journey time, price, frequency, drop-off points in city
- **Taxi (metered)**: typical fare range in ${dest.currency} + USD, journey time, where to find official taxis
- **Rideshare (Uber/local app)**: typical fare, pickup location, app to use
- **Private Transfer**: price range, when it's worth it

Base prices on dest.budget[]: $${budgetLow}/day budget, $${budgetMid}/day mid-range context.

### 4. Arrival Tips: First 30 Minutes
Practical step-by-step for a smooth arrival:
- **SIM Cards**: where to buy at the airport, which carriers, costs for data plans
- **Currency Exchange**: airport rate vs. city center — honest advice on where/when to exchange
- **Luggage Storage**: options at the airport, cost per day
- **Tourist Information**: official desk location, what to grab (maps, transit cards, passes)
- **First transport decision**: what to pick based on budget and group size

### 5. Getting Into the City: Neighborhood-Specific Tips
For the main areas from dest.areas[] — ${dest.areas.slice(0, 4).join(", ")} — give specific advice on which transport mode makes most sense and any specific directions/stops.

### 6. Departure Tips
- Check-in times: international vs. domestic, peak vs. off-peak
- Security: typical wait times, what to know (liquids rules, laptop rules for this region)
- Terminal facilities worth knowing: best food, lounges, prayer rooms, pharmacies
- Transit hotel options if you have a long layover
- Getting to the airport: which transport option to take depending on time of day

### 7. Common Mistakes to Avoid
3–4 specific mistakes travelers make at this airport: unofficial taxis, wrong terminal, exchange rate traps, etc. Draw from dest.safety[]: ${dest.safety.slice(0, 2).join("; ")}

### 8. Internal Links + CTA
End with:
- "Plan your full ${dest.name} trip with our [complete ${dest.name} travel guide](/destinations/${dest.id})."
- "**New to ${dest.name}?** [Build your perfect itinerary on Faroway](/) in 60 seconds — AI-powered, free."

## Tone & Style Rules
- Write like someone who has navigated this airport many times and wants to save you the stress
- Use specific terminal names, transport names, and carrier names where possible
- Include at least one genuinely useful tip the average travel blog skips
- Do NOT pad with vague filler. Every sentence must earn its place.
- Do NOT use the phrases "hidden gem", "off the beaten path", "vibrant", "bustling", or "world-class"
- Write in second person ("you'll", "your flight")
- Use ## for major sections, ### for subsections

Output ONLY the markdown content (no frontmatter — that will be added separately). Start directly with the opening hook paragraph.`;
}

function buildPrompt(
  dest: Destination,
  postType: (typeof POST_TYPES)[number]
): string {
  if (postType.key === "getting-around") {
    return buildGettingAroundPrompt(dest);
  }
  return buildAirportGuidePrompt(dest);
}

// ── Frontmatter builder ──

function buildFrontmatter(
  slug: string,
  title: string,
  dest: Destination,
  postType: (typeof POST_TYPES)[number],
  content: string,
  authorIndex: number
): string {
  const wordCount = content.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 230);

  const isAirport = postType.key === "airport-guide";
  const descBase = isAirport
    ? `${dest.name} airport guide: transport options, prices, arrival tips, and how to get to the city from ${dest.name} airport.`
    : `Getting around ${dest.name}: complete guide to metro, bus, taxi, rideshare, cycling, and transport apps in ${dest.name}, ${dest.country}.`;

  const description = descBase.slice(0, 160);
  const author = AUTHOR_ROTATION[authorIndex % AUTHOR_ROTATION.length];

  const tags = isAirport
    ? `[transportation, ${dest.name}, ${dest.name} airport, ${dest.country}, airport guide, travel tips]`
    : `[transportation, ${dest.name}, getting around ${dest.name}, ${dest.country}, travel tips, city transport]`;

  return `---
slug: ${slug}
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
category: Tips
tags: ${tags}
author_slug: ${author}
cluster: travel-logistics
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
      if (!text || text.length < 400) {
        throw new Error(`Response too short (${text.length} chars)`);
      }
      return text;
    },
    slug
  );

  const frontmatter = buildFrontmatter(slug, title, dest, postType, content, authorIndex);
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

  if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    console.error(
      "Error: Set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN environment variable."
    );
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const destinations = mergeDestinations();
  console.log(`\n📍 Loaded ${destinations.length} unique destinations`);

  // Build all post jobs — 2 posts per destination
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
