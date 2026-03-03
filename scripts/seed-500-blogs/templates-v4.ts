import type { Destination } from './destinations';
import type { BlogEntry } from './templates';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateReadingTime(content: string): number {
  const words = content.split(/\s+/).length;
  return Math.max(4, Math.ceil(words / 230));
}

function cta(dest: Destination): string {
  return `\n\n---\n\n*Ready to plan your ${dest.name} trip? [Create a free personalized itinerary with Faroway](/) — it takes 60 seconds and adapts to your travel style.*`;
}

function pick<T>(arr: T[], n: number): T[] {
  const out: T[] = [];
  const pool = [...arr];
  while (out.length < n && pool.length > 0) {
    const idx = out.length % pool.length;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function usd(n: number): string {
  return `$${n}`;
}

/** Strip the "area — description" format down to just the area name. */
function areaName(area: string): string {
  return area.split('—')[0].split('–')[0].trim();
}

/** Strip "Food — description" down to just the food name. */
function foodName(food: string): string {
  return food.split('—')[0].split('–')[0].trim();
}

/** Build internal links to other blog posts about this destination. */
function relatedLinks(dest: Destination): string {
  return `
**Continue planning your ${dest.name} trip:**

- [Best Time to Visit ${dest.name}](/blog/best-time-to-visit-${dest.id}) — Season-by-season breakdown
- [Where to Stay in ${dest.name}](/blog/where-to-stay-in-${dest.id}) — Neighborhoods ranked by budget and vibe
- [${dest.name} on a Budget](/blog/${dest.id}-on-a-budget) — How to stretch every dollar
- [What to Eat in ${dest.name}](/blog/what-to-eat-in-${dest.id}) — The complete food guide
- [Getting Around ${dest.name}](/blog/getting-around-${dest.id}-transportation) — Transport decoded
- [Hidden Gems in ${dest.name}](/blog/hidden-gems-${dest.id}) — Beyond the tourist trail`;
}

/** Build internal links to Faroway tools. */
function toolLinks(dest: Destination): string {
  return `
**Faroway tools for your trip:**

- [Trip Cost Estimator](/tools/trip-cost/${dest.id}) — Get a realistic budget
- [Best Time to Visit ${dest.name}](/tools/best-time-to-visit/${dest.id}) — Interactive weather & crowd data
- [Packing List Generator](/tools/packing-list) — Custom list for ${dest.name}'s climate
- [Create Your ${dest.name} Itinerary](/create) — AI-powered, free, 60 seconds`;
}

/** Determine budget tier label from daily budget. */
function budgetTier(budget: number): string {
  if (budget < 30) return 'ultra-budget';
  if (budget < 50) return 'budget-friendly';
  if (budget < 80) return 'moderate';
  if (budget < 120) return 'mid-range';
  return 'expensive';
}

/** Determine a destination's primary "draw" from its data. */
function primaryDraw(dest: Destination): string {
  const foodCount = dest.foods.length;
  const attractionCount = dest.attractions.length;
  const hiddenCount = dest.hidden.length;
  const romanticCount = dest.romantic.length;

  if (dest.id === 'bali' || dest.id === 'fiji' || dest.id === 'zanzibar' || dest.id === 'santorini') return 'beaches and natural beauty';
  if (dest.id === 'reykjavik' || dest.id === 'queenstown' || dest.id === 'cusco') return 'adventure and landscapes';
  if (dest.id === 'kyoto' || dest.id === 'petra' || dest.id === 'cairo') return 'history and cultural heritage';
  if (foodCount >= 6 && dest.budget[0] < 40) return 'street food and culinary culture';
  if (attractionCount >= 6) return 'world-class sights and attractions';
  if (romanticCount >= 3) return 'romance and atmosphere';
  if (hiddenCount >= 4) return 'off-the-beaten-path discovery';
  return 'a compelling mix of culture and experiences';
}

// ---------------------------------------------------------------------------
// Template 1 — The Honest Guide to [City]
// ---------------------------------------------------------------------------

function templateHonestGuide(dest: Destination): BlogEntry {
  const slug = `honest-guide-to-${dest.id}`;
  const title = `The Honest Guide to ${dest.name}: What Travel Blogs Won't Tell You`;
  const description = `An unfiltered look at ${dest.name} — what's genuinely great, what's overrated, who'll love it, who should skip it, and how to make the most of it.`.slice(0, 160);

  const attractions = pick(dest.attractions, 5);
  const foods = pick(dest.foods, 5);
  const areas = pick(dest.areas, 4);
  const hidden = pick(dest.hidden, 3);
  const safety = pick(dest.safety, 2);
  const etiquette = pick(dest.etiquette, 2);
  const tips = pick(dest.tips, 4);
  const nightlife = pick(dest.nightlife, 2);
  const dayTrips = pick(dest.dayTrips, 2);

  const tier = budgetTier(dest.budget[0]);
  const draw = primaryDraw(dest);
  const isExpensive = dest.budget[1] >= 120;
  const isCheap = dest.budget[0] < 35;

  const overratedSection = getOverratedSection(dest);
  const underratedSection = getUnderratedSection(dest, hidden, areas);
  const whoShouldSkipSection = getWhoShouldSkipSection(dest);
  const realCostsSection = getRealCostsSection(dest);
  const culturalFrictionSection = getCulturalFrictionSection(dest, etiquette, safety);

  const content = `# The Honest Guide to ${dest.name}: What Travel Blogs Won't Tell You

Every travel blog will tell you ${dest.name} is "amazing" and "must-visit." That's not useful. You need to know whether **you** will actually enjoy it, what will frustrate you, and where the hype outpaces reality.

This is the guide I wish someone had given me. No sponsored partnerships. No Instagram-filtered optimism. Just a clear-eyed assessment of what ${dest.name} actually delivers.

## The Bottom Line (Before You Read Further)

${dest.name} is best for: **${draw}**. The ${tier} cost of living (${usd(dest.budget[0])}–${usd(dest.budget[1])}/day) makes it ${isCheap ? 'one of the best-value destinations in ' + dest.continent : isExpensive ? 'a destination where you need to budget carefully' : 'accessible for most travelers without feeling like a budget trip'}. Visit during **${dest.bestTime}** and avoid **${dest.peakSeason}** unless you have a specific reason to go then.

**Will you like it?** If you travel for ${draw}, yes — ${dest.name} is legitimately excellent. If you're expecting a relaxing, effortless vacation with zero cultural adjustment, ${dest.continent === 'Europe' || dest.continent === 'Oceania' ? "you'll mostly be fine, though it has its quirks" : 'you may need to recalibrate your expectations'}.

## What's Genuinely Great

### The Attractions That Earn Their Reputation

Not everything popular is overhyped. **${attractions[0]}** is as impressive as people say — ${dest.continent === 'Asia' ? 'arrive before 8 AM and you might have it nearly to yourself' : 'go on a weekday morning for the best experience'}. **${attractions[1]}** and **${attractions[2]}** also deliver. These are not tourist traps. They became famous because they're genuinely extraordinary.

### The Food Scene

${dest.name}'s food is ${dest.foods.length >= 5 ? 'a legitimate reason to book a trip on its own' : 'consistently good and occasionally exceptional'}. ${isCheap ? `You can eat incredibly well for ${usd(Math.round(dest.budget[0] * 0.3))} per day.` : `Budget ${usd(Math.round(dest.budget[1] * 0.35))} per day for food to eat comfortably.`}

The standouts:

- **${foodName(foods[0])}** — ${foods[0].includes('—') ? foods[0].split('—')[1].trim() : 'A local staple worth seeking out'}
- **${foodName(foods[1])}** — ${foods[1].includes('—') ? foods[1].split('—')[1].trim() : 'Another highlight of the local cuisine'}
- **${foodName(foods[2])}** — ${foods[2].includes('—') ? foods[2].split('—')[1].trim() : 'Do not leave without trying this'}

Skip the restaurants clustered around **${attractions[0]}**. Walk three blocks in any direction and the food gets better and costs half as much. For a deep dive, read our [complete ${dest.name} food guide](/blog/what-to-eat-in-${dest.id}).

### The Neighborhoods That Make It Special

The best thing about ${dest.name} is that it's not one place — it's several. **${areaName(areas[0])}** and **${areaName(areas[1])}** feel like different cities. ${areas[0].includes('—') ? areas[0].split('—')[1].trim() + '.' : ''} Walk fifteen minutes and you're in **${areaName(areas[2])}**, which has a completely different energy.

This variety means ${dest.name} rewards longer stays. Two days gives you the highlights. Five days lets you actually know the place. For a full breakdown, see our [neighborhood guide](/blog/${dest.id}-neighborhoods-where-to-base-yourself).

${overratedSection}

${underratedSection}

${whoShouldSkipSection}

${realCostsSection}

${culturalFrictionSection}

## Practical Intelligence

### The Timing Question

**${dest.bestTime}** is the sweet spot — good weather, manageable crowds, reasonable prices. **${dest.peakSeason}** drives prices up 30–50% and fills every popular spot with queues. The shoulder months just before and after peak offer the best balance.

For detailed month-by-month analysis, check our [Best Time to Visit ${dest.name}](/blog/best-time-to-visit-${dest.id}) guide or use the [interactive tool](/tools/best-time-to-visit/${dest.id}).

### Getting Around Without Wasting Time

${tips[0] || dest.transport[0] || 'Public transport covers the main tourist areas efficiently.'}

${tips[1] || dest.transport[1] || 'Walking is viable for central neighborhoods.'}

The biggest transport mistake: ${dest.continent === 'Asia' ? 'taking taxis during rush hour. You will spend 45 minutes going 3 kilometers.' : dest.continent === 'Europe' ? 'not buying a transit pass. Individual tickets add up fast.' : 'not downloading a ride-hailing app before you arrive.'} Full details in our [${dest.name} transport guide](/blog/getting-around-${dest.id}-transportation).

### Day Trips Worth Your Time

If you have extra days, two trips are genuinely worth it:

1. **${dayTrips[0]}**
2. **${dayTrips[1]}**

See all options in our [day trips from ${dest.name}](/blog/best-day-trips-from-${dest.id}) guide.

## The Honest Verdict

${dest.name} is not perfect. No destination is. But it is ${dest.attractions.length >= 5 && dest.foods.length >= 4 ? 'one of the most rewarding destinations in ' + dest.continent : 'a destination that delivers genuine value'} for travelers who arrive with the right expectations.

The people who love ${dest.name} most are the ones who ${isCheap ? 'embrace the chaos, eat where locals eat, and stop comparing everything to home' : 'balance iconic sights with neighborhood wandering, and treat minor inconveniences as part of the experience'}.

The people who are disappointed usually ${isExpensive ? 'expected luxury for budget prices, or stayed entirely within the tourist bubble' : 'over-planned their days, only visited the top-5 Instagram spots, and ate at restaurants with English-language hawkers out front'}.

Go with curiosity. Leave room for accidents. ${dest.name} will take care of the rest.

${relatedLinks(dest)}

${toolLinks(dest)}
${cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Destinations',
    tags: [dest.name, dest.country, 'honest review', 'travel guide', 'what to know', dest.continent.toLowerCase()],
    author_slug: 'sarah-chen',
    reading_time: estimateReadingTime(content),
    cover_image_alt: `Authentic scene in ${dest.name}, ${dest.country} — beyond the tourist trail`,
    cluster: 'destination-guides',
    imgId: dest.imgId,
  };
}

// ---------------------------------------------------------------------------
// Template 1 — Section generators (keep content varied per destination)
// ---------------------------------------------------------------------------

function getOverratedSection(dest: Destination): string {
  const attractions = dest.attractions;
  // Pick the most "famous" attraction (first in list) as the one people debate
  const headline = attractions[0];

  // Continent-based honest takes on common disappointments
  const continentIssues: Record<string, string> = {
    'Asia': `Tourist-oriented restaurants near major sites charge 3–4x local prices for mediocre food. The authentic version is always a side street away.`,
    'Europe': `The "iconic" photo spots are mobbed by noon. Every person in the crowd is trying to get the same shot you saw on Instagram. The experience is watching other people take photos.`,
    'North America': `The gap between what things cost and what they're worth is wider here than almost anywhere. A $25 attraction can be less interesting than a free public park.`,
    'South America': `Some of the most-promoted "experiences" are essentially tourist performances — staged versions of something that happens organically elsewhere in the city.`,
    'Africa': `Organized tours to popular sites can feel rushed and impersonal. You see the attraction but miss the context that makes it meaningful.`,
    'Middle East': `The new, flashy attractions get all the press, but they're often expensive, crowded, and less interesting than the historic sites they overshadow.`,
    'Oceania': `The natural beauty is real, but the infrastructure around popular spots can feel over-commercialized. Sometimes the best views are from the free lookout, not the paid experience.`,
  };

  const issue = continentIssues[dest.continent] || continentIssues['Europe'];

  return `## What's Overrated (Honest Take)

### ${headline} — Great, But...

Let me be clear: **${headline}** is worth seeing. It earned its reputation. But the experience of visiting it in ${dest.peakSeason.toLowerCase().includes('season') ? 'peak season' : dest.peakSeason} is fundamentally different from what you see in photos. Arrive early, manage your expectations about crowds, and spend 30 minutes less there than you planned — use that time to explore the surrounding area instead.

### The General Tourist Trap Pattern

${issue}

### The Instagram Problem

Half the "must-visit" lists for ${dest.name} are driven by one photogenic angle of a place that's otherwise unremarkable. Before adding something to your itinerary because it looked good on social media, ask: "Is there something to **do** here, or just something to **photograph**?" If it's the latter, spend 15 minutes there at most.

For spots that are actually worth photographing AND experiencing, see our [Instagram spots guide](/blog/best-instagram-spots-in-${dest.id}) — we note which ones have substance beyond the photo op.`;
}

function getUnderratedSection(dest: Destination, hidden: string[], areas: string[]): string {
  return `## What's Underrated (The Real Gems)

### ${hidden[0]}

This is the kind of place that makes you feel like you cracked the code. Most tourists never make it here because it's not in the top-10 lists. Their loss. It captures something essential about ${dest.name} that the famous attractions can't — the texture of daily life, the pace that locals actually live at.

### ${areaName(areas[areas.length - 1])} Neighborhood

While everyone crowds into **${areaName(areas[0])}**, the **${areaName(areas[areas.length - 1])}** area is quietly excellent. ${areas[areas.length - 1].includes('—') ? areas[areas.length - 1].split('—')[1].trim() + '.' : 'It offers a completely different perspective on the city.'} Better food prices, more interesting street life, and you'll actually meet residents instead of other tourists.

### ${hidden[1]}

Another spot the guidebooks underserve. ${hidden[1]}. Worth a dedicated half-day if you have three or more days in ${dest.name}.

We wrote a full guide to places like these: [Hidden Gems in ${dest.name}](/blog/hidden-gems-${dest.id}).`;
}

function getWhoShouldSkipSection(dest: Destination): string {
  const skips: string[] = [];

  if (dest.budget[1] >= 150) {
    skips.push(`**Strict budget travelers.** While you *can* do ${dest.name} on ${usd(dest.budget[0])}/day, it requires constant cost-consciousness that can drain the fun. If penny-counting stresses you out, consider a cheaper destination in ${dest.continent} first and come back when your budget is more comfortable.`);
  }
  if (dest.climate.toLowerCase().includes('tropical') || dest.climate.toLowerCase().includes('hot')) {
    skips.push(`**People who hate heat and humidity.** ${dest.name}'s climate is ${dest.climate.toLowerCase()}. If you wilt in warm weather, time your visit carefully or skip it entirely. Air conditioning exists but you'll spend significant time outdoors.`);
  }
  if (dest.continent === 'Asia' || dest.continent === 'Africa' || dest.continent === 'Middle East') {
    skips.push(`**Travelers who need everything to feel familiar.** ${dest.name} is a different culture with different norms. The food is different, the pace is different, and things don't always work the way you expect. That's the point — but if it sounds exhausting rather than exciting, that's worth acknowledging.`);
  }
  if (dest.nightlife.length < 2) {
    skips.push(`**Pure party travelers.** ${dest.name}'s nightlife exists but it's not the main attraction. If your ideal trip revolves around clubs and bar crawls, other cities deliver more.`);
  }

  // Ensure we always have at least 2 items
  if (skips.length < 2) {
    skips.push(`**Travelers who over-plan every hour.** ${dest.name} rewards spontaneity. If you need a minute-by-minute schedule to feel comfortable, the city will fight you.`);
  }
  if (skips.length < 2) {
    skips.push(`**Anyone expecting a "hidden gem."** ${dest.name} is popular for a reason. If your primary motivation is going somewhere "nobody else goes," this isn't it.`);
  }

  return `## Who Should Probably Skip ${dest.name}

This isn't gatekeeping — it's saving you money and disappointment. ${dest.name} is excellent for the right traveler and frustrating for the wrong one.

${skips.map(s => `- ${s}`).join('\n')}

Not sure if ${dest.name} matches your travel style? Our [travel quiz](/tools/travel-quiz) can help you figure that out.`;
}

function getRealCostsSection(dest: Destination): string {
  const daily = dest.budget;
  return `## What Things Actually Cost (2026)

Forget the "you can travel ${dest.name} for ${usd(10)} a day!" clickbait. Here's what a realistic daily budget looks like:

| Spend Level | Daily Budget | What That Gets You |
|---|---|---|
| **Backpacker** | ${usd(daily[0])}/day | Dorm beds or basic guesthouses, street food, public transport, free attractions |
| **Comfortable** | ${usd(daily[1])}/day | Private room in a good location, sit-down meals, occasional taxis, paid attractions |
| **Luxury** | ${usd(daily[2])}+/day | Boutique hotels, fine dining, private tours, premium experiences |

**What surprises most people:** ${daily[0] < 40 ? `How far your money goes. ${dest.name} is genuinely affordable — you can eat outstanding food for ${usd(Math.round(daily[0] * 0.25))} a meal and get a clean private room for ${usd(Math.round(daily[0] * 1.2))}/night.` : daily[1] >= 150 ? `How quickly costs add up. Accommodation in decent neighborhoods starts around ${usd(Math.round(daily[1] * 0.5))}/night, and a restaurant dinner easily runs ${usd(Math.round(daily[1] * 0.2))}.` : `The variance between areas. Eating in **${dest.areas[0] ? dest.areas[0].split('—')[0].trim() : 'the tourist center'}** costs 40–60% more than the same quality food three neighborhoods over.`}

For a detailed cost breakdown with specific prices, see our [${dest.name} budget guide](/blog/${dest.id}-on-a-budget) or estimate your personal costs with the [trip cost calculator](/tools/trip-cost/${dest.id}).`;
}

function getCulturalFrictionSection(dest: Destination, etiquette: string[], safety: string[]): string {
  return `## The Stuff That Catches People Off Guard

Every destination has friction points — things that aren't dangerous but are disorienting if you're not prepared.

### Cultural Norms You'll Want to Know

- ${etiquette[0] || 'Greetings and social norms differ from Western conventions.'}
- ${etiquette[1] || 'Dress codes at religious and cultural sites are enforced.'}
- Tipping culture: ${dest.continent === 'Asia' ? 'Tipping is not expected and can sometimes cause confusion. Don\'t tip unless you\'re at an upscale Western-style restaurant.' : dest.continent === 'Europe' ? 'Round up the bill or add 5–10%. The aggressive American-style tipping culture doesn\'t apply.' : dest.continent === 'North America' ? 'Tip 15–20% at sit-down restaurants. It\'s part of the cost of dining, not optional.' : 'Tipping customs vary. Ask locally or at your hotel for current norms.'}

### Safety — Honest Assessment

- ${safety[0] || `${dest.name} is generally safe for tourists who exercise normal caution.`}
- ${safety[1] || 'Keep valuables secure in crowded areas and use common sense at night.'}
- The honest take: ${dest.safety.length >= 3 ? `${dest.name} has specific safety considerations that are worth understanding. Read our [full safety guide](/blog/is-${dest.id}-safe-solo-travel-guide) before you go.` : `${dest.name} is about as safe as you'd expect for a destination of its size. Standard big-city awareness applies. Our [safety guide](/blog/is-${dest.id}-safe-solo-travel-guide) covers the details.`}

### The Language Situation

${dest.lang.toLowerCase().includes('english') ? `English is widely spoken, so communication is straightforward. You won't struggle.` : `The local language is ${dest.lang}. English proficiency varies — strong in tourist areas and hotels, limited in residential neighborhoods and markets. Download an offline translation app. The effort of attempting a few ${dest.lang.split(',')[0].split('(')[0].trim()} phrases earns you significantly warmer interactions.`}`;
}

// ---------------------------------------------------------------------------
// Template 2 — [City] Neighborhood-by-Neighborhood Guide
// ---------------------------------------------------------------------------

function templateNeighborhoods(dest: Destination): BlogEntry {
  const slug = `${dest.id}-neighborhoods-where-to-base-yourself`;
  const title = `${dest.name} Neighborhoods: Where to Stay, Eat & Explore Area by Area`;
  const description = `A neighborhood-by-neighborhood guide to ${dest.name}. Find the right area for your budget, travel style, and interests — with specific recs for each.`.slice(0, 160);

  const areas = dest.areas;
  const foods = dest.foods;
  const hidden = dest.hidden;
  const nightlife = dest.nightlife;
  const shopping = dest.shopping;
  const transport = dest.transport;

  // Build a detailed section for each neighborhood
  const neighborhoodSections = areas.map((area, i) => {
    const name = areaName(area);
    const desc = area.includes('—') ? area.split('—')[1].trim() : '';

    // Assign vibes and traveler types based on position and destination data
    const vibes = getNeighborhoodVibe(dest, i);
    const priceLevel = getNeighborhoodPrice(dest, i);
    const bestFor = getNeighborhoodBestFor(dest, i);

    // Pull a relevant food for this neighborhood (cycle through available)
    const localFood = foods[i % foods.length];
    const localFoodName = foodName(localFood);

    // Pull relevant hidden gem or shopping if available
    const nearbyGem = hidden[i % hidden.length];
    const nearbyShopping = shopping[i % shopping.length] || '';

    return `### ${i + 1}. ${name}

**Vibe:** ${vibes}
**Price level:** ${priceLevel}
**Best for:** ${bestFor}

${desc ? desc.charAt(0).toUpperCase() + desc.slice(1) + '. ' : ''}${name} is ${i === 0 ? `where most first-time visitors base themselves, and for good reason — it puts you within walking distance of major attractions and has the strongest tourist infrastructure` : i === 1 ? `the neighborhood that grows on you. Less polished than ${areaName(areas[0])} but more rewarding for travelers who want texture over convenience` : i === 2 ? `a different energy entirely. You come here for a specific experience rather than a central base` : `worth exploring even if you don't stay here. It shows a side of ${dest.name} that the main tourist areas don't`}.

**Where to eat here:** ${localFoodName} is easy to find in this area. ${i === 0 ? `Prices near main attractions run 30–50% higher than the neighborhood average. Walk two blocks from the tourist flow and quality goes up while prices come down.` : `This area has some of the most authentic dining in the city. Look for places full of locals during lunch hours.`}

**The catch:** ${i === 0 ? `It's the busiest area, especially during ${dest.peakSeason}. If crowds drain your energy, consider staying in ${areaName(areas[1] || areas[0])} and commuting in.` : i === 1 ? `It's a 10–20 minute commute to the main sights. Not a dealbreaker, but factor it into your planning.` : `Less tourist infrastructure means fewer English menus and less hand-holding. That's a feature for some travelers and a bug for others.`}${nearbyShopping ? `\n\n**Shopping nearby:** ${nearbyShopping}` : ''}`;
  }).join('\n\n');

  const content = `# ${dest.name} Neighborhoods: Where to Stay, Eat & Explore Area by Area

Most ${dest.name} guides treat the city as one place. It's not. It's ${areas.length} distinct neighborhoods (at least) stitched together, and choosing the wrong base can mean spending half your trip commuting or missing the parts of the city you'd love most.

This guide breaks down each major area — what it feels like, what it costs, who it's for, and what you'll find there. Pick the one that matches your travel style and you'll have a fundamentally better trip.

## Quick Decision Matrix

| Neighborhood | Best For | Price Level | Walk to Sights? |
|---|---|---|---|
${areas.map((area, i) => `| **${areaName(area)}** | ${getNeighborhoodBestFor(dest, i)} | ${getNeighborhoodPrice(dest, i)} | ${i === 0 ? 'Yes' : i === 1 ? 'Mostly' : 'Some'} |`).join('\n')}

## How to Choose (The 30-Second Version)

- **First visit, short trip (1–3 days)?** Stay in **${areaName(areas[0])}**. Convenience matters more than anything when time is limited.
- **Repeat visitor or longer stay (4+ days)?** Consider **${areaName(areas[1])}** or **${areaName(areas[areas.length > 2 ? 2 : 1])}** for a more local experience.
- **Budget priority?** ${dest.budget[0] < 40 ? `Almost any area is affordable, but ${areaName(areas[areas.length - 1])} or ${areaName(areas[1])} will save you 20–30% on accommodation.` : `${areaName(areas[areas.length - 1])} typically runs 30–40% cheaper than the central neighborhoods.`}
- **Nightlife priority?** ${nightlife.length > 0 ? `${nightlife[0].split('—')[0].trim()} is your answer.` : `${areaName(areas[0])} has the most options after dark.`}

## Neighborhood Deep Dives

${neighborhoodSections}

## Getting Between Neighborhoods

${transport[0] || 'Public transit connects all major neighborhoods efficiently.'}

${transport[1] || 'Walking between adjacent neighborhoods is usually feasible and enjoyable.'}

${dest.continent === 'Asia' ? `Ride-hailing apps (Grab, local equivalents) are cheap and reliable for cross-city trips. Budget ${usd(Math.round(dest.budget[0] * 0.1))}–${usd(Math.round(dest.budget[0] * 0.2))} per ride.` : dest.continent === 'Europe' ? `Metro/subway systems will get you between any two neighborhoods in 15–25 minutes. Buy a multi-day pass if you plan to area-hop.` : `Taxis and ride-shares are the most practical option for cross-neighborhood travel.`}

For the full breakdown, read our [${dest.name} transportation guide](/blog/getting-around-${dest.id}-transportation).

## Where NOT to Stay

Without naming specific hotels: avoid accommodations directly next to **${dest.attractions[0]}** or the city's main transport hub. You pay a 40–60% premium for a location that's loud, crowded, and only "convenient" for one attraction. Staying 10–15 minutes away by transit gives you a better neighborhood experience and significantly more value.

## The Smart Strategy

If you have four or more days, consider splitting your stay between two neighborhoods. ${areas.length >= 3 ? `Two nights in **${areaName(areas[0])}** for sightseeing, then move to **${areaName(areas[1])}** or **${areaName(areas[2])}** for a more local experience.` : `Start in **${areaName(areas[0])}** for the main sights, then move to **${areaName(areas[1])}** to see a different side.`} You'll effectively get two trips in one.

${relatedLinks(dest)}

${toolLinks(dest)}
${cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Destinations',
    tags: [dest.name, 'neighborhoods', 'where to stay', dest.country, 'area guide', 'local guide'],
    author_slug: 'james-miller',
    reading_time: estimateReadingTime(content),
    cover_image_alt: `Neighborhood street scene in ${dest.name}, ${dest.country}`,
    cluster: 'destination-guides',
    imgId: dest.imgId,
  };
}

// ---------------------------------------------------------------------------
// Template 2 — Neighborhood helper functions
// ---------------------------------------------------------------------------

function getNeighborhoodVibe(dest: Destination, index: number): string {
  const vibesByContinent: Record<string, string[]> = {
    'Asia': ['Bustling, colorful, sensory-rich', 'Local and lively, less polished', 'Calm, residential, slow-paced', 'Eclectic mix of old and new', 'Emerging, creative, youthful energy'],
    'Europe': ['Historic, walkable, postcard-pretty', 'Bohemian, artsy, neighborhood feel', 'Trendy, café-lined, local favorite', 'Quiet, residential, authentic', 'Vibrant, nightlife-forward, social'],
    'North America': ['Urban, walkable, high-energy', 'Hip, gentrifying, restaurant-dense', 'Residential, leafy, relaxed', 'Artsy, independent, community-driven', 'Commercial, convenient, well-connected'],
    'South America': ['Colorful, musical, street-life-forward', 'Historic, cobblestone, atmospheric', 'Modern, upscale, international', 'Local, gritty-charming, real', 'Green, residential, family-friendly'],
    'Africa': ['Historic, market-forward, immersive', 'Upscale, modern, well-serviced', 'Local, vibrant, off-tourist-path', 'Coastal or green, relaxed pace', 'Creative, emerging, youthful'],
    'Middle East': ['Ancient, atmospheric, labyrinthine', 'Modern, glamorous, high-rise', 'Traditional, market-rich, authentic', 'Residential, calm, neighborhood-feel', 'Waterfront, breezy, social'],
    'Oceania': ['Harbor-adjacent, walkable, scenic', 'Beachy, relaxed, outdoor-focused', 'Urban, café-culture, creative', 'Suburban, green, family-friendly', 'Quirky, indie, neighborhood-proud'],
  };

  const vibes = vibesByContinent[dest.continent] || vibesByContinent['Europe'];
  return vibes[index % vibes.length];
}

function getNeighborhoodPrice(dest: Destination, index: number): string {
  const base = dest.budget[1];
  if (index === 0) return base >= 120 ? '$$$$' : base >= 80 ? '$$$' : '$$';
  if (index === 1) return base >= 120 ? '$$$' : '$$';
  if (index === 2) return '$$';
  return base >= 80 ? '$$' : '$';
}

function getNeighborhoodBestFor(dest: Destination, index: number): string {
  const bestFor = [
    'First-time visitors, short stays',
    'Repeat visitors, food lovers',
    dest.family.length > 0 ? 'Families, longer stays' : 'Budget travelers, culture seekers',
    dest.nightlife.length > 1 ? 'Nightlife, young travelers' : 'Local immersion, off-path explorers',
    'Digital nomads, extended stays',
  ];
  return bestFor[index % bestFor.length];
}

// ---------------------------------------------------------------------------
// Template 3 — [City] for [Matched Traveler Type]
// ---------------------------------------------------------------------------

interface TravelerProfile {
  type: string;
  slugSuffix: string;
  taglineFn: (dest: Destination) => string;
  introFn: (dest: Destination) => string;
  sectionsFn: (dest: Destination) => string;
  tags: string[];
  cluster: string;
}

/** Match each destination to its strongest traveler type. */
function getTravelerProfile(dest: Destination): TravelerProfile {
  // Map destinations to their most natural traveler type
  const typeMap: Record<string, string> = {
    // Foodies
    'tokyo': 'foodies', 'bangkok': 'foodies', 'mexico-city': 'foodies',
    'lima': 'foodies', 'hanoi': 'foodies', 'singapore': 'foodies',
    'florence': 'foodies',
    // History & culture buffs
    'kyoto': 'history-lovers', 'rome': 'history-lovers', 'cairo': 'history-lovers',
    'petra': 'history-lovers', 'istanbul': 'history-lovers', 'cusco': 'history-lovers',
    'siem-reap': 'history-lovers', 'havana': 'history-lovers', 'prague': 'history-lovers',
    'vienna': 'history-lovers',
    // Adventure seekers
    'queenstown': 'adventure-seekers', 'reykjavik': 'adventure-seekers',
    'cape-town': 'adventure-seekers', 'nairobi': 'adventure-seekers',
    // Solo travelers
    'lisbon': 'solo-travelers', 'berlin': 'solo-travelers',
    'taipei': 'solo-travelers', 'melbourne': 'solo-travelers',
    'copenhagen': 'solo-travelers', 'edinburgh': 'solo-travelers',
    // Couples & romance
    'paris': 'couples', 'santorini': 'couples', 'dubrovnik': 'couples',
    'fiji': 'couples', 'zanzibar': 'couples', 'cartagena': 'couples',
    'auckland': 'couples',
    // Digital nomads
    'bali': 'digital-nomads', 'kuala-lumpur': 'digital-nomads',
    'buenos-aires': 'digital-nomads',
    // Photographers
    'marrakech': 'photographers', 'rio-de-janeiro': 'photographers',
    // City explorers
    'london': 'first-timers-abroad', 'new-york': 'first-timers-abroad',
    'amsterdam': 'first-timers-abroad', 'vancouver': 'first-timers-abroad',
    'sydney': 'first-timers-abroad', 'san-francisco': 'first-timers-abroad',
    // Luxury seekers
    'dubai': 'luxury-seekers',
    // Nightlife & culture
    'seoul': 'culture-enthusiasts', 'hong-kong': 'culture-enthusiasts',
    'mumbai': 'culture-enthusiasts',
  };

  const type = typeMap[dest.id] || 'curious-travelers';
  return buildProfile(type);
}

function buildProfile(type: string): TravelerProfile {
  const profiles: Record<string, TravelerProfile> = {
    'foodies': {
      type: 'Food Lovers',
      slugSuffix: 'for-food-lovers',
      taglineFn: (d) => `A food lover's guide to eating your way through ${d.name} — from street stalls to sit-down restaurants, with a local's perspective.`,
      introFn: (d) => foodieIntro(d),
      sectionsFn: (d) => foodieSections(d),
      tags: ['food', 'culinary travel', 'street food', 'restaurants', 'foodie'],
      cluster: 'vibe-based-travel',
    },
    'history-lovers': {
      type: 'History & Culture Lovers',
      slugSuffix: 'for-history-culture-lovers',
      taglineFn: (d) => `${d.name} through the lens of history and culture — the sites, stories, and context that make this destination extraordinary.`,
      introFn: (d) => historyIntro(d),
      sectionsFn: (d) => historySections(d),
      tags: ['history', 'culture', 'heritage', 'museums', 'temples'],
      cluster: 'destination-guides',
    },
    'adventure-seekers': {
      type: 'Adventure Seekers',
      slugSuffix: 'for-adventure-seekers',
      taglineFn: (d) => `Adrenaline, outdoors, and raw experiences — the adventure traveler's guide to ${d.name}.`,
      introFn: (d) => adventureIntro(d),
      sectionsFn: (d) => adventureSections(d),
      tags: ['adventure', 'outdoor', 'hiking', 'extreme sports', 'nature'],
      cluster: 'vibe-based-travel',
    },
    'solo-travelers': {
      type: 'Solo Travelers',
      slugSuffix: 'for-solo-travelers',
      taglineFn: (d) => `Everything solo travelers need to know about ${d.name} — safety, social scenes, budget tips, and why it's one of the best solo destinations in ${d.continent}.`,
      introFn: (d) => soloIntro(d),
      sectionsFn: (d) => soloSections(d),
      tags: ['solo travel', 'solo', 'independent travel', 'safety', 'social'],
      cluster: 'vibe-based-travel',
    },
    'couples': {
      type: 'Couples',
      slugSuffix: 'for-couples-romantic-trip',
      taglineFn: (d) => `The couples' guide to ${d.name} — romantic experiences, intimate dining, and the moments that make a trip together unforgettable.`,
      introFn: (d) => couplesIntro(d),
      sectionsFn: (d) => couplesSections(d),
      tags: ['couples', 'romantic', 'honeymoon', 'date ideas', 'romance'],
      cluster: 'vibe-based-travel',
    },
    'digital-nomads': {
      type: 'Digital Nomads',
      slugSuffix: 'for-digital-nomads',
      taglineFn: (d) => `The digital nomad's guide to ${d.name} — coworking, connectivity, cost of living, visas, and building a routine in a new city.`,
      introFn: (d) => nomadIntro(d),
      sectionsFn: (d) => nomadSections(d),
      tags: ['digital nomad', 'remote work', 'coworking', 'wifi', 'long stay'],
      cluster: 'vibe-based-travel',
    },
    'photographers': {
      type: 'Photographers',
      slugSuffix: 'for-photographers-visual-guide',
      taglineFn: (d) => `A photographer's guide to ${d.name} — the best light, the hidden angles, and the shots that go beyond the tourist clichés.`,
      introFn: (d) => photographerIntro(d),
      sectionsFn: (d) => photographerSections(d),
      tags: ['photography', 'photo spots', 'visual guide', 'Instagram', 'golden hour'],
      cluster: 'vibe-based-travel',
    },
    'first-timers-abroad': {
      type: 'First-Time International Travelers',
      slugSuffix: 'for-first-time-international-travelers',
      taglineFn: (d) => `Why ${d.name} is the perfect first international trip — easy to navigate, English-friendly, and exciting without being overwhelming.`,
      introFn: (d) => firstTimerIntro(d),
      sectionsFn: (d) => firstTimerSections(d),
      tags: ['first trip abroad', 'beginner', 'easy travel', 'English-friendly', 'safe'],
      cluster: 'trip-planning-packing',
    },
    'luxury-seekers': {
      type: 'Luxury Travelers',
      slugSuffix: 'for-luxury-travelers',
      taglineFn: (d) => `The luxury guide to ${d.name} — where to stay, dine, and experience the city at its most premium without wasting money on flash over substance.`,
      introFn: (d) => luxuryIntro(d),
      sectionsFn: (d) => luxurySections(d),
      tags: ['luxury', 'premium', 'fine dining', 'boutique hotels', 'VIP'],
      cluster: 'insider-tips',
    },
    'culture-enthusiasts': {
      type: 'Culture Enthusiasts',
      slugSuffix: 'for-culture-enthusiasts',
      taglineFn: (d) => `${d.name} through a cultural lens — the art, music, street life, and daily rituals that define this city beyond its tourist attractions.`,
      introFn: (d) => cultureIntro(d),
      sectionsFn: (d) => cultureSections(d),
      tags: ['culture', 'art', 'music', 'local life', 'immersive travel'],
      cluster: 'vibe-based-travel',
    },
    'curious-travelers': {
      type: 'Curious Travelers',
      slugSuffix: 'for-curious-travelers',
      taglineFn: (d) => `${d.name} for the intellectually curious — the deeper stories, unusual angles, and rewarding detours that most guides skip.`,
      introFn: (d) => curiousIntro(d),
      sectionsFn: (d) => curiousSections(d),
      tags: ['curious traveler', 'deep travel', 'unusual', 'off-path', 'stories'],
      cluster: 'destination-guides',
    },
  };

  return profiles[type] || profiles['curious-travelers'];
}

function templateTravelerType(dest: Destination): BlogEntry {
  const profile = getTravelerProfile(dest);
  const slug = `${dest.id}-${profile.slugSuffix}`;
  const title = `${dest.name} for ${profile.type}: The Complete Guide`;
  const description = profile.taglineFn(dest).slice(0, 160);

  const content = `# ${dest.name} for ${profile.type}: The Complete Guide

${profile.introFn(dest)}

${profile.sectionsFn(dest)}

## Planning Your ${profile.type.includes('Couple') ? 'Trip Together' : 'Trip'}

The best time to visit ${dest.name} is **${dest.bestTime}**. Avoid **${dest.peakSeason}** unless you specifically want that energy — prices spike and availability drops.

For a budget of **${usd(dest.budget[1])}/day**, you'll have a comfortable experience with room for the special moments that make a ${profile.type.toLowerCase()} trip worth it.

${relatedLinks(dest)}

${toolLinks(dest)}
${cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Destinations',
    tags: [dest.name, dest.country, ...profile.tags],
    author_slug: 'sarah-chen',
    reading_time: estimateReadingTime(content),
    cover_image_alt: `${dest.name}, ${dest.country} — a guide for ${profile.type.toLowerCase()}`,
    cluster: profile.cluster,
    imgId: dest.imgId,
  };
}

// ---------------------------------------------------------------------------
// Template 3 — Traveler type content generators
// ---------------------------------------------------------------------------

function foodieIntro(d: Destination): string {
  return `You don't travel to ${d.name} for the sights and stay for the food. You travel for the food and fit sights around meals.

${d.name} is ${d.foods.length >= 5 ? 'one of the great eating cities of ' + d.continent : 'a destination where food consistently exceeds expectations'}. The culinary scene ranges from ${d.budget[0] < 40 ? `${usd(1)}–${usd(3)} street food that rivals fine dining` : `affordable local spots to world-class restaurants`} to experiences that justify building an entire trip around them.

This guide is organized around eating, not sightseeing. Attractions are included only when they're near great food.`;
}

function foodieSections(d: Destination): string {
  const foods = d.foods;
  const areas = d.areas;
  const hidden = d.hidden;

  return `## The Essential Dishes (Ranked by Priority)

${foods.map((f, i) => {
    const name = foodName(f);
    const desc = f.includes('—') ? f.split('—')[1].trim() : '';
    return `### ${i + 1}. ${name}

${desc ? desc.charAt(0).toUpperCase() + desc.slice(1) + '. ' : ''}${i === 0 ? `This is the dish that defines ${d.name}'s food identity. You'll find versions everywhere, but quality varies wildly. The best versions are in **${areaName(areas[1] || areas[0])}** where locals eat, not in the tourist zone around **${d.attractions[0]}**.` : i === 1 ? `A close second in the ${d.name} culinary canon. Worth seeking out a specialist spot rather than ordering it as a side dish.` : `Another essential — the kind of dish that makes you understand why people plan return trips to ${d.name}.`}`;
  }).join('\n\n')}

## The Food Neighborhoods

${areas.slice(0, 3).map((area, i) => {
    const name = areaName(area);
    return `### ${name}

${i === 0 ? `The highest concentration of restaurants, but also the most tourist-oriented. Eat here for **${foodName(foods[0])}** at specialist shops that have been perfecting one dish for decades. Skip restaurants with picture menus in multiple languages.` : i === 1 ? `Where the locals actually eat dinner. Less polished, better value, more interesting. This is where you'll find the ${d.name} food scene that doesn't make it into guidebooks.` : `The emerging food neighborhood — newer restaurants, fusion experiments, and the kind of creative cooking that signals where ${d.name}'s food culture is heading.`}`;
  }).join('\n\n')}

## Where Most Food Tourists Go Wrong

1. **Eating only at famous-name restaurants.** The best meal in ${d.name} might be from a place with no English sign and four tables.
2. **Skipping breakfast.** ${d.continent === 'Asia' ? `Morning markets and breakfast stalls are some of the best eating in ${d.name}. Start early.` : `Local breakfast culture here is worth experiencing — it's not just hotel buffets.`}
3. **Not eating late.** ${d.nightlife.length > 0 ? `Some of the best food in ${d.name} comes out after 9 PM.` : `Evening dining culture in ${d.name} peaks later than you might expect.`}
4. **Following food influencer recommendations without context.** That viral spot might have been great two years ago. Ask your hotel staff where *they* eat.

For our full food guide with specific recommendations: [What to Eat in ${d.name}](/blog/what-to-eat-in-${d.id}).`;
}

function historyIntro(d: Destination): string {
  return `${d.name} isn't a city with history — it's a city *made of* history. Every street, building, and public square carries layers of meaning that most tourists walk right past.

This guide is for travelers who want more than photos of old buildings. It's for people who want to understand **why** ${d.name} looks the way it does, what happened here, and how the past shapes the present.

You don't need to be a scholar. You just need to be curious.`;
}

function historySections(d: Destination): string {
  const attractions = d.attractions;
  const areas = d.areas;
  const dayTrips = d.dayTrips;

  return `## The Essential Historical Sites

${attractions.slice(0, 4).map((a, i) => `### ${a}

${i === 0 ? `The headline attraction, and for once, the headline is deserved. What most visitors miss is the context — this isn't just a photogenic monument. It represents a specific moment in ${d.name}'s history that shaped everything that came after. Budget at least 90 minutes here, and consider a guided tour for the first visit.` : i === 1 ? `Less crowded than ${attractions[0]} but arguably more interesting from a historical perspective. The architecture tells a story that audio guides rarely capture well — look for the small details that reveal how the space has been used and modified over centuries.` : i === 2 ? `This is the site that history enthusiasts remember most vividly. It connects to the broader story of ${d.country} in ways that aren't immediately obvious.` : `Worth visiting in the late afternoon when light and crowds are both more manageable. The history here spans multiple periods.`}`).join('\n\n')}

## Walking Through Time: The Historical Neighborhoods

The best way to experience ${d.name}'s history is on foot, moving through neighborhoods where the past is built into the streetscape.

**${areaName(areas[0])}** — ${areas[0].includes('—') ? areas[0].split('—')[1].trim() : 'The historic core of the city'}. Walk slowly here. Every block has something worth noticing.

**${areaName(areas[1])}** — ${areas[1].includes('—') ? areas[1].split('—')[1].trim() : 'A neighborhood with its own distinct historical character'}.

## Day Trips for History Lovers

${dayTrips.length > 0 ? dayTrips.slice(0, 2).map(dt => `- **${dt}**`).join('\n') : `The surrounding region has historical sites that complement what you'll see in ${d.name} itself.`}

These day trips add crucial context to ${d.name}'s story. See our [full day trips guide](/blog/best-day-trips-from-${d.id}).

## How to Go Deeper

- Hire a local historian-guide for at least one half-day. The difference between a standard tour and a historian-led walk is immense.
- Visit the main sites twice — once to orient yourself, once to look at details.
- Read one book about ${d.name}'s history before you go. Even a Wikipedia deep-dive makes every site more meaningful.
- Check our [${d.name} cultural guide](/blog/${d.id}-cultural-dos-and-donts) for historical context on local customs.`;
}

function adventureIntro(d: Destination): string {
  return `${d.name} is not just a place to look at things. It's a place to do things — hard things, exhilarating things, things that leave you sore and grinning.

This guide skips the museums and dining recommendations (we have [other guides](/blog/what-to-eat-in-${d.id}) for that). This is about the outdoor experiences, the physical challenges, and the raw encounters with nature that make ${d.name} an adventure destination.`;
}

function adventureSections(d: Destination): string {
  const attractions = d.attractions;
  const dayTrips = d.dayTrips;
  const hidden = d.hidden;

  return `## Top Adventures

${attractions.slice(0, 3).map((a, i) => `### ${a}

${i === 0 ? `The signature experience. ${d.name}'s most iconic adventure lives up to the hype if you time it right — go early, go prepared, and bring more water than you think you need.` : i === 1 ? `Less famous but equally rewarding. The effort-to-payoff ratio here is excellent.` : `For experienced adventurers looking to push beyond the standard offerings.`}`).join('\n\n')}

## Day Trip Adventures

${dayTrips.slice(0, 3).map(dt => `- **${dt}**`).join('\n')}

Full details in our [day trips from ${d.name}](/blog/best-day-trips-from-${d.id}) guide.

## Off-the-Beaten-Path

${hidden.slice(0, 2).map(h => `- **${h}**`).join('\n')}

These spots don't show up in standard guides. See [Hidden Gems in ${d.name}](/blog/hidden-gems-${d.id}) for more.

## Practical Notes for Adventure Travelers

- **Fitness level:** Most activities are accessible to reasonably fit travelers. Elite-level fitness opens up additional options.
- **Gear:** ${d.packing.slice(0, 2).map(p => p).join('. ')}.
- **Safety:** ${d.safety[0] || 'Standard outdoor safety precautions apply.'} Check our [safety guide](/blog/is-${d.id}-safe-solo-travel-guide) for specifics.
- **Best season:** ${d.bestTime}. Some activities are seasonal.
- **Budget:** Adventure activities add ${usd(Math.round(d.budget[1] * 0.3))}–${usd(Math.round(d.budget[1] * 0.6))}/day on top of base costs. See our [budget guide](/blog/${d.id}-on-a-budget).`;
}

function soloIntro(d: Destination): string {
  return `${d.name} is ${d.safety.length >= 2 ? 'one of the safer destinations in ' + d.continent + ' for solo travelers' : 'manageable for solo travelers who exercise standard precautions'}. But safety alone doesn't make a great solo trip — you also need a city that's easy to navigate alone, has social infrastructure for meeting people, and doesn't punish single travelers with double pricing.

${d.name} delivers on ${d.budget[0] < 50 ? 'all three fronts, especially value — solo dining is never a problem, and the budget stretches far' : 'most fronts, though you may need to be intentional about the social aspect'}.

This guide covers the practical solo-specific concerns: safety, meeting people, eating alone, and building a schedule that works for one.`;
}

function soloSections(d: Destination): string {
  return `## Safety for Solo Travelers

${d.safety.map(s => `- ${s}`).join('\n')}

The honest assessment: ${d.name} is ${d.safety.length >= 3 ? 'generally very safe. The main risks are petty theft in crowded areas and the occasional scam — both avoidable with basic awareness.' : 'safe enough that it shouldn\'t deter you, though standard travel caution applies, especially at night.'}

For women traveling solo, the additional considerations are real but manageable. Read our [detailed safety guide](/blog/is-${d.id}-safe-solo-travel-guide).

## Meeting People

- **Hostels and social accommodations** are the easiest entry point. Even if you prefer private rooms, many hostels offer them with access to common areas.
- **Walking tours** (free and paid) attract other solo travelers. It's the lowest-friction way to meet people.
- ${d.nightlife.length > 0 ? `**${d.nightlife[0]}** — solo-friendly, easy to strike up conversations.` : `**Cafes and co-working spaces** — the daytime equivalent of a social bar.`}
- **Cooking classes and food tours** attract a similar demographic of curious solo travelers.

## Solo Dining Without Awkwardness

${d.continent === 'Asia' ? `Solo dining is completely normal in ${d.name}. Counter seating, street food stalls, and hawker centres are designed for individual diners. You'll never feel out of place eating alone.` : d.continent === 'Europe' ? `Cafe culture makes solo dining easy. Sit at the bar for restaurant meals — you'll get better service and often better conversation than at a table.` : `Solo dining is becoming more common. Lunch is always easy. For dinner, choose bustling local spots over formal restaurants.`}

## The Solo Budget

Solo travel in ${d.name} costs approximately **${usd(Math.round(d.budget[1] * 0.85))}/day** — slightly less than a couple would spend per person because you make faster decisions and skip some of the "experience" activities designed for two.

See our [${d.name} budget guide](/blog/${d.id}-on-a-budget) for specific cost breakdowns.

## Recommended Solo Itinerary

- **Days 1–2:** Base yourself in **${areaName(d.areas[0])}** and hit the main sights. Join a walking tour on day 1 to orient yourself and meet people.
- **Day 3:** Venture to **${areaName(d.areas[1])}** for a different vibe. This is where solo travel gets rewarding — you discover things on your own terms.
- **Day 4+:** Day trip to **${d.dayTrips[0]?.split('—')[0]?.trim() || 'surrounding areas'}** or deep-dive into a neighborhood.

Use [Faroway's itinerary builder](/create) to customize this based on your interests.`;
}

function couplesIntro(d: Destination): string {
  return `${d.name} has earned its reputation as a romantic destination — but not every "romantic" experience here is actually worth your time and money. Some are genuine magic. Others are overpriced setups designed to separate couples from their cash.

This guide separates the two. It covers the experiences that will genuinely create memories, the dining that's worth dressing up for, and the moments you'll both remember ten years from now.`;
}

function couplesSections(d: Destination): string {
  const romantic = d.romantic;
  const foods = d.foods;
  const areas = d.areas;

  return `## The Experiences That Actually Deliver

${romantic.map((r, i) => `### ${i + 1}. ${r}

${i === 0 ? `This is the one people talk about when they get home. It's worth the splurge and the planning.` : i === 1 ? `Less famous but equally intimate. The kind of experience that feels like it's just for the two of you.` : `A perfect complement to the other experiences on this list.`}`).join('\n\n')}

## Romantic Dining

Skip the "romantic dinner package" at your hotel. Instead:

- **${foodName(foods[0])}** at a local restaurant in **${areaName(areas[1] || areas[0])}** — more authentic, more intimate, less expensive.
- **${foodName(foods[1])}** — share this dish. It's designed for it.
- For a full food guide: [What to Eat in ${d.name}](/blog/what-to-eat-in-${d.id})

## The Most Romantic Neighborhoods

**${areaName(areas[0])}** by day, **${areaName(areas[1])}** by evening. The shift in atmosphere as the sun sets is part of the romance.

For detailed neighborhood info: [Where to base yourself in ${d.name}](/blog/${d.id}-neighborhoods-where-to-base-yourself)

## What to Skip

- "Romantic sunset cruises" that pack 50 people onto a boat. Find your own sunset spot.
- Restaurants with "couples' menus" at 3x the normal price. Order off the regular menu.
- Any activity that advertises "Instagram-worthy." If the selling point is the photo, the experience is secondary.

See also: [${d.name} Honeymoon Guide](/blog/${d.id}-honeymoon-romantic-getaway-guide) for extended romantic stays.

## Budget for Two

A romantic trip to ${d.name} runs **${usd(Math.round(d.budget[1] * 1.6))}/day for two** at a comfortable level, including one splurge experience per day. See our [cost estimator](/tools/trip-cost/${d.id}) for a personalized breakdown.`;
}

function nomadIntro(d: Destination): string {
  return `${d.name} isn't just a vacation destination — it's a place where you can actually get work done while living somewhere interesting.

${d.budget[0] < 40 ? `The cost of living is low enough (${usd(d.budget[0] * 30)}–${usd(d.budget[1] * 30)}/month) that your remote salary goes significantly further.` : `The cost of living is ${d.budget[1] >= 120 ? 'comparable to or higher than most Western cities, but the quality of life trade-off can be worth it' : 'moderate — not the cheapest nomad base, but you get strong infrastructure for the price'}.`}

This guide covers the practical questions: wifi reliability, coworking options, visa situation, and building a sustainable routine.`;
}

function nomadSections(d: Destination): string {
  return `## Connectivity & Coworking

**Internet quality:** ${d.continent === 'Asia' ? 'Generally good. Cafe wifi varies wildly — coworking spaces are more reliable.' : d.continent === 'Europe' ? 'Excellent. Most cafes have usable wifi, and coworking spaces offer enterprise-grade connections.' : 'Adequate for most remote work. Video calls work fine in coworking spaces; cafe wifi can be spotty.'}

**Best areas for remote work:** **${areaName(d.areas[1] || d.areas[0])}** has the highest concentration of cafes with power outlets and decent wifi. **${areaName(d.areas[0])}** has more coworking options.

## Monthly Cost Breakdown

| Category | Budget | Comfortable |
|---|---|---|
| Accommodation | ${usd(d.budget[0] * 20)} | ${usd(d.budget[1] * 15)} |
| Food | ${usd(d.budget[0] * 15)} | ${usd(d.budget[1] * 12)} |
| Transport | ${usd(d.budget[0] * 5)} | ${usd(d.budget[1] * 3)} |
| Coworking | ${usd(100)} | ${usd(200)} |
| **Total/month** | **${usd(d.budget[0] * 40 + 100)}** | **${usd(d.budget[1] * 30 + 200)}** |

For a detailed cost analysis: [${d.name} Budget Guide](/blog/${d.id}-on-a-budget)

## The Routine

The nomads who thrive in ${d.name} build structure:

- **Morning:** Work block at a coworking space or cafe (8 AM–12 PM)
- **Midday:** ${d.foods[0] ? `Lunch — try **${foodName(d.foods[0])}** at a local spot` : 'Lunch at a local spot'}
- **Afternoon:** Explore — this is why you're here, not at home
- **Evening:** Social time or second work block

## Where to Live

- **${areaName(d.areas[1] || d.areas[0])}** for the best nomad community
- **${areaName(d.areas[0])}** if you want tourist convenience
- **${areaName(d.areas[d.areas.length - 1])}** for cheaper long-stay accommodation

See our [neighborhood guide](/blog/${d.id}-neighborhoods-where-to-base-yourself) for detailed area breakdowns.

## Visa Considerations

Research current visa requirements on your country's travel advisory site. ${d.continent === 'Asia' ? 'Many countries in the region offer visa-on-arrival or e-visa options. Digital nomad visas are emerging.' : 'Visa requirements vary significantly by nationality.'} This changes frequently — always check current rules before booking.`;
}

function photographerIntro(d: Destination): string {
  return `${d.name} is one of the most photogenic destinations in ${d.continent} — which is exactly the problem. Every spot has been shot a million times from the same angle.

This guide is about going beyond the cliché shots. We cover timing, light, lesser-known angles, and the hidden locations that give you images nobody else has.`;
}

function photographerSections(d: Destination): string {
  const photoSpots = d.photoSpots;

  return `## The Iconic Shots (Done Right)

${photoSpots.map((p, i) => `### ${i + 1}. ${p}

${i === 0 ? `Everyone shoots this. The difference between a tourist snap and a portfolio image is timing — arrive 30 minutes before sunrise or during blue hour. The light transforms everything.` : i === 1 ? `Less crowded than the top spot but equally photogenic. Bring a tripod for long exposures.` : `An underrated angle. Most photographers skip this for the more famous vantage points.`}`).join('\n\n')}

## Beyond the Clichés

${d.hidden.slice(0, 3).map((h, i) => `- **${h}** — ${i === 0 ? 'Street photography gold. The light here in the morning is extraordinary.' : 'Rarely photographed but full of visual stories.'}`).join('\n')}

For our full list: [Instagram Spots in ${d.name}](/blog/best-instagram-spots-in-${d.id}) and [Hidden Gems](/blog/hidden-gems-${d.id}).

## Light & Weather

- **Golden hour:** The best light in ${d.name} is ${d.continent === 'Asia' || d.continent === 'Africa' ? '6:00–6:45 AM and 5:15–6:00 PM (tropical light is fast — don\'t be late)' : '7:00–8:30 AM and 5:00–7:00 PM (varies by season)'}.
- **Best photography season:** ${d.bestTime}. The light quality and weather reliability peak during this window.
- **Rain:** ${d.climate.toLowerCase().includes('tropical') ? 'Post-rain reflections are magic. Carry a rain cover for your gear and shoot the wet streets.' : 'Overcast days give you even, shadow-free light for architecture and street scenes.'}

## Gear Notes

- ${d.packing[0] || 'Pack light — you\'ll walk more than you expect.'}
- A 24–70mm lens covers 80% of what you'll want to shoot. Add a 70–200mm if temples/architecture are your focus.
- Drone laws: Check current regulations for ${d.country}. Many popular sites restrict or prohibit drones.`;
}

function firstTimerIntro(d: Destination): string {
  return `If you've never traveled internationally before (or only once or twice), ${d.name} is an excellent place to start.

${d.lang.toLowerCase().includes('english') ? 'English is widely spoken, ' : 'While the local language is ' + d.lang + ', English is common in tourist areas, '}the infrastructure is reliable, and the culture is welcoming to newcomers. It's exciting enough to feel like a real adventure but manageable enough that you won't spend the whole trip stressed.

This guide covers everything a first-time international traveler needs to know.`;
}

function firstTimerSections(d: Destination): string {
  return `## Before You Go

- **Passport:** Ensure it's valid for at least 6 months beyond your travel dates.
- **Visa:** Check requirements for ${d.country} based on your nationality.
- **Insurance:** Get travel insurance. It's non-negotiable for international travel. Budget ${usd(30)}–${usd(80)} for a week-long policy.
- **Money:** ${d.currency}. ${d.continent === 'Europe' ? 'Credit cards are accepted almost everywhere. Carry a small amount of cash for markets.' : 'Carry a mix of cash and cards. ATMs are widely available.'}

Read our [first-timer tips for ${d.name}](/blog/${d.id}-travel-tips-first-time-visitors) for the complete pre-departure checklist.

## The First 24 Hours

1. **Airport to hotel:** ${d.transport[0] || 'Use official airport transport or a ride-hailing app. Avoid unofficial taxis.'}
2. **Settle in:** Drop your bags. Walk your immediate neighborhood. Buy water and snacks.
3. **Orientation walk:** Head to **${areaName(d.areas[0])}** and just absorb. Don't try to "do" anything yet.
4. **First meal:** Try **${foodName(d.foods[0])}** at a busy local spot. If locals are eating there, the food is good.

## What Will Feel Different

- **Pace:** Things might move faster or slower than you're used to. Both are fine.
- **Food:** ${d.continent === 'Asia' ? 'The flavors are more intense. Start mild if you\'re spice-averse and work up.' : 'The meal structure and timing may differ from home. Adapt to local rhythms.'}
- **Personal space:** Cultural norms around physical proximity vary. ${d.etiquette[0] || 'Observe how locals interact and follow their lead.'}
- **Communication:** ${d.lang.toLowerCase().includes('english') ? 'You\'ll be fine. A smile and basic politeness go far.' : 'A translation app on your phone solves 90% of communication needs.'}

## The Safety Reality

${d.safety.slice(0, 2).map(s => `- ${s}`).join('\n')}

**The honest take:** ${d.name} is ${d.safety.length >= 2 ? 'very safe for tourists' : 'safe with standard precautions'}. The danger of international travel is vastly overstated. Use the same awareness you would in any unfamiliar city. Full guide: [Is ${d.name} Safe?](/blog/is-${d.id}-safe-solo-travel-guide)

## Getting Around

${d.transport.slice(0, 2).map(t => `- ${t}`).join('\n')}

See our [complete transport guide](/blog/getting-around-${d.id}-transportation) for maps and tips.

## Your Confidence Will Build Fast

By day 2 or 3, the anxiety evaporates and the excitement takes over. ${d.name} rewards curiosity, and the infrastructure makes it hard to truly get lost or stuck. You'll come home wondering why you waited so long.`;
}

function luxuryIntro(d: Destination): string {
  return `${d.name} has plenty of expensive options. Not all of them are worth the money.

This guide separates genuine luxury — experiences where premium spending delivers premium value — from tourist traps with high prices and mediocre delivery. If you're going to spend ${usd(d.budget[2])}+/day, every dollar should earn its place.`;
}

function luxurySections(d: Destination): string {
  return `## Where to Stay

Skip the international chain hotels unless you need points. ${d.name}'s best luxury stays are boutique properties in **${areaName(d.areas[0])}** or **${areaName(d.areas[1])}** that offer something a Hilton can't — local character, personal service, and a sense of place.

Budget: ${usd(Math.round(d.budget[2] * 0.5))}–${usd(d.budget[2])}/night for genuine luxury. See [Where to Stay in ${d.name}](/blog/where-to-stay-in-${d.id}).

## Dining Worth Dressing Up For

- **${foodName(d.foods[0])}** at a top-tier restaurant — the elevated version of this local classic.
- **${foodName(d.foods[1])}** — worth a reservation at a specialist establishment.
- ${d.continent === 'Asia' ? 'Fine dining here offers extraordinary value compared to equivalents in London or New York.' : 'Expect prices comparable to major international dining cities.'}

Full food guide: [What to Eat in ${d.name}](/blog/what-to-eat-in-${d.id}).

## Experiences Worth the Premium

${d.romantic.slice(0, 3).map((r, i) => `${i + 1}. **${r}** — ${i === 0 ? 'The signature splurge. Book in advance.' : 'Worth every penny for the right traveler.'}`).join('\n')}

## What's NOT Worth Premium Pricing

- **Airport VIP services** in ${d.name} — unless you're connecting through a nightmare terminal, save the ${usd(100)}+.
- **Hotel restaurant dinners** — almost always inferior to independent restaurants at the same price point.
- **Private guides for standard tourist sites** — a ${usd(20)} audio guide often provides better information than a ${usd(200)} private guide at popular attractions.

## The Smart Luxury Strategy

Splurge on **2–3 anchor experiences** and keep everything else comfortable but not extravagant. A ${usd(d.budget[2])}/day budget spent this way feels more luxurious than spreading ${usd(d.budget[2])}/day evenly across every meal and activity.`;
}

function cultureIntro(d: Destination): string {
  return `The culture of ${d.name} isn't something you observe from outside — it's something you walk into, eat through, listen to, and absorb through your skin.

This guide goes beyond temples and museums (though those matter too). It's about the daily rhythms, the street-level art, the music you'll hear coming out of doorways, and the social rituals that reveal what ${d.name} is actually like when the tourists aren't watching.`;
}

function cultureSections(d: Destination): string {
  return `## The Cultural Layer Cake

### The Famous Layer

**${d.attractions[0]}** and **${d.attractions[1]}** are the cultural headliners, and they earn it. Visit them — but also study them. Read a paragraph about their history before you go. The difference between "that's a nice building" and "I understand why this exists" is the difference between tourism and travel.

### The Street Layer

This is where culture actually lives:

- **${areaName(d.areas[0])}** — ${d.areas[0].includes('—') ? d.areas[0].split('—')[1].trim() : 'The cultural heart of the city'}
- **${areaName(d.areas[1])}** — ${d.areas[1].includes('—') ? d.areas[1].split('—')[1].trim() : 'A neighborhood with its own distinct cultural identity'}
- Walk these areas without a destination. The discoveries are the point.

### The Hidden Layer

- ${d.hidden[0]}
- ${d.hidden[1] || d.hidden[0]}

These places don't appear in standard guides. See [Hidden Gems in ${d.name}](/blog/hidden-gems-${d.id}).

## Food as Culture

In ${d.name}, food isn't separate from culture — it *is* culture. **${foodName(d.foods[0])}** tells you something about ${d.name}'s values. **${foodName(d.foods[1])}** reveals something about its history.

Eat at local places. Ask questions. Watch how other diners eat. You'll learn more in one meal than in an hour at a museum.

Full food guide: [What to Eat in ${d.name}](/blog/what-to-eat-in-${d.id})

## After Dark

${d.nightlife.length > 0 ? d.nightlife.map(n => `- **${n}**`).join('\n') : `${d.name}'s evening culture is more about food and conversation than clubs and bars.`}

Read more: [${d.name} at Night](/blog/things-to-do-in-${d.id}-at-night)

## Cultural Etiquette

${d.etiquette.slice(0, 3).map(e => `- ${e}`).join('\n')}

Full guide: [${d.name} Cultural Dos and Don'ts](/blog/${d.id}-cultural-dos-and-donts)`;
}

function curiousIntro(d: Destination): string {
  return `${d.name} rewards curiosity more than most destinations. The surface-level experience is good. The deeper you go, the better it gets.

This guide is for travelers who read plaques, ask locals questions, take detours down interesting-looking streets, and judge a city by its bookshops and markets more than its monuments.`;
}

function curiousSections(d: Destination): string {
  return `## Start With the Obvious (Then Go Deeper)

**${d.attractions[0]}** is where every tourist goes. Go too — but then ask yourself *why* it's the most-visited site. What does its prominence tell you about ${d.name}'s values, history, or self-image? That question leads you somewhere interesting.

**${d.attractions[1]}** rewards a second look even more. The details most people miss are the most revealing ones.

## The Neighborhoods Nobody Tells You About

- **${d.hidden[0]}** — This is the ${d.name} that locals know and tourists miss.
- **${d.hidden[1] || d.hidden[0]}** — A completely different angle on the city.
- **${areaName(d.areas[d.areas.length - 1])}** — The neighborhood that shows you where ${d.name} is heading, not just where it's been.

More: [Hidden Gems in ${d.name}](/blog/hidden-gems-${d.id})

## The Questions That Make the Trip

Before each day, pick one question to explore:
- "What do people in ${d.name} do on a normal Tuesday?"
- "Why does this neighborhood look so different from that one?"
- "What's the most contentious thing about ${d.name} that locals actually debate?"
- "Where would I live if I moved here?"

These questions make you look at the city differently. They turn passive sightseeing into active discovery.

## Eat Curiously

- Try **${foodName(d.foods[0])}** at three different places and compare.
- Ask your server what *they* order when they eat here.
- Visit the local market and buy something you can't identify. Ask the vendor what it is.

Full food guide: [What to Eat in ${d.name}](/blog/what-to-eat-in-${d.id})

## Read Before You Go

One book or long article about ${d.name} will 10x your experience. You don't need to become an expert — you need just enough context to ask better questions and notice more details.

## The Curious Traveler's Budget

Curious travel is cheap. Walking is free. Markets are free. Conversations are free. The experiences that reward curiosity most in ${d.name} cost ${usd(0)}–${usd(Math.round(d.budget[0] * 0.3))}.

Full budget: [${d.name} on a Budget](/blog/${d.id}-on-a-budget)`;
}

// ---------------------------------------------------------------------------
// Template 4 — Mistakes Tourists Always Make in [City]
// ---------------------------------------------------------------------------

function templateTouristMistakes(dest: Destination): BlogEntry {
  const slug = `tourist-mistakes-in-${dest.id}`;
  const title = `${getMistakeCount(dest)} Mistakes Tourists Always Make in ${dest.name} (And How to Avoid Them)`;
  const description = `The most common tourist mistakes in ${dest.name} — from money traps to cultural blunders. Learn from other travelers' errors and have a better trip.`.slice(0, 160);

  const mistakes = generateMistakes(dest);

  const content = `# ${getMistakeCount(dest)} Mistakes Tourists Always Make in ${dest.name} (And How to Avoid Them)

Every destination has its learning curve. ${dest.name} is no exception. The difference between a frustrating trip and an incredible one often comes down to knowing which mistakes to avoid before you make them.

These aren't obscure edge cases. They're the errors that first-time visitors to ${dest.name} make over and over — and they're all preventable.

${mistakes}

## The Meta-Mistake: Not Adapting

The biggest mistake isn't on this list because it's the mistake behind all the other mistakes: **expecting ${dest.name} to work like home.**

${dest.name} has its own logic. Its own pace. Its own version of "how things are done." The faster you stop measuring it against where you came from, the faster you start enjoying it for what it is.

The travelers who love ${dest.name} most are the ones who arrived curious, not demanding.

## How to Prepare

The best defense against tourist mistakes is preparation. These guides cover everything on this list in more detail:

${relatedLinks(dest)}

${toolLinks(dest)}
${cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Travel Tips',
    tags: [dest.name, dest.country, 'tourist mistakes', 'travel tips', 'what to avoid', 'common errors'],
    author_slug: 'james-miller',
    reading_time: estimateReadingTime(content),
    cover_image_alt: `Tourist navigating ${dest.name}, ${dest.country} — avoiding common mistakes`,
    cluster: 'insider-tips',
    imgId: dest.imgId,
  };
}

function getMistakeCount(dest: Destination): number {
  // Generate between 11-15 mistakes depending on data richness
  const base = 11;
  const bonus = (dest.etiquette.length > 2 ? 1 : 0)
    + (dest.safety.length > 2 ? 1 : 0)
    + (dest.tips.length > 4 ? 1 : 0)
    + (dest.foods.length > 4 ? 1 : 0);
  return base + bonus;
}

function generateMistakes(dest: Destination): string {
  const mistakes: string[] = [];
  let num = 1;

  // 1. Money/exchange mistake (universal)
  mistakes.push(`## ${num}. Exchanging Money at the Airport

${dest.continent === 'Asia' || dest.continent === 'Africa' || dest.continent === 'South America'
    ? `Airport exchange rates in ${dest.name} are 10–20% worse than what you'll find in the city. You're literally throwing away money before your trip even starts.`
    : `Airport exchange counters charge premium rates and commissions. It's not dramatic, but over a week it adds up.`}

**Instead:** ${dest.budget[0] < 50
    ? `Withdraw ${dest.currency} from a local ATM in the city (your bank's foreign transaction fee is almost always smaller than the airport exchange markup). Or bring clean USD/EUR and exchange at a licensed city exchange office.`
    : `Use a travel-friendly debit card with no foreign transaction fees at a city ATM. Withdraw enough for a few days at a time.`}

For a complete money guide, see [${dest.name} on a Budget](/blog/${dest.id}-on-a-budget).`);
  num++;

  // 2. Eating near attractions
  mistakes.push(`## ${num}. Eating Next to ${dest.attractions[0]}

Every restaurant within a 2-minute walk of **${dest.attractions[0]}** charges 40–80% more for food that's 40–80% worse. They survive on foot traffic, not quality. The kitchen knows you'll never come back.

**Instead:** Walk 5–10 minutes in any direction. Look for places where locals are eating, not places with laminated picture menus in four languages. The meal will be better, cheaper, and more memorable.

Our [food guide](/blog/what-to-eat-in-${dest.id}) has specific neighborhood recommendations.`);
  num++;

  // 3. Over-planning
  mistakes.push(`## ${num}. Cramming Too Much Into Each Day

The classic first-timer error: a minute-by-minute itinerary with 8 stops per day, no travel time budgeted, and no margin for the unexpected. By day 3, you're exhausted, resentful, and you've seen a lot of things without actually experiencing any of them.

**Instead:** Plan 2–3 anchors per day, max. Leave gaps. The best moments in ${dest.name} are the ones you didn't schedule — the side street you wandered down, the cafe you stumbled into, the conversation with a local that changed your perspective.

Use [Faroway's itinerary builder](/create) to create a flexible plan that adapts to your pace.`);
  num++;

  // 4. Transport mistake (destination-specific)
  mistakes.push(`## ${num}. ${getTransportMistake(dest)}

${getTransportMistakeDetail(dest)}

Full transport guide: [Getting Around ${dest.name}](/blog/getting-around-${dest.id}-transportation).`);
  num++;

  // 5. Cultural blunder
  if (dest.etiquette.length > 0) {
    mistakes.push(`## ${num}. Ignoring Local Customs

${dest.etiquette[0]}. ${dest.etiquette[1] || ''} These aren't optional suggestions — they're baseline expectations. Ignoring them marks you as a disrespectful tourist and can genuinely offend people who are otherwise welcoming.

**Instead:** Spend 10 minutes reading about ${dest.name}'s cultural norms before you go. Our [cultural etiquette guide](/blog/${dest.id}-cultural-dos-and-donts) covers everything you need to know.`);
    num++;
  }

  // 6. Accommodation mistake
  mistakes.push(`## ${num}. Staying in the Wrong Neighborhood

Where you stay in ${dest.name} matters more than most travelers realize. The "convenient" hotel next to the train station might save you 15 minutes of commuting but cost you the experience of actually living in the city.

**${areaName(dest.areas[0])}** is safe and central but can feel touristy. **${areaName(dest.areas[1])}** gives you a more authentic experience at better prices. Neither is wrong — but choosing blindly often is.

**Instead:** Read our [neighborhood guide](/blog/${dest.id}-neighborhoods-where-to-base-yourself) and pick an area that matches your priorities.`);
  num++;

  // 7. Peak season mistake
  mistakes.push(`## ${num}. Visiting During Peak Season Without Preparing for It

**${dest.peakSeason}** brings the best weather — and the worst crowds. Prices for accommodation spike 30–50%. Popular attractions develop hour-long queues. If you visit during peak, that's fine — but plan accordingly.

**Instead:** ${dest.bestTime !== dest.peakSeason
    ? `Consider visiting during **${dest.bestTime}** instead. Or if peak season is non-negotiable, book accommodation 3+ months ahead, buy skip-the-line tickets where available, and visit popular sites at opening time.`
    : `Book everything far in advance. Arrive at popular attractions before 9 AM. Accept that some spots will be crowded and build that into your expectations.`}

Use our [Best Time to Visit tool](/tools/best-time-to-visit/${dest.id}) to find the optimal window.`);
  num++;

  // 8. Budget mistake
  mistakes.push(`## ${num}. Using a Budget Number From a 2019 Blog Post

Costs change. Inflation is real. That blog post saying you can "travel ${dest.name} for ${usd(Math.round(dest.budget[0] * 0.5))}/day" was either written years ago or by someone with a very different definition of "travel."

**Realistic 2026 budgets:**
- Budget: **${usd(dest.budget[0])}/day** (basic accommodation, street food, public transport)
- Comfortable: **${usd(dest.budget[1])}/day** (private room, restaurant meals, occasional taxis)
- Luxury: **${usd(dest.budget[2])}+/day** (boutique hotels, fine dining, private tours)

Get a personalized estimate: [Trip Cost Calculator](/tools/trip-cost/${dest.id}).`);
  num++;

  // 9. Packing mistake
  if (dest.packing.length > 0) {
    mistakes.push(`## ${num}. Packing Wrong for the Climate

${dest.name}'s climate is **${dest.climate.toLowerCase()}**. Tourists consistently ${dest.climate.toLowerCase().includes('tropical') || dest.climate.toLowerCase().includes('hot')
      ? 'underestimate the heat and humidity. You will sweat through cotton in an hour. You need moisture-wicking fabrics.'
      : dest.climate.toLowerCase().includes('cold')
        ? 'underdress. Layers are essential — the temperature swing between a heated museum and the street outside is dramatic.'
        : 'pack for the wrong season or fail to account for temperature variations throughout the day.'}

**Specifics:**
${dest.packing.slice(0, 3).map(p => `- ${p}`).join('\n')}

Generate a custom packing list: [Packing List Tool](/tools/packing-list).

Also see: [${dest.name} Packing Essentials](/blog/${dest.id}-packing-list-essentials).`);
    num++;
  }

  // 10. Safety mistake
  mistakes.push(`## ${num}. Being Either Too Paranoid or Too Careless

Both extremes are mistakes. Some tourists arrive so afraid of scams and theft that they can't relax. Others wander around with phones hanging out of back pockets and wallets on cafe tables.

${dest.safety[0] || `${dest.name} is generally safe for tourists.`}

**The sweet spot:** Standard urban awareness. Secure your valuables. Be cautious in crowded areas. Don't flash expensive items. And then relax and enjoy the trip.

Full safety details: [Is ${dest.name} Safe?](/blog/is-${dest.id}-safe-solo-travel-guide).`);
  num++;

  // 11. Not exploring beyond the center
  mistakes.push(`## ${num}. Never Leaving the Tourist Center

If you only visit **${dest.attractions[0]}**, **${dest.attractions[1]}**, and **${dest.attractions[2] || dest.attractions[0]}**, you've seen ${dest.name}'s highlight reel but not ${dest.name} itself. The city beyond the top-10 list is where the actual character lives.

**Instead:** Dedicate at least one full day to exploring a non-touristy neighborhood. **${dest.hidden[0]}** is a great starting point. Take a day trip: [Best Day Trips from ${dest.name}](/blog/best-day-trips-from-${dest.id}).`);
  num++;

  // 12. Tipping mistake (if enough etiquette data)
  if (dest.etiquette.length > 1) {
    mistakes.push(`## ${num}. Getting Tipping Wrong

Tipping culture in ${dest.name} is ${dest.continent === 'Asia' ? 'different from Western norms. In many contexts, tipping is not expected and can even cause confusion' : dest.continent === 'Europe' ? 'more restrained than in North America. Rounding up the bill or adding 5–10% is standard' : dest.continent === 'North America' ? 'expected and consequential. 15–20% at sit-down restaurants isn\'t a bonus — it\'s part of how the system works' : 'worth researching before your first meal'}.

**Instead:** Research tipping norms for ${dest.country} specifically. Our [cultural etiquette guide](/blog/${dest.id}-cultural-dos-and-donts) has the details.`);
    num++;
  }

  // 13. Not trying the food (if food-rich destination)
  if (dest.foods.length >= 4) {
    mistakes.push(`## ${num}. Eating "Safe" Food the Entire Trip

Yes, the hotel buffet is familiar. Yes, the McDonald's is predictable. But you flew to ${dest.name} — one of the ${dest.foods.length >= 6 ? 'great eating cities of ' + dest.continent : 'places where food is part of the cultural identity'}. Eating only what you recognize at home is like going to a concert and wearing earplugs.

**Start gentle:** **${foodName(dest.foods[0])}** is accessible and delicious. **${foodName(dest.foods[1])}** is a natural next step. By day 3, you'll be ordering things you can't pronounce and loving every bite.

The full food map: [What to Eat in ${dest.name}](/blog/what-to-eat-in-${dest.id}).`);
    num++;
  }

  // 14. Forgetting travel insurance
  mistakes.push(`## ${num}. Skipping Travel Insurance

This is the mistake you don't regret until you do — and then you regret it enormously. A medical emergency in ${dest.name} without insurance can cost thousands. A missed connection or stolen luggage is painful but survivable; a hospital bill in a foreign country is neither.

**A basic policy costs ${usd(30)}–${usd(80)} for a week.** That's less than one nice dinner in ${dest.name}. Get it.`);
  num++;

  // 15. Not using technology wisely
  mistakes.push(`## ${num}. Not Setting Up Your Phone Before You Arrive

Arriving in ${dest.name} without offline maps, a translation app, or a way to access the internet is a self-imposed handicap. ${dest.continent === 'Asia' ? 'Local ride-hailing apps like Grab are essential.' : 'Navigation apps will save you hours of confusion.'}

**Before you leave home:**
- Download offline maps (Google Maps or Maps.me)
- ${dest.lang.toLowerCase().includes('english') ? 'Install a translation app for menu reading' : `Install Google Translate with ${dest.lang.split(',')[0].split('(')[0].trim()} downloaded for offline use`}
- Research local SIM/eSIM options (usually ${usd(5)}–${usd(15)} for a week of data)
- Save your accommodation address in the local language on your phone

Read our [first-time tips](/blog/${dest.id}-travel-tips-first-time-visitors) for the complete tech checklist.`);

  return mistakes.join('\n\n');
}

function getTransportMistake(dest: Destination): string {
  if (dest.continent === 'Asia') return 'Taking Taxis When Transit Is Better (and Cheaper)';
  if (dest.continent === 'Europe') return 'Not Buying a Transit Pass on Day One';
  if (dest.continent === 'North America') return 'Relying Entirely on Ride-Shares';
  if (dest.continent === 'South America') return 'Trusting Unmarked Taxis';
  if (dest.continent === 'Africa') return 'Not Arranging Transport in Advance';
  if (dest.continent === 'Middle East') return 'Walking When Distances Are Deceptive';
  if (dest.continent === 'Oceania') return 'Underestimating Distances Between Areas';
  return 'Not Planning Your Transportation';
}

function getTransportMistakeDetail(dest: Destination): string {
  const transport = dest.transport;

  if (dest.continent === 'Asia') {
    return `${dest.name}'s ${transport[0] || 'public transit'} is fast, air-conditioned, and costs a fraction of taxis. Meanwhile, road traffic is often gridlocked. A 20-minute metro ride becomes a 45-minute, ${usd(Math.round(dest.budget[0] * 0.2))} taxi ride during rush hour.

**Instead:** ${transport[0] || 'Use public transit for most trips.'} Reserve taxis for late-night trips or when you're carrying heavy luggage.`;
  }

  if (dest.continent === 'Europe') {
    return `Individual transit tickets in ${dest.name} cost ${usd(2)}–${usd(4)} each. Take 4 rides a day for a week and you've spent ${usd(60)}+. A multi-day pass typically costs ${usd(15)}–${usd(30)} and pays for itself by day 2.

**Instead:** Buy a transit pass at the airport or the first metro station you see. ${transport[0] || 'The public transit system covers virtually all tourist areas.'}`;
  }

  return `${transport[0] || 'Transportation in ' + dest.name + ' requires some advance planning.'}

**Instead:** Research transport options before you arrive. ${transport[1] || 'A combination of public transit and occasional ride-shares usually works best.'}`;
}

// ---------------------------------------------------------------------------
// Template generators array + main export
// ---------------------------------------------------------------------------

const templateGenerators: Array<(dest: Destination) => BlogEntry> = [
  templateHonestGuide,      // 1 — sarah-chen
  templateNeighborhoods,    // 2 — james-miller
  templateTravelerType,     // 3 — sarah-chen
  templateTouristMistakes,  // 4 — james-miller
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function generateAllPosts(destinations: Destination[]): BlogEntry[] {
  const posts: BlogEntry[] = [];

  for (const dest of destinations) {
    for (let ti = 0; ti < templateGenerators.length; ti++) {
      const post = templateGenerators[ti](dest);
      // Use per-template image if available, otherwise fall back to shared imgId
      if (dest.imgIds && dest.imgIds[ti]) {
        post.imgId = dest.imgIds[ti];
      }
      posts.push(post);
    }
  }

  return posts;
}
