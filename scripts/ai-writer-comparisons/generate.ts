/**
 * Faroway AI Writer — Destination Comparisons
 * Generates 26 comparison posts using Claude claude-opus-4-5
 *
 * Usage:
 *   npx tsx scripts/ai-writer-comparisons/generate.ts
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

// Stubs for destinations not in our dataset
const STUBS: Record<string, Destination> = {
  athens: {
    id: "athens",
    name: "Athens",
    country: "Greece",
    continent: "Europe",
    tagline: "Cradle of Western civilization — ancient ruins, vibrant street life, and great seafood",
    lang: "Greek",
    currency: "Euro (€)",
    bestTime: "April to June and September to November",
    peakSeason: "July to August",
    climate: "Mediterranean with hot dry summers and mild winters",
    budget: [60, 150, 350],
    attractions: ["Acropolis", "Parthenon", "National Archaeological Museum", "Plaka district", "Temple of Olympian Zeus", "Agora"],
    areas: ["Plaka — old town below the Acropolis", "Monastiraki — flea market and street food", "Exarchia — bohemian cafes and galleries", "Kolonaki — upscale boutiques and restaurants", "Piraeus — port gateway to Greek islands"],
    foods: ["Souvlaki — grilled meat skewers in pita", "Moussaka — layered eggplant and lamb with béchamel", "Greek salad with feta", "Spanakopita — spinach and feta pastry", "Fresh seafood at Piraeus waterfront"],
    tips: ["Visit Acropolis at 8am to beat heat and crowds", "Athens card covers major museums and transport", "Walk everywhere in the compact historic center", "Metro to Piraeus for island ferries"],
    dayTrips: ["Delphi — oracle sanctuary and mountain scenery, 3 hours", "Cape Sounion — clifftop temple at sunset, 2 hours", "Aegina island — day ferry from Piraeus, 1 hour"],
    hidden: ["Anafiotika — Cycladic island-style village above Plaka", "National Garden — leafy oasis in central Athens"],
    photoSpots: ["Acropolis hill at sunset from Filopappou Hill", "Monastiraki square with Acropolis backdrop"],
    romantic: ["Sunset dinner at Dionysus restaurant below Acropolis", "Evening walk through Plaka lantern-lit alleys"],
    family: ["Acropolis Museum — kid-friendly ancient Greece exhibits", "Hellenic Children's Museum downtown"],
    nightlife: ["Gazi — LGBTQ+ friendly bars and clubs", "Psiri — tavernas and live music"],
    shopping: ["Monastiraki flea market — antiques and curiosities", "Ermou Street — pedestrian shopping mall"],
    transport: ["Athens Metro covers main tourist areas", "Walking is best in the compact historic center"],
    safety: ["Athens is safe in tourist areas", "Watch for pickpockets on the Metro"],
    etiquette: ["Dress conservatively at Orthodox churches", "Afternoon siesta respected in smaller shops"],
    packing: ["Comfortable walking shoes for cobblestones", "Sunscreen and hat for intense summer sun", "Light layers for evening sea breezes"],
    imgId: "photo-1555993539-1732b0258235",
  },
  budapest: {
    id: "budapest",
    name: "Budapest",
    country: "Hungary",
    continent: "Europe",
    tagline: "Grand Belle Époque city split by the Danube — thermal baths, ruin bars, and magnificent architecture",
    lang: "Hungarian",
    currency: "Hungarian Forint (HUF)",
    bestTime: "April to June and September to October",
    peakSeason: "July to August",
    climate: "Humid continental with warm summers and cold winters",
    budget: [50, 120, 300],
    attractions: ["Buda Castle", "Parliament Building", "Széchenyi Thermal Bath", "Fisherman's Bastion", "Chain Bridge", "Great Market Hall"],
    areas: ["Castle Hill — historic Buda fortifications and museums", "Pest downtown — grand boulevards and nightlife", "Jewish Quarter — ruin bars and synagogue", "Margaret Island — spa resort island in the Danube", "Óbuda — Roman ruins and antique markets"],
    foods: ["Goulash — beef paprika stew with dumplings", "Lángos — fried dough with sour cream and cheese", "Kürtőskalács — chimney cake street pastry", "Fisherman's soup — spicy paprika fish broth", "Dobos torte — layered sponge and caramel cake"],
    tips: ["Thermal baths are better value on weekday mornings", "Buy Budapest Card for transport and museum discounts", "Ruin bars are only open evenings — plan accordingly"],
    dayTrips: ["Szentendre — Danube village of Serbian culture, 40 minutes", "Eger — baroque city with castle and wine cellars, 2 hours", "Visegrád — castle ruins above the Danube bend, 1 hour"],
    hidden: ["Memento Park — Communist-era statues on city outskirts", "Rác Thermal Bath — hidden Ottoman-era bath"],
    photoSpots: ["Parliament Building lit up at night from the Buda side", "Fisherman's Bastion at dawn with Danube views"],
    romantic: ["Danube river cruise at dusk past illuminated bridges", "Széchenyi outdoor thermal pool on a winter evening"],
    family: ["Tropicarium aquarium and zoo", "Hungarian Railway History Park — vintage trains"],
    nightlife: ["Ruin bars in the Jewish Quarter — Szimpla Kert", "Kazinczy Street bar cluster — most concentrated nightlife"],
    shopping: ["Great Market Hall — paprika, embroidery, and local produce", "Vásárcsarnok market — traditional Hungarian crafts"],
    transport: ["Metro lines connect Buda and Pest", "Trams run along the Danube on both banks"],
    safety: ["Budapest is safe for tourists", "Watch for taxi overcharging — use official cabs or apps"],
    etiquette: ["Tipping 10–15% is customary in restaurants", "Thermal bath etiquette: shower before entering pools"],
    packing: ["Swimsuit for thermal baths — essential Budapest experience", "Smart-casual clothes for ruin bar nights", "Warm layers for cold winters"],
    imgId: "photo-1541343672885-9be56236302a",
  },
  dublin: {
    id: "dublin",
    name: "Dublin",
    country: "Ireland",
    continent: "Europe",
    tagline: "Literary pubs, Georgian squares, and the friendliest locals in Europe",
    lang: "English (Irish Gaelic)",
    currency: "Euro (€)",
    bestTime: "May to September",
    peakSeason: "July to August and St. Patrick's Day",
    climate: "Oceanic with cool mild temperatures and frequent rain year-round",
    budget: [80, 180, 450],
    attractions: ["Trinity College and Book of Kells", "Guinness Storehouse", "Dublin Castle", "Temple Bar", "St. Patrick's Cathedral", "National Museum of Ireland"],
    areas: ["Temple Bar — tourist pubs and cobblestone nightlife", "Georgian Dublin — Merrion Square and Georgian architecture", "Docklands — tech companies and modern waterfront", "Portobello — bohemian cafes and vintage shops", "Kilmainham — historic gaol and Phoenix Park"],
    foods: ["Full Irish breakfast — beans, sausages, black pudding, eggs", "Seafood chowder at a pub in Temple Bar", "Boxty — traditional Irish potato pancake", "Colcannon — mashed potato with cabbage or kale", "Pint of Guinness — non-negotiable Dublin experience"],
    tips: ["Leprechaun Museum is surprisingly excellent", "Dublin DART coastal train is scenic and cheap", "Book Guinness Storehouse tickets online to skip queues"],
    dayTrips: ["Howth — fishing village with cliffwalk, 30 minutes by DART", "Glendalough — monastic ruins in Wicklow Mountains, 1.5 hours", "Kilkenny — medieval castle city, 1.5 hours by bus"],
    hidden: ["Marsh's Library — oldest public library in Ireland, 1701", "Little Museum of Dublin — quirky social history collection"],
    photoSpots: ["Ha'penny Bridge reflected at dusk in the Liffey", "Georgian doors on Merrion Square — 50 colors"],
    romantic: ["Evening river cruise on the Liffey", "Dinner at a candlelit Georgian townhouse restaurant"],
    family: ["Dublin Zoo in Phoenix Park — Europe's oldest zoo", "EPIC Irish Emigration Museum — interactive history"],
    nightlife: ["Temple Bar pubs — touristy but iconic", "Camden Street — local bar scene away from tourists"],
    shopping: ["Grafton Street — pedestrian shopping and buskers", "George's Street Arcade — alternative and vintage"],
    transport: ["DART coastal train and Luas tram cover city", "Walking suits the compact city center perfectly"],
    safety: ["Dublin is safe with standard urban precautions", "Petty theft in busy Temple Bar areas"],
    etiquette: ["Banter is an Irish art form — embrace the craic", "Rounds system at pubs — if someone buys you a drink, buy one back"],
    packing: ["Waterproof jacket — Dublin gets rain in any season", "Layers for unpredictable weather", "Comfortable walking shoes for cobblestone streets"],
    imgId: "photo-1564959130747-897fb406b9af",
  },
  johannesburg: {
    id: "johannesburg",
    name: "Johannesburg",
    country: "South Africa",
    continent: "Africa",
    tagline: "Africa's economic powerhouse — Apartheid history, world-class art, and Soweto soul",
    lang: "Zulu, Xhosa, English (11 official languages)",
    currency: "South African Rand (ZAR)",
    bestTime: "April to September (dry winter season)",
    peakSeason: "June to August",
    climate: "Semi-arid highland with warm summers, dry mild winters, and afternoon thunderstorms",
    budget: [40, 120, 350],
    attractions: ["Apartheid Museum", "Soweto township", "Constitution Hill", "Cradle of Humankind", "Maboneng Precinct", "Gold Reef City"],
    areas: ["Maboneng — regenerated creative precinct with galleries and food", "Sandton — financial hub and luxury malls", "Soweto — historic township, vibrant music and culture", "Rosebank — café culture and African craft markets", "Melville — bohemian suburb with independent restaurants"],
    foods: ["Braai — South African BBQ, the national institution", "Bunny chow — curry in a hollowed loaf", "Boerewors — spiced beef sausage grilled over fire", "Malva pudding — sticky caramel dessert", "Samp and beans — traditional Zulu comfort food"],
    tips: ["Always book a registered Soweto tour guide", "Uber is essential — do not hail street taxis", "Cradle of Humankind requires a half-day trip"],
    dayTrips: ["Pretoria — jacaranda-lined administrative capital, 1 hour", "Pilanesberg National Park — Big 5, 2 hours", "Magaliesburg — hiking and hot springs, 1.5 hours"],
    hidden: ["Origins Centre at Wits University — human evolution museum", "Neighbourgoods Market in Braamfontein on Saturdays"],
    photoSpots: ["Soweto skyline from Orlando Towers", "Constitutional Court architecture and murals"],
    romantic: ["Dinner at a rooftop restaurant in Maboneng", "Sunset game drive at a nearby private reserve"],
    family: ["Lion Park — safe interaction with big cats", "Gold Reef City — theme park and gold mine tours"],
    nightlife: ["Maboneng clubs and live music venues", "Melville bars and restaurants — local crowd"],
    shopping: ["Rosebank Rooftop Market — African crafts on Sundays", "Nelson Mandela Square — upscale shops"],
    transport: ["Uber is the recommended transport throughout", "Gautrain links Sandton to airport and Pretoria"],
    safety: ["Johannesburg requires urban safety awareness", "Stay in recommended neighborhoods and use ride-hailing apps"],
    etiquette: ["Learn a few Zulu greetings — hugely appreciated", "Ask permission before photographing people"],
    packing: ["Sunscreen for high-altitude UV intensity", "Layers for cool winter evenings", "Power bank for long days out"],
    imgId: "photo-1577948000111-9c970dfe3743",
  },
  madrid: {
    id: "madrid",
    name: "Madrid",
    country: "Spain",
    continent: "Europe",
    tagline: "Spain's art-filled capital — the Prado, late-night tapas, and passionate football",
    lang: "Spanish",
    currency: "Euro (€)",
    bestTime: "April to June and September to November",
    peakSeason: "July to August",
    climate: "Semi-arid continental with hot dry summers and cool winters",
    budget: [70, 160, 400],
    attractions: ["Prado Museum", "Reina Sofía Museum", "Royal Palace", "Retiro Park", "Puerta del Sol", "Thyssen-Bornemisza Museum"],
    areas: ["Sol and Gran Vía — commercial heart with shops and theaters", "La Latina — tapas bars and medieval streets", "Malasaña — bohemian bars and vintage boutiques", "Chueca — LGBTQ+ neighborhood with great restaurants", "Salamanca — upscale fashion and fine dining"],
    foods: ["Tortilla española — potato and egg omelette, the national dish", "Cocido madrileño — hearty chickpea and meat stew", "Jamón ibérico — cured Iberian ham sliced to order", "Churros con chocolate — fried dough with thick hot chocolate", "Bocadillo de calamares — squid sandwich, a Madrid street staple"],
    tips: ["Museums often free Sunday afternoons — book timed entry", "Madrid nightlife starts at midnight and runs until dawn", "Metro is excellent and covers all major sights", "Siesta means many shops close 2–5pm"],
    dayTrips: ["Toledo — medieval walled city, 30 minutes by high-speed train", "Segovia — Roman aqueduct and castle, 30 minutes by train", "El Escorial — royal monastery in the mountains, 1 hour"],
    hidden: ["Templo de Debod — Egyptian temple gifted to Spain in Retiro Park", "El Rastro — massive Sunday flea market in La Latina"],
    photoSpots: ["Retiro Park lake with Crystal Palace reflection", "Gran Vía illuminated at night"],
    romantic: ["Late dinner at a candlelit taberna in La Latina", "Sunset drinks at a rooftop bar overlooking city"],
    family: ["Parque de Atracciones theme park in Casa de Campo", "Real Madrid Bernabéu stadium tour"],
    nightlife: ["Malasaña and Chueca bars till 3am, clubs till dawn", "Rooftop bars on Gran Vía — spectacular views"],
    shopping: ["El Corte Inglés — Spanish department store institution", "Fuencarral Street — indie fashion and streetwear"],
    transport: ["Metro covers all attractions efficiently", "Renfe train to nearby day-trip cities"],
    safety: ["Madrid is generally safe for tourists", "Pickpockets active around Sol and tourist attractions"],
    etiquette: ["Dinner before 10pm is considered early by locals", "Greet shopkeepers and restaurant staff when entering"],
    packing: ["Comfortable walking shoes for city exploration", "Sun protection for intense summer heat", "Smart-casual clothes — Madrileños dress well"],
    imgId: "photo-1539037116277-4db20889f2d4",
  },
};

function findDest(id: string): Destination {
  const found = allDests.find((d) => d.id === id);
  if (found) return found;
  if (STUBS[id]) return STUBS[id];
  throw new Error(`Destination not found: ${id}`);
}

// ── Comparison pairs ───────────────────────────────────────────────────────

const PAIRS: Array<[string, string]> = [
  ["tokyo", "kyoto"],
  ["paris", "barcelona"],
  ["rome", "athens"],
  ["new-york", "los-angeles"],
  ["london", "amsterdam"],
  ["bali", "bangkok"],
  ["dubai", "singapore"],
  ["prague", "budapest"],
  ["sydney", "melbourne"],
  ["miami", "new-orleans"],
  ["lisbon", "porto"],
  ["seoul", "tokyo"],
  ["bangkok", "bali"],
  ["edinburgh", "dublin"],
  ["vienna", "zurich"],
  ["istanbul", "athens"],
  ["marrakech", "casablanca"],
  ["cape-town", "johannesburg"],
  ["buenos-aires", "santiago"],
  ["rio-de-janeiro", "medellin"],
  ["tokyo", "osaka"],
  ["barcelona", "madrid"],
  ["berlin", "amsterdam"],
  ["lisbon", "seville"],
  ["new-york", "chicago"],
  ["san-francisco", "los-angeles"],
];

// ── Helpers ────────────────────────────────────────────────────────────────

const AUTHORS = ["alex-chen", "maria-garcia", "james-wilson", "sofia-costa", "omar-hassan", "yuki-tanaka"];

function rotateAuthor(i: number): string {
  return AUTHORS[i % AUTHORS.length];
}

function slugifyPair(id1: string, id2: string): string {
  return `${id1}-vs-${id2}`;
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
  index: number;
}): string {
  const { slug, title, description, tags, authorSlug, imgId, content, index } = params;
  const rt = readingTime(content);
  return `---
slug: ${slug}
title: "${title.replace(/"/g, '\\"')}"
description: "${description.slice(0, 160).replace(/"/g, '\\"')}"
category: Guides
tags: [${tags.map((t) => `"${t}"`).join(", ")}]
author_slug: ${authorSlug}
cluster: destination-comparisons
imgId: ${imgId}
reading_time: ${rt}
---

`;
}

// ── AI generation ──────────────────────────────────────────────────────────

async function generateComparison(
  dest1: Destination,
  dest2: Destination,
  index: number
): Promise<string> {
  const slug = slugifyPair(dest1.id, dest2.id);
  const title = `${dest1.name} vs ${dest2.name}: Which Should You Visit?`;

  const prompt = `You are a senior travel writer for Faroway (faroway.ai), an AI trip planner. Write a detailed, genuinely helpful destination comparison article.

## Assignment
Title: "${title}"
Slug: ${slug}
Target length: 1,200–1,800 words

## Destination Data

### ${dest1.name}
- Country: ${dest1.country}, Continent: ${dest1.continent}
- Tagline: ${dest1.tagline}
- Climate: ${dest1.climate}
- Best time: ${dest1.bestTime} | Peak season: ${dest1.peakSeason}
- Daily budget (budget/mid/luxury): $${dest1.budget[0]}/$${dest1.budget[1]}/$${dest1.budget[2]}
- Language: ${dest1.lang} | Currency: ${dest1.currency}
- Top attractions: ${dest1.attractions.slice(0, 5).join(", ")}
- Neighborhoods: ${dest1.areas.slice(0, 3).join("; ")}
- Must-eat foods: ${dest1.foods.slice(0, 4).join("; ")}
- Nightlife: ${dest1.nightlife.slice(0, 2).join("; ")}
- Transport: ${dest1.transport.slice(0, 2).join("; ")}
- Etiquette tips: ${dest1.etiquette.slice(0, 2).join("; ")}

### ${dest2.name}
- Country: ${dest2.country}, Continent: ${dest2.continent}
- Tagline: ${dest2.tagline}
- Climate: ${dest2.climate}
- Best time: ${dest2.bestTime} | Peak season: ${dest2.peakSeason}
- Daily budget (budget/mid/luxury): $${dest2.budget[0]}/$${dest2.budget[1]}/$${dest2.budget[2]}
- Language: ${dest2.lang} | Currency: ${dest2.currency}
- Top attractions: ${dest2.attractions.slice(0, 5).join(", ")}
- Neighborhoods: ${dest2.areas.slice(0, 3).join("; ")}
- Must-eat foods: ${dest2.foods.slice(0, 4).join("; ")}
- Nightlife: ${dest2.nightlife.slice(0, 2).join("; ")}
- Transport: ${dest2.transport.slice(0, 2).join("; ")}
- Etiquette tips: ${dest2.etiquette.slice(0, 2).join("; ")}

## Required Structure (write the article body only — NO frontmatter)

1. Opening hook (2–3 sentences) — why this is a real dilemma travelers face
2. **Quick Comparison Table** — markdown table with these rows: Cost/day, Vibe, Food scene, Nightlife, Top sights, Best for, Weather, Language barrier
3. **Cost: Which City is Cheaper?** section — specific daily budget breakdown for both
4. **Vibe & Atmosphere** section — genuine personality differences, who each city appeals to
5. **Food Scene** section — specific dishes and where to eat them
6. **Top Sights & Activities** section — best attractions with brief descriptions
7. **Nightlife & Entertainment** section — honest comparison
8. **Practical Logistics** section — transport, safety, best time to visit
9. **Choose ${dest1.name} if you want...** / **Choose ${dest2.name} if you want...** — 4–5 bullet points each, specific and honest
10. **Our Verdict** — 2–3 sentences with a genuine recommendation
11. Faroway CTA ending: "*Ready to plan your trip? [Use Faroway's AI trip planner](/) to build the perfect itinerary for ${dest1.name} or ${dest2.name} in 60 seconds — free. Also explore our [${dest1.name} travel guide](/destinations/${dest1.id}) and [${dest2.name} travel guide](/destinations/${dest2.id}).*"

## Writing Guidelines
- Write in second person ("you") — conversational but authoritative
- Be specific: name real neighborhoods, dishes, prices, venues
- Be honest about trade-offs — every city has genuine pros and cons
- Avoid generic travel clichés — write content that actually helps a traveler decide
- Use the destination data above but expand with real knowledge
- Target 1,200–1,800 words total

Write the article body now (NO frontmatter, start with the opening paragraph):`;

  const response = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const content = (response.content[0] as { type: string; text: string }).text;

  const tags = [
    dest1.name.toLowerCase(),
    dest2.name.toLowerCase(),
    "destination comparison",
    "travel planning",
    `${dest1.country.toLowerCase()} travel`,
    `${dest2.country.toLowerCase()} travel`,
    "where to visit",
    "travel guide",
  ].slice(0, 8);

  const description = `${dest1.name} vs ${dest2.name}: Compare costs, vibe, food, nightlife, and top sights to decide which city deserves your next trip.`.slice(0, 160);

  const frontmatter = buildFrontmatter({
    slug,
    title,
    description,
    tags,
    authorSlug: rotateAuthor(index),
    imgId: dest1.imgId,
    content,
    index,
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

async function main() {
  console.log(`\n🚀 Faroway AI Writer — Destination Comparisons`);
  console.log(`   Generating ${PAIRS.length} comparison posts...\n`);

  const sem = new Semaphore(5);
  let completed = 0;
  let skipped = 0;

  const tasks = PAIRS.map(([id1, id2], index) => async () => {
    await sem.acquire();
    try {
      const slug = slugifyPair(id1, id2);
      const outPath = path.join(OUTPUT_DIR, `${slug}.md`);

      if (fs.existsSync(outPath)) {
        console.log(`  ⏭  Skipping ${slug} (already exists)`);
        skipped++;
        return;
      }

      console.log(`  Writing: ${slug}...`);

      const dest1 = findDest(id1);
      const dest2 = findDest(id2);

      const fileContent = await withRetry(() => generateComparison(dest1, dest2, index));
      const words = wordCount(fileContent);

      fs.writeFileSync(outPath, fileContent, "utf8");
      completed++;
      console.log(`  ✓ ${slug} (${words.toLocaleString()} words)`);
    } finally {
      sem.release();
    }
  });

  await Promise.all(tasks.map((t) => t()));

  console.log(`\n✅ Done! ${completed} written, ${skipped} skipped`);
  console.log(`   Output: ${OUTPUT_DIR}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
