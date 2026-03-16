#!/usr/bin/env python3
"""
Faroway AI Writer — writes blog posts using Claude API directly.
Usage: python3 write-batch.py --cluster itinerary --start 0 --count 20
"""
import json, os, sys, time, argparse, re
import anthropic

client = anthropic.Anthropic(auth_token=os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"))
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)

AUTHORS = ["alex-chen", "maria-garcia", "james-wilson", "sofia-costa", "omar-hassan", "yuki-tanaka"]

def load_dests():
    with open("/tmp/faroway-destinations.json") as f:
        return json.load(f)

def word_count(text):
    return len(text.split())

def reading_time(text):
    return max(4, -(-word_count(text) // 230))  # ceil div

def slug_exists(slug):
    return os.path.exists(os.path.join(OUTPUT_DIR, f"{slug}.md"))

def save_post(slug, title, description, category, tags, author, cluster, img_id, content):
    rt = reading_time(content)
    frontmatter = f"""---
slug: {slug}
title: "{title}"
description: "{description[:160]}"
category: {category}
tags: {json.dumps(tags)}
author_slug: {author}
cluster: {cluster}
imgId: {img_id}
reading_time: {rt}
---

"""
    path = os.path.join(OUTPUT_DIR, f"{slug}.md")
    with open(path, "w") as f:
        f.write(frontmatter + content)
    return word_count(content)

def write_post(prompt, slug, title, description, category, tags, author, cluster, img_id, retries=3):
    for attempt in range(retries):
        try:
            msg = client.messages.create(
                model="claude-opus-4-5",
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}]
            )
            content = msg.content[0].text
            wc = save_post(slug, title, description, category, tags, author, cluster, img_id, content)
            return wc
        except Exception as e:
            if attempt < retries - 1:
                print(f"  Retry {attempt+1}/{retries-1} for {slug}: {e}")
                time.sleep(2 * (attempt + 1))
            else:
                print(f"  FAILED {slug}: {e}")
                return 0

def dest_context(d):
    return f"""
Destination: {d['name']}, {d['country']}
Tagline: {d['tagline']}
Climate: {d.get('climate', 'varies')}
Best time to visit: {d.get('bestTime', 'year-round')}
Budget: ${d['budget'][0]}/day (budget) · ${d['budget'][1]}/day (mid) · ${d['budget'][2]}/day (luxury)
Top attractions: {', '.join(d['attractions'][:6])}
Neighborhoods: {'; '.join(d['areas'][:5])}
Must-eat foods: {'; '.join(d['foods'][:6])}
Local tips: {'; '.join(d['tips'][:5])}
Getting around: {'; '.join(d['transport'][:3])}
Safety: {'; '.join(d.get('safety', [])[:3])}
Etiquette: {'; '.join(d.get('etiquette', [])[:3])}
Packing tips: {'; '.join(d.get('packing', [])[:3])}
Day trips: {'; '.join(d.get('dayTrips', [])[:3])}
Hidden gems: {'; '.join(d.get('hidden', [])[:3])}
""".strip()

# ── ITINERARY PROMPTS ──

def prompt_3day(d):
    return f"""Write a comprehensive, 1,600-word travel blog post: "3 Days in {d['name']}: The Perfect Weekend Itinerary"

{dest_context(d)}

Structure:
- Intro paragraph (2-3 sentences, hooks the reader, mentions the city's essence)
- Quick Facts table (markdown table: Country, Language, Currency, Best time to visit, Budget per day at 3 levels)
- Day 1: [Iconic Foundations] with Morning (8am-12pm), Afternoon (12pm-5pm), Evening (5pm-10pm) — specific attractions with why/how long, meal recommendations with price range
- Day 2: [Deep Dive] same morning/afternoon/evening structure — different neighborhoods, local experiences
- Day 3: [Final Day] morning/afternoon/evening — best remaining sights + departure tips
- Where to Stay section: budget pick, mid-range pick, splurge pick (use {d['areas'][0].split(' ')[0]} area etc.)
- Getting There & Around (2-3 sentences using the transport data)
- Closing paragraph + this exact CTA: "*Ready to customize this itinerary? [Use Faroway's AI planner](/) to build your perfect {d['name']} trip in 60 seconds — free.*"

Tone: Knowledgeable friend who's been there, not a generic travel guide. Specific, practical, opinionated. Use real place names from the destination data. No fluff.
Write only the blog post content — no preamble or meta-commentary."""

