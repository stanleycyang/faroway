import type { Destination } from './destinations';

export interface BlogEntry {
  slug: string;
  title: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  author_slug: string;
  reading_time: number;
  cover_image_alt: string;
  cluster: string | null;
  imgId: string;
}

// Helper functions
function estimateReadingTime(content: string): number {
  const words = content.split(/\s+/).length;
  return Math.max(3, Math.ceil(words / 230));
}

function cta(dest: Destination): string {
  return `\n\n---\n\n*Planning a trip to ${dest.name}? [Let Faroway create your perfect itinerary](/) — it's free and takes just 60 seconds.*`;
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

// Template 1: Weekend in [City]
export function templateWeekendGuide(dest: Destination): BlogEntry {
  const slug = `weekend-in-${dest.id}`;
  const title = `Weekend in ${dest.name}: The Perfect 48-Hour Itinerary`;
  const description = `Make the most of 48 hours in ${dest.name} with this weekend itinerary. Top attractions, best food, and insider tips for a perfect short break.`.slice(0, 160);

  const topAttractions = pick(dest.attractions, 4);
  const topFoods = pick(dest.foods, 3);
  const topAreas = pick(dest.areas, 2);

  const content = `# Weekend in ${dest.name}: The Perfect 48-Hour Itinerary

You've got 48 hours in ${dest.name}. That's not much time to explore one of ${dest.continent}'s most captivating cities, but it's enough to fall in love. This weekend guide focuses on the absolute must-sees, the best local food, and a realistic pace that won't leave you exhausted.

## Quick Facts

| Detail | Information |
|---|---|
| **Best time for a weekend** | ${dest.bestTime} |
| **Budget (2 days)** | ${usd(dest.budget[0] * 2)} budget to ${usd(dest.budget[2] * 2)} luxury |
| **Getting around** | ${dest.transport[0]} |
| **Currency** | ${dest.currency} |

## Friday Evening: Arrival & First Impressions

Most weekend travelers arrive Friday evening. Drop your bags at your hotel in **${topAreas[0].split(' —')[0]}** and head straight out to experience the city's pulse.

**6:00 PM — Dinner in the Heart of the City**

Start with ${topFoods[0]}. This is ${dest.name}'s signature dish and you'll find excellent versions throughout the city, but locals recommend eating it fresh at ${topAreas[1].split(' —')[0]}.

**8:00 PM — Evening Walk**

${dest.name} reveals a completely different character at night. Walk through ${topAttractions[0]} as the lights come on. ${dest.photoSpots[0] || 'The main square'} is particularly beautiful at dusk.

**Insider tip:** ${dest.tips[0]}

## Saturday: The Full ${dest.name} Experience

### Morning (8:00 AM - 12:00 PM)

Wake up early. ${dest.name} mornings are special — fewer crowds, better light for photos, and the locals are out living their daily routines.

**8:00 AM — Breakfast Like a Local**

${topFoods[1]} is the traditional breakfast choice. Find a local café in ${topAreas[0].split(' —')[0]} and watch the city wake up over your meal.

**9:30 AM — ${topAttractions[0]}**

This is ${dest.name}'s most iconic attraction and it deserves at least 90 minutes of your time. ${dest.tips[1] || 'Arrive early to avoid crowds.'}

**11:30 AM — ${topAttractions[1]}**

From here, it's a short walk to ${topAttractions[1]}, another essential sight. Budget an hour for exploration.

### Afternoon (12:00 PM - 6:00 PM)

**12:30 PM — Lunch**

By now you're hungry. ${topFoods[2]} is perfect for lunch. The best versions are found in ${topAreas[1].split(' —')[0]}.

**2:00 PM — ${topAttractions[2] || 'Local Museum'}**

Spend the afternoon at ${topAttractions[2] || 'the local museum'}. ${dest.name}'s history and culture come alive here, and it's a good escape if the weather turns.

**4:30 PM — Coffee Break & Neighbourhood Walk**

Grab a coffee and explore ${topAreas[1].split(' —')[0]} on foot. This is where you'll find ${dest.name}'s true character — away from the guidebook sights.

**Hidden gem:** ${dest.hidden[0] || 'Ask locals for recommendations'}

### Evening (6:00 PM onwards)

**6:00 PM — Sunset**

Head to ${dest.photoSpots[1] || dest.photoSpots[0] || 'a viewpoint'} for the best sunset view in the city.

**7:30 PM — Dinner**

Saturday night deserves something special. Book ahead for dinner at a restaurant in ${topAreas[0].split(' —')[0]} or ${topAreas[1].split(' —')[0]}.

**9:30 PM — ${dest.name} After Dark**

${dest.nightlife[0] || 'The nightlife district'} comes alive after 10 PM. Whether you want cocktails, live music, or dancing, you'll find it here.

## Sunday: Last Morning & Departure

### Morning (8:00 AM - 12:00 PM)

**8:00 AM — Final Breakfast**

Return to that café you loved yesterday, or try somewhere new in a different neighbourhood.

**9:30 AM — ${topAttractions[3] || 'Market Visit'}**

Spend your last morning at ${topAttractions[3] || 'the local market'}. ${dest.shopping[0] || 'The market'} is perfect for last-minute souvenirs and authentic local atmosphere.

**11:00 AM — Departure**

Head to the airport or train station. You've experienced the best of ${dest.name} in just 48 hours.

## Where to Stay

For a weekend trip, location is everything. Stay in **${topAreas[0].split(' —')[0]}** for easy access to everything, or **${topAreas[1].split(' —')[0]}** for a more authentic local vibe.

**Budget:** ${usd(dest.budget[0] * 2)} for two nights in a hostel or basic hotel  
**Mid-range:** ${usd(dest.budget[1] * 2)} for a good 3-star hotel  
**Luxury:** ${usd(dest.budget[2] * 2)} and up for boutique hotels or upscale chains

## What to Skip

With only 48 hours, some things have to wait for next time:

- ${dest.dayTrips[0]} — this deserves a full day
- Extensive shopping — save it for a longer trip
- Museum marathons — pick one or two, not five

## Final Tips for Your Weekend

1. **${dest.tips[0]}**
2. **${dest.tips[1] || 'Book key attractions in advance'}**
3. **${dest.safety[0] || 'The city is generally safe for tourists'}**
4. **${dest.etiquette[0] || 'Respect local customs'}**

## Beyond the Weekend

If you fall in love with ${dest.name} (and you will), these day trips are worth extending your stay:

- **${dest.dayTrips[0]}**
- **${dest.dayTrips[1] || dest.dayTrips[0]}**

${cta(dest)}

*Related: [Best Time to Visit ${dest.name}](/blog/best-time-to-visit-${dest.id}) | [${dest.name} Travel Guide](/destinations/${dest.id})*`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Guides',
    tags: [dest.name, dest.country, 'weekend trip', 'city break', '48 hours', dest.continent.toLowerCase()],
    author_slug: 'alex-chen',
    reading_time: estimateReadingTime(content),
    cover_image_alt: `${dest.name} city view`,
    cluster: 'destination-guides',
    imgId: dest.imgId,
  };
}

