import type { Destination } from './destinations';
import type { BlogEntry } from '../seed-500-blogs/templates';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateReadingTime(content: string): number {
  return Math.max(4, Math.ceil(content.split(/\s+/).length / 230));
}

function pick<T>(arr: T[], n: number): T[] {
  return arr.slice(0, Math.min(n, arr.length));
}

function rotateAuthor(i: number): string {
  const authors = ['alex-chen', 'maria-garcia', 'james-wilson', 'sofia-costa', 'omar-hassan', 'yuki-tanaka'];
  return authors[i % authors.length];
}

function faroway_cta(dest: Destination): string {
  return `\n\n---\n\n*Ready to customize this itinerary? [Use Faroway's AI planner](/) to build your perfect ${dest.name} trip in 60 seconds — free.*`;
}

function related_links(dest: Destination): string {
  return `\n\nFor more planning help, check out our guides on [the best time to visit ${dest.name}](/blog/best-time-to-visit-${dest.id}) and [where to stay in ${dest.name}](/blog/best-neighborhoods-${dest.id}). See all [${dest.name} travel info](/destinations/${dest.id}).`;
}

function budget_row(dest: Destination): string {
  const [budget, mid, lux] = dest.budget;
  return `| **Daily budget** | Budget: $${budget}/day · Mid: $${mid}/day · Luxury: $${lux}/day |`;
}

function quick_facts(dest: Destination): string {
  const [budget, mid, lux] = dest.budget;
  return `## Quick Facts

| | |
|---|---|
| **Country** | ${dest.country} |
| **Language** | ${dest.lang} |
| **Currency** | ${dest.currency} |
| **Best time to visit** | ${dest.bestTime} |
| **Climate** | ${dest.climate} |
${budget_row(dest)}
| **Peak season** | ${dest.peakSeason} |`;
}

// ---------------------------------------------------------------------------
// Template 1 — 3-Day Itinerary
// ---------------------------------------------------------------------------