def prompt_5day(d):
    return f"""Write a comprehensive, 1,800-word travel blog post: "5 Days in {d['name']}: The Complete Itinerary"

{dest_context(d)}

Structure:
- Hook intro (highlight what makes 5 days the sweet spot for {d['name']})
- Quick Facts table (Country, Currency, Best time, Budget levels, Language)
- Day 1–5 with Morning/Afternoon/Evening for each day — different focus each day (e.g., historical, modern, local neighborhood, day trip, food-focused)
- Day trip suggestion using: {', '.join(d.get('dayTrips', ['nearby region'])[:2])}
- Where to Stay (3 options by budget with neighborhood context)
- Budget Breakdown table: budget traveler (${d['budget'][0]}/day), mid-range (${d['budget'][1]}/day), luxury (${d['budget'][2]}/day) — with what that gets you
- Practical tips (3-4 specific tips from the destination data)
- CTA: "*Planning a {d['name']} trip? [Let Faroway build your personalized 5-day plan](/) — free, in 60 seconds.*"

Tone: Expert travel writer with firsthand knowledge. Opinionated ("Day 3 is the best day"). Use specific neighborhood names. No fluff."""

def prompt_7day(d):
    return f"""Write a comprehensive, 2,000-word travel blog post: "7 Days in {d['name']}: The Ultimate Week Itinerary"

{dest_context(d)}

Structure:
- Opening that sells the reader on why a full week is worth it
- Quick Facts table
- Day 1–7 with detailed Morning/Afternoon/Evening for each
  - Early days: city essentials and orientation
  - Mid days: deeper neighborhoods, local experiences, day trips ({', '.join(d.get('dayTrips', [])[:2])})
  - Final days: hidden gems ({', '.join(d.get('hidden', [])[:2])}), favorite revisits, farewell meal
- Week at a Glance (single markdown table summarizing all 7 days)
- Where to Stay (neighborhood comparison with pros/cons)
- Budget for 7 Days: budget (${{d['budget'][0]*7}}), mid (${{d['budget'][1]*7}}), luxury (${{d['budget'][2]*7}}) — what's included
- Top 5 Tips (pulled from destination data, opinionated)
- CTA: "*Want a personalized 7-day {d['name']} plan? [Faroway creates it for free in 60 seconds.](/)*"

Write 2,000 words of substantive content. Each day should feel distinct. Be specific about timing, prices, and neighborhoods.""".replace("{{", "{").replace("}}", "}")

def prompt_10day(d):
    return f"""Write a comprehensive, 2,200-word travel blog post: "10 Days in {d['name']}: An In-Depth Exploration"

{dest_context(d)}

This is for travelers who want to go beyond tourist highlights. Structure:
- Intro: Why 10 days unlocks the REAL {d['name']}
- Quick Facts table
- Days 1–10 with Morning/Afternoon/Evening structure
  - Days 1-3: Foundation (essential sights, orientation)
  - Days 4-6: Deeper neighborhoods and local life
  - Days 7-8: Day trips ({', '.join(d.get('dayTrips', ['nearby areas'])[:2])})
  - Days 9-10: Slow travel — markets, cooking, culture, hidden spots ({', '.join(d.get('hidden', [])[:3])})
- 10-Day Budget breakdown (total cost at 3 levels)
- The {d['name']} You Won't Find on Day 3 (hidden gems section)
- Photography spots: {', '.join(d.get('photoSpots', d['attractions'])[:3])}
- CTA: "*Building a 10-day {d['name']} itinerary? [Faroway personalizes it instantly — free.](/)*"

Write with enthusiasm for extended travel. This reader is not rushing. Give them the layered experience."""