// Template 2: Solo Travel Guide
export function templateSoloTravel(dest: Destination): BlogEntry {
  const slug = `solo-travel-guide-${dest.id}`;
  const title = `Solo Travel in ${dest.name}: Everything You Need to Know`;
  const description = `Is ${dest.name} good for solo travelers? Absolutely. Safety tips, where to meet people, best hostels, and what to do alone in ${dest.name}.`.slice(0, 160);

  const safetyTips = pick(dest.safety, 3);
  const socialPlaces = pick([...dest.nightlife, ...dest.areas], 3);
  const soloActivities = pick(dest.attractions, 4);

  const content = `# Solo Travel in ${dest.name}: Everything You Need to Know

Traveling solo to ${dest.name}? You're in for an incredible experience. ${dest.tagline} — and it's even better when you're traveling on your own terms, at your own pace, meeting people when you want to and enjoying solitude when you don't.

This guide covers everything solo travelers need to know: is it safe, where to meet other travelers, what to do alone, and how to make the most of your solo ${dest.name} adventure.

## Is ${dest.name} Safe for Solo Travelers?

**Short answer:** ${safetyTips[0]}

${dest.name} is ${dest.safety.length > 2 ? 'generally welcoming to solo travelers' : 'considered safe'}, but like anywhere, common sense matters.

**Safety essentials:**

1. **${safetyTips[0]}**
2. **${safetyTips[1] || 'Keep valuables secure'}**
3. **${safetyTips[2] || 'Stay aware of your surroundings'}**

**Solo female travelers:** ${dest.name} is ${dest.safety.length > 1 ? 'manageable for women traveling alone' : 'relatively safe'}. ${dest.etiquette[0] || 'Dress and behave respectfully.'} Trust your instincts and avoid walking alone late at night in unfamiliar areas.

## Where to Meet Other Travelers

Solo doesn't have to mean lonely. ${dest.name} has a thriving traveler scene if you know where to look.

### Best Hostels for Solo Travelers

Stay in **${dest.areas[0].split(' —')[0]}** or **${dest.areas[1].split(' —')[0]}** for the best hostel scene. Look for hostels that organize:

- Walking tours
- Pub crawls
- Cooking classes
- Group dinners

Budget: ${usd(dest.budget[0])} per night in a dorm

### Social Spots to Meet People

- **${socialPlaces[0]}** — ${dest.nightlife.length > 0 ? 'the main backpacker hangout zone' : 'a popular area for travelers'}
- **${socialPlaces[1] || dest.areas[1].split(' —')[0]}** — coffee shops and co-working spaces
- **${socialPlaces[2] || dest.attractions[0]}** — join a free walking tour here

**Pro tip:** Use apps like Meetup, Couchsurfing (for events, not hosting), or Bumble BFF to connect with locals and other solo travelers.

## What to Do Alone in ${dest.name}

Some experiences are actually better solo. Here's what to prioritize:

### 1. ${soloActivities[0]}

This is ${dest.name}'s most iconic sight. Going solo means you can spend as long as you want here without anyone rushing you. ${dest.tips[0] || 'Visit early for the best experience.'}

### 2. ${soloActivities[1] || soloActivities[0]}

Perfect for solo exploration. Bring headphones and a good podcast, or just soak it in at your own pace.

### 3. ${dest.shopping[0] || 'Local Market'}

Markets are ideal for solo travelers — you can wander, sample street food, and pick up souvenirs without coordinating with anyone.

### 4. ${soloActivities[2] || dest.attractions[2] || 'Museum Visit'}

Museums and galleries are made for solo travel. You can read every placard or skip straight to what interests you.

## Solo Dining in ${dest.name}

Eating alone can feel awkward at first, but it's liberating once you get past the initial discomfort.

**Best solo dining options:**

- **Street food:** ${dest.foods[0]} is perfect eaten standing at a stall
- **Counter seating:** Look for ${dest.foods[1]} spots with bar seating
- **Markets:** ${dest.shopping[0] || 'The main market'} has dozens of food stalls
- **Lunch:** Midday meals feel less conspicuous for solo diners

**Insider tip:** ${dest.tips[1] || 'Bring a book or phone for solo meals if it makes you comfortable.'}

## Day Trips You Can Do Solo

These excursions from ${dest.name} are easy to do independently:

1. **${dest.dayTrips[0]}** — join a group tour or take public transport
2. **${dest.dayTrips[1] || dest.dayTrips[0]}** — easily done as a solo traveler

## Budget Breakdown for Solo Travelers

Solo travel often costs more per person (no room sharing), but ${dest.name} is ${dest.budget[0] < 40 ? 'very affordable' : 'manageable'} even on your own.

**Daily budget (solo):**

- **Hostel dorm:** ${usd(dest.budget[0])}
- **Food (3 meals + snacks):** ${usd(dest.budget[0] * 0.6)} - ${usd(dest.budget[1] * 0.5)}
- **Transport:** ${usd(Math.round(dest.budget[0] * 0.2))}
- **Attractions:** ${usd(Math.round(dest.budget[0] * 0.3))}
- **Total:** ${usd(dest.budget[0] * 2)} - ${usd(dest.budget[1])} per day

## Practical Solo Travel Tips

1. **${dest.tips[0]}**
2. **Keep your phone charged** — essential for maps, translation, and emergency contacts
3. **${dest.transport[0]}** — learn the public transport system
4. **${dest.etiquette[0] || 'Learn a few local phrases'}** — it opens doors
5. **Trust your gut** — if something feels off, leave

## What to Pack for Solo ${dest.name}

- **${dest.packing[0]}**
- **${dest.packing[1] || 'Comfortable walking shoes'}**
- **Portable charger** — you'll use your phone constantly for navigation
- **Small daypack** with anti-theft zippers
- **${dest.packing[2] || 'Weather-appropriate clothing'}**

## Staying Connected

- Buy a local SIM card at the airport — data makes solo travel infinitely easier
- Download offline maps of ${dest.name} before you arrive
- Share your itinerary with someone back home

## Solo Travel in ${dest.name}: Worth It?

Absolutely. ${dest.name} is ${dest.safety.length > 1 ? 'welcoming to independent travelers' : 'manageable for solo adventurers'}, the infrastructure is ${dest.transport.length > 1 ? 'solid' : 'adequate'}, and you'll meet plenty of other travelers if you want company.

Going solo means you can:
- Sleep in or wake up early without compromise
- Spend three hours in ${dest.attractions[0]} if you want to
- Change plans on a whim
- Push yourself outside your comfort zone

That's the magic of solo travel.

${cta(dest)}

*Related: [${dest.name} Safety Guide](/blog/${dest.id}-safety-guide) | [Budget Travel in ${dest.name}](/blog/${dest.id}-on-a-budget)*`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Tips',
    tags: [dest.name, 'solo travel', 'backpacking', dest.country, 'independent travel', 'safety'],
    author_slug: 'maria-garcia',
    reading_time: estimateReadingTime(content),
    cover_image_alt: `Solo traveler exploring ${dest.name}`,
    cluster: 'solo-travel',
    imgId: dest.imgId,
  };
}

