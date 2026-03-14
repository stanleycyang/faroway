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

function faroway_cta(dest1: Destination, dest2: Destination): string {
  return `\n\n---\n\n*Ready to plan your trip? [Use Faroway's AI planner](/) to build the perfect itinerary for either ${dest1.name} or ${dest2.name} in 60 seconds — free.*`;
}

// ---------------------------------------------------------------------------
// Template 1 — City vs City
// ---------------------------------------------------------------------------

export function templateCityVsCity(dest1: Destination, dest2: Destination, idx = 0): BlogEntry {
  const slug = `${dest1.id}-vs-${dest2.id}`;
  const title = `${dest1.name} vs ${dest2.name}: Which City Should You Visit?`;
  const description = `${dest1.name} vs ${dest2.name} — we compare cost, vibe, food, sights, and more to help you decide which city deserves your next trip.`.slice(0, 160);

  const content = `# ${dest1.name} vs ${dest2.name}: Which City Should You Visit?

The eternal debate: **${dest1.name}** or **${dest2.name}**?

Both cities are incredible. Both belong on your bucket list. But if you only have time (or budget) for one trip right now, you need to make a choice. This guide breaks down the real differences — cost, vibe, food, sights, nightlife — so you can pick the city that fits *your* travel style.

---

## The Quick Comparison

| Factor | ${dest1.name} | ${dest2.name} |
|--------|${'-'.repeat(dest1.name.length)}|${'-'.repeat(dest2.name.length)}|
| **Daily budget** | $${dest1.budget[0]}–$${dest1.budget[1]} | $${dest2.budget[0]}–$${dest2.budget[1]} |
| **Vibe** | ${dest1.tagline} | ${dest2.tagline} |
| **Language** | ${dest1.lang} | ${dest2.lang} |
| **Best time** | ${dest1.bestTime} | ${dest2.bestTime} |
| **Climate** | ${dest1.climate} | ${dest2.climate} |
| **Food scene** | ${dest1.foods[0]?.split(' — ')?.[0] || 'Local cuisine'} | ${dest2.foods[0]?.split(' — ')?.[0] || 'Local cuisine'} |
| **Top sight** | ${dest1.attractions[0]} | ${dest2.attractions[0]} |
| **Nightlife** | ${dest1.nightlife?.[0] ? 'Strong' : 'Moderate'} | ${dest2.nightlife?.[0] ? 'Strong' : 'Moderate'} |
| **Walkability** | ${dest1.transport[0]?.includes('walk') ? 'Excellent' : 'Good'} | ${dest2.transport[0]?.includes('walk') ? 'Excellent' : 'Good'} |

---

## Cost: Which City is Cheaper?

**${dest1.name}** runs about **$${dest1.budget[0]}–$${dest1.budget[1]}/day** for a mid-range traveler. That covers:
- Accommodation in ${dest1.areas[0]?.split(' — ')?.[0] || 'a central area'}
- Two restaurant meals and street food
- Public transport or local taxis
- Entry fees to major attractions

**${dest2.name}** is ${dest2.budget[0] < dest1.budget[0] ? 'cheaper' : dest2.budget[0] > dest1.budget[0] ? 'more expensive' : 'about the same price'}, averaging **$${dest2.budget[0]}–$${dest2.budget[1]}/day**. ${dest2.budget[0] < dest1.budget[0] ? `You'll save on accommodation and food, which are noticeably cheaper than ${dest1.name}.` : dest2.budget[0] > dest1.budget[0] ? `Expect to pay more for hotels, restaurants, and even public transport.` : `Daily costs are nearly identical, so budget isn't the deciding factor.`}

**Winner:** ${dest1.budget[0] < dest2.budget[0] ? dest1.name : dest2.budget[0] < dest1.budget[0] ? dest2.name : 'Tie — both cost about the same'}

---

## Vibe: What's the Energy?

**${dest1.name}** is ${dest1.tagline.toLowerCase()}. The atmosphere is ${dest1.climate.includes('hot') || dest1.climate.includes('tropical') ? 'laid-back and warm' : dest1.climate.includes('cold') ? 'energetic with a winter edge' : 'balanced and welcoming'}. Expect ${dest1.areas[0]?.split(' — ')?.[1] || 'diverse neighborhoods with distinct personalities'}.

**${dest2.name}** is ${dest2.tagline.toLowerCase()}. ${dest2.climate.includes('hot') || dest2.climate.includes('tropical') ? 'The heat shapes everything — slower mornings, late dinners, a rhythm dictated by the sun.' : dest2.climate.includes('cold') ? 'Cold weather creates a cozier, indoor-focused culture.' : 'The moderate climate means the city is active year-round.'} ${dest2.areas[0]?.split(' — ')?.[1] || 'Neighborhoods have their own character.'} 

**Who should pick ${dest1.name}:** Travelers who want ${dest1.romantic?.[0] ? 'romance and atmosphere' : dest1.family?.[0] ? 'family-friendly activities' : dest1.nightlife?.[0] ? 'nightlife and energy' : 'authentic local culture'}.

**Who should pick ${dest2.name}:** Travelers who want ${dest2.romantic?.[0] ? 'romance and atmosphere' : dest2.family?.[0] ? 'family-friendly activities' : dest2.nightlife?.[0] ? 'nightlife and energy' : 'authentic local culture'}.

---

## Food: Where's the Better Dining Scene?

### ${dest1.name} Food Highlights

${dest1.foods.slice(0, 3).map(f => `- **${f.split(' — ')[0]}** — ${f.split(' — ')[1] || 'a local favorite'}`).join('\n')}

The food scene in ${dest1.name} is ${dest1.foods.length > 5 ? 'world-class' : 'excellent'} — you could eat well for a week and never repeat a dish.

### ${dest2.name} Food Highlights

${dest2.foods.slice(0, 3).map(f => `- **${f.split(' — ')[0]}** — ${f.split(' — ')[1] || 'a local favorite'}`).join('\n')}

${dest2.name}'s food culture is ${dest2.foods.length > 5 ? 'deeply rooted and internationally recognized' : 'strong and worth the trip alone'}.

**Winner:** ${dest1.foods.length > dest2.foods.length ? dest1.name : dest2.foods.length > dest1.foods.length ? dest2.name : 'Tie — both have incredible food scenes'}

---

## Sights: Which Has Better Attractions?

### ${dest1.name} Top Sights

${dest1.attractions.slice(0, 4).map(a => `- ${a}`).join('\n')}

${dest1.name} has ${dest1.attractions.length >= 6 ? 'enough sights to fill a full week' : 'the essential sights you can cover in 3–5 days'}.

### ${dest2.name} Top Sights

${dest2.attractions.slice(0, 4).map(a => `- ${a}`).join('\n')}

${dest2.name} is ${dest2.attractions.length >= 6 ? 'packed with world-famous landmarks' : 'more compact but still rewarding'}.

**Winner:** ${dest1.attractions.length > dest2.attractions.length ? dest1.name : dest2.attractions.length > dest1.attractions.length ? dest2.name : 'Tie — both have excellent sights'}

---

## Day Trips: Which Has Better Surroundings?

**From ${dest1.name}:**
${(dest1.dayTrips || []).slice(0, 3).map(d => `- ${d}`).join('\n') || '- Limited day-trip options'}

**From ${dest2.name}:**
${(dest2.dayTrips || []).slice(0, 3).map(d => `- ${d}`).join('\n') || '- Limited day-trip options'}

**Winner:** ${(dest1.dayTrips || []).length > (dest2.dayTrips || []).length ? dest1.name : (dest2.dayTrips || []).length > (dest1.dayTrips || []).length ? dest2.name : 'Tie'}

---

## Nightlife: Where's the Better After-Dark Scene?

**${dest1.name}:** ${dest1.nightlife?.[0] || 'Quieter nightlife scene — more cafés and local bars than clubs.'}

**${dest2.name}:** ${dest2.nightlife?.[0] || 'Relaxed evening culture — think dinner and walking, not all-night parties.'}

**Winner:** ${dest1.nightlife?.length > dest2.nightlife?.length ? dest1.name : dest2.nightlife?.length > dest1.nightlife?.length ? dest2.name : 'Tie — similar nightlife levels'}

---

## The Verdict: ${dest1.name} or ${dest2.name}?

### Choose ${dest1.name} if you want:

- ${dest1.budget[0] < dest2.budget[0] ? 'A more budget-friendly trip' : 'A premium experience'}
- ${dest1.tagline}
- ${dest1.foods[0]?.split(' — ')?.[0] || 'Amazing local food'}
- ${dest1.romantic?.[0] || dest1.family?.[0] || dest1.nightlife?.[0] || 'Authentic cultural immersion'}

### Choose ${dest2.name} if you want:

- ${dest2.budget[0] < dest1.budget[0] ? 'A more budget-friendly trip' : 'A premium experience'}
- ${dest2.tagline}
- ${dest2.foods[0]?.split(' — ')?.[0] || 'Amazing local food'}
- ${dest2.romantic?.[0] || dest2.family?.[0] || dest2.nightlife?.[0] || 'Authentic cultural immersion'}

### Can't decide? Do both.

Seriously. If you're already flying to ${dest1.continent}, adding ${dest2.name} ${dest1.country === dest2.country ? 'is easy' : 'might only be a short flight away'}. Combine them into one epic trip.

---

## More Resources

- [${dest1.name} 5-day itinerary](/blog/5-days-in-${dest1.id})
- [${dest2.name} 5-day itinerary](/blog/5-days-in-${dest2.id})
- [${dest1.name} destination guide](/destinations/${dest1.id})
- [${dest2.name} destination guide](/destinations/${dest2.id})

${faroway_cta(dest1, dest2)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Guides',
    tags: [dest1.name, dest2.name, `${dest1.name} vs ${dest2.name}`, 'destination comparison', dest1.continent, dest2.continent, 'travel planning'].filter((v, i, a) => a.indexOf(v) === i),
    author_slug: rotateAuthor(idx),
    reading_time: estimateReadingTime(content),
    cover_image_alt: `${dest1.name} vs ${dest2.name} — which city should you visit?`,
    cluster: 'destination-comparisons',
    imgId: dest1.imgId,
  };
}

// ---------------------------------------------------------------------------
// Template 2 — Which City (Alternative Format)
// ---------------------------------------------------------------------------

export function templateWhichCity(dest1: Destination, dest2: Destination, idx = 0): BlogEntry {
  const slug = `${dest1.id}-or-${dest2.id}`;
  const title = `${dest1.name} or ${dest2.name}? We Help You Decide`;
  const description = `Choosing between ${dest1.name} and ${dest2.name}? Compare budgets, vibes, sights, and food to pick the perfect destination for your trip.`.slice(0, 160);

  const content = `# ${dest1.name} or ${dest2.name}? We Help You Decide

Two amazing cities. One trip. Limited time and budget. The classic traveler's dilemma.

You've narrowed it down to **${dest1.name}** or **${dest2.name}**, and now you're stuck. Both look incredible on Instagram. Both have glowing reviews. Both are "must-see" destinations according to every travel blog.

So how do you actually choose?

We break it down by the factors that matter: **money, vibe, food, culture, and what you'll actually remember** five years from now.

---

## TL;DR: The One-Minute Decision Guide

**Pick ${dest1.name} if:**
- You have a daily budget of $${dest1.budget[0]}–$${dest1.budget[1]}
- You want ${dest1.tagline.toLowerCase()}
- ${dest1.foods[0]?.split(' — ')?.[0] || 'The local food'} is on your bucket list
- You prefer ${dest1.climate.includes('hot') || dest1.climate.includes('warm') ? 'warm weather' : 'cooler climates'}

**Pick ${dest2.name} if:**
- You have a daily budget of $${dest2.budget[0]}–$${dest2.budget[1]}
- You want ${dest2.tagline.toLowerCase()}
- ${dest2.foods[0]?.split(' — ')?.[0] || 'The local food'} is on your bucket list
- You prefer ${dest2.climate.includes('hot') || dest2.climate.includes('warm') ? 'warm weather' : 'cooler climates'}

Still undecided? Keep reading.

---

## Budget Breakdown: Which is Cheaper?

### ${dest1.name} Daily Costs

| Category | Budget | Mid-range | Luxury |
|----------|--------|-----------|--------|
| Accommodation | $${Math.round(dest1.budget[0] * 0.4)} | $${Math.round(dest1.budget[1] * 0.5)} | $${Math.round(dest1.budget[2] * 0.4)}+ |
| Food (3 meals) | $${Math.round(dest1.budget[0] * 0.35)} | $${Math.round(dest1.budget[1] * 0.3)} | $${Math.round(dest1.budget[2] * 0.25)} |
| Transport | $${Math.round(dest1.budget[0] * 0.15)} | $${Math.round(dest1.budget[1] * 0.1)} | $${Math.round(dest1.budget[2] * 0.15)} |
| Sights/activities | $${Math.round(dest1.budget[0] * 0.1)} | $${Math.round(dest1.budget[1] * 0.1)} | $${Math.round(dest1.budget[2] * 0.2)} |
| **Total/day** | **$${dest1.budget[0]}** | **$${dest1.budget[1]}** | **$${dest1.budget[2]}** |

### ${dest2.name} Daily Costs

| Category | Budget | Mid-range | Luxury |
|----------|--------|-----------|--------|
| Accommodation | $${Math.round(dest2.budget[0] * 0.4)} | $${Math.round(dest2.budget[1] * 0.5)} | $${Math.round(dest2.budget[2] * 0.4)}+ |
| Food (3 meals) | $${Math.round(dest2.budget[0] * 0.35)} | $${Math.round(dest2.budget[1] * 0.3)} | $${Math.round(dest2.budget[2] * 0.25)} |
| Transport | $${Math.round(dest2.budget[0] * 0.15)} | $${Math.round(dest2.budget[1] * 0.1)} | $${Math.round(dest2.budget[2] * 0.15)} |
| Sights/activities | $${Math.round(dest2.budget[0] * 0.1)} | $${Math.round(dest2.budget[1] * 0.1)} | $${Math.round(dest2.budget[2] * 0.2)} |
| **Total/day** | **$${dest2.budget[0]}** | **$${dest2.budget[1]}** | **$${dest2.budget[2]}** |

**Winner:** ${dest1.budget[0] < dest2.budget[0] ? `${dest1.name} is cheaper by about $${dest2.budget[0] - dest1.budget[0]}/day` : dest2.budget[0] < dest1.budget[0] ? `${dest2.name} is cheaper by about $${dest1.budget[0] - dest2.budget[0]}/day` : 'Tie — both cost about the same'}

---

## Traveler Profiles: Who Goes Where?

### ${dest1.name} is perfect for:

- **${dest1.romantic?.length ? 'Couples' : dest1.family?.length ? 'Families' : dest1.nightlife?.length ? 'Party travelers' : 'Solo travelers'}** — ${dest1.romantic?.[0] || dest1.family?.[0] || dest1.nightlife?.[0] || 'Great for independent exploration'}
- **Foodies** — ${dest1.foods[0]?.split(' — ')?.[0] || 'The local cuisine'} alone is worth the flight
- **${dest1.photoSpots?.length ? 'Photographers' : 'Culture lovers'}** — ${dest1.photoSpots?.[0] || dest1.attractions[0]} is iconic

### ${dest2.name} is perfect for:

- **${dest2.romantic?.length ? 'Couples' : dest2.family?.length ? 'Families' : dest2.nightlife?.length ? 'Party travelers' : 'Solo travelers'}** — ${dest2.romantic?.[0] || dest2.family?.[0] || dest2.nightlife?.[0] || 'Great for independent exploration'}
- **Foodies** — ${dest2.foods[0]?.split(' — ')?.[0] || 'The local cuisine'} is unforgettable
- **${dest2.photoSpots?.length ? 'Photographers' : 'Culture lovers'}** — ${dest2.photoSpots?.[0] || dest2.attractions[0]} is stunning

---

## Final Thoughts: Just Pick One

Both cities are amazing. You'll have a great time in either. The real mistake is overthinking it to the point where you never book anything.

**Our advice:** Flip a coin. Seriously. If you feel disappointed by the result, go with the other one. If you feel relieved, book it.

You can always come back for the other city next year.

---

## Related Guides

- [3 days in ${dest1.name}](/blog/3-days-in-${dest1.id})
- [3 days in ${dest2.name}](/blog/3-days-in-${dest2.id})
- [${dest1.name} travel guide](/destinations/${dest1.id})
- [${dest2.name} travel guide](/destinations/${dest2.id})

${faroway_cta(dest1, dest2)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Guides',
    tags: [dest1.name, dest2.name, `${dest1.name} or ${dest2.name}`, 'destination comparison', 'travel planning', dest1.continent, dest2.continent].filter((v, i, a) => a.indexOf(v) === i),
    author_slug: rotateAuthor(idx + 1),
    reading_time: estimateReadingTime(content),
    cover_image_alt: `${dest1.name} or ${dest2.name}? Compare and decide`,
    cluster: 'destination-comparisons',
    imgId: dest2.imgId,
  };
}