def prompt_weekend(d):
    return f"""Write a punchy, 1,400-word travel blog post: "{d['name']} Weekend Itinerary: Make the Most of 48 Hours"

{dest_context(d)}

This is for someone flying in Friday night and leaving Sunday evening. Every hour counts. Structure:
- Hook: "Here's exactly how to do {d['name']} in a weekend without wasting a minute"
- Friday Evening (arrive, dinner, first impressions) — 3-4 hours
- Saturday: Full Day — Morning/Afternoon/Evening — your absolute best picks only (top 3-4 attractions max)
- Sunday: Morning/Afternoon (checkout by 2pm) — 2-3 focused experiences + farewell meal
- The Non-Negotiables (bullet list: 5 things you MUST do in 48 hours)
- The Skip List (2-3 things that need more time than a weekend allows)
- Weekend budget: ${d['budget'][0]*2}–${d['budget'][1]*2} total for 48 hours
- Logistics: best neighborhoods to stay, transport tips for tight schedule
- CTA: "*Short on time? [Faroway plans your perfect {d['name']} weekend in 60 seconds — free.](/)*"

Tone: Urgent, decisive, no waffling. This reader has 48 hours and wants definitive answers."""

# ── COMPARISON PROMPTS ──

COMPARISON_PAIRS = [
    ("tokyo", "kyoto"), ("paris", "barcelona"), ("rome", "athens"),
    ("new-york", "los-angeles"), ("london", "amsterdam"), ("bali", "bangkok"),
    ("dubai", "singapore"), ("prague", "budapest"), ("sydney", "melbourne"),
    ("miami", "new-orleans"), ("lisbon", "porto"), ("seoul", "tokyo"),
    ("bangkok", "bali"), ("edinburgh", "dublin"), ("vienna", "zurich"),
    ("istanbul", "athens"), ("cape-town", "johannesburg"), ("buenos-aires", "santiago"),
    ("tokyo", "osaka"), ("barcelona", "madrid"), ("berlin", "amsterdam"),
    ("lisbon", "seville"), ("new-york", "chicago"), ("san-francisco", "los-angeles"),
    ("paris", "london"), ("rome", "florence"),
]

def prompt_comparison(d1, d2):
    n1, n2 = d1['name'], d2['name']
    return f"""Write a comprehensive, 1,500-word travel comparison blog post: "{n1} vs {n2}: Which Should You Visit?"

City 1 — {n1}:
{dest_context(d1)}

City 2 — {n2}:
{dest_context(d2)}

Structure:
- Hook intro: Both cities are incredible — here's who should choose which
- Quick Comparison Table (markdown): | Category | {n1} | {n2} | — rows: Vibe, Cost (per day), Best for, Food scene, Nightlife, Sightseeing, Ease of getting around, Best time to visit
- {n1} at a Glance (150 words: its strengths and personality)
- {n2} at a Glance (150 words: its strengths and personality)  
- Head-to-Head sections:
  - Cost & Budget (which is cheaper and by how much)
  - Food & Dining (different food cultures, signature dishes)
  - Sightseeing (iconic sights comparison)
  - Nightlife & Entertainment
  - Getting Around
- Choose {n1} If... (5 specific traveler profiles)
- Choose {n2} If... (5 specific traveler profiles)
- Can You Do Both? (if they're close, suggest a combined itinerary)
- CTA: "*Can't decide? [Tell Faroway your travel style and it'll recommend the perfect city — free.](/)*"

Be opinionated. Don't be mealy-mouthed. Make real recommendations."""

# ── CHECKLIST PROMPTS ──