export function template3DayItinerary(dest: Destination, idx = 0): BlogEntry {
  const slug = `3-days-in-${dest.id}`;
  const title = `3 Days in ${dest.name}: The Perfect Weekend Itinerary`;
  const description = `The perfect 3-day ${dest.name} itinerary. Day-by-day breakdown with top sights, where to stay, what to eat, and insider tips to make every hour count.`.slice(0, 160);

  const attractions = pick(dest.attractions, 6);
  const foods = pick(dest.foods, 3);
  const areas = pick(dest.areas, 3);
  const tips = pick(dest.tips, 3);
  const transport = pick(dest.transport, 2);

  const content = `# 3 Days in ${dest.name}: The Perfect Weekend Itinerary

${dest.tagline}. With just 72 hours, you need a plan that cuts through the noise and gets you to the best of ${dest.name} without wasting a single morning on logistics. This itinerary has been refined to give you the essential ${dest.name} experience — iconic sights, local food, and a few surprises.

${quick_facts(dest)}

---

## Day 1: Foundations — Iconic Landmarks & First Impressions

### Morning (8:00 AM – 12:00 PM)

Start your first morning at **${attractions[0]}**, one of ${dest.name}'s most celebrated landmarks. Arrive early (before 9 AM) to beat the crowds and get the best photos. This alone will take 1.5–2 hours if you explore properly.

From there, head to **${attractions[1] || attractions[0]}** (about 15–20 minutes away). This is the quintessential ${dest.name} sight — the kind that ends up on postcards. Budget another 1–1.5 hours.

**Morning fuel:** Start with breakfast at a local café near your hotel. In ${dest.name}, the standard morning meal runs $${dest.budget[0]}–$${Math.round(dest.budget[0] * 1.5)} per person.

### Afternoon (12:00 PM – 5:00 PM)

Lunch break: try **${foods[0]}** — a ${dest.name} specialty you'll find at any good local restaurant. Budget $${dest.budget[0]}–$${Math.round(dest.budget[0] * 2)} for a satisfying meal.

After lunch, explore the **${areas[0].split(' — ')[0]}** neighborhood. This is ${areas[0].split(' — ')[1] || 'one of the city\'s most interesting areas'}. Budget 2–3 hours for wandering, shopping, and soaking up the atmosphere.

**Afternoon highlight:** ${dest.photoSpots?.[0] || attractions[2] || 'the main viewpoint'} — ideal for the golden-hour shot.

### Evening (5:00 PM – 10:00 PM)

Head back to freshen up, then find a spot in the **${areas[1]?.split(' — ')[0] || areas[0].split(' — ')[0]}** area for dinner. This neighborhood is ${areas[1]?.split(' — ')[1] || 'the local dining hub'}. Try **${foods[1] || foods[0]}** at one of the neighborhood restaurants.

After dinner, explore the area on foot. ${dest.name} at night has a completely different energy — don't rush back to the hotel.

**Day 1 budget estimate:** $${dest.budget[0] * 3}–$${dest.budget[1] * 2} (budget–mid-range)

---

## Day 2: Go Deeper — Culture, Local Neighborhoods & Hidden Spots

### Morning (8:30 AM – 12:30 PM)

Today is about going deeper. Start at **${attractions[2] || attractions[0]}**, which is more authentic than yesterday's tourist-heavy spots. Arrive early, take your time. This is where you get the real sense of local life.

Follow up with a visit to **${dest.hidden?.[0] || attractions[3] || 'a lesser-known local favorite'}** — a spot most tourists miss entirely. It's worth the detour.

### Afternoon (12:30 PM – 6:00 PM)

Lunch at a spot in the **${areas[2]?.split(' — ')[0] || areas[0].split(' — ')[0]}** neighborhood. ${areas[2]?.split(' — ')[1] || 'This area has excellent local dining options'}.

Spend your afternoon at **${attractions[3] || attractions[1]}** and, if time allows, **${attractions[4] || attractions[0]}**. Both are in the same area and can be combined into a half-day loop.

**Culture tip:** ${tips[0]}

### Evening (6:00 PM – 11:00 PM)

Tonight, eat where locals actually eat. Find **${foods[2] || foods[0]}** at a neighborhood spot away from the main tourist drags — prices are typically 30–40% lower and quality is often better.

${dest.nightlife?.length ? `If you're up for it, ${dest.nightlife[0]} is the spot for the local nightlife scene.` : 'An after-dinner walk through the main square is a classic ending to the day.'}

**Day 2 budget estimate:** $${dest.budget[0] * 2.5}–$${dest.budget[1] * 1.8} (budget–mid-range)

---

## Day 3: Day Trip or Final Sweep

### Morning (8:00 AM – 1:00 PM)

Two options for your final morning:

**Option A — Day Trip:** Head to **${dest.dayTrips?.[0]?.split(' — ')[0] || 'a nearby attraction'}** for the morning. ${dest.dayTrips?.[0]?.split(' — ')[1] || 'A short trip from the city that\'s worth the journey'}. Leave by 8 AM to maximize time.

**Option B — Final Sweep:** Hit anything you missed: **${attractions[5] || attractions[0]}**, revisit a favorite neighborhood, or spend time at the local market.

### Afternoon (1:00 PM – 6:00 PM)

A long final lunch — this is your last chance to eat everything you haven't tried yet. ${dest.foods.slice(0, 4).join(', ')} — if you haven't had them all, today is the day.

Spend the rest of the afternoon doing last souvenir shopping in ${dest.shopping?.[0]?.split(' — ')[0] || areas[0].split(' — ')[0]}.

**Transport tip:** ${transport[0]}

---

## Where to Stay in ${dest.name}

| Budget | Area | Approx. Price/Night |
|--------|------|---------------------|
| 💰 Budget | ${areas[0].split(' — ')[0]} hostel or guesthouse | $${dest.budget[0]}–$${Math.round(dest.budget[0] * 1.8)}/night |
| 💰💰 Mid-range | ${areas[1]?.split(' — ')[0] || areas[0].split(' — ')[0]} boutique hotel | $${dest.budget[1] - 20}–$${dest.budget[1] + 40}/night |
| 💰💰💰 Luxury | ${areas[2]?.split(' — ')[0] || areas[0].split(' — ')[0]} premium hotel | $${dest.budget[2] - 50}+/night |

**Best area for first-timers:** ${areas[0].split(' — ')[0]} — ${areas[0].split(' — ')[1] || 'central and walkable'}.

---

## Getting Around

${transport.map(t => `- ${t}`).join('\n')}

**Pro tip:** ${tips[1] || tips[0]}

---

## What to Eat: ${dest.name} Food Essentials

Don't leave ${dest.name} without trying:

${dest.foods.slice(0, 5).map((f, i) => `${i + 1}. **${f.split(' — ')[0]}** — ${f.split(' — ')[1] || 'a local specialty worth seeking out'}`).join('\n')}

---

## Packing Tips for ${dest.name}

${dest.packing.map(p => `- ${p}`).join('\n')}

${related_links(dest)}
${faroway_cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Guides',
    tags: [dest.name, dest.country, `${dest.name} itinerary`, `${dest.name} travel guide`, '3 days', 'weekend trip', dest.continent, 'travel planning'],
    author_slug: rotateAuthor(idx),
    reading_time: estimateReadingTime(content),
    cover_image_alt: `${dest.name} travel itinerary — ${dest.tagline}`,
    cluster: 'itinerary-guides',
    imgId: dest.imgId,
  };
}