// Template 3: Digital Nomad Guide
export function templateDigitalNomad(dest: Destination): BlogEntry {
  const slug = `digital-nomad-guide-${dest.id}`;
  const title = `Digital Nomad Guide to ${dest.name}: Coworking, Cost of Living & Visa`;
  const description = `Thinking of remote working from ${dest.name}? This digital nomad guide covers visas, coworking spaces, cost of living, and best neighborhoods for location-independent workers.`.slice(0, 160);

  const workFriendlyAreas = pick(dest.areas, 3);
  const monthlyCost = dest.budget[1] * 30;

  const content = `# Digital Nomad Guide to ${dest.name}: Working Remotely from ${dest.country}

${dest.name} has quietly become one of ${dest.continent}'s rising digital nomad destinations. ${dest.tagline} — and increasingly, it's a city where you can live, work, and thrive as a location-independent professional.

This guide covers everything digital nomads need to know: visa options, internet reliability, coworking spaces, monthly costs, and the best neighborhoods for remote workers.

## Why ${dest.name} for Digital Nomads?

**Pros:**
- ${dest.budget[0] < 50 ? '**Affordable cost of living** — significantly cheaper than most Western cities' : 'Reasonable cost of living for the quality of life'}
- **${dest.climate}** — ${dest.bestTime} is particularly pleasant for working
- **Time zone:** ${dest.continent === 'Asia' ? 'Works well for Asian/European collaboration' : dest.continent === 'Europe' ? 'Central European time zone ideal for global teams' : 'Convenient for Americas-based remote work'}
- **${dest.transport[0]}** — getting around is easy

**Cons:**
- ${dest.safety.length > 2 ? 'Some safety considerations in certain areas' : 'Limited coworking scene compared to major digital nomad hubs'}
- Language barrier: ${dest.lang !== 'English' ? `Most locals speak ${dest.lang}, not English` : 'English widely spoken'}
- Visa situation: ${dest.country === 'United States' || dest.country === 'Canada' ? 'Tourist visas only, no digital nomad visa' : 'Check current visa requirements'}

## Internet & Connectivity

**Speed:** ${dest.continent === 'Asia' || dest.continent === 'Europe' ? 'Generally excellent — fiber optic is common in major areas' : 'Adequate in urban centers, varies elsewhere'}

**Reliability:** ${dest.continent === 'Asia' ? 'Very reliable' : dest.continent === 'Europe' ? 'Solid' : 'Generally stable with occasional outages'}

**Cafe wifi:** Most cafés in **${workFriendlyAreas[0].split(' —')[0]}** and **${workFriendlyAreas[1].split(' —')[0]}** have wifi, but it's not always fast enough for video calls.

**Best option:** Get a local SIM with unlimited data as backup. Expect to pay ${usd(20)}-${usd(40)} per month for excellent mobile data.

## Coworking Spaces

${dest.name} ${workFriendlyAreas.length > 2 ? 'has a growing coworking scene' : 'offers some coworking options'}, especially in **${workFriendlyAreas[0].split(' —')[0]}**.

**Recommended spaces:**
- **${workFriendlyAreas[0].split(' —')[0]}** — main coworking hub
- **${workFriendlyAreas[1].split(' —')[0]}** — quieter, more local vibe
- **${workFriendlyAreas[2]?.split(' —')[0] || dest.areas[0].split(' —')[0]}** — budget-friendly options

**Costs:**
- **Day pass:** ${usd(10)}-${usd(20)}
- **Monthly membership:** ${usd(100)}-${usd(250)}
- **Dedicated desk:** ${usd(200)}-${usd(400)}

**Cafe working:** Expect to buy a coffee every 2-3 hours if you're working from cafés. ${usd(3)}-${usd(6)} per coffee.

## Best Neighborhoods for Digital Nomads

### 1. ${workFriendlyAreas[0].split(' —')[0]}

${workFriendlyAreas[0]}

**Why nomads love it:**
- Most cafés and coworking spaces
- International food options
- Easy to meet other remote workers

**Monthly rent:** ${usd(monthlyCost * 0.7)} - ${usd(monthlyCost * 1.2)} for a one-bedroom apartment

### 2. ${workFriendlyAreas[1].split(' —')[0]}

${workFriendlyAreas[1]}

**Why it works:**
- More authentic local experience
- Often cheaper than the main expat areas
- Good mix of cafés and quiet work spots

**Monthly rent:** ${usd(monthlyCost * 0.5)} - ${usd(monthlyCost * 0.9)}

### 3. ${workFriendlyAreas[2]?.split(' —')[0] || dest.areas[2]?.split(' —')[0] || 'Outskirts'}

${workFriendlyAreas[2] || dest.areas[2] || 'Quieter residential neighborhoods away from tourist areas'}

**Good for:**
- Longer stays (3+ months)
- Those seeking quiet and routine
- Budget-conscious nomads

**Monthly rent:** ${usd(monthlyCost * 0.4)} - ${usd(monthlyCost * 0.7)}

## Cost of Living Breakdown

Here's what you can expect to spend per month as a digital nomad in ${dest.name}:

| Expense | Budget | Comfortable | Luxury |
|---|---|---|---|
| **Accommodation** | ${usd(monthlyCost * 0.4)} | ${usd(monthlyCost * 0.7)} | ${usd(monthlyCost * 1.2)} |
| **Food & groceries** | ${usd(monthlyCost * 0.3)} | ${usd(monthlyCost * 0.5)} | ${usd(monthlyCost * 0.8)} |
| **Coworking/cafés** | ${usd(monthlyCost * 0.15)} | ${usd(monthlyCost * 0.25)} | ${usd(monthlyCost * 0.35)} |
| **Transport** | ${usd(monthlyCost * 0.1)} | ${usd(monthlyCost * 0.15)} | ${usd(monthlyCost * 0.25)} |
| **Entertainment** | ${usd(monthlyCost * 0.1)} | ${usd(monthlyCost * 0.2)} | ${usd(monthlyCost * 0.4)} |
| **TOTAL** | **${usd(Math.round(monthlyCost))}** | **${usd(Math.round(monthlyCost * 1.8))}** | **${usd(Math.round(monthlyCost * 3))}** |

## Visa Options

${dest.country === 'Thailand' ? '**Tourist visa:** 60 days on arrival, extendable once for 30 days\n**Digital Nomad Visa:** Available for qualifying remote workers' : dest.country === 'Portugal' ? '**D7 Visa:** Passive income visa popular with digital nomads\n**Tourist visa:** 90 days visa-free for most nationalities' : dest.country === 'Mexico' ? '**Tourist visa:** 180 days on arrival\n**Temporary resident visa:** Available for those with proof of income' : '**Check current requirements** — visa policies change frequently'}

**Visa runs:** ${dest.dayTrips.length > 0 ? `Popular visa run destinations include ${dest.dayTrips[0].split(' —')[0]}` : 'Consult with local immigration'}

## Digital Nomad Community

**Finding other nomads:**
- Facebook groups: "Digital Nomads ${dest.name}"
- Meetup.com events in ${workFriendlyAreas[0].split(' —')[0]}
- Coworking space events
- ${dest.nightlife[0] || 'Local expat bars'}

**Networking events:** ${workFriendlyAreas.length > 2 ? 'Regular meetups happen in the coworking spaces' : 'Growing but limited compared to major nomad hubs'}

## Day-to-Day Life

**Groceries:** ${dest.shopping[0] || 'Local markets'} for fresh produce, international supermarkets for familiar brands

**Eating out:** ${dest.foods[0]} costs ${usd(dest.budget[0] * 0.2)} at a local spot, ${usd(dest.budget[1] * 0.4)} at a mid-range restaurant

**Fitness:** Gyms cost ${usd(30)}-${usd(60)} per month

**Healthcare:** ${dest.safety.length > 1 ? 'Good private healthcare available' : 'Adequate private clinics'}. Get travel insurance with coverage in ${dest.country}.

## Best Time to Visit as a Nomad

**${dest.bestTime}** is ideal for digital nomads:
- ${dest.climate}
- ${dest.peakSeason.includes('season') ? 'Avoid peak tourist season for better prices and fewer crowds' : `Peak season (${dest.peakSeason}) brings higher prices`}
- ${dest.tips[0] || 'Weather is most predictable during these months'}

## Practical Tips for Digital Nomads

1. **${dest.tips[0]}**
2. **Set up a routine** — ${workFriendlyAreas[0].split(' —')[0]} has the infrastructure for a good work-life rhythm
3. **${dest.transport[0]}** — learn it in your first week
4. **Learn basic ${dest.lang}** — especially for dealing with landlords and service providers
5. **${dest.etiquette[0] || 'Respect local customs'}**

## The Verdict: Is ${dest.name} Good for Digital Nomads?

**Yes, if you want:**
- ${dest.budget[0] < 50 ? 'Affordable cost of living' : 'Good value for money'}
- ${dest.continent === 'Asia' ? 'Asian culture and timezone' : dest.continent === 'Europe' ? 'European base with good connectivity' : 'Unique cultural experience'}
- ${dest.climate.includes('warm') || dest.climate.includes('tropical') ? 'Warm weather year-round or seasonally' : 'Four distinct seasons'}

**Skip it if you need:**
- Massive coworking scene like Bali or Lisbon
- Large existing digital nomad community
- English as the primary language everywhere

${cta(dest)}

*Related: [Cost of Living in ${dest.name}](/blog/${dest.id}-cost-of-living) | [Best Neighborhoods in ${dest.name}](/blog/best-neighborhoods-${dest.id})*`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Lifestyle',
    tags: [dest.name, 'digital nomad', 'remote work', 'coworking', dest.country, 'cost of living'],
    author_slug: 'james-wilson',
    reading_time: estimateReadingTime(content),
    cover_image_alt: `Digital nomad workspace in ${dest.name}`,
    cluster: 'digital-nomads',
    imgId: dest.imgId,
  };
}