def prompt_packing(d):
    return f"""Write a practical, 1,100-word packing list blog post: "{d['name']} Packing List: What to Pack for Your Trip"

{dest_context(d)}

Structure:
- Intro: Why packing right for {d['name']} specifically matters (climate, culture, activities)
- The Essentials Table (markdown): | Item | Why You Need It | Notes |
- Clothing section (climate-appropriate, culture-aware — use the etiquette and climate data)
- Documents & Money checklist with [ ] checkboxes
- Electronics & Connectivity
- Health & Safety (any destination-specific health considerations)
- Toiletries (what's easy to buy there vs. bring)
- Day Pack Essentials (what to carry daily)
- Things NOT to Pack (2-3 items people always bring that they shouldn't)
- Packing Tips for {d['name']} specifically (use dest.packing data)
- CTA: "*Once your bag is packed, [let Faroway plan your {d['name']} itinerary — free.](/)*"

Use markdown checkboxes (- [ ] item) for the packing lists. Be specific — not "shoes" but "comfortable walking shoes (you'll walk 15,000+ steps/day in {d['name']})" """

def prompt_checklist(d):
    return f"""Write a comprehensive, 1,100-word pre-trip checklist blog post: "{d['name']} Travel Checklist: Everything Before You Go"

{dest_context(d)}

Structure:
- Intro: Why {d['name']} trips need specific prep (visa requirements, health, currency, etc.)
- 8 Weeks Before checklist (- [ ] items): visas, flights, accommodation research, travel insurance
- 4 Weeks Before checklist: book key experiences, accommodation confirmation, vaccinations if needed
- 1 Week Before checklist: currency, download apps ({', '.join(d.get('tips', [])[:2]).replace('"', '')}), notify bank, print docs
- Day Before checklist: pack, check-in online, transport to airport confirmed
- Arrival Day checklist: SIM card, local currency, transport to hotel, download offline maps
- In-{d['name']} Essentials (things to organize on arrival)
- Emergency Info: embassy contact, emergency numbers format for {d['country']}
- CTA: "*Checklist done? [Use Faroway to build your day-by-day {d['name']} itinerary — free.](/)*"

Be specific to {d['name']} and {d['country']}. Not a generic travel checklist — destination-specific advice throughout."""

# ── LOGISTICS PROMPTS ──

def prompt_getting_around(d):
    return f"""Write a comprehensive, 1,400-word transportation guide: "Getting Around {d['name']}: Complete Transportation Guide"

{dest_context(d)}

Structure:
- Intro: Overview of how {d['name']} works for getting around (walkable? transit-dependent? car needed?)
- Transport Options Overview table (markdown): | Mode | Cost | Best for | Pros | Cons |
- Metro / Subway section (if applicable): how to use, cost, key lines, tourist passes
- Bus section: routes, cost, apps to use
- Taxi & Rideshare: apps available, rough costs, tipping etiquette
- Bicycle: rental options, bike-friendliness, best cycling areas
- Walking: best walkable neighborhoods, distances between key sights
- Day Trips from {d['name']}: {', '.join(d.get('dayTrips', ['nearby areas'])[:3])} — how to reach each
- Money-Saving Tips: tourist transit passes, cards, free options
- Common Scams & How to Avoid Them (transport-specific)
- Recommended Apps: navigation + rideshare apps for {d['country']}
- CTA: "*Planning your {d['name']} itinerary? [Faroway handles routing and timing — free.](/)*"

Use real data from the transport and safety arrays. Specific costs in local context."""