// ---------------------------------------------------------------------------
// Template 2 — 5-Day Itinerary
// ---------------------------------------------------------------------------

export function template5DayItinerary(dest: Destination, idx = 0): BlogEntry {
  const slug = `5-days-in-${dest.id}`;
  const title = `5 Days in ${dest.name}: The Ultimate First-Timer's Itinerary`;
  const description = `Everything you need for a perfect 5 days in ${dest.name}. Day-by-day plan covering top attractions, hidden gems, local food, and where to stay.`.slice(0, 160);

  const attractions = dest.attractions;
  const foods = dest.foods;
  const areas = dest.areas;
  const tips = dest.tips;

  const content = `# 5 Days in ${dest.name}: The Ultimate First-Timer's Itinerary

Five days is the sweet spot for ${dest.name}. Long enough to go deep on the highlights without rushing. Short enough that you won't run out of things to do. This itinerary balances iconic landmarks with local neighborhoods, day trips, and genuine cultural immersion.

${quick_facts(dest)}

---

## Day 1: Arrival & First Impressions

### Afternoon/Evening

Land, check in, decompress. Don't try to pack in too much on arrival day.

Your only mandatory task: walk to **${attractions[0]}** before dinner. Even a 30-minute first look will orient you and build anticipation for tomorrow. 

**Arrival dinner:** Eat near your hotel tonight. In ${areas[0].split(' — ')[0]}, you'll find plenty of options from casual street food ($${dest.budget[0]}/meal) to sit-down restaurants ($${dest.budget[1] - 20}/meal).

**Where to stay for 5 days:** Base yourself in **${areas[0].split(' — ')[0]}** — ${areas[0].split(' — ')[1] || 'the best base for exploring the city'}. Mid-range hotels here run $${dest.budget[1] - 20}–$${dest.budget[1] + 30}/night.

---

## Day 2: The Classic Circuit

### Morning
**${attractions[0]}** — This time, go deep. At least 2 hours. The lines are longest mid-morning, so get there at opening.

**${attractions[1]}** — 20–30 minutes from the first stop. Budget 1.5 hours.

### Afternoon
Lunch in the **${areas[1]?.split(' — ')[0] || areas[0].split(' — ')[0]}** area — ${areas[1]?.split(' — ')[1] || 'local dining hub'}.

**${attractions[2] || attractions[0]}** for the afternoon. Then drift through **${areas[2]?.split(' — ')[0] || areas[1]?.split(' — ')[0] || areas[0].split(' — ')[0]}** as the light fades.

### Evening
First proper dinner out — try **${foods[0]}**. The locals eat late in ${dest.name}, so don't rush.

**Tip:** ${tips[0]}

---

## Day 3: Neighborhoods & Local Life

Today, put down the map and explore. The following neighborhoods reward slow walking:

### ${areas[0].split(' — ')[0]}
${areas[0]} — budget a full morning here. Start at the main market or square and let it unfold.

### ${areas[1]?.split(' — ')[0] || 'The Old Town'}
${areas[1] || 'The historic old town with atmospheric streets and local cafés'}. Perfect for afternoon wandering, photo stops, and coffee breaks.

**Lunch:** Try **${foods[1] || foods[0]}** at a neighborhood spot. Budget $${dest.budget[0]}–$${Math.round(dest.budget[0] * 2)}.

### Evening: ${dest.romantic?.[0] || 'Dinner with a view'}
${dest.romantic?.[0] || 'Find a rooftop or viewpoint restaurant for dinner'} — one of the most memorable experiences in ${dest.name}.

---

## Day 4: Day Trip to ${dest.dayTrips?.[0]?.split(' — ')[0] || 'Nearby Highlight'}

This is your dedicated day-trip day. The best option from ${dest.name}:

**${dest.dayTrips?.[0]?.split(' — ')[0] || 'Nearby destination'}** — ${dest.dayTrips?.[0]?.split(' — ')[1] || 'well worth the journey'}

Leave by 8:30 AM to maximize time. Return by late afternoon so you're not exhausted for evening.

**Alternative options:**
${(dest.dayTrips || []).slice(1, 4).map(d => `- ${d}`).join('\n') || '- Explore more local neighborhoods'}

**Day-trip budget:** Add $${Math.round(dest.budget[0] * 2)}–$${dest.budget[1]} for transportation and entry fees.

---

## Day 5: Hidden Gems & Farewell

### Morning: Off the Tourist Trail
Skip the famous sights today. Instead:

- **${dest.hidden?.[0] || attractions[4] || 'A local favorite spot'}** — ${dest.hidden?.[0]?.split(' — ')?.[1] || 'most tourists miss this entirely'}
- **${dest.hidden?.[1] || dest.photoSpots?.[1] || 'Another hidden gem'}** — worth the detour

### Afternoon: Final Lap
Last shopping at **${dest.shopping?.[0]?.split(' — ')[0] || areas[0].split(' — ')[0]}**. Last food mission: anything on your list you haven't eaten yet.

${dest.foods.slice(0, 4).map(f => `- **${f.split(' — ')[0]}**`).join('\n')}

### Evening: Goodbye Dinner
Splurge a little on the final night. Go mid-range to luxury ($${dest.budget[1]}–$${dest.budget[2] - 50}/person). You've earned it.

---

## Where to Stay in ${dest.name} (5-Night Breakdown)

| Budget Level | Neighborhood | Price/Night | Why |
|---|---|---|---|
| Budget | ${areas[0].split(' — ')[0]} | $${dest.budget[0]}–$${Math.round(dest.budget[0] * 1.8)} | Most walkable, cheapest base |
| Mid-range | ${areas[1]?.split(' — ')[0] || areas[0].split(' — ')[0]} | $${dest.budget[1] - 20}–$${dest.budget[1] + 50} | Best balance of access and comfort |
| Luxury | ${areas[2]?.split(' — ')[0] || areas[0].split(' — ')[0]} | $${dest.budget[2] - 50}+ | Premium experience and service |

---

## ${dest.name} in 5 Days: What to Eat

These are the non-negotiables:

${foods.slice(0, 6).map((f, i) => `**${i + 1}. ${f.split(' — ')[0]}** — ${f.split(' — ')[1] || 'essential local dish'}`).join('\n\n')}

---

## Getting Around ${dest.name}

${dest.transport.map(t => `- ${t}`).join('\n')}

${tips.slice(0, 3).map(t => `> **Tip:** ${t}`).join('\n\n')}

${related_links(dest)}
${faroway_cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Guides',
    tags: [dest.name, dest.country, `${dest.name} itinerary`, `${dest.name} travel guide`, '5 days', 'first time', dest.continent, 'travel planning'],
    author_slug: rotateAuthor(idx + 1),
    reading_time: estimateReadingTime(content),
    cover_image_alt: `5 days in ${dest.name} — complete travel itinerary`,
    cluster: 'itinerary-guides',
    imgId: dest.imgId,
  };
}

// ---------------------------------------------------------------------------
// Template 3 — 7-Day Itinerary
// ---------------------------------------------------------------------------

export function template7DayItinerary(dest: Destination, idx = 0): BlogEntry {
  const slug = `7-days-in-${dest.id}`;
  const title = `7 Days in ${dest.name}: The Complete One-Week Itinerary`;
  const description = `The complete 7-day ${dest.name} itinerary. One full week covering every major sight, authentic local experiences, two day trips, and the best food.`.slice(0, 160);

  const attractions = dest.attractions;
  const foods = dest.foods;
  const areas = dest.areas;
  const tips = dest.tips;
  const dayTrips = dest.dayTrips || [];

  const content = `# 7 Days in ${dest.name}: The Complete One-Week Itinerary

A full week in ${dest.name} — the minimum time to do it justice. Seven days lets you see the highlights without rushing, take two day trips, eat your way through the food scene, and actually start to feel like you belong there.

${quick_facts(dest)}

**Total estimated budget for 7 days:**
- 🎒 Budget traveler: $${dest.budget[0] * 7 + 50}–$${dest.budget[0] * 7 + 150}
- 🏨 Mid-range: $${dest.budget[1] * 7}–$${dest.budget[1] * 7 + 200}
- ✨ Luxury: $${dest.budget[2] * 7}+

---

## Day 1: Arrival & Orientation

**Arrive, check in, walk around.** Don't overplan arrival day. Your one goal: orient yourself. Walk to the nearest main area, eat something local, sleep.

**First-night dinner:** ${foods[0]} — a quick, informal introduction to the local flavor.

---

## Day 2: The Big Sights

Hit the most famous sights while you have maximum energy:

**Morning:** ${attractions[0]} — be there at opening. Minimum 2 hours.
**Late morning:** ${attractions[1]} — 1–1.5 hours.
**Afternoon:** ${attractions[2] || attractions[0]} — 1.5 hours.
**Late afternoon:** Wander **${areas[0].split(' — ')[0]}** as the tourist crowds thin.
**Evening:** Dinner at a proper local restaurant — budget $${dest.budget[1] - 20}/person.

**Tip:** ${tips[0]}

---

## Day 3: Culture & Local Neighborhoods

**Morning:** ${areas[1]?.split(' — ')[0] || areas[0].split(' — ')[0]} — ${areas[1]?.split(' — ')[1] || 'the most atmospheric neighborhood'}.
**Lunch:** ${foods[1] || foods[0]} from a local spot.
**Afternoon:** ${attractions[3] || attractions[1]} and nearby **${dest.hidden?.[0]?.split(' — ')?.[0] || 'hidden gem'}**.
**Evening:** ${dest.nightlife?.[0] || 'A relaxed evening in a neighborhood bar or café'}.

---

## Day 4: Day Trip #1

**Destination:** ${dayTrips[0]?.split(' — ')[0] || 'Nearby attraction'}

${dayTrips[0] || 'Take a day trip to a nearby destination for a change of scenery.'}

Leave by 8:00 AM. Return by 6:00 PM. Dinner on arrival back — you'll be tired but satisfied.

---

## Day 5: Slow Day — Markets, Food, Wandering

No agenda today. Some ideas:

- Morning market at ${areas[2]?.split(' — ')[0] || areas[0].split(' — ')[0]}
- ${dest.family?.[0] || 'Museum or cultural institution'}
- Lunch at ${dest.shopping?.[0]?.split(' — ')[0] || 'local market food stalls'}
- ${dest.photoSpots?.[0]?.split(' ')?.[0] || 'Photography walk'} — golden hour photography
- ${dest.romantic?.[1] || 'Evening stroll through the most beautiful neighborhood'}

**Food mission:** Try everything you haven't eaten yet: ${foods.slice(2, 5).map(f => f.split(' — ')[0]).join(', ')}.

---

## Day 6: Day Trip #2

**Destination:** ${dayTrips[1]?.split(' — ')[0] || 'Second nearby destination'}

${dayTrips[1] || 'Second day trip option for variety.'}

${dayTrips[1]?.split(' — ')?.[1] || 'Worth the journey for a different perspective on the region.'}

---

## Day 7: Final Day — Hidden Gems & Goodbyes

**Morning:** Everything you missed. Prioritize:
${(dest.hidden || []).slice(0, 3).map(h => `- ${h}`).join('\n') || `- ${attractions[4] || attractions[0]}\n- ${dest.photoSpots?.[1] || 'Final photo spots'}`}

**Afternoon:** Final shopping at ${dest.shopping?.[0]?.split(' — ')[0] || areas[0].split(' — ')[0]}.

**Packing tip:** ${dest.packing?.[0] || 'Leave room in your luggage for local purchases.'}

**Farewell dinner:** Splurge tonight. You've had a week here — you know where to go.

---

## The Full 7-Day ${dest.name} Food Guide

| Day | Must-Try Dish | Where to Find It |
|-----|--------------|-----------------|
| Day 1 | ${foods[0]?.split(' — ')?.[0] || 'Local specialty'} | Near your hotel |
| Day 2 | ${foods[1]?.split(' — ')?.[0] || 'Restaurant'} | ${areas[0].split(' — ')[0]} |
| Day 3 | ${foods[2]?.split(' — ')?.[0] || 'Street food'} | Local market |
| Day 4 | Day-trip local food | At destination |
| Day 5 | ${foods[3]?.split(' — ')?.[0] || 'Neighborhood café'} | Market stalls |
| Day 6 | Day-trip specialty | At destination |
| Day 7 | ${foods[4]?.split(' — ')?.[0] || 'Farewell splurge'} | Best restaurant |

---

## Getting Around: All 7 Days

${dest.transport.map(t => `- ${t}`).join('\n')}

${related_links(dest)}
${faroway_cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Guides',
    tags: [dest.name, dest.country, `${dest.name} itinerary`, `${dest.name} travel guide`, '7 days', 'one week', dest.continent, 'travel planning'],
    author_slug: rotateAuthor(idx + 2),
    reading_time: estimateReadingTime(content),
    cover_image_alt: `7 days in ${dest.name} — one week travel itinerary`,
    cluster: 'itinerary-guides',
    imgId: dest.imgId,
  };
}

