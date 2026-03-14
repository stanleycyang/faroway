# Faroway Skyscraper Content Squad

**Status:** Ready to seed
**Created:** March 13, 2026
**Target:** Outrank Wanderlog, Roadtrippers, TripIt on high-intent travel keywords

---

## Strategy Overview

The **skyscraper technique** is simple: find what's already ranking, build something genuinely better, then promote it.

This content squad targets the AI travel planning space's most valuable keywords with content that's more comprehensive, better structured, and optimized for both search engines and actual travelers.

### Primary Competitor: Wanderlog

**Wanderlog.com** dominates travel SEO with millions of indexed pages. Their core strength:
- "[X] days in [City] itinerary" format (3/5/7-day versions for every major destination)
- User-generated itineraries with maps and day-by-day structure
- Weak spots: thin content, user-submitted quality varies, ads everywhere

**Our edge:** AI-powered itineraries with richer detail, actual cost breakdowns, neighborhood context, transport guidance, and no ads. Plus we link directly to Faroway's itinerary builder at the end of every post — perfect funnel.

### Secondary Targets

- **Roadtrippers:** Road trip routes (we counter with city comparisons + day trips)
- **TripIt:** Travel checklists and logistics (we build better, more localized versions)
- **TripAdvisor:** Food guides (we go deeper with neighborhood context)

---

## Content Clusters

| Cluster | Templates | Posts | SEO Target | Competitor |
|---------|-----------|-------|------------|------------|
| **itinerary-guides** | 5 | 500 | "[X] days in [city] itinerary" | Wanderlog |
| **destination-comparisons** | 2 | 26 | "[city] vs [city]" | — (blue ocean) |
| **travel-checklists** | 2 | 200 | "[city] packing list" | TripIt |
| **travel-logistics** | 2 | 200 | "getting around [city]" | Wanderlog |
| **food-travel** | 3 | 300 | "[city] food guide" | TripAdvisor |
| **TOTAL** | **14** | **1,226** | | |

---

## Cluster Breakdown

### 1. Itinerary Guides (500 posts)

**Templates:**
1. `template3DayItinerary` → `3-days-in-{city}`
2. `template5DayItinerary` → `5-days-in-{city}`
3. `template7DayItinerary` → `7-days-in-{city}`
4. `template10DayItinerary` → `10-days-in-{city}`
5. `templateWeekendItinerary` → `{city}-weekend-itinerary`

**Why this works:**
- Wanderlog's itineraries are thin (often < 500 words, user-generated)
- Ours are 1,500–2,000 words with day-by-day breakdowns, actual costs, where-to-stay recommendations, and transport tips
- Every post ends with a CTA to use Faroway's AI planner to customize the itinerary
- Direct conversion funnel: "I like this 5-day plan" → "Let me customize it in Faroway"

**Example post:** `/blog/3-days-in-tokyo` outranks wanderlog.com/itinerary/3-days-tokyo because:
- More comprehensive (2,000 words vs 600)
- Better structure (quick facts table, day-by-day with morning/afternoon/evening, where to stay, transport, food)
- Actual budget breakdowns ($50/day, $150/day, $400/day)
- Internal links to `/destinations/tokyo` and related posts
- Stronger CTA to a free tool (Faroway) vs paid upgrade (Wanderlog Plus)

---

### 2. Destination Comparisons (26 posts)

**Templates:**
1. `templateCityVsCity` → `{city1}-vs-{city2}`
2. `templateWhichCity` → `{city1}-or-{city2}`

**Hardcoded pairs:**
Tokyo vs Kyoto, Paris vs Barcelona, Rome vs Athens, New York vs Los Angeles, London vs Amsterdam, Bali vs Bangkok, Dubai vs Singapore, Prague vs Budapest, Sydney vs Melbourne, Miami vs New Orleans, Lisbon vs Porto, Seoul vs Tokyo, Bangkok vs Bali

**Why this works:**
- Wanderlog has almost ZERO comparison content — this is a blue ocean
- High-intent search: users typing "Tokyo vs Kyoto" are actively planning and comparing
- Side-by-side comparison tables (cost, vibe, food, nightlife, sights)
- "Choose X if you want..." decision framework
- Links to both city destination pages + their respective itineraries

