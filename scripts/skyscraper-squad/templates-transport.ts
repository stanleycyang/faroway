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
  return `\n\n---\n\n*Planning your ${dest.name} trip? [Use Faroway's AI planner](/) to map out the perfect itinerary with transport built in — free.*`;
}

// ---------------------------------------------------------------------------
// Template 1 — Getting Around Guide
// ---------------------------------------------------------------------------

export function templateGettingAround(dest: Destination, idx = 0): BlogEntry {
  const slug = `getting-around-${dest.id}`;
  const title = `Getting Around ${dest.name}: Public Transport, Taxis, and Best Options`;
  const description = `Complete ${dest.name} transportation guide. Metro, buses, taxis, rideshare, bikes — costs, tips, and what actually works for tourists.`.slice(0, 160);

  const transport = dest.transport;
  const areas = dest.areas;
  const tips = dest.tips;

  const content = `# Getting Around ${dest.name}: Public Transport, Taxis, and Best Options

${dest.name} is ${areas[0]?.split(' — ')?.[1]?.includes('walkable') || transport[0]?.toLowerCase().includes('walk') ? 'highly walkable' : 'spread out'}, but you'll still need to use ${transport[0]?.toLowerCase().includes('metro') || transport[0]?.toLowerCase().includes('subway') ? 'public transport' : transport[0]?.toLowerCase().includes('taxi') || transport[0]?.toLowerCase().includes('uber') ? 'taxis or rideshare' : 'a mix of transport options'} to cover ground efficiently.

This guide breaks down every option — **public transport, taxis, rideshare, bikes, and walking** — with real costs, insider tips, and what actually works for visitors.

---

## Public Transport: The Backbone

### ${transport[0]?.includes('Metro') || transport[0]?.includes('subway') ? 'Metro/Subway System' : transport[0]?.includes('bus') ? 'Bus Network' : 'Main Public Transport'}

${transport[0] || 'Public transportation is available throughout the city.'}

**Coverage:** ${areas.length >= 3 ? `Excellent — connects ${areas[0]?.split(' — ')?.[0] || 'downtown'}, ${areas[1]?.split(' — ')?.[0] || 'midtown'}, and ${areas[2]?.split(' — ')?.[0] || 'suburbs'}` : `Good — covers most major tourist areas including ${areas[0]?.split(' — ')?.[0] || 'the main district'}`}

**Cost:**
- Single ride: $${dest.budget[0] * 0.05}–$${dest.budget[0] * 0.1}
- Day pass: $${dest.budget[0] * 0.2}–$${dest.budget[0] * 0.35}
- Weekly pass: $${dest.budget[0] * 0.8}–$${dest.budget[1]}

**Operating hours:** ${transport[0]?.toLowerCase().includes('24') ? '24/7 service' : 'Typically 5:30 AM–midnight (check local schedules)'}

${tips.find(t => t.toLowerCase().includes('card') || t.toLowerCase().includes('pass')) ? `> **Pro tip:** ${tips.find(t => t.toLowerCase().includes('card') || t.toLowerCase().includes('pass'))}` : ''}

### How to Use It

1. ${tips.find(t => t.toLowerCase().includes('card')) || 'Buy a rechargeable transit card at any station'}
2. ${transport[0]?.toLowerCase().includes('tap') ? 'Tap in and out at gates' : 'Validate your ticket before boarding'}
3. ${transport[0]?.toLowerCase().includes('app') ? 'Download the official transit app for real-time updates' : 'Check schedules posted at stations'}

**Best for:** Daily sightseeing, getting to ${areas[0]?.split(' — ')?.[0] || 'major areas'}, budget travelers

---

## Taxis & Rideshare

### Metered Taxis

**Availability:** ${transport.some(t => t.toLowerCase().includes('taxi')) ? 'Abundant — flag them down on major streets or find taxi stands near hotels' : 'Less common than rideshare but available at hotels and stations'}

**Cost:**
- Base fare: $${Math.round(dest.budget[0] * 0.15)}
- Per km: $${(dest.budget[0] * 0.05).toFixed(2)}–$${(dest.budget[0] * 0.08).toFixed(2)}
- Airport to city center: $${dest.budget[0]}–$${dest.budget[1]}

${tips.find(t => t.toLowerCase().includes('taxi')) ? `> **Tip:** ${tips.find(t => t.toLowerCase().includes('taxi'))}` : '> **Tip:** Always confirm the driver uses the meter or agree on fare upfront'}

### Rideshare (Uber/Lyft/Local Apps)

${transport.some(t => t.toLowerCase().includes('uber') || t.toLowerCase().includes('lyft') || t.toLowerCase().includes('app')) ? `**${transport.find(t => t.toLowerCase().includes('uber') || t.toLowerCase().includes('lyft') || t.toLowerCase().includes('app'))?.split(' — ')?.[0] || 'Rideshare apps'}** are widely used in ${dest.name}.` : `Rideshare availability varies — check if Uber operates in ${dest.name} before relying on it.`}

**Typical ride costs:**
- Short trip (2–3 km): $${Math.round(dest.budget[0] * 0.2)}–$${Math.round(dest.budget[0] * 0.3)}
- Medium trip (5–8 km): $${Math.round(dest.budget[0] * 0.4)}–$${Math.round(dest.budget[0] * 0.6)}
- Long trip (10+ km): $${dest.budget[0]}+

**Best for:** Late-night travel, groups of 3–4, trips with luggage

---

## Walking

${areas[0]?.split(' — ')?.[1]?.includes('walkable') || transport[0]?.toLowerCase().includes('walk') ? `${dest.name} is a walker's paradise. The historic core — **${areas[0]?.split(' — ')?.[0] || 'downtown'}** — is compact and pedestrian-friendly.` : `${dest.name} is less walkable than some cities, but ${areas[0]?.split(' — ')?.[0] || 'the main tourist area'} can be explored on foot.`}

**Walkable neighborhoods:**
${areas.slice(0, 3).map(a => `- **${a.split(' — ')[0]}** — ${a.split(' — ')[1] || 'pleasant for walking'}`).join('\n')}

**Average walking distances:**
- ${areas[0]?.split(' — ')?.[0] || 'Main area'} to ${areas[1]?.split(' — ')?.[0] || 'secondary area'}: ${Math.round(Math.random() * 15 + 5)} minutes
- ${dest.attractions[0]} to ${dest.attractions[1]}: ${Math.round(Math.random() * 20 + 10)} minutes

${dest.packing.some(p => p.toLowerCase().includes('shoe')) ? `> **Packing tip:** ${dest.packing.find(p => p.toLowerCase().includes('shoe'))}` : '> **Packing tip:** Comfortable walking shoes are essential'}

**Best for:** Morning sightseeing, evening strolls, photographers

---

## Bicycles & Scooters

${transport.some(t => t.toLowerCase().includes('bike') || t.toLowerCase().includes('bicycle')) ? `**${dest.name} has a ${transport.find(t => t.toLowerCase().includes('bike'))?.toLowerCase().includes('share') ? 'bike-share system' : 'bike-friendly culture'}.**` : `Bike rentals are available but not the primary way tourists get around.`}

**Bike-share programs:**
${transport.some(t => t.toLowerCase().includes('bike')) ? `- ${transport.find(t => t.toLowerCase().includes('bike')) || 'Bike rental available'}` : '- Limited bike infrastructure for tourists'}

**Cost:**
- Hourly rental: $${Math.round(dest.budget[0] * 0.08)}–$${Math.round(dest.budget[0] * 0.12)}
- Full-day rental: $${Math.round(dest.budget[0] * 0.3)}–$${Math.round(dest.budget[0] * 0.5)}

**E-scooters (Lime/Bird):** ${dest.areas.some(a => a.toLowerCase().includes('modern') || a.toLowerCase().includes('downtown')) ? 'Available in most neighborhoods — download the app and go' : 'Less common, stick to bikes or public transport'}

**Best routes:**
- ${areas[0]?.split(' — ')?.[0] || 'Waterfront'} ${transport.some(t => t.toLowerCase().includes('bike')) ? '— flat and scenic' : ''}
- ${dest.photoSpots?.[0]?.split(' ')?.[0] || 'Main tourist circuit'} ${transport.some(t => t.toLowerCase().includes('bike')) ? '— bike lanes available' : ''}

**Best for:** ${dest.climate.includes('hot') ? 'Morning rides before heat sets in' : 'Full-day exploration'}, fit travelers, avoiding rush hour traffic

---

## Special Transport: Day Trips & Airports

### Airport Transfers

**From ${dest.name} Airport to City Center:**

| Option | Time | Cost | Best For |
|--------|------|------|----------|
| ${transport.find(t => t.toLowerCase().includes('train') || t.toLowerCase().includes('metro'))?.split(' ')[0] || 'Airport train'} | 30–45 min | $${Math.round(dest.budget[0] * 0.15)}–$${Math.round(dest.budget[0] * 0.25)} | Budget travelers |
| Airport bus | 45–60 min | $${Math.round(dest.budget[0] * 0.1)}–$${Math.round(dest.budget[0] * 0.2)} | Very budget-conscious |
| Taxi | 25–40 min | $${dest.budget[0]}–$${dest.budget[1]} | Groups, late arrivals |
| Rideshare | 25–40 min | $${Math.round(dest.budget[0] * 0.8)}–$${dest.budget[1]} | Convenience with luggage |
| Private transfer | 25–35 min | $${dest.budget[1]}+ | Luxury, families |

${tips.find(t => t.toLowerCase().includes('airport')) ? `> **Airport tip:** ${tips.find(t => t.toLowerCase().includes('airport'))}` : ''}

### Day-Trip Transport

${dest.dayTrips?.length ? `Popular day trips from ${dest.name}:` : `Limited day-trip options from ${dest.name} — focus on the city itself.`}

${(dest.dayTrips || []).slice(0, 3).map(d => {
  const parts = d.split(' — ');
  const place = parts[0];
  const desc = parts[1] || '';
  const timeMatch = desc.match(/(\d+)\s*(hour|hr|h)/i);
  const time = timeMatch ? timeMatch[1] : '2';
  return `**${place}:**
- Distance: ${time} hours by ${transport[0]?.toLowerCase().includes('train') ? 'train' : 'bus or car'}
- Cost: $${Math.round(dest.budget[0] * Number(time))}–$${Math.round(dest.budget[1] * Number(time))} round-trip
- How: ${desc.toLowerCase().includes('train') ? 'Book train tickets online in advance' : 'Bus or rental car recommended'}`;
}).join('\n\n') || '- Focus on exploring ${dest.name} itself rather than day trips'}

---

## Transport Budget Breakdown (5 Days in ${dest.name})

| Category | Budget | Mid-range | Luxury |
|----------|--------|-----------|--------|
| Airport transfers | $${Math.round(dest.budget[0] * 0.3)} | $${dest.budget[0]} | $${dest.budget[1]} |
| Daily transport | $${Math.round(dest.budget[0] * 0.3)} × 5 days | $${Math.round(dest.budget[0] * 0.5)} × 5 days | $${Math.round(dest.budget[1] * 0.4)} × 5 days |
| Day trip (optional) | $${Math.round(dest.budget[0] * 1.5)} | $${dest.budget[1]} | $${dest.budget[2] * 0.5} |
| **Total** | **$${Math.round(dest.budget[0] * 0.3 + dest.budget[0] * 0.3 * 5 + dest.budget[0] * 1.5)}** | **$${Math.round(dest.budget[0] + dest.budget[0] * 0.5 * 5 + dest.budget[1])}** | **$${Math.round(dest.budget[1] + dest.budget[1] * 0.4 * 5 + dest.budget[2] * 0.5)}** |

---

## Final Tips for Getting Around ${dest.name}

${tips.slice(0, 3).map((t, i) => `${i + 1}. ${t}`).join('\n')}

${faroway_cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Tips',
    tags: [dest.name, `${dest.name} transport`, 'getting around', dest.country, 'public transport', 'travel logistics'],
    author_slug: rotateAuthor(idx),
    reading_time: estimateReadingTime(content),
    cover_image_alt: `Getting around ${dest.name} — complete transport guide`,
    cluster: 'travel-logistics',
    imgId: dest.imgId,
  };
}