// ---------------------------------------------------------------------------
// Template 4 — 10-Day Itinerary
// ---------------------------------------------------------------------------

export function template10DayItinerary(dest: Destination, idx = 0): BlogEntry {
  const slug = `10-days-in-${dest.id}`;
  const title = `10 Days in ${dest.name}: The In-Depth Traveler's Itinerary`;
  const description = `10 days in ${dest.name}: complete itinerary for slow travelers who want to go beyond the highlights. Day-by-day breakdown, 3 day trips, local neighborhoods, and more.`.slice(0, 160);

  const content = `# 10 Days in ${dest.name}: The In-Depth Traveler's Itinerary

Ten days in ${dest.name} means you get everything: the classic sights, the neighborhood deep dives, three day trips, and enough time to slow down and actually feel the place. This is the itinerary for travelers who don't like to rush.

${quick_facts(dest)}

**10-day budget summary:**
- Budget: $${dest.budget[0] * 10 + 100}–$${dest.budget[0] * 10 + 250}
- Mid-range: $${dest.budget[1] * 10}–$${dest.budget[1] * 10 + 300}
- Luxury: $${dest.budget[2] * 10}+

---

## Days 1–2: Arrival & Classic Circuit

**Day 1:** Arrive, orient, easy evening.
**Day 2:** Hit the top three sights: ${dest.attractions.slice(0, 3).map(a => `**${a}**`).join(', ')}. These require full energy — do them first.

---

## Days 3–4: Neighborhood Deep Dives

Two days of slow neighborhood exploration:

**Day 3 — ${dest.areas[0]?.split(' — ')?.[0] || 'Historic Center'}:**
${dest.areas[0] || 'The historic heart of the city.'} Full morning walk, lunch at a local spot, afternoon museums or galleries.

**Day 4 — ${dest.areas[1]?.split(' — ')?.[0] || 'Local Quarter'}:**
${dest.areas[1] || 'A lesser-known but rewarding neighborhood.'} Morning market, afternoon wandering, evening at ${dest.nightlife?.[0] || 'a neighborhood bar'}.

---

## Day 5: Day Trip #1

**${dest.dayTrips?.[0]?.split(' — ')?.[0] || 'Nearby destination'}:** ${dest.dayTrips?.[0] || 'A short journey from the city.'}

---

## Days 6–7: Culture & Hidden Gems

**Day 6:** ${dest.attractions[3] || dest.attractions[1]}, followed by ${dest.hidden?.[0] || 'off-the-beaten-path exploration'}.

**Day 7:** Slow day. Farmer's market, cooking class, or ${dest.family?.[0] || 'local museum'}. The kind of day you can't plan — let it unfold.

---

## Day 8: Day Trip #2

**${dest.dayTrips?.[1]?.split(' — ')?.[0] || 'Second day trip'}:** ${dest.dayTrips?.[1] || 'Different scenery and pace.'}

---

## Days 9–10: Final Lap

**Day 9:** Return to your favorite spots. That neighborhood you loved. The restaurant you want to go back to. The walk you want to do one more time.

**Day 10:** Morning errands (last shopping at ${dest.shopping?.[0]?.split(' — ')?.[0] || 'local market'}), slow afternoon, memorable farewell dinner.

**Farewell dish:** Don't leave without one final plate of ${dest.foods?.[0]?.split(' — ')?.[0] || 'the local specialty'}.

---

## 10-Day Packing List for ${dest.name}

${dest.packing.map(p => `- [ ] ${p}`).join('\n')}
- [ ] Travel insurance documents
- [ ] Local currency for cash-only spots
- [ ] Portable phone charger

${related_links(dest)}
${faroway_cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Guides',
    tags: [dest.name, dest.country, `${dest.name} itinerary`, '10 days', 'extended trip', dest.continent, 'slow travel', 'travel planning'],
    author_slug: rotateAuthor(idx + 3),
    reading_time: estimateReadingTime(content),
    cover_image_alt: `10 days in ${dest.name} — extended travel itinerary`,
    cluster: 'itinerary-guides',
    imgId: dest.imgId,
  };
}

// ---------------------------------------------------------------------------
// Template 5 — Weekend Itinerary
// ---------------------------------------------------------------------------

export function templateWeekendItinerary(dest: Destination, idx = 0): BlogEntry {
  const slug = `${dest.id}-weekend-itinerary`;
  const title = `${dest.name} Weekend Itinerary: 48 Hours Done Right`;
  const description = `Only 48 hours in ${dest.name}? This weekend itinerary cuts straight to the best of the city. Top sights, best food, no wasted time.`.slice(0, 160);

  const attractions = pick(dest.attractions, 4);
  const foods = pick(dest.foods, 3);
  const areas = pick(dest.areas, 2);
  const tips = pick(dest.tips, 2);

  const content = `# ${dest.name} Weekend Itinerary: 48 Hours Done Right

A long weekend in ${dest.name} is absolutely doable — if you're ruthless with your planning. This 48-hour itinerary gets you the best of the city without trying to squeeze in everything. We've done the triage for you.

${quick_facts(dest)}

**Weekend budget estimate:**
- Budget: $${dest.budget[0] * 2 + 100}–$${dest.budget[0] * 2 + 200} (incl. transport)
- Mid-range: $${dest.budget[1] * 2 + 50}–$${dest.budget[1] * 2 + 200}
- Luxury: $${dest.budget[2] * 2}+

---

## Saturday: The Best of ${dest.name} in One Day

### Early Morning (8:00 AM)

Start at **${attractions[0]}** before the crowds arrive. This is the non-negotiable — the single sight that defines ${dest.name}. Budget 1.5–2 hours, get there early.

**Breakfast:** Grab something near ${attractions[0]} — look for local spots, not tourist cafés.

### Mid-Morning (10:30 AM)

**${attractions[1]}** — 30 minutes' walk or quick transit from the first stop. This is the second essential sight: plan 1–1.5 hours.

### Afternoon (1:00 PM)

**Lunch:** Try **${foods[0]}** — the most important local dish. Find it in **${areas[0].split(' — ')[0]}**, where locals eat it.

**${attractions[2] || attractions[0]}** (2:00–4:30 PM): The afternoon is for going deeper. This sight rewards more time than most tourists give it.

### Evening (5:30 PM)

Wander **${areas[1]?.split(' — ')[0] || areas[0].split(' — ')[0]}** — ${areas[1]?.split(' — ')?.[1] || 'the best neighborhood for evening atmosphere'}. Don't rush this.

**Saturday dinner:** Budget 2 hours. Try **${foods[1] || foods[0]}** at a proper sit-down restaurant. Splurge a little — it's a weekend.

${dest.nightlife?.length ? `**After dinner:** ${dest.nightlife[0]}` : '**After dinner:** An evening walk through the most photogenic neighborhood.'}

---

## Sunday: Hidden Gems & Farewell

### Morning (9:00 AM)

**${dest.hidden?.[0]?.split(' — ')?.[0] || attractions[3] || attractions[0]}** — ${dest.hidden?.[0] || 'the spot most weekend visitors miss'}.

**Sunday brunch:** ${foods[2] || foods[0]} somewhere local. Sundays in ${dest.name} are slower — lean into it.

### Afternoon (12:00 PM – 5:00 PM)

**Final priority list — pick two:**
${dest.attractions.slice(3, 6).map(a => `- [ ] ${a}`).join('\n') || `- [ ] ${attractions[3] || attractions[0]}\n- [ ] ${dest.photoSpots?.[1] || 'Photo walk'}`}

**${dest.photoSpots?.[0] || 'The best viewpoint'}** — if you haven't gotten the shot yet, this is your window.

**Last shopping:** **${dest.shopping?.[0]?.split(' — ')?.[0] || areas[0].split(' — ')[0]}** — 45 minutes max.

### Departure

**48-hour verdict:** You can't see everything in a weekend, and that's fine. What you *can* do is experience the heart of ${dest.name} — the sights, flavors, and street energy that make it worth coming back for more.

---

## Weekend Quick Tips

${tips.map(t => `- ${t}`).join('\n')}

- Book accommodation in **${areas[0].split(' — ')[0]}** for the best walkability
- Get your transport sorted before arrival (${dest.transport[0]})
- Make restaurant reservations for Saturday night dinner

${related_links(dest)}
${faroway_cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Guides',
    tags: [dest.name, dest.country, `${dest.name} weekend`, `${dest.name} 48 hours`, 'weekend trip', 'short trip', dest.continent, 'travel planning'],
    author_slug: rotateAuthor(idx + 4),
    reading_time: estimateReadingTime(content),
    cover_image_alt: `${dest.name} weekend itinerary — 48 hours in the city`,
    cluster: 'itinerary-guides',
    imgId: dest.imgId,
  };
}