**Example post:** `/blog/tokyo-vs-kyoto`
- Target keyword: "Tokyo vs Kyoto" (8,100 monthly searches, low competition)
- No authoritative comparison exists — we own this space immediately
- CTAs to both `/destinations/tokyo` and `/destinations/kyoto` plus Faroway planner

---

### 3. Travel Checklists (200 posts)

**Templates:**
1. `templatePackingChecklist` → `{city}-packing-list`
2. `templateTravelChecklist` → `{city}-travel-checklist`

**Why this works:**
- TripIt has generic checklists — ours are city-specific
- Climate-tailored packing lists (Tokyo in winter ≠ Miami in summer)
- Cultural etiquette integrated (modest dress for temples, etc.)
- Markdown checkboxes for printability
- Links to itineraries and destination pages for further planning

---

### 4. Travel Logistics (200 posts)

**Templates:**
1. `templateGettingAround` → `getting-around-{city}`
2. `templateAirportGuide` → `{city}-airport-guide`

**Why this works:**
- High-intent search: "how to get from Tokyo airport to city" shows immediate travel need
- Wanderlog has some transport content but it's buried in itineraries
- Our posts are standalone, detailed, and optimized for logistics keywords
- Airport guides cover SIM cards, currency exchange, transport options with costs
- Getting around guides compare metro/taxi/bike/walk with real pricing

---

### 5. Food Travel (300 posts)

**Templates:**
1. `templateFoodGuide` → `{city}-food-guide`
2. `templateMustEat` → `must-eat-in-{city}`
3. `templateFoodieItinerary` → `{city}-foodie-itinerary`

**Why this works:**
- TripAdvisor dominates "best restaurants in X" but not "what to eat in X"
- Our food guides focus on dishes, not just restaurants (more authentic)
- Neighborhood-specific recommendations using `dest.areas` and `dest.foods`
- Budget vs splurge breakdowns
- Foodie itineraries = day-by-day food tour (unique angle)

---

## Destinations (100 total)

**Reused from seed-500-blogs (50 high-traffic cities):**
Tokyo, Kyoto, Bali, Bangkok, Singapore, Seoul, Hong Kong, Taipei, Paris, Barcelona, London, Rome, Lisbon, Amsterdam, Prague, Vienna, Edinburgh, Florence, Berlin, New York, San Francisco, Sydney, Melbourne, Dubai, Istanbul, Marrakech, Cape Town, Buenos Aires, Rio de Janeiro, Mexico City + more

**Reused from seed-1000-blogs (selected):**
Chiang Mai, Osaka, Porto, Seville, Medellin, Tbilisi, Oaxaca, Zurich, Busan, Krakow, Austin, Nashville, Seattle, Denver, Montreal, Toronto, etc.

**New destinations added (US + emerging):**
Las Vegas, Boston, Washington DC, San Diego, Houston, Chicago, Miami, New Orleans, and other high-search-volume US cities

All destinations use the exact `Destination` interface from `seed-500-blogs/destinations.ts` with full data: attractions, areas, foods, tips, transport, safety, etiquette, packing, etc.

---

## How to Run

### Dry Run (No DB Writes)

```bash
cd /Users/stanleyyang/.openclaw/workspace/faroway
npx tsx scripts/skyscraper-squad/index.ts --dry-run
```

Shows what would be generated without touching the database.

---

### Run One Cluster

```bash
# Just itinerary guides (500 posts)
npx tsx scripts/skyscraper-squad/index.ts --cluster itinerary-guides

# Just comparisons (26 posts)
npx tsx scripts/skyscraper-squad/index.ts --cluster destination-comparisons

# Just checklists (200 posts)
npx tsx scripts/skyscraper-squad/index.ts --cluster travel-checklists

# Just transport (200 posts)
npx tsx scripts/skyscraper-squad/index.ts --cluster travel-logistics

# Just food (300 posts)
npx tsx scripts/skyscraper-squad/index.ts --cluster food-travel
```

