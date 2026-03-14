# Task: Build seed-1000-blogs Scripts

## STUDY FIRST

Read these files before writing anything:
- scripts/seed-500-blogs/destinations.ts (50 destinations)
- scripts/seed-500-blogs/templates.ts
- scripts/seed-500-blogs/templates-v2.ts
- scripts/seed-500-blogs/templates-v3.ts
- scripts/seed-500-blogs/index.ts (runner)
- apps/web/app/blog/page.tsx
- apps/web/app/destinations/page.tsx

## GOAL

Create `scripts/seed-1000-blogs/` with scripts to generate 1000 SEO-optimized blog posts for faroway.ai.

## FILE STRUCTURE

### scripts/seed-1000-blogs/destinations.ts
- 80 NEW destinations NOT already in seed-500-blogs/destinations.ts
- Cover: more of Africa, South America, Eastern Europe, Central Asia, Pacific Islands, Middle East
- Use the exact same Destination interface (all fields: id, name, country, continent, tagline, lang, currency, bestTime, peakSeason, climate, budget, attractions, areas, foods, tips, dayTrips, hidden, photoSpots, romantic, family, nightlife, shopping, transport, safety, etiquette, packing, imgId)
- For imgId use "photo-XXXXXXXXXXXXXXX" format (realistic Unsplash-style IDs)
- Existing destinations to AVOID duplicating: tokyo, kyoto, bali, paris, barcelona, rome, new-york, london, amsterdam, istanbul, dubai, singapore, new-zealand, peru, mexico-city, lisbon, prague, budapest, vienna, berlin, sydney, hong-kong, bangkok, seoul, marrakech, cape-town, buenos-aires, rio-de-janeiro, havana, amsterdam (check the file for the full list)

### scripts/seed-1000-blogs/templates.ts
Three template functions:
1. templateWeekendGuide(dest) → slug: "weekend-in-${dest.id}", cluster: "destination-guides"
2. templateSoloTravel(dest) → slug: "solo-travel-guide-${dest.id}", cluster: "solo-travel"
3. templateDigitalNomad(dest) → slug: "digital-nomad-guide-${dest.id}", cluster: "digital-nomads"

### scripts/seed-1000-blogs/templates-v2.ts
Three template functions:
1. templateBudgetTravel(dest) → slug: "${dest.id}-on-a-budget", cluster: "budget-travel"
2. templateLuxuryTravel(dest) → slug: "luxury-travel-${dest.id}", cluster: "luxury-travel"
3. templateAdventureTravel(dest) → slug: "adventure-travel-${dest.id}", cluster: "adventure-travel"

### scripts/seed-1000-blogs/templates-v3.ts
Three template functions:
1. templateFamilyTravel(dest) → slug: "family-travel-guide-${dest.id}", cluster: "family-travel"
2. templateCouplesTravel(dest) → slug: "${dest.id}-for-couples", cluster: "romance-travel"
3. templateFirstTimer(dest) → slug: "first-time-visiting-${dest.id}", cluster: "destination-guides"

### scripts/seed-1000-blogs/templates-v4.ts
Three template functions:
1. templateSafetyGuide(dest) → slug: "${dest.id}-safety-guide", cluster: "travel-tips"
2. templateNeighborhoods(dest) → slug: "best-neighborhoods-${dest.id}", cluster: "destination-guides"
3. templateHiddenGems(dest) → slug: "${dest.id}-hidden-gems", cluster: "destination-guides"

### scripts/seed-1000-blogs/index.ts
- Copy pattern from scripts/seed-500-blogs/index.ts
- Import destinations from ./destinations and all templates from ./templates through ./templates-v4.ts
- Apply ALL 12 template functions to ALL 80 destinations = 960 posts
- Support --dry-run, --batch 1 (first 500), --batch 2 (next 460)
- Spread published_at dates across March 2026 to August 2026
- Same Supabase upsert logic with Unsplash cover images
- Upsert to blog_posts table

## CONTENT REQUIREMENTS FOR EACH TEMPLATE FUNCTION

Every template function must return a BlogEntry with:
- slug: unique kebab-case
- title: compelling SEO title
- description: max 160 chars, include keyword naturally
- content: 1000-1500 words, proper markdown with ## headings, tables where useful, bullet lists
- category: one of "Guides", "Tips", "Budget", "Luxury", "Adventure", "Food", "Lifestyle", "Photography"
- tags: 6-8 relevant SEO tags including destination name, country, travel type
- author_slug: rotate among "alex-chen", "maria-garcia", "james-wilson", "sofia-costa", "omar-hassan", "yuki-tanaka"
- reading_time: calculate from content word count
- cover_image_alt: descriptive alt text
- cluster: appropriate cluster string
- imgId: use dest.imgId or dest.imgIds[0] if available

## INTERNAL LINKING

Each post's content must include:
1. Link to the destination page: /destinations/${dest.id}
2. Link to at least 2 related blog posts for same destination (e.g., /blog/best-time-to-visit-${dest.id}, /blog/${dest.id}-travel-guide)
3. A CTA at the bottom: "*Planning a trip to ${dest.name}? [Let Faroway create your perfect itinerary](/) — it's free and takes just 60 seconds.*"

## CLUSTERS

Valid cluster values:
- "destination-guides"
- "travel-tips"  
- "budget-travel"
- "luxury-travel"
- "adventure-travel"
- "food-travel"
- "digital-nomads"
- "family-travel"
- "solo-travel"
- "romance-travel"
- "photography"

## QUALITY BAR

- Content must be genuinely useful and use the destination's actual data (attractions, foods, areas, etc.)
- Natural keyword usage, no stuffing
- Varied sentence structure and engaging tone
- Each template should feel distinct from the others

When completely done creating all files, run this exact command:
openclaw system event --text "Done: seed-1000-blogs ready — 80 destinations x 12 templates = 960 posts" --mode now
