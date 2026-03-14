/**
 * Faroway AI Writer — food-travel cluster
 * Generates genuine, AI-written food & culinary travel posts using Claude.
 *
 * Usage:
 *   npx tsx scripts/ai-writer-food/generate.ts
 *   npx tsx scripts/ai-writer-food/generate.ts --limit 12  (for testing)
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
const CONCURRENCY = 12; // 4 destinations × 3 posts at a time
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
    key: "food-guide",
    slug: (id: string) => `${id}-food-guide`,
    title: (name: string) =>
      `${name} Food Guide: What to Eat, Where & How Much`,
  },
  {
    key: "must-eat",
    slug: (id: string) => `must-eat-in-${id}`,
    title: (name: string) =>
      `Must-Eat Foods in ${name}: A Culinary Bucket List`,
  },
  {
    key: "foodie-itinerary",
    slug: (id: string) => `${id}-foodie-itinerary`,
    title: (name: string) =>
      `${name} Foodie Itinerary: 3 Days of Eating Your Way Through ${name}`,
  },
] as const;

// ── Anthropic client ──

const client = new Anthropic({
  authToken: process.env.CLAUDE_CODE_OAUTH_TOKEN,
  defaultHeaders: {
    "anthropic-beta": "oauth-2025-04-20",
  },
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
  return merged.slice(0, 100);
}

// ── Prompt builders ──

function buildFoodGuidePrompt(dest: Destination): string {
  const [budgetLow, budgetMid, budgetLux] = dest.budget;

  return `You are a food-obsessed travel writer who has eaten your way through ${dest.name} multiple times. Your writing makes readers simultaneously hungry AND informed — every description should make someone want to book a flight just to eat.

## Post Details
- **Title**: ${dest.name} Food Guide: What to Eat, Where & How Much
- **Destination**: ${dest.name}, ${dest.country}

## Destination Data
\`\`\`json
${JSON.stringify(dest, null, 2)}
\`\`\`

## Writing Instructions

Write **1,400–1,800 words** of compelling, practically useful food travel content. Structure as follows:

### 1. Opening Hook (2–3 sentences)
A vivid, sensory scene — the smell, sound, or sight of ${dest.name}'s food culture that immediately makes the reader hungry. No clichés like "food paradise" or "culinary heaven."

### 2. Food Culture Overview (150–200 words)
What makes ${dest.name}'s food scene unique? Historical influences, regional specialties, dining culture. Why does this city's food deserve your full attention?

### 3. Must-Try Dishes (200–300 words)
The 5–7 essential dishes no visitor should miss. For each: what it is, what it tastes like (sensory detail), and where to find it (use specific neighborhood types from areas[]).

### 4. Street Food Scene (150–200 words)
The pulse of ${dest.name}'s street food — where to find it, when to go, what to look for. Markets, night markets, food stalls. Practical details on timing and etiquette.

### 5. Restaurants by Budget (200–250 words)
Three tiers using actual price ranges:
- **Budget** (under $${budgetLow}/meal): Best cheap eats and why they're worth it
- **Mid-range** ($${Math.round(budgetLow * 1.5)}–$${Math.round(budgetMid * 0.8)}/meal): Solid local restaurants
- **Splurge** ($${budgetMid}+/meal): When to spend big and where

### 6. Vegetarian & Vegan Options (100–150 words)
Honest assessment — is ${dest.name} veg-friendly? What options exist? Specific dish names and where to find them.

### 7. Food Markets & Neighborhoods (150–200 words)
The food geography of ${dest.name} using areas[] data. Which neighborhoods are the food destinations? What to eat where. Any food markets worth planning your day around?

### 8. Dining Etiquette (100–150 words)
Using etiquette[] data: how locals eat, tipping customs, ordering culture, meal timing. The stuff that makes you look like you know what you're doing.

### 9. Faroway CTA
End with:
"For complete ${dest.name} trip planning, explore our [${dest.name} destination guide](/destinations/${dest.id})."
"**Build your ${dest.name} food itinerary with AI →** [Plan your trip on Faroway](/) in 60 seconds and never miss a meal."

## Tone & Style Rules
- Every dish description must include at least one sensory detail (taste, smell, texture, sound)
- Use specific neighborhood names from areas[] — not generic "local area"
- Reference actual foods from foods[] data — don't invent dishes
- Do NOT use "foodie paradise", "culinary journey", "food scene", or "delicious" more than once each
- Write in second person ("you'll find", "your first bite")
- Make price ranges feel concrete: "$8 gets you a bowl that will haunt your dreams"

Output ONLY the markdown content (no frontmatter). Start directly with the opening hook paragraph.`;
}

function buildMustEatPrompt(dest: Destination): string {
  const foodList = dest.foods.slice(0, 12).join(", ");

  return `You are a food writer who has dedicated weeks to eating through ${dest.name}, and you're writing the definitive bucket list of what to eat there. Your writing should make readers feel the food, not just read about it — every paragraph should trigger hunger.

## Post Details
- **Title**: Must-Eat Foods in ${dest.name}: A Culinary Bucket List
- **Destination**: ${dest.name}, ${dest.country}

## Destination Data
\`\`\`json
${JSON.stringify(dest, null, 2)}
\`\`\`

## Foods to Cover
Focus on these (expand richly from the data): ${foodList}

## Writing Instructions

Write **1,000–1,400 words** of immersive, narrative food writing. This is NOT a listicle — it's a love letter to ${dest.name}'s cuisine that happens to be organized around dishes.

### 1. Opening (2–3 sentences)
Drop the reader into a specific, sensory moment of eating in ${dest.name}. A specific dish, a specific time of day, a specific feeling.

### 2. The Dishes (bulk of the post — 800–1,000 words)
Cover **8–12 dishes** from foods[] — each with its own mini-section (use #### headers with the dish name). For each dish write:

**The dish itself**: What is it? What are its components? What does it taste like — be specific about flavors, textures, the moment it hits your tongue. Use sensory language that makes the reader lean forward.

**The cultural story**: Why does this dish exist? What does it say about ${dest.name}'s history, geography, or culture? One compelling fact or origin story.

**Where to find it**: What type of place serves this — a street stall, a market, a family restaurant, a specific neighborhood? What time of day is best? Any insider knowledge?

**Price**: What does it cost? ("Around $X" or "$X–$Y range") — make it feel accessible.

### 3. How to Eat Like a Local (100–150 words)
The meta-advice: timing, ordering culture, sharing etiquette in ${dest.name}. The context that helps you eat well, not just eat.

### 4. Faroway CTA
End with:
"See our full [${dest.name} food guide](/destinations/${dest.id}) for restaurant recommendations at every budget."
"**Ready to plan your ${dest.name} food trip? →** [Use Faroway's AI planner](/) to build a custom itinerary around the dishes that call to you."

## Tone & Style Rules
- Visceral, sensory writing — if you describe soup, I should almost smell it
- Cultural context matters — food is history, geography, family
- Do NOT use: "must-try", "game-changer", "to die for", or "iconic" more than twice total
- Vary sentence length — some punchy one-liners, some rich flowing descriptions
- Write as someone who genuinely loves this food, not a food bot reciting facts
- Each dish section should feel different from the last — vary the approach

Output ONLY the markdown content (no frontmatter). Start directly with the opening paragraph.`;
}

function buildFoodieItineraryPrompt(dest: Destination): string {
  const [budgetLow, budgetMid, budgetLux] = dest.budget;

  return `You are a food travel writer who has spent 3 days eating through ${dest.name} with obsessive dedication — tracking down the best versions of every dish, eating in markets and fine restaurants alike, and noting every practical detail. Now write the itinerary you wish you'd had.

## Post Details
- **Title**: ${dest.name} Foodie Itinerary: 3 Days of Eating Your Way Through ${dest.name}
- **Destination**: ${dest.name}, ${dest.country}

## Destination Data
\`\`\`json
${JSON.stringify(dest, null, 2)}
\`\`\`

## Writing Instructions

Write **1,200–1,600 words** of day-by-day food travel planning. Each day should have a clear food theme and geographic logic — don't make travelers backtrack across town between meals.

### 1. Opening (2–3 sentences)
The premise: 3 days, one goal — to eat ${dest.name} properly. Set the tone and appetite.

### 2. Before You Eat: Quick Notes (50–75 words)
Key context: meal times, tipping customs, cash vs. card, booking ahead requirements. From etiquette[] and tips[] data.

### 3. Day 1: [Theme based on dest.areas[0] or main food district]
Structure each meal slot:

**Morning** (Breakfast/Brunch): What to eat, where to eat it (neighborhood from areas[]), why this is the right start. Specific dish from foods[]. Estimated cost: $X–$Y.

**Afternoon** (Lunch + exploration): A main meal plus a market visit or food walk. Use areas[] for geography. Dish from foods[]. Include one food market or street food spot using hidden[] or areas[] data. Cost: $X–$Y.

**Evening** (Dinner): A sit-down restaurant experience. Budget range using dest.budget[]. What to order. Which neighborhood (areas[]). Cost: $X–$Y.

**Day 1 total food spend**: Budget ~$${budgetLow * 3}/day · Mid ~$${Math.round(budgetMid * 1.5)}/day · Splurge ~$${budgetLux}/day

### 4. Day 2: [Theme — different area or cuisine type]
Same structure: Morning / Afternoon / Evening.
- Mix in a cooking class option if culturally appropriate
- Reference a different neighborhood from areas[]
- Use different foods from foods[] than Day 1
- Include one "hidden" food spot from hidden[] data

**Day 2 total food spend**: Budget ~$${budgetLow * 3}/day · Mid ~$${Math.round(budgetMid * 1.5)}/day · Splurge ~$${budgetLux}/day

### 5. Day 3: [Theme — best of everything / farewell feast]
Same structure: Morning / Afternoon / Evening.
- Final morning should include a classic local breakfast
- Afternoon: food market or neighborhood walk with snacking
- Evening: the meal worth ending on — best of what ${dest.name} does

**Day 3 total food spend**: Budget ~$${budgetLow * 3}/day · Mid ~$${Math.round(budgetMid * 1.5)}/day · Splurge ~$${budgetLux}/day

### 6. Food Budget Summary (table)
| | Budget | Mid-range | Splurge |
|---|---|---|---|
| Per day | ~$${budgetLow * 3} | ~$${Math.round(budgetMid * 1.5)} | ~$${budgetLux} |
| 3 days | ~$${budgetLow * 9} | ~$${Math.round(budgetMid * 4.5)} | ~$${budgetLux * 3} |

### 7. Pro Tips for Food Travelers (3–4 bullets)
Specific, practical, from tips[] and etiquette[] data. Things only someone who's eaten there would know.

### 8. Faroway CTA
End with:
"For full destination planning, see our [${dest.name} travel guide](/destinations/${dest.id})."
"**Let AI build your perfect ${dest.name} food trip →** [Plan with Faroway](/) and get a custom itinerary built around your taste."

## Tone & Style Rules
- Practical but evocative — this should make you want to go AND know exactly what to do when you arrive
- Each day should feel different — different energy, different neighborhoods, different food experiences
- Prices should feel real and grounded, not vague ("around $12 for a bowl that feeds you for hours")
- Reference specific neighborhoods from areas[] for every location
- Use foods[] data for specific dish recommendations
- Don't repeat dishes across days — use the full range of foods[] available
- Do NOT use: "foodie", "culinary adventure", "local gems" — write specifically instead

Output ONLY the markdown content (no frontmatter). Start directly with the opening paragraph.`;
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
  const author = AUTHOR_ROTATION[authorIndex % AUTHOR_ROTATION.length];

  const description =
    `${title}. Discover what to eat, where to find it, and how much to spend in ${dest.name}, ${dest.country}.`.slice(
      0,
      160
    );

  const destTag = dest.name.toLowerCase();
  const countryTag = dest.country.toLowerCase();

  return `---
slug: ${slug}
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
category: Food
tags: [${destTag} food, ${countryTag} cuisine, what to eat in ${destTag}, food guide, local food, street food]
author_slug: ${author}
cluster: food-travel
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
  postKey: string,
  slug: string,
  title: string,
  prompt: string,
  authorIndex: number
): Promise<{ slug: string; wordCount: number } | null> {
  const outputPath = path.join(OUTPUT_DIR, `${slug}.md`);

  if (fs.existsSync(outputPath)) {
    return null; // already exists — skip
  }

  console.log(`  Writing ${slug}...`);

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
  console.log(`  ✓ ${slug} (${wordCount} words)`);
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
  const limitArg = process.argv.indexOf("--limit");
  const postLimit =
    limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

  const apiKey = process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "Error: CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY environment variable is not set."
    );
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const destinations = mergeDestinations();
  console.log(`\n🍜 Faroway Food Writer — food-travel cluster`);
  console.log(`📍 Loaded ${destinations.length} unique destinations`);

  // Build all post jobs
  type PostJob = {
    dest: Destination;
    postKey: string;
    slug: string;
    title: string;
    prompt: string;
    authorIndex: number;
  };

  const jobs: PostJob[] = [];
  let authorIndex = 0;

  for (const dest of destinations) {
    for (const pt of POST_TYPES) {
      const slug = pt.slug(dest.id);
      const title = pt.title(dest.name);

      let prompt: string;
      if (pt.key === "food-guide") {
        prompt = buildFoodGuidePrompt(dest);
      } else if (pt.key === "must-eat") {
        prompt = buildMustEatPrompt(dest);
      } else {
        prompt = buildFoodieItineraryPrompt(dest);
      }

      jobs.push({ dest, postKey: pt.key, slug, title, prompt, authorIndex });
      authorIndex++;
    }
  }

  const totalJobs = Math.min(jobs.length, postLimit);
  console.log(`📝 Total posts to generate: ${totalJobs}`);
  console.log(`⚡ Concurrency: ${CONCURRENCY} (4 destinations × 3 posts)\n`);

  const limit = createLimiter(CONCURRENCY);

  let written = 0;
  let skipped = 0;
  let failed = 0;
  const failedSlugs: string[] = [];

  const activeJobs = jobs.slice(0, totalJobs);

  await Promise.all(
    activeJobs.map(({ dest, postKey, slug, title, prompt, authorIndex }) =>
      limit(async () => {
        const outputPath = path.join(OUTPUT_DIR, `${slug}.md`);
        if (fs.existsSync(outputPath)) {
          skipped++;
          return;
        }

        try {
          const result = await generatePost(
            dest,
            postKey,
            slug,
            title,
            prompt,
            authorIndex
          );
          if (result === null) {
            skipped++;
          } else {
            written++;
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
