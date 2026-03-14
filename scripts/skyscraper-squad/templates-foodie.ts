import type { Destination } from './destinations';
import type { BlogEntry } from '../seed-500-blogs/templates';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateReadingTime(content: string): number {
  return Math.max(3, Math.ceil(content.split(/\s+/).length / 230));
}

function rotateAuthor(i: number): string {
  const authors = ['alex-chen', 'maria-garcia', 'james-wilson', 'sofia-costa', 'omar-hassan', 'yuki-tanaka'];
  return authors[i % authors.length];
}

function faroway_cta(dest: Destination): string {
  return `\n\n---\n\n*Planning a food-focused trip to ${dest.name}? [Use Faroway's AI planner](/) to build a custom itinerary with the best restaurants and markets — free.*`;
}

function pick<T>(arr: T[], n: number): T[] {
  return arr.slice(0, Math.min(n, arr.length));
}

// ---------------------------------------------------------------------------
// Template 1 — Food Guide
// ---------------------------------------------------------------------------

export function templateFoodGuide(dest: Destination, idx = 0): BlogEntry {
  const slug = `${dest.id}-food-guide`;
  const title = `${dest.name} Food Guide: What to Eat & Where to Find It`;
  const description = `Complete ${dest.name} food guide. Essential dishes, best neighborhoods, local markets, and restaurant recommendations from budget to splurge.`.slice(0, 160);

  const foods = dest.foods;
  const areas = dest.areas;
  const tips = dest.tips;

  const content = `# ${dest.name} Food Guide: What to Eat & Where to Find It

The food in ${dest.name} is ${foods.length >= 6 ? 'world-class' : 'excellent'} — ${dest.tagline.toLowerCase()}. But knowing *what* to eat and *where* to find it makes the difference between a good trip and an unforgettable one.

This guide covers the essential dishes, the best neighborhoods for eating, budget vs. splurge recommendations, and how to avoid tourist traps.

---

## The Essential ${dest.name} Dishes

Don't leave ${dest.name} without eating these:

${foods.slice(0, 6).map((f, i) => {
  const parts = f.split(' — ');
  const dish = parts[0];
  const desc = parts[1] || 'a local specialty';
  return `### ${i + 1}. ${dish}

${desc.charAt(0).toUpperCase() + desc.slice(1)}. This is the dish you'll remember five years from now.

**Where to find it:** ${areas[i % areas.length]?.split(' — ')?.[0] || 'Local restaurants and markets'}
**Price range:** $${Math.round(dest.budget[0] * (0.5 + i * 0.1))}–$${Math.round(dest.budget[1] * (0.4 + i * 0.15))}
**Best time:** ${i % 3 === 0 ? 'Breakfast' : i % 3 === 1 ? 'Lunch' : 'Dinner'}`;
}).join('\n\n')}

---

## Best Neighborhoods for Food

### ${areas[0]?.split(' — ')?.[0] || 'Historic Center'}

${areas[0]?.split(' — ')?.[1] || 'The heart of the local food scene.'}

**Eat here for:** ${foods[0]?.split(' — ')?.[0] || 'Traditional dishes'}, ${foods[1]?.split(' — ')?.[0] || 'local specialties'}

**Budget:** $${dest.budget[0]}–$${dest.budget[1]}/meal

**Recommended spots:**
${foods.slice(0, 2).map(f => `- **${f.split(' — ')[0]}** at any local restaurant`).join('\n')}

**Vibe:** ${Math.random() > 0.5 ? 'Tourist-friendly but still authentic' : 'Mix of locals and tourists — good quality'}

---

### ${areas[1]?.split(' — ')?.[0] || 'Local Quarter'}

${areas[1]?.split(' — ')?.[1] || 'Where locals actually eat.'}

**Eat here for:** ${foods[2]?.split(' — ')?.[0] || 'Street food'}, ${foods[3]?.split(' — ')?.[0] || 'casual dining'}

**Budget:** $${Math.round(dest.budget[0] * 0.7)}–$${dest.budget[0]}/meal

**Recommended spots:**
${foods.slice(2, 4).map(f => `- Try **${f.split(' — ')[0]}** from street vendors`).join('\n')}

**Vibe:** Authentic, fewer English menus, better prices

---

${areas.length >= 3 ? `### ${areas[2]?.split(' — ')?.[0] || 'Upscale District'}

${areas[2]?.split(' — ')?.[1] || 'For special occasion dinners.'}

**Eat here for:** Upscale versions of ${foods[0]?.split(' — ')?.[0] || 'local classics'}, fusion cuisine

**Budget:** $${dest.budget[1]}–$${dest.budget[2]}/meal

**Vibe:** Date night, celebrations, expense-account dining

---` : ''}

## Budget vs. Splurge: Where to Spend

### Budget Eats (Under $${dest.budget[0]}/meal)

**Street food:** ${foods.find(f => f.toLowerCase().includes('street') || f.toLowerCase().includes('stall')) || foods[0]} from vendors in ${areas[0]?.split(' — ')?.[0] || 'main markets'}

**Local markets:** ${dest.shopping?.find(s => s.toLowerCase().includes('market')) || areas[0] + ' market'} — food stalls with $${Math.round(dest.budget[0] * 0.3)}–$${Math.round(dest.budget[0] * 0.6)} meals

**Chain restaurants:** ${Math.random() > 0.5 ? 'Avoid international chains — local chains are better and cheaper' : 'Local fast-food chains offer good value'}

**Best for:** Breakfast, lunch, backpackers, solo travelers

---

### Mid-Range ($${dest.budget[0]}–$${dest.budget[1]}/meal)

**Neighborhood restaurants:** ${areas[1]?.split(' — ')?.[0] || 'Local dining areas'} — sit-down meals with full service

**Cafés:** ${areas.find(a => a.toLowerCase().includes('café') || a.toLowerCase().includes('coffee')) || areas[0]} — great for ${foods.find(f => f.toLowerCase().includes('coffee') || f.toLowerCase().includes('tea')) || 'lunch and coffee'}

**Best for:** Dinner, couples, comfortable dining

---

### Splurge ($${dest.budget[1]}–$${dest.budget[2]}+/meal)

${dest.romantic?.length || areas.some(a => a.toLowerCase().includes('upscale')) ? `**Fine dining:** ${areas[2]?.split(' — ')?.[0] || areas[0]?.split(' — ')?.[0]} — tasting menus and chef-driven restaurants` : `**Upscale restaurants:** Top-rated spots in ${areas[0]?.split(' — ')?.[0] || 'downtown'}`}

**Signature experiences:** ${dest.romantic?.[0] || foods[0]} at a rooftop restaurant with views

**Best for:** Special occasions, anniversaries, once-in-a-trip experiences

---

## What to Drink in ${dest.name}

${foods.some(f => f.toLowerCase().includes('coffee') || f.toLowerCase().includes('tea')) ? `**${foods.find(f => f.toLowerCase().includes('coffee') || f.toLowerCase().includes('tea'))?.split(' — ')?.[0] || 'Local coffee'}** — ${foods.find(f => f.toLowerCase().includes('coffee') || f.toLowerCase().includes('tea'))?.split(' — ')?.[1] || 'a must-try'}` : `**Local specialty drinks** — ask for recommendations at cafés`}

${foods.some(f => f.toLowerCase().includes('beer') || f.toLowerCase().includes('wine')) ? `**${foods.find(f => f.toLowerCase().includes('beer') || f.toLowerCase().includes('wine'))?.split(' — ')?.[0] || 'Local beer'}** — ${foods.find(f => f.toLowerCase().includes('beer') || f.toLowerCase().includes('wine'))?.split(' — ')?.[1] || 'pairs perfectly with local food'}` : `**Local beverages** — explore the drink menu`}

${tips.find(t => t.toLowerCase().includes('drink') || t.toLowerCase().includes('water')) ? `> **Tip:** ${tips.find(t => t.toLowerCase().includes('drink') || t.toLowerCase().includes('water'))}` : '> **Tip:** Tap water is generally safe but bottled is widely available'}

---

## Food Etiquette in ${dest.name}

${dest.etiquette.slice(0, 3).map(e => `- ${e}`).join('\n')}
${dest.etiquette.some(e => e.toLowerCase().includes('tip')) ? '' : `- Tipping: ${Math.random() > 0.5 ? `${Math.floor(Math.random() * 10 + 10)}% is standard` : 'Not expected but appreciated for good service'}`}

---

## Avoiding Tourist Traps

**Red flags:**
- Photo menus outside with pictures of every dish
- Staff aggressively trying to pull you inside
- Menus in 10+ languages
- Prices significantly higher than surrounding restaurants

**How to find good local spots:**
- Look for restaurants full of locals (not other tourists)
- Ask your hotel or Airbnb host for recommendations
- Venture 2–3 blocks off the main tourist streets
- Use Google Maps ratings but read the reviews (watch for fake reviews)

${tips.find(t => t.toLowerCase().includes('food') || t.toLowerCase().includes('eat')) ? `> **Local tip:** ${tips.find(t => t.toLowerCase().includes('food') || t.toLowerCase().includes('eat'))}` : ''}

---

## Weekly Food Budget for ${dest.name}

| Budget Level | Breakfast | Lunch | Dinner | Snacks/Drinks | Daily Total | Weekly Total |
|--------------|-----------|-------|--------|---------------|-------------|--------------|
| Budget | $${Math.round(dest.budget[0] * 0.15)} | $${Math.round(dest.budget[0] * 0.25)} | $${Math.round(dest.budget[0] * 0.35)} | $${Math.round(dest.budget[0] * 0.1)} | $${Math.round(dest.budget[0] * 0.85)} | $${Math.round(dest.budget[0] * 0.85 * 7)} |
| Mid-range | $${Math.round(dest.budget[1] * 0.12)} | $${Math.round(dest.budget[1] * 0.22)} | $${Math.round(dest.budget[1] * 0.32)} | $${Math.round(dest.budget[1] * 0.08)} | $${Math.round(dest.budget[1] * 0.74)} | $${Math.round(dest.budget[1] * 0.74 * 7)} |
| Luxury | $${Math.round(dest.budget[2] * 0.1)} | $${Math.round(dest.budget[2] * 0.18)} | $${Math.round(dest.budget[2] * 0.28)} | $${Math.round(dest.budget[2] * 0.06)} | $${Math.round(dest.budget[2] * 0.62)} | $${Math.round(dest.budget[2] * 0.62 * 7)} |

${faroway_cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Food',
    tags: [dest.name, `${dest.name} food`, 'food guide', dest.country, 'local cuisine', 'restaurants', 'what to eat'],
    author_slug: rotateAuthor(idx),
    reading_time: estimateReadingTime(content),
    cover_image_alt: `${dest.name} food guide — what to eat and where to find it`,
    cluster: 'food-travel',
    imgId: dest.imgId,
  };
}

// ---------------------------------------------------------------------------
// Template 2 — Must-Eat Dishes
// ---------------------------------------------------------------------------

export function templateMustEat(dest: Destination, idx = 0): BlogEntry {
  const slug = `must-eat-in-${dest.id}`;
  const title = `10 Must-Eat Dishes in ${dest.name} (And Where to Find Them)`;
  const description = `The 10 essential ${dest.name} dishes you can't miss. Local specialties, where to eat them, and what makes each one special.`.slice(0, 160);

  const foods = dest.foods;
  const areas = dest.areas;

  const content = `# 10 Must-Eat Dishes in ${dest.name} (And Where to Find Them)

Food is half the reason to visit ${dest.name}. Maybe more than half.

These are the 10 dishes that define the ${dest.name} food scene — the ones locals grew up eating, the ones you'll crave long after you're home. We tell you exactly what they are, where to find them, and how to order them like you know what you're doing.

---

${foods.slice(0, 10).map((f, i) => {
  const parts = f.split(' — ');
  const dish = parts[0];
  const desc = parts[1] || 'a beloved local dish';
  const area = areas[i % areas.length]?.split(' — ')?.[0] || 'local restaurants';
  return `## ${i + 1}. ${dish}

${desc.charAt(0).toUpperCase() + desc.slice(1)}.

**What it is:** ${Math.random() > 0.5 ? `A ${dest.name} classic` : 'Essential local specialty'}${i < 3 ? ' — one of the most iconic dishes in the city' : ''}

**Where to find it:** ${area}
**Price:** $${Math.round(dest.budget[0] * (0.4 + i * 0.12))}–$${Math.round(dest.budget[1] * (0.3 + i * 0.1))}
**When to eat it:** ${i % 4 === 0 ? 'Breakfast' : i % 4 === 1 ? 'Lunch' : i % 4 === 2 ? 'Dinner' : 'Anytime'}

**How to order:** ${i % 3 === 0 ? `Just point and say "${dish}" — everyone will know what you mean` : i % 3 === 1 ? `Ask for the chef's recommendation on preparation style` : `Order with confidence — it's on every menu in ${area}`}

---`;
}).join('\n')}

## Bonus: ${foods.length > 10 ? foods[10]?.split(' — ')?.[0] || 'Street Food' : 'Local Desserts'}

${foods.length > 10 ? `${foods[10]} — ${Math.random() > 0.5 ? 'not as famous but equally delicious' : 'a hidden gem worth seeking out'}.` : `Don't skip dessert in ${dest.name}. The sweet treats are as memorable as the savory dishes.`}

---

## Food Tour Route: Hit All 10 in 3 Days

### Day 1: The Classics
- Breakfast: ${foods[0]?.split(' — ')?.[0] || 'Local breakfast specialty'}
- Lunch: ${foods[1]?.split(' — ')?.[0] || 'Lunch dish'}
- Dinner: ${foods[2]?.split(' — ')?.[0] || 'Dinner dish'}

### Day 2: Street Food & Markets
- Morning: ${areas[0]?.split(' — ')?.[0] || 'Main market'} for ${foods[3]?.split(' — ')?.[0] || 'street food'}
- Afternoon: ${foods[4]?.split(' — ')?.[0] || 'Snack'} from a street vendor
- Evening: ${foods[5]?.split(' — ')?.[0] || 'Dinner'}

### Day 3: Splurge & Explore
- Brunch: ${foods[6]?.split(' — ')?.[0] || 'Late breakfast'}
- Afternoon: ${foods[7]?.split(' — ')?.[0] || 'Light lunch'}
- Farewell dinner: ${foods[8]?.split(' — ')?.[0] || 'Final meal'} at a top-rated restaurant

${faroway_cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Food',
    tags: [dest.name, `${dest.name} food`, 'must-eat', 'local dishes', dest.country, 'food bucket list'],
    author_slug: rotateAuthor(idx + 1),
    reading_time: estimateReadingTime(content),
    cover_image_alt: `Must-eat dishes in ${dest.name} — complete food bucket list`,
    cluster: 'food-travel',
    imgId: dest.imgId,
  };
}

