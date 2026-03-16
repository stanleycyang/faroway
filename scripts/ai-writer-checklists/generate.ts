/**
 * Faroway AI Writer — Travel Checklists
 * Generates 200 checklist posts (100 destinations × 2 types) using Claude claude-opus-4-5
 *
 * Usage:
 *   npx tsx scripts/ai-writer-checklists/generate.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";

const client = new Anthropic({ authToken: process.env.CLAUDE_CODE_OAUTH_TOKEN });

// ── Types ──────────────────────────────────────────────────────────────────

interface Destination {
  id: string;
  name: string;
  country: string;
  continent: string;
  tagline: string;
  lang: string;
  currency: string;
  bestTime: string;
  peakSeason: string;
  climate: string;
  budget: [number, number, number];
  attractions: string[];
  areas: string[];
  foods: string[];
  tips: string[];
  dayTrips: string[];
  hidden: string[];
  photoSpots: string[];
  romantic: string[];
  family: string[];
  nightlife: string[];
  shopping: string[];
  transport: string[];
  safety: string[];
  etiquette: string[];
  packing: string[];
  imgId: string;
  imgIds?: string[];
}

// ── Load merged destinations ───────────────────────────────────────────────

import { destinations as d500 } from "../seed-500-blogs/destinations";
import { destinations as d1000 } from "../seed-1000-blogs/destinations";
import { destinations as dSquad } from "../skyscraper-squad/destinations";

const allDests: Destination[] = [...d500, ...d1000, ...dSquad].filter(
  (d, i, arr) => arr.findIndex((x) => x.id === d.id) === i
);

// Use first 100 destinations from the merged list
const DESTINATIONS = allDests.slice(0, 100);

// ── Helpers ────────────────────────────────────────────────────────────────

const AUTHORS = ["alex-chen", "maria-garcia", "james-wilson", "sofia-costa", "omar-hassan", "yuki-tanaka"];

function rotateAuthor(i: number): string {
  return AUTHORS[i % AUTHORS.length];
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

function readingTime(text: string): number {
  return Math.ceil(wordCount(text) / 230);
}

function buildFrontmatter(params: {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  authorSlug: string;
  imgId: string;
  content: string;
  cluster: string;
}): string {
  const { slug, title, description, tags, authorSlug, imgId, content, cluster } = params;
  const rt = readingTime(content);
  return `---
slug: ${slug}
title: "${title.replace(/"/g, '\\"')}"
description: "${description.slice(0, 160).replace(/"/g, '\\"')}"
category: Tips
tags: [${tags.map((t) => `"${t}"`).join(", ")}]
author_slug: ${authorSlug}
cluster: ${cluster}
imgId: ${imgId}
reading_time: ${rt}
---

`;
}

// ── AI generation — Packing List ───────────────────────────────────────────

async function generatePackingList(dest: Destination, index: number): Promise<string> {
  const slug = `${dest.id}-packing-list`;
  const title = `${dest.name} Packing List: What to Pack for Your Trip`;

  const prompt = `You are a senior travel writer for Faroway (faroway.ai), an AI trip planner. Write a comprehensive, destination-specific packing list.

## Assignment
Title: "${title}"
Slug: ${slug}
Target length: 900–1,200 words

## Destination Data
- Name: ${dest.name}, ${dest.country}
- Climate: ${dest.climate}
- Best time to visit: ${dest.bestTime}
- Culture/etiquette: ${dest.etiquette.join("; ")}
- Destination-specific packing notes: ${dest.packing.join("; ")}
- Top attractions: ${dest.attractions.slice(0, 4).join(", ")}
- Activities: ${[...dest.romantic.slice(0, 1), ...dest.family.slice(0, 1), ...dest.nightlife.slice(0, 1)].join("; ")}

## Required Structure (write the article body only — NO frontmatter)

Start with a brief intro (2–3 sentences) about why packing smart for ${dest.name} matters.

Then write 8–10 sections with markdown checkbox format:

### 1. Clothing
- Climate-specific clothing items (be specific about ${dest.climate} conditions)
- Include items from dest packing data: ${dest.packing.slice(0, 3).join("; ")}
- Cultural considerations (temple dress codes, conservative areas if applicable)
- Include [ ] checkbox format for each item

### 2. Documents & Money
- [ ] Passport and copies
- [ ] Travel insurance documents
- ${dest.currency} considerations
- Visa requirements if applicable
- Credit card and cash advice specific to ${dest.country}

### 3. Electronics
- Power adapter (mention ${dest.country} outlet types if relevant)
- Phone, camera, power bank recommendations
- Offline apps and downloads

### 4. Toiletries
- What's available locally in ${dest.name}
- What to bring from home
- Sunscreen and insect repellent advice for ${dest.climate}

### 5. Health & Safety
- Any vaccinations or health precautions for ${dest.country}
- First aid essentials
- ${dest.safety[0] || 'Standard safety precautions'}

### 6. Money & Payments
- ${dest.currency} specifics
- Whether cards or cash is better in ${dest.name}
- Recommended amount to carry

### 7. Entertainment & Comfort
- Travel day comfort items
- Books, apps, entertainment for the journey
- Offline maps and translation apps

### 8. Day-Trip Essentials
- Items needed for ${dest.dayTrips[0] || 'day trips from ' + dest.name}
- Comfortable walking gear for ${dest.areas[0]?.split(' — ')?.[0] || 'exploring neighborhoods'}

### 9. What NOT to Pack
- 3–4 items travelers commonly over-pack for ${dest.name}
- What you can buy cheaply there

### 10. Final Checklist Summary
- A quick 5-item "absolutely don't forget" list specific to ${dest.name}

End with Faroway CTA: "*Planning your ${dest.name} trip? [Use Faroway's AI trip planner](/) to build your perfect itinerary in 60 seconds — free. See our full [${dest.name} travel guide](/destinations/${dest.id}) for more tips.*"

## Writing Guidelines
- Use [ ] checkbox format for all packing items
- Be destination-specific — not generic advice
- Reference specific ${dest.name} neighborhoods, attractions, and activities
- Mention the climate (${dest.climate}) throughout
- 900–1,200 words total

Write the article body now (NO frontmatter, start with the intro paragraph):`;

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });

  const content = (response.content[0] as { type: string; text: string }).text;

  const tags = [
    `${dest.name.toLowerCase()} packing list`,
    `what to pack for ${dest.name.toLowerCase()}`,
    `${dest.name.toLowerCase()} travel`,
    `${dest.country.toLowerCase()} travel tips`,
    "packing checklist",
    "travel essentials",
    `${dest.continent.toLowerCase()} travel`,
    "packing guide",
  ].slice(0, 8);

  const description = `Complete ${dest.name} packing list tailored to the ${dest.climate} climate and local culture. Clothing, documents, health essentials, and what NOT to pack.`.slice(0, 160);

  const frontmatter = buildFrontmatter({
    slug,
    title,
    description,
    tags,
    authorSlug: rotateAuthor(index),
    imgId: dest.imgId,
    content,
    cluster: "travel-checklists",
  });

  return frontmatter + content;
}

// ── AI generation — Travel Checklist ──────────────────────────────────────

async function generateTravelChecklist(dest: Destination, index: number): Promise<string> {
  const slug = `${dest.id}-travel-checklist`;
  const title = `${dest.name} Travel Checklist: Everything Before You Go`;

  const prompt = `You are a senior travel writer for Faroway (faroway.ai), an AI trip planner. Write a comprehensive pre-trip travel checklist.

## Assignment
Title: "${title}"
Slug: ${slug}
Target length: 900–1,200 words

## Destination Data
- Name: ${dest.name}, ${dest.country}
- Language: ${dest.lang}
- Currency: ${dest.currency}
- Climate: ${dest.climate}
- Best time to visit: ${dest.bestTime}
- Safety notes: ${dest.safety.slice(0, 2).join("; ")}
- Transport: ${dest.transport.slice(0, 2).join("; ")}
- Etiquette: ${dest.etiquette.slice(0, 2).join("; ")}

## Required Structure (write the article body only — NO frontmatter)

Start with a brief intro (2–3 sentences) about why a pre-trip checklist matters for ${dest.name}.

Then organize into 4 time-based phases:

## 30 Days Before Departure
- [ ] Check passport validity (6 months beyond travel dates)
- [ ] Research visa requirements for ${dest.country} — [specific visa advice based on country]
- [ ] Book flights and accommodations near [best neighborhoods in ${dest.name}]
- [ ] Get travel insurance with medical coverage
- [ ] Research vaccinations or health requirements for ${dest.country}
- [ ] Check Foreign Office / State Department travel advisories
- [ ] Set up a no-fee international credit card or debit card
- [ ] Book in-demand experiences (popular tours in ${dest.name}, restaurant reservations)
- [ ] 4–5 more destination-specific items

## 1 Week Before Departure
- [ ] Confirm all bookings (flights, hotels, tours)
- [ ] Download offline maps for ${dest.name}
- [ ] Download translation app with ${dest.lang} offline pack
- [ ] Exchange some ${dest.currency} or arrange airport exchange
- [ ] Notify your bank of travel to ${dest.country}
- [ ] Check weather forecast for ${dest.name} during your trip dates
- [ ] Pack your bags (using our ${dest.name} packing list)
- [ ] 4–5 more destination-specific items

## Day Before Departure
- [ ] Reconfirm flight times and check-in online
- [ ] Charge all devices and power banks
- [ ] Save emergency contacts: hotel, local embassy, insurance hotline
- [ ] Check transport from ${dest.name} airport options
- [ ] Print or download all booking confirmations
- [ ] Pack carry-on with essentials for potential luggage delays
- [ ] 3–4 more specific items

## Arrival Day in ${dest.name}
- [ ] Clear customs and immigration — know what to declare
- [ ] Get local SIM card or activate international plan
- [ ] Exchange currency if needed — [where to exchange in ${dest.name}]
- [ ] Download the Faroway app and load your ${dest.name} itinerary
- [ ] ${dest.transport[0] || 'Arrange transport to your accommodation'}
- [ ] Check-in and store luggage if early arrival
- [ ] Orient yourself — find nearest [specific landmark/area in ${dest.name}]
- [ ] 2–3 more arrival-specific items

## Essential Apps for ${dest.name}
List 5–6 must-have apps specific to ${dest.name}/${dest.country} (local transit apps, translation, maps, food delivery, ride-hailing if applicable)

## Key Emergency Information
- Local emergency number
- Nearest embassy contact advice
- ${dest.safety[0] || 'Safety tip for ' + dest.name}
- Travel insurance activation steps

## Cultural Prep for ${dest.name}
- 3–4 cultural points from: ${dest.etiquette.join("; ")}
- Basic phrases in ${dest.lang} (hello, thank you, excuse me, how much)

End with Faroway CTA: "*Let Faroway handle the planning. [Build your ${dest.name} itinerary](/) with our AI trip planner in 60 seconds — free. See our full [${dest.name} travel guide](/destinations/${dest.id}) for insider tips.*"

## Writing Guidelines
- Use [ ] checkbox format for all checklist items
- Be destination-specific — reference ${dest.name} neighborhoods, specific logistics, local apps
- Include concrete advice (e.g., "Exchange currency at Superrich not the airport" if applicable)
- 900–1,200 words total

Write the article body now (NO frontmatter, start with the intro paragraph):`;

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 2500,
    messages: [{ role: "user", content: prompt }],
  });

  const content = (response.content[0] as { type: string; text: string }).text;

  const tags = [
    `${dest.name.toLowerCase()} travel checklist`,
    `${dest.name.toLowerCase()} trip planning`,
    `${dest.name.toLowerCase()} travel tips`,
    `${dest.country.toLowerCase()} travel`,
    "travel checklist",
    "before you go",
    "trip preparation",
    `${dest.continent.toLowerCase()} travel`,
  ].slice(0, 8);

  const description = `Complete ${dest.name} travel checklist: visa requirements, bookings, vaccinations, and pre-trip tasks organized by 30 days out, 1 week, and day before.`.slice(0, 160);

  const frontmatter = buildFrontmatter({
    slug,
    title,
    description,
    tags,
    authorSlug: rotateAuthor(index + 100),
    imgId: dest.imgId,
    content,
    cluster: "travel-checklists",
  });

  return frontmatter + content;
}

// ── Semaphore ──────────────────────────────────────────────────────────────

class Semaphore {
  private count: number;
  private queue: Array<() => void> = [];

  constructor(max: number) {
    this.count = max;
  }

  async acquire(): Promise<void> {
    if (this.count > 0) {
      this.count--;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.count++;
    }
  }
}

// ── Retry wrapper ──────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, retries = 3, backoffMs = 2000): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      console.error(`  Attempt ${attempt} failed, retrying in ${backoffMs}ms...`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw new Error("Unreachable");
}

// ── Main ───────────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(__dirname, "output");

interface ChecklistTask {
  dest: Destination;
  type: "packing" | "checklist";
  index: number;
}

async function main() {
  console.log(`\n🚀 Faroway AI Writer — Travel Checklists`);
  console.log(`   Generating ${DESTINATIONS.length * 2} checklist posts (${DESTINATIONS.length} destinations × 2)...\n`);

  const tasks: ChecklistTask[] = [];
  DESTINATIONS.forEach((dest, i) => {
    tasks.push({ dest, type: "packing", index: i });
    tasks.push({ dest, type: "checklist", index: i });
  });

  const sem = new Semaphore(5);
  let completed = 0;
  let skipped = 0;

  const work = tasks.map((task) => async () => {
    await sem.acquire();
    try {
      const { dest, type, index } = task;
      const slug = type === "packing" ? `${dest.id}-packing-list` : `${dest.id}-travel-checklist`;
      const outPath = path.join(OUTPUT_DIR, `${slug}.md`);

      if (fs.existsSync(outPath)) {
        console.log(`  ⏭  Skipping ${slug} (already exists)`);
        skipped++;
        return;
      }

      console.log(`  Writing: ${slug}...`);

      const fileContent = await withRetry(() =>
        type === "packing"
          ? generatePackingList(dest, index)
          : generateTravelChecklist(dest, index)
      );

      const words = wordCount(fileContent);
      fs.writeFileSync(outPath, fileContent, "utf8");
      completed++;
      console.log(`  ✓ ${slug} (${words.toLocaleString()} words)`);
    } finally {
      sem.release();
    }
  });

  await Promise.all(work.map((w) => w()));

  console.log(`\n✅ Done! ${completed} written, ${skipped} skipped`);
  console.log(`   Output: ${OUTPUT_DIR}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