def prompt_airport(d):
    return f"""Write a comprehensive, 1,200-word airport guide: "{d['name']} Airport Guide: Getting to the City"

{dest_context(d)}

Structure:
- Intro: Which airport(s) serve {d['name']}, how far from city center
- Transport Options comparison table (markdown): | Option | Journey Time | Cost | Best for |
  Include: Train/Metro, Bus/Coach, Taxi, Rideshare (Uber/Lyft/local app), Private Transfer
- Train/Metro to City section: terminal, cost (rough price in USD), journey time, where it goes
- Bus section: routes, cost, journey time
- Taxi section: licensed taxi cost estimate, rideshare availability
- Arrival Tips:
  - SIM cards (where to buy at airport, cost, best providers)
  - Currency exchange (airport vs. city, ATM tips)
  - Luggage storage
  - Tourist information desk
- Departure Tips:
  - How early to arrive, check-in counters vs. online
  - Airport lounges worth knowing about
  - Food & shopping at the airport
- Connecting Through {d['name']} (transit visa info if relevant)
- CTA: "*Landed in {d['name']}? [Let Faroway plan the rest of your trip — free.](/)*"

Be specific with prices (even if approximate). Travelers need real numbers."""

# ── FOOD PROMPTS ──

def prompt_food_guide(d):
    return f"""Write a mouth-watering, 1,600-word food guide: "{d['name']} Food Guide: What to Eat, Where & How Much"

{dest_context(d)}

Structure:
- Hook: What makes {d['name']}'s food scene unique and unmissable
- {d['name']} Food Culture Overview (100 words — the food philosophy, meal times, dining culture)
- Must-Try Dishes section: expand on each item in foods[] with what it is, where to find it, price range
- Street Food Scene: best streets/markets for street food, what to look for, safety tips
- Restaurants by Budget:
  - Budget (under ${d['budget'][0]+10}/meal): what you get, best options by neighborhood
  - Mid-range (${d['budget'][0]+10}–${d['budget'][1]+20}/meal): recommended spots and dishes
  - Splurge (${d['budget'][1]+20}+/meal): when it's worth it in {d['name']}
- Vegetarian & Vegan Options: how plant-based-friendly is {d['name']}?
- Food Neighborhoods: which areas in {', '.join([a.split(' — ')[0] for a in d['areas'][:4]])} have the best food?
- Dining Etiquette: {'; '.join(d.get('etiquette', [])[:3])}
- When to Eat: local meal times, when restaurants fill up
- CTA: "*Hungry for more {d['name']}? [Build your personalized food itinerary with Faroway — free.](/)*"

Write with genuine enthusiasm. Make readers hungry. Use specific dish names and flavors."""

def prompt_must_eat(d):
    foods = d['foods']
    return f"""Write a passionate, 1,200-word culinary bucket list post: "Must-Eat Foods in {d['name']}: A Culinary Bucket List"

{dest_context(d)}

Core foods to cover: {'; '.join(foods)}

For EACH food item, write 80-120 words covering:
- What it is (sensory description — taste, texture, smell)
- The cultural story / why it matters in {d['name']}
- Where to find the best version (neighborhood, type of place)  
- What to expect to pay
- Pro tip (how to order, what to get with it, common mistake tourists make)

Format each as: ## [Food Name]
Then the 80-120 word write-up.

After all items:
- Honorable Mentions (2-3 more foods worth trying, brief)
- The Golden Rule: what every first-time visitor must eat on Day 1
- CTA: "*Ready to eat your way through {d['name']}? [Faroway builds your food itinerary — free.](/)*"

Write like you love this food. Sensory, specific, opinionated."""