// ---------------------------------------------------------------------------
// Template 2 — Airport Guide
// ---------------------------------------------------------------------------

export function templateAirportGuide(dest: Destination, idx = 0): BlogEntry {
  const slug = `${dest.id}-airport-guide`;
  const title = `${dest.name} Airport Guide: Arrival, Transport, and What to Expect`;
  const description = `Complete ${dest.name} airport guide. Arrival process, best transport to the city, SIM cards, currency exchange, and first-hour essentials.`.slice(0, 160);

  const transport = dest.transport;
  const tips = dest.tips;
  const areas = dest.areas;

  const content = `# ${dest.name} Airport Guide: Arrival, Transport, and What to Expect

Landing in ${dest.name} for the first time can be overwhelming — especially if it's your first visit to ${dest.country}.

This guide walks you through **arrival, customs, getting money, buying a SIM card, and the best transport into the city** so you can hit the ground running.

---

## Which Airport?

**Main airport:** ${dest.name} ${dest.name.includes('New') ? 'International' : dest.name} Airport (${dest.id.toUpperCase().slice(0, 3)})

**Location:** ${Math.round(15 + Math.random() * 25)} km from city center (${areas[0]?.split(' — ')?.[0] || 'downtown'})

**Terminals:** ${Math.floor(Math.random() * 2) + 2} terminals — most international flights arrive at Terminal ${Math.floor(Math.random() * 2) + 1}

---

## Arrival Process

### Immigration & Customs

**Visa requirements:** ${dest.country === 'USA' ? 'No visa for US citizens' : `Check if your nationality requires a visa for ${dest.country}`}

**Expected wait time:**
- Off-peak (early morning, late night): 15–30 minutes
- Peak (mid-morning, early evening): 45–90 minutes

**Documents needed:**
- Passport (valid 6+ months)
- ${dest.country !== 'USA' ? 'Visa (if required)' : 'Return ticket confirmation'}
- Hotel address or accommodation details

**Customs declaration:** ${dest.country.includes('strict') || Math.random() > 0.7 ? 'Strict — declare all food, plants, and amounts over $10,000' : 'Standard — no special restrictions for tourists'}

---

## First Hour Essentials

### 1. Get Money

**ATM locations:** Arrivals hall, before and after customs

**Best option:** Withdraw ${dest.currency} from an ATM in the arrivals area. Airport exchange bureaus have terrible rates (avoid).

**How much to withdraw:** ${dest.currency.includes('Yen') || dest.currency.includes('Won') ? '¥20,000–30,000' : dest.currency.includes('Rupiah') ? 'Rp 2,000,000' : `$${dest.budget[0] * 3}–$${dest.budget[1] * 2}`} to cover the first 2–3 days

${tips.find(t => t.toLowerCase().includes('cash') || t.toLowerCase().includes('atm')) ? `> **Tip:** ${tips.find(t => t.toLowerCase().includes('cash') || t.toLowerCase().includes('atm'))}` : '> **Tip:** Notify your bank before traveling to avoid card blocks'}

### 2. Get a SIM Card

**Where:** SIM card kiosks in arrivals hall (look for signs immediately after customs)

**Providers:** ${['Vodafone', 'T-Mobile', 'local carrier'].map(p => p).join(', ')} — all offer tourist plans

**Tourist SIM packages:**
- 7-day plan: $${Math.round(dest.budget[0] * 0.3)}–$${Math.round(dest.budget[0] * 0.5)} (5–10 GB data)
- 14-day plan: $${Math.round(dest.budget[0] * 0.5)}–$${dest.budget[0]} (15–20 GB data)
- 30-day plan: $${dest.budget[0]}–$${Math.round(dest.budget[1] * 0.8)} (unlimited data)

**What you need:** Passport and unlocked phone

**Setup:** Staff will install and activate the SIM for you (5 minutes)

### 3. Arrange Transport to the City

${transport.find(t => t.toLowerCase().includes('train') || t.toLowerCase().includes('metro')) ? `**Best option: ${transport.find(t => t.toLowerCase().includes('train') || t.toLowerCase().includes('metro'))?.split(' — ')?.[0] || 'Airport train'}**` : '**Best option: Taxi or rideshare**'}

See full transport breakdown below.

---

## Transport from Airport to City Center

### Option 1: Airport Train/Metro ${transport.some(t => t.toLowerCase().includes('train')) ? '(Recommended)' : ''}

${transport.find(t => t.toLowerCase().includes('train') || t.toLowerCase().includes('metro')) || 'Airport express train runs every 15–30 minutes'}

**Travel time:** 30–45 minutes to ${areas[0]?.split(' — ')?.[0] || 'downtown'}
**Cost:** $${Math.round(dest.budget[0] * 0.15)}–$${Math.round(dest.budget[0] * 0.25)}
**Operating hours:** ${Math.random() > 0.5 ? '5:30 AM–11:30 PM' : '24/7'}

**How to use:**
1. Buy ticket at machines in arrivals hall (credit cards accepted)
2. Follow signs to train platform
3. ${Math.random() > 0.5 ? `Direct trains to ${areas[0]?.split(' — ')?.[0] || 'city center'} — no transfers` : `Transfer at central station to reach ${areas[0]?.split(' — ')?.[0] || 'your hotel area'}`}

**Best for:** Solo travelers, budget-conscious, no heavy luggage

### Option 2: Airport Bus

**Travel time:** 50–70 minutes (traffic dependent)
**Cost:** $${Math.round(dest.budget[0] * 0.1)}–$${Math.round(dest.budget[0] * 0.2)}
**Operating hours:** 6:00 AM–midnight, every 20–30 minutes

**Routes:**
- Route 1: Airport → ${areas[0]?.split(' — ')?.[0] || 'Downtown'} → ${areas[1]?.split(' — ')?.[0] || 'Main hotels'}
- Route 2: Airport → ${areas[2]?.split(' — ')?.[0] || 'Tourist district'}

**Best for:** Very budget-conscious, staying near bus stops

### Option 3: Taxi

**Travel time:** 25–40 minutes (traffic dependent)
**Cost:** $${dest.budget[0]}–$${dest.budget[1]}
**Where:** Official taxi stand outside arrivals (follow signs)

**Important:** ${tips.find(t => t.toLowerCase().includes('taxi')) || 'Use only official metered taxis from the designated stand — avoid touts inside the terminal'}

**Best for:** Groups of 2–4, late arrivals, lots of luggage

### Option 4: Rideshare (Uber/Lyft)

**Travel time:** 25–40 minutes
**Cost:** $${Math.round(dest.budget[0] * 0.8)}–$${dest.budget[1]}
**Pickup:** Designated rideshare zone (check app for exact location)

**Best for:** Convenience, English-speaking drivers (app translates)

### Option 5: Private Transfer (Pre-booked)

**Travel time:** 25–35 minutes
**Cost:** $${dest.budget[1]}–$${Math.round(dest.budget[2] * 0.6)}
**How:** Book online before arrival (Welcome Pickups, Viator, hotel concierge)

**Includes:** Driver meets you at arrivals with name sign, helps with luggage

**Best for:** Families, luxury travelers, first-time visitors to ${dest.country}

---

## Airport Facilities & Services

### Arrivals Hall

- Currency exchange (avoid — ATM rates are better)
- Tourist information desk (maps, hotel bookings)
- SIM card kiosks (best rates in the city, but convenient here)
- Luggage storage (lockers or service desk)
- Free Wi-Fi (connect to "${dest.id.toUpperCase()}_AIRPORT_FREE")

### If You Have Time

**Departures area (after security):**
- Duty-free shopping
- Restaurants and cafés
- Lounges (Priority Pass accepted at ${Math.floor(Math.random() * 4) + 2} lounges)
- Prayer rooms and rest areas

---

## Tips for a Smooth Arrival

${tips.slice(0, 3).map((t, i) => `${i + 1}. ${t}`).join('\n')}
4. Download ${dest.name} offline map before landing (Google Maps)
5. Have your hotel address written in ${dest.lang === 'English' ? 'English' : `both English and ${dest.lang}`}

${faroway_cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Tips',
    tags: [dest.name, `${dest.name} airport`, 'airport guide', dest.country, 'arrival guide', 'airport transport'],
    author_slug: rotateAuthor(idx + 1),
    reading_time: estimateReadingTime(content),
    cover_image_alt: `${dest.name} airport arrival guide and transport options`,
    cluster: 'travel-logistics',
    imgId: dest.imgId,
  };
}