// ---------------------------------------------------------------------------
// Template 3 — Foodie Itinerary
// ---------------------------------------------------------------------------

export function templateFoodieItinerary(dest: Destination, idx = 0): BlogEntry {
  const slug = `${dest.id}-foodie-itinerary`;
  const title = `${dest.name} Foodie Itinerary: 3 Days of Eating Your Way Through the City`;
  const description = `The ultimate ${dest.name} food tour itinerary. 3 days of markets, street food, local restaurants, and the best meals of your life.`.slice(0, 160);

  const foods = dest.foods;
  const areas = dest.areas;
  const tips = dest.tips;

  const content = `# ${dest.name} Foodie Itinerary: 3 Days of Eating Your Way Through the City

If you're visiting ${dest.name} primarily for the food (smart choice), this itinerary is for you.

Three days. Every meal planned. Markets, street food, sit-down restaurants, and one splurge dinner. By the end, you'll have eaten the essential ${dest.name} dishes and discovered why this city's food scene is legendary.

---

## Day 1: The Essentials

### Breakfast (8:00 AM) — ${areas[0]?.split(' — ')?.[0] || 'Local Market'}

Start at the **${areas[0]?.split(' — ')?.[0] || 'main market'}** when it opens. The morning energy is unmatched.

**What to eat:** ${foods[0]?.split(' — ')?.[0] || 'Breakfast specialty'} — ${foods[0]?.split(' — ')?.[1] || 'the classic morning dish'}

**Where:** Market food stalls or a nearby café
**Budget:** $${Math.round(dest.budget[0] * 0.2)}–$${Math.round(dest.budget[0] * 0.35)}

### Mid-Morning Snack (10:30 AM)

Walk through **${areas[1]?.split(' — ')?.[0] || 'the old town'}** and try ${foods[1]?.split(' — ')?.[0] || 'a local snack'} from a street vendor.

**Budget:** $${Math.round(dest.budget[0] * 0.15)}

### Lunch (1:00 PM) — Sit-Down Restaurant

**${foods[2]?.split(' — ')?.[0] || 'Lunch dish'}** at a neighborhood restaurant in **${areas[0]?.split(' — ')?.[0] || 'downtown'}**.

${foods[2]?.split(' — ')?.[1] || 'This is the dish everyone talks about.'}

**Budget:** $${Math.round(dest.budget[0] * 0.5)}–$${dest.budget[0]}

### Afternoon Break (4:00 PM)

${foods.find(f => f.toLowerCase().includes('coffee') || f.toLowerCase().includes('tea'))?.split(' — ')?.[0] || 'Coffee'} at a local café. People-watch. Decompress.

### Dinner (7:30 PM) — The First Big Meal

**${foods[3]?.split(' — ')?.[0] || 'Dinner dish'}** at a well-reviewed restaurant.

${areas[2]?.split(' — ')?.[0] || areas[0]?.split(' — ')?.[0]} has excellent options. Book ahead if it's a weekend.

**Budget:** $${dest.budget[1]}–$${Math.round(dest.budget[1] * 1.5)}

**Day 1 food budget:** $${Math.round(dest.budget[0] * 0.2 + dest.budget[0] * 0.15 + dest.budget[0] + dest.budget[0] * 0.1 + dest.budget[1] * 1.2)}

---

## Day 2: Markets & Street Food

### Breakfast (8:30 AM) — Street Food Tour

Hit **${areas[1]?.split(' — ')?.[0] || 'the local market'}** for a proper street food breakfast.

**Try:**
- ${foods[4]?.split(' — ')?.[0] || 'Street breakfast item'}
- ${foods[5]?.split(' — ')?.[0] || 'Second breakfast item'}

Eat standing at the stall like a local.

**Budget:** $${Math.round(dest.budget[0] * 0.25)}

### Lunch (1:30 PM) — Food Market

Spend the afternoon at **${dest.shopping?.find(s => s.toLowerCase().includes('market'))?.split(' — ')?.[0] || areas[0]?.split(' — ')?.[0] + ' market'}** grazing.

**What to try:**
${foods.slice(6, 9).map(f => `- ${f.split(' — ')[0]}`).join('\n')}

This is not a sit-down meal. This is a 2-hour wander-and-eat marathon.

**Budget:** $${Math.round(dest.budget[0] * 1.2)}

### Dinner (7:00 PM) — Neighborhood Favorite

Tonight, eat where locals eat. **${areas[1]?.split(' — ')?.[0] || 'A quieter neighborhood'}** — no tourists, just good food.

Order **${foods[2]?.split(' — ')?.[0] || 'the house specialty'}** and whatever the waiter recommends.

**Budget:** $${Math.round(dest.budget[0] * 0.8)}–$${dest.budget[1]}

**Day 2 food budget:** $${Math.round(dest.budget[0] * 0.25 + dest.budget[0] * 1.2 + dest.budget[1])}

---

## Day 3: Splurge Day

### Brunch (10:00 AM) — Slow Start

Sleep in. Find a café in **${areas[2]?.split(' — ')?.[0] || areas[0]?.split(' — ')?.[0]}** known for weekend brunch.

**Order:** ${foods[0]?.split(' — ')?.[0] || 'Brunch specialty'} and the best ${foods.find(f => f.toLowerCase().includes('coffee'))?.split(' — ')?.[0] || 'coffee'} in ${dest.name}

**Budget:** $${Math.round(dest.budget[1] * 0.4)}–$${Math.round(dest.budget[1] * 0.6)}

### Afternoon Snack (3:00 PM)

One last street food mission: ${foods.find(f => !foods.slice(0, 8).includes(f))?.split(' — ')?.[0] || foods[9]?.split(' — ')?.[0] || 'a final local snack'}.

### Farewell Dinner (8:00 PM) — The Splurge

Your last night in ${dest.name}. Go all-in.

**Where:** ${dest.romantic?.[0]?.includes('dinner') ? dest.romantic[0].split('at ')?.[1] || areas[2]?.split(' — ')?.[0] || 'Top-rated restaurant' : areas[2]?.split(' — ')?.[0] || 'Best restaurant in the city'}

**Order:** ${foods[0]?.split(' — ')?.[0] || 'Signature dish'}, ${foods[1]?.split(' — ')?.[0] || 'another favorite'}, and whatever the chef recommends.

This is a 2+ hour meal. Savor it.

**Budget:** $${dest.budget[2] * 0.6}–$${dest.budget[2]}

**Day 3 food budget:** $${Math.round(dest.budget[1] * 0.5 + dest.budget[0] * 0.2 + dest.budget[2] * 0.8)}

---

## Total 3-Day Foodie Budget

- **Budget traveler:** $${Math.round((dest.budget[0] * 2.5 + dest.budget[1] * 0.5) * 3)}
- **Mid-range:** $${Math.round((dest.budget[1] * 1.5 + dest.budget[0] * 0.5) * 3)}
- **Splurge:** $${Math.round((dest.budget[2] * 0.8 + dest.budget[1] * 0.5) * 3)}

---

## Bonus Tips for Food-Focused Travel

${tips.slice(0, 3).map(t => `- ${t}`).join('\n')}
- Book splurge restaurants 1–2 weeks ahead
- Carry cash — many street vendors don't accept cards
- Pace yourself — ${dest.name} food is rich

${faroway_cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Food',
    tags: [dest.name, `${dest.name} food`, 'food itinerary', 'foodie travel', dest.country, 'food tour', 'culinary travel'],
    author_slug: rotateAuthor(idx + 2),
    reading_time: estimateReadingTime(content),
    cover_image_alt: `${dest.name} foodie itinerary — 3-day food tour`,
    cluster: 'food-travel',
    imgId: dest.imgId,
  };
}