def prompt_foodie_itinerary(d):
    return f"""Write an exciting, 1,400-word foodie travel post: "{d['name']} Foodie Itinerary: 3 Days of Eating Your Way Through {d['name']}"

{dest_context(d)}

Structure:
- Hook: Why {d['name']} is one of the world's great food cities (or why its food scene surprises people)
- Day 1: [Focus: Classics & Street Food]
  - Morning (8am): iconic breakfast spot + what to order
  - Mid-morning snack: street food from a specific market/street type
  - Lunch: sit-down local restaurant, dish recommendation + price
  - Afternoon food walk: neighborhood to explore with snacking
  - Dinner: mid-range restaurant that showcases {d['name']}'s best
  - Day 1 food budget: ~${d['budget'][0]+15}–${d['budget'][1]+10}
- Day 2: [Focus: Markets & Local Neighborhoods]  
  - Same structure but focused on food markets, local neighborhood eateries
  - Include a cooking class option (morning or afternoon)
- Day 3: [Focus: Splurge & Farewell Meal]
  - Mix of memorable experiences — fancy brunch, food hall, iconic landmark restaurant
  - Farewell dinner: the best meal of the trip
  - What to bring home (local food souvenirs)
- Food Budget Summary table (all 3 days at budget/mid/splurge levels)
- CTA: "*Build your custom {d['name']} food itinerary with [Faroway — free.](/)*"

Be specific. Name dish types, neighborhood names, market types. Make it feel like a real plan."""

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cluster", required=True, choices=["itinerary-3day","itinerary-5day","itinerary-7day","itinerary-10day","itinerary-weekend","comparisons","packing","checklist","getting-around","airport","food-guide","must-eat","foodie-itinerary"])
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--count", type=int, default=20)
    args = parser.parse_args()

    dests = load_dests()
    dest_map = {d['id']: d for d in dests}

    cluster_config = {
        "itinerary-3day":      ("itinerary-guides", "Guides", lambda d: (f"3-days-in-{d['id']}", f"3 Days in {d['name']}: The Perfect Weekend Itinerary", f"The perfect 3-day {d['name']} itinerary. Day-by-day breakdown with top sights, where to eat, and insider tips.", prompt_3day(d))),
        "itinerary-5day":      ("itinerary-guides", "Guides", lambda d: (f"5-days-in-{d['id']}", f"5 Days in {d['name']}: The Complete Itinerary", f"Plan the perfect 5 days in {d['name']} with this detailed itinerary — sights, food, transport, and budget.", prompt_5day(d))),
        "itinerary-7day":      ("itinerary-guides", "Guides", lambda d: (f"7-days-in-{d['id']}", f"7 Days in {d['name']}: The Ultimate Week Itinerary", f"The ultimate week in {d['name']} — 7-day itinerary with day trips, hidden gems, and full budget breakdown.", prompt_7day(d))),
        "itinerary-10day":     ("itinerary-guides", "Guides", lambda d: (f"10-days-in-{d['id']}", f"10 Days in {d['name']}: An In-Depth Exploration", f"Go beyond the highlights with this 10-day {d['name']} itinerary — deep dives into neighborhoods and day trips.", prompt_10day(d))),
        "itinerary-weekend":   ("itinerary-guides", "Guides", lambda d: (f"{d['id']}-weekend-itinerary", f"{d['name']} Weekend Itinerary: Make the Most of 48 Hours", f"48 hours in {d['name']}? This weekend itinerary gets you the essential experiences without wasting a minute.", prompt_weekend(d))),
        "packing":             ("travel-checklists", "Tips", lambda d: (f"{d['id']}-packing-list", f"{d['name']} Packing List: What to Pack for Your Trip", f"The complete {d['name']} packing list — climate-specific, culture-aware, with every essential for your trip.", prompt_packing(d))),
        "checklist":           ("travel-checklists", "Tips", lambda d: (f"{d['id']}-travel-checklist", f"{d['name']} Travel Checklist: Everything Before You Go", f"The complete {d['name']} travel checklist — visas, bookings, packing, and everything from 8 weeks out to arrival day.", prompt_checklist(d))),
        "getting-around":      ("travel-logistics", "Tips", lambda d: (f"getting-around-{d['id']}", f"Getting Around {d['name']}: Complete Transportation Guide", f"Everything you need to know about getting around {d['name']} — metro, taxi, bus, rideshare costs and tips.", prompt_getting_around(d))),
        "airport":             ("travel-logistics", "Tips", lambda d: (f"{d['id']}-airport-guide", f"{d['name']} Airport Guide: Getting to the City", f"How to get from {d['name']} airport to the city — transport options, costs, journey times, and arrival tips.", prompt_airport(d))),
        "food-guide":          ("food-travel", "Food", lambda d: (f"{d['id']}-food-guide", f"{d['name']} Food Guide: What to Eat, Where & How Much", f"The complete {d['name']} food guide — must-try dishes, best neighborhoods for food, and budget breakdowns.", prompt_food_guide(d))),
        "must-eat":            ("food-travel", "Food", lambda d: (f"must-eat-in-{d['id']}", f"Must-Eat Foods in {d['name']}: A Culinary Bucket List", f"Don't leave {d['name']} without eating these iconic dishes. A culinary bucket list for every traveler.", prompt_must_eat(d))),
        "foodie-itinerary":    ("food-travel", "Food", lambda d: (f"{d['id']}-foodie-itinerary", f"{d['name']} Foodie Itinerary: 3 Days of Eating Your Way Through {d['name']}", f"3-day {d['name']} food itinerary — markets, street food, local restaurants, and the best meals of your trip.", prompt_foodie_itinerary(d))),
    }

    if args.cluster == "comparisons":
        pairs_batch = COMPARISON_PAIRS[args.start:args.start + args.count]
        written, skipped, failed = 0, 0, 0
        for i, (id1, id2) in enumerate(pairs_batch):
            d1 = dest_map.get(id1) or {"id": id1, "name": id1.replace("-", " ").title(), "country": "Unknown", "tagline": "", "budget": [60,150,400], "attractions": [], "areas": [], "foods": [], "tips": [], "transport": [], "safety": [], "etiquette": [], "packing": [], "dayTrips": [], "hidden": [], "imgId": "photo-generic"}
            d2 = dest_map.get(id2) or {"id": id2, "name": id2.replace("-", " ").title(), "country": "Unknown", "tagline": "", "budget": [60,150,400], "attractions": [], "areas": [], "foods": [], "tips": [], "transport": [], "safety": [], "etiquette": [], "packing": [], "dayTrips": [], "hidden": [], "imgId": "photo-generic"}
            slug = f"{id1}-vs-{id2}"
            if slug_exists(slug):
                print(f"  SKIP  {slug}")
                skipped += 1
                continue
            print(f"  Writing: {slug}...")
            author = AUTHORS[(i + args.start) % len(AUTHORS)]
            n1, n2 = d1['name'], d2['name']
            wc = write_post(
                prompt_comparison(d1, d2), slug,
                f"{n1} vs {n2}: Which Should You Visit?",
                f"Comparing {n1} and {n2} — cost, food, nightlife, sights. Find out which city is right for your trip.",
                "Guides",
                [n1.lower(), n2.lower(), f"{n1} vs {n2}", "travel comparison", "which city to visit"],
                author, "destination-comparisons", d1.get('imgId', 'photo-generic')
            )
            if wc: written += 1; print(f"  ✓ {slug} ({wc} words)")
            else: failed += 1
            time.sleep(0.5)
        print(f"\nDone — written: {written}, skipped: {skipped}, failed: {failed}")
    else:
        cluster, category, post_fn = cluster_config[args.cluster]
        dest_batch = dests[args.start:args.start + args.count]
        written, skipped, failed = 0, 0, 0
        for i, d in enumerate(dest_batch):
            try:
                slug, title, description, prompt = post_fn(d)
            except Exception as e:
                print(f"  ERR building prompt for {d['id']}: {e}")
                failed += 1
                continue
            if slug_exists(slug):
                print(f"  SKIP  {slug}")
                skipped += 1
                continue
            print(f"  Writing: {slug}...")
            author = AUTHORS[(i + args.start) % len(AUTHORS)]
            tags = [d['name'], d['country'], args.cluster, "travel", d['name'].lower() + " guide"]
            wc = write_post(prompt, slug, title, description, category, tags, author, cluster, d.get('imgId', 'photo-generic'))
            if wc: written += 1; print(f"  ✓ {slug} ({wc} words)")
            else: failed += 1
            time.sleep(0.3)
        print(f"\nDone — written: {written}, skipped: {skipped}, failed: {failed}")