---

### Full Run (All 1,226 Posts)

```bash
# Batch 1: first ~600 posts
npx tsx scripts/skyscraper-squad/index.ts --batch 1

# Batch 2: remaining ~600 posts
npx tsx scripts/skyscraper-squad/index.ts --batch 2
```

**Why batches?** Unsplash rate limiting + safer to verify batch 1 before running batch 2.

---

## Content Quality Bar

Every template function produces content that:

1. **Uses real destination data** — attractions, foods, areas, transport, etc. from `destinations.ts`
2. **Has 1,000+ words** — itinerary templates hit 1,500–2,000 words
3. **Includes internal links** — to `/destinations/{id}` and 2+ related blog posts
4. **Has a strong CTA** — "Use Faroway's AI planner to customize this itinerary — free"
5. **Natural keyword usage** — no stuffing, just naturally optimized for target keywords
6. **Varied sentence structure** — reads like a human wrote it, not a template engine

---

## SEO Strategy

### On-Page

- **Title tags:** `{keyword} — Faroway` (e.g., "3 Days in Tokyo: The Perfect Weekend Itinerary")
- **Meta descriptions:** 150–160 chars, includes target keyword + CTA
- **H1 = Title:** Always matches the target keyword
- **Internal linking:** Every post links to destination page + 2 related posts
- **Structured data:** Blog post schema (already in blog infrastructure)

### Off-Page

- **Reddit strategy:** Post itineraries in r/travel, r/solotravel, r/JapanTravel, etc. (see `REDDIT-STRATEGY.md`)
- **Social:** Share on Twitter/X, Facebook travel groups
- **Backlinks:** Reach out to travel bloggers for link exchanges
- **Guest posts:** Contribute itineraries to other travel sites with backlinks

---

## Success Metrics

**Phase 1 (Month 1):**
- All 1,226 posts indexed by Google
- 50+ impressions/day on target keywords
- 5+ clicks/day from organic search

**Phase 2 (Month 3):**
- Ranking on page 1 for 20+ "[city] itinerary" keywords
- 500+ impressions/day
- 50+ clicks/day
- 5+ Faroway app signups from blog traffic

**Phase 3 (Month 6):**
- Outranking Wanderlog on 50+ target keywords
- 2,000+ impressions/day
- 200+ clicks/day
- 50+ Faroway app signups/week from blog

---

## Next Steps

1. ✅ Build content squad infrastructure (this PR)
2. ⏳ Run `--batch 1` and verify output quality
3. ⏳ Run `--batch 2` once batch 1 is indexed
4. ⏳ Monitor Google Search Console for indexing + performance
5. ⏳ Execute Reddit strategy (post top-performing itineraries)
6. ⏳ Build backlinks via outreach + guest posts

---

## Maintenance

### Adding New Destinations

1. Edit `destinations.ts`
2. Add new `Destination` object with all fields
3. Re-run: `npx tsx scripts/skyscraper-squad/index.ts`

All 14 templates will automatically generate posts for the new destination.

### Updating Templates

1. Edit the relevant `templates-*.ts` file
2. Re-run with `--dry-run` to verify changes
3. Re-run live to update existing posts (upsert by slug)

---

## Files

```
scripts/skyscraper-squad/
├── README.md                     # This file
├── destinations.ts               # 100 destinations (reused + new)
├── templates-itinerary.ts        # 5 itinerary templates (core content)
├── templates-vs.ts               # 2 comparison templates (blue ocean)
├── templates-checklist.ts        # 2 checklist templates
├── templates-transport.ts        # 2 transport templates
├── templates-foodie.ts           # 3 food templates
└── index.ts                      # Runner script (generates + seeds all posts)
```

---

## Questions?

Check the main Faroway docs or Slack #faroway.

**Strategy questions:** See `REDDIT-STRATEGY.md` and `honestcasa-seo-plan.md` (similar approach)
**Technical questions:** See `scripts/seed-500-blogs/` for the pattern we're following

---

_Built with the skyscraper technique. Let's outrank the giants._ 🏔️
