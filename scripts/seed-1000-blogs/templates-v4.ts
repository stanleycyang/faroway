import type { Destination } from './destinations';
import type { BlogEntry } from './templates';

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

// Template 1: Safety Guide
export function templateSafetyGuide(dest: Destination): BlogEntry {
  const slug = `${dest.id}-safety-guide`;
  const title = `Is ${dest.name} Safe? Complete Safety Guide for Travelers`;
  const description = `Is ${dest.name} safe for tourists? Crime rates, scams to avoid, safe neighborhoods, health tips, and practical safety advice for visiting ${dest.name}.`.slice(0, 160);

  const safetyTips = pick(dest.safety, 3);
  const safeAreas = pick(dest.areas, 3);

  const content = `# Is ${dest.name} Safe? The Complete Safety Guide for Travelers

"Is ${dest.name} safe?" It's one of the most common questions travelers ask before booking a trip. The short answer: **${safetyTips[0] || 'Yes, with normal precautions'}**.

But safety is nuanced. This guide covers everything you need to know about staying safe in ${dest.name}: crime statistics, scams to avoid, safe neighborhoods, health considerations, and practical tips for a worry-free trip.

## Overall Safety Rating

**${dest.name} safety for tourists:** ${dest.safety.length > 2 ? '8/10 — Generally very safe' : dest.safety.length > 1 ? '7/10 — Safe with precautions' : '7/10 — Safe for most travelers'}

**Compared to other ${dest.continent} cities:** ${dest.continent === 'Europe' ? 'On par with most European capitals' : dest.continent === 'Asia' ? 'Safer than many Asian destinations' : dest.continent === 'South America' ? 'Safer than regional reputation suggests' : 'Average for the region'}

**US State Department rating:** Check travel.state.gov for current advisories

## Crime & Personal Safety

### Petty Crime

${safetyTips[0] || 'Pickpocketing exists in tourist areas.'}

**Common petty crimes:**
- Pickpocketing in crowded areas (${dest.attractions[0]}, public transport)
- Bag snatching on busy streets
- Distraction scams

**Prevention:**
- Use a money belt or anti-theft bag
- Keep phones in front pockets
- Stay aware in crowded areas
- Don't flash expensive jewelry or electronics

### Violent Crime

Violent crime against tourists in ${dest.name} is **rare**. ${dest.safety.length > 1 ? safetyTips[1] : 'Exercise normal urban awareness.'}

**Areas to be cautious:**
- ${dest.safety.length > 2 ? safetyTips[2] : 'Unfamiliar neighborhoods late at night'}
- Around train/bus stations after dark
- Empty streets in any area late at night

## Scams to Watch Out For

### 1. The Restaurant Scam
**How it works:** Touts invite you to a restaurant; you're charged 10x the normal price or presented with a hidden "service charge."

**Prevention:** Check menus with prices before sitting; avoid restaurants with aggressive touts

### 2. The Fake Help Scam
**How it works:** Someone offers to "help" with tickets/directions and demands payment

**Prevention:** Use official ticket machines; politely decline unsolicited help

### 3. The Taxi Scam
**How it works:** ${dest.transport[0]?.includes('Taxi') || dest.transport[1]?.includes('Taxi') ? 'Meters "broken" or scenic routes to inflate fares' : 'Unlicensed taxis or inflated fares'}

**Prevention:** Use ride-hailing apps (${dest.transport.some(t => t.includes('Uber') || t.includes('Grab') || t.includes('Bolt')) ? 'Uber, Grab, Bolt' : 'Uber or local equivalents'}); agree on price before getting in

### 4. The Photo Scam
**How it works:** Someone offers to take your photo, then demands payment (or steals your phone)

**Prevention:** Be cautious with strangers offering to photograph you

### 5. ${dest.continent === 'Europe' ? 'The Petition Scam' : dest.continent === 'Asia' ? 'The Gem Scam' : 'The Street Vendor Scam'}
**How it works:** ${dest.continent === 'Europe' ? 'People ask you to sign a petition, then demand donation or pickpocket you' : dest.continent === 'Asia' ? 'Strangers invite you to a gem/suit shop; items are worthless' : 'Aggressive vendors who won\'t take no for an answer'}

**Prevention:** Politely decline and walk away; don't engage

## Safe Neighborhoods

### ${safeAreas[0].split(' —')[0]} — ✅ Very Safe
${safeAreas[0]}

- Well-lit streets at night
- Police presence in tourist areas
- Safe for solo travelers and women

### ${safeAreas[1].split(' —')[0]} — ✅ Safe
${safeAreas[1]}

- Local neighborhood, generally safe
- Exercise normal precautions at night
- Good for budget accommodation

### ${safeAreas[2]?.split(' —')[0] || dest.areas[2]?.split(' —')[0]} — ⚠️ Some Caution
${safeAreas[2] || dest.areas[2]}

- ${safeAreas[2]?.includes('night') ? 'Fine during the day, use caution at night' : 'Stick to main streets after dark'}
- Don't wander into unfamiliar areas late at night

### Areas to Avoid
- ${dest.safety.length > 2 ? safetyTips[2] || 'Industrial areas at night' : 'Areas around the bus station late at night'}
- Poorly lit back streets after midnight
- Any area that feels uncomfortable

## Safety for Solo Travelers

${dest.name} is **${dest.safety.length > 1 ? 'excellent' : 'good'}** for solo travelers.

**Tips:**
- Stay in ${safeAreas[0].split(' —')[0]} for the safest experience
- ${dest.nightlife.length > 1 ? `${dest.nightlife[0]} is safe for solo nights out` : 'Stick to busy areas for evening outings'}
- Trust your instincts — if something feels wrong, leave
- ${dest.tips[0] || 'Share your itinerary with someone at home'}

## Safety for Women Travelers

**Is ${dest.name} safe for women traveling alone?** Yes, with standard precautions.

**Women-specific safety tips:**
- ${dest.etiquette[0] || 'Dress modestly to avoid unwanted attention'}
- Avoid empty train cars at night
- Be cautious accepting drinks from strangers
- Keep hotel/accommodation address handy
- ${dest.safety.length > 1 ? safetyTips[1] : 'Trust your instincts'}

**Catcalling/harassment:** ${dest.continent === 'Europe' ? 'Minimal in tourist areas' : dest.continent === 'Asia' ? 'Rare but possible' : 'Can happen; ignore and keep walking'}

## Health & Medical Safety

### Healthcare Quality
${dest.name} has **${dest.continent === 'Europe' || dest.country === 'Japan' || dest.country === 'Singapore' ? 'excellent' : 'adequate'}** healthcare for tourists.

**Private clinics:** Available in ${safeAreas[0].split(' —')[0]} — expect to pay ${usd(50)}-${usd(200)} for consultations

**Pharmacies:** ${dest.continent === 'Europe' || dest.continent === 'Asia' ? 'Well-stocked and widely available' : 'Available in major areas'}

### Tap Water
${dest.country === 'Japan' || dest.continent === 'Europe' ? '**Safe to drink** from the tap' : '**Bottled water recommended** — avoid tap water and ice in cheaper restaurants'}

### Vaccinations
Check CDC or your national health authority for current recommendations for ${dest.country}.

**Commonly recommended:**
- Routine vaccinations (up to date)
- ${dest.continent === 'Asia' || dest.continent === 'Africa' ? 'Hepatitis A & B' : 'No special vaccinations typically required'}
- ${dest.continent === 'Asia' || dest.continent === 'Africa' || dest.continent === 'South America' ? 'Typhoid (for adventurous eaters)' : ''}

### Travel Insurance
**Essential.** Make sure your policy covers:
- Medical evacuation
- Trip cancellation
- Lost luggage
- ${dest.dayTrips.some(d => d.includes('hik') || d.includes('adventure')) ? 'Adventure activities' : 'Standard coverage'}

## Emergency Contacts

- **Police:** Local emergency number (research before you go)
- **Ambulance:** Same as above
- **Embassy:** Find your country's embassy address in ${dest.name}
- **Hotel:** Save your hotel address and phone number

**Tip:** Screenshot these on your phone and save offline.

## Transport Safety

### ${dest.transport[0]}
${dest.transport[0]}

**Safety rating:** ✅ Safe
- ${dest.transport[0]?.includes('Metro') || dest.transport[0]?.includes('Subway') ? 'Watch for pickpockets in crowded cars' : 'Generally reliable and safe'}

### Taxis
${dest.transport[1] || 'Taxis available'}

**Safety tips:**
- Use official taxi stands or ride apps
- ${dest.transport[1]?.includes('meter') ? 'Insist on the meter' : 'Agree on price before getting in'}
- ${dest.safety.length > 1 ? 'Licensed taxis have ID displayed' : 'Note the taxi number in case of issues'}

### Walking
${dest.name} is ${safeAreas.length > 2 ? 'walkable and safe during the day' : 'generally safe for walking'}.

**Night walking:**
- Stick to well-lit main streets
- Avoid shortcuts through empty areas
- ${dest.tips[0] || 'Trust your instincts'}

## Natural Disasters & Weather

${dest.climate}

**Potential risks:**
- ${dest.climate.includes('earthquake') ? 'Earthquakes possible — know exit routes' : ''}
- ${dest.climate.includes('typhoon') || dest.climate.includes('hurricane') ? 'Seasonal storms — check forecasts' : ''}
- ${dest.climate.includes('flood') ? 'Flooding during monsoon season' : ''}
- ${dest.climate.includes('hot') ? 'Heat exhaustion in summer — stay hydrated' : ''}

## COVID-19 & Health Protocols

Check current ${dest.country} entry requirements before traveling. Requirements change frequently.

**Current typical measures:**
- Vaccination proof (may be required)
- Testing (varies by country)
- Mask requirements (varies)

## Safety Tips Summary

1. **${safetyTips[0] || 'Stay aware of your surroundings'}**
2. **${safetyTips[1] || 'Keep valuables secure'}**
3. **${safetyTips[2] || 'Use official transport'}**
4. **${dest.tips[0] || 'Learn emergency phrases'}**
5. **${dest.etiquette[0] || 'Respect local customs'}**

## The Bottom Line

Is ${dest.name} safe? **Yes.** Millions of tourists visit ${dest.name} every year without incident. Use common sense, stay aware, and you'll have a wonderful trip.

The biggest safety "threat" in ${dest.name}? Probably ${dest.foods[0]?.includes('street') ? 'eating too much delicious street food' : 'spending too much on souvenirs'}.

${cta(dest)}

*Related: [First Time in ${dest.name}](/blog/first-time-visiting-${dest.id}) | [Solo Travel in ${dest.name}](/blog/solo-travel-guide-${dest.id})*`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Tips',
    tags: [dest.name, 'safety', 'travel safety', 'scams', dest.country, 'tips'],
    author_slug: 'omar-hassan',
    reading_time: estimateReadingTime(content),
    cover_image_alt: `Safety guide for ${dest.name}`,
    cluster: 'travel-tips',
    imgId: dest.imgId,
  };
}

// Template 2: Best Neighborhoods
export function templateNeighborhoods(dest: Destination): BlogEntry {
  const slug = `best-neighborhoods-${dest.id}`;
  const title = `Best Neighborhoods in ${dest.name}: Where to Stay & Explore`;
  const description = `Guide to ${dest.name}'s best neighborhoods. Where to stay, eat, and explore in each area — from touristy to local, budget to luxury.`.slice(0, 160);

  const allAreas = dest.areas.slice(0, 5);

  const content = `# Best Neighborhoods in ${dest.name}: The Complete Area Guide

Where you stay in ${dest.name} shapes your entire experience. Each neighborhood has its own character, price point, and vibe — and choosing the right one can make the difference between a good trip and an unforgettable one.

This guide breaks down ${dest.name}'s best neighborhoods: who they're perfect for, where to eat and drink, and what you'll find there.

## Neighborhood Overview Map

${dest.name}'s main neighborhoods:

${allAreas.map((area, i) => `${i + 1}. **${area.split(' —')[0]}** — ${area.split(' —')[1] || 'key district'}`).join('\n')}

## 1. ${allAreas[0].split(' —')[0]}

${allAreas[0]}

### Why Stay Here

**Perfect for:**
- First-time visitors
- Those who want to walk everywhere
- Travelers who prioritize convenience over price

**Not ideal for:**
- Budget travelers
- Those seeking authentic local experiences
- Travelers who dislike crowds

### The Vibe

${allAreas[0].split(' —')[0]} is ${allAreas[0].includes('historic') ? 'historic and photogenic' : allAreas[0].includes('modern') ? 'modern and polished' : allAreas[0].includes('trendy') ? 'trendy and vibrant' : 'the heart of the action'}. Expect ${allAreas[0].includes('tourist') ? 'tourists, cafés, and souvenir shops' : 'a mix of locals and visitors'}.

### Where to Eat

- **Breakfast:** Local café, ${usd(dest.budget[0] * 0.2)}
- **Lunch:** ${dest.foods[0]} at a mid-range spot, ${usd(dest.budget[1] * 0.3)}
- **Dinner:** Fine dining in the area, ${usd(dest.budget[2] * 0.5)}

### Where to Stay

- **Budget:** ${usd(dest.budget[0] * 1.2)} per night
- **Mid-range:** ${usd(dest.budget[1])} per night
- **Luxury:** ${usd(dest.budget[2] * 1.5)} per night

### Highlights

- Walking distance to ${dest.attractions[0]}
- Best restaurant scene in the city
- ${dest.nightlife[0] || 'Active nightlife'}

---

## 2. ${allAreas[1]?.split(' —')[0] || 'Secondary District'}

${allAreas[1] || 'Alternative area for travelers seeking something different'}

### Why Stay Here

**Perfect for:**
- ${allAreas[1]?.includes('local') ? 'Travelers seeking authenticity' : 'Those wanting a quieter base'}
- Budget-conscious visitors
- ${allAreas[1]?.includes('artsy') || allAreas[1]?.includes('bohemian') ? 'Creatives and artists' : 'Families and couples'}

**Not ideal for:**
- ${allAreas[1]?.includes('far') ? 'Those who hate public transport' : 'Party-seekers wanting central nightlife'}

### The Vibe

${allAreas[1]?.split(' —')[0] || 'This district'} feels ${allAreas[1]?.includes('local') ? 'like the real city' : allAreas[1]?.includes('quiet') ? 'peaceful and residential' : 'relaxed and livable'}. ${allAreas[1]?.includes('expat') ? 'Expect a mix of long-term expats and locals' : 'Fewer tourists, more authentic experiences'}.

### Where to Eat

- **Local breakfast:** ${usd(dest.budget[0] * 0.15)}
- **Neighborhood lunch:** ${usd(dest.budget[0] * 0.25)}
- **Dinner:** ${usd(dest.budget[1] * 0.35)}

### Where to Stay

- **Budget:** ${usd(dest.budget[0] * 0.9)} per night
- **Mid-range:** ${usd(dest.budget[1] * 0.8)} per night
- **Vacation rentals:** ${usd(dest.budget[1] * 0.7)} per night

### Highlights

- Better value for money
- ${allAreas[1]?.includes('market') ? 'Local markets and food' : 'Authentic neighborhood life'}
- ${allAreas[1]?.includes('café') || allAreas[1]?.includes('coffee') ? 'Great café culture' : 'Hidden restaurants'}

---

## 3. ${allAreas[2]?.split(' —')[0] || 'Third District'}

${allAreas[2] || 'Another area worth considering'}

### Why Stay Here

**Perfect for:**
- ${allAreas[2]?.includes('business') ? 'Business travelers' : allAreas[2]?.includes('upscale') ? 'Luxury seekers' : 'Those wanting a different perspective'}

### The Vibe

${allAreas[2]?.includes('modern') ? 'Modern and efficient' : allAreas[2]?.includes('old') ? 'Historic and charming' : 'Distinct from the main tourist areas'}.

### Where to Stay

- **Budget:** ${usd(dest.budget[0] * 0.85)} per night
- **Mid-range:** ${usd(dest.budget[1] * 0.9)} per night

---

## 4. ${allAreas[3]?.split(' —')[0] || 'Fourth Area'}

${allAreas[3] || 'Worth exploring for a day trip'}

### Quick Take

${allAreas[3]?.includes('nightlife') ? 'The party district' : allAreas[3]?.includes('art') ? 'The creative quarter' : 'A neighborhood with its own character'}.

**Stay here if:** ${allAreas[3]?.includes('night') ? 'You want to be near bars and clubs' : 'You want to escape the main tourist areas'}

---

## 5. ${allAreas[4]?.split(' —')[0] || dest.dayTrips[0]?.split(' —')[0] || 'Outer District'}

${allAreas[4] || dest.areas[4] || 'On the outskirts of the city'}

### Quick Take

${allAreas[4]?.includes('quiet') || !allAreas[4] ? 'Quieter and more residential' : 'Different character from the center'}.

**Stay here if:** You're renting an apartment for a longer stay or want a completely local experience.

---

## Neighborhood Comparison

| Area | Price | Vibe | Best For |
|---|---|---|---|
| **${allAreas[0]?.split(' —')[0]}** | $$$$ | Central, touristy | First-timers |
| **${allAreas[1]?.split(' —')[0]}** | $$$ | Local, authentic | Mid-stays |
| **${allAreas[2]?.split(' —')[0]}** | $$$ | ${allAreas[2]?.includes('modern') ? 'Modern' : 'Mixed'} | ${allAreas[2]?.includes('business') ? 'Business' : 'Varied'} |
| **${allAreas[3]?.split(' —')[0] || 'Area 4'}** | $$ | ${allAreas[3]?.includes('night') ? 'Lively' : 'Relaxed'} | ${allAreas[3]?.includes('night') ? 'Nightlife' : 'Budget'} |
| **${allAreas[4]?.split(' —')[0] || 'Outskirts'}** | $ | Quiet | Long stays |

## Where to Stay by Travel Style

### First-Time Visitors
**Best area:** ${allAreas[0].split(' —')[0]}

Walk everywhere, see the highlights, soak in the atmosphere. Pay a premium for convenience.

### Budget Travelers
**Best area:** ${allAreas[1]?.split(' —')[0] || allAreas[3]?.split(' —')[0] || 'Secondary district'}

Better prices, still accessible to attractions, more authentic food options.

### Digital Nomads
**Best area:** ${allAreas[1]?.includes('café') || allAreas[2]?.includes('coworking') ? allAreas[1]?.split(' —')[0] || allAreas[2]?.split(' —')[0] : allAreas[1]?.split(' —')[0] || 'Secondary district'}

Good wifi cafés, reasonable monthly rent, livable neighborhood feel.

### Couples & Honeymooners
**Best area:** ${allAreas[0].split(' —')[0]} or ${allAreas[1]?.split(' —')[0]}

Romantic atmosphere, great restaurants, walkable streets.

### Families
**Best area:** ${allAreas[1]?.split(' —')[0] || allAreas[2]?.split(' —')[0]}

More space, quieter streets, family-friendly restaurants.

## Getting Between Neighborhoods

- **${dest.transport[0]}** covers most areas
- Walking between ${allAreas[0].split(' —')[0]} and ${allAreas[1]?.split(' —')[0] || 'neighboring areas'}: ${dest.areas.length > 3 ? '15-30 minutes' : '10-20 minutes'}
- ${dest.transport[1] || 'Taxis available'} for further trips

## Final Recommendation

**First visit?** Stay in **${allAreas[0].split(' —')[0]}** for convenience.

**Been before?** Try **${allAreas[1]?.split(' —')[0] || 'a new neighborhood'}** for a fresh perspective.

**Long stay?** Consider **${allAreas[1]?.split(' —')[0] || allAreas[2]?.split(' —')[0]}** for better value and livability.

${cta(dest)}

*Related: [First Time in ${dest.name}](/blog/first-time-visiting-${dest.id}) | [Where to Stay in ${dest.name}](/destinations/${dest.id})*`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Guides',
    tags: [dest.name, 'neighborhoods', 'where to stay', dest.country, 'areas', 'accommodation'],
    author_slug: 'james-wilson',
    reading_time: estimateReadingTime(content),
    cover_image_alt: `${dest.name} neighborhoods guide`,
    cluster: 'destination-guides',
    imgId: dest.imgId,
  };
}

// Template 3: Hidden Gems
export function templateHiddenGems(dest: Destination): BlogEntry {
  const slug = `${dest.id}-hidden-gems`;
  const title = `Hidden Gems of ${dest.name}: 15 Secret Spots Locals Love`;
  const description = `Discover ${dest.name}'s best-kept secrets. Hidden restaurants, secret viewpoints, local neighborhoods, and off-the-beaten-path attractions.`.slice(0, 160);

  const hiddenSpots = pick([...dest.hidden, ...dest.photoSpots.slice(1)], 6);
  const secretFood = pick(dest.foods.slice(2), 3);
  const localAreas = pick(dest.areas.slice(1), 2);

  const content = `# Hidden Gems of ${dest.name}: Secret Spots the Guidebooks Miss

Every city has two versions: the one tourists see and the one locals love. ${dest.name} is no different.

While ${dest.attractions[0]} gets all the attention, the real magic happens in the neighborhoods, markets, and secret corners that most visitors never find. This guide reveals ${dest.name}'s hidden gems — the places locals actually go, the food that's not in guidebooks, and the experiences that transform a trip into a story.

## Secret Viewpoints

### 1. ${hiddenSpots[0] || dest.photoSpots[1] || 'Hidden Viewpoint'}

${hiddenSpots[0] || `A secret spot with views of ${dest.attractions[0]}`}

**Why it's hidden:** No guidebook mentions it. No tour bus stops here. Just you, the view, and maybe a few locals who know.

**Best time:** ${dest.photoSpots[0]?.includes('sunset') ? 'Sunset' : dest.photoSpots[0]?.includes('sunrise') ? 'Sunrise' : 'Golden hour (1 hour before sunset)'}

**How to find it:** ${hiddenSpots[0]?.includes('walk') ? 'A 10-minute walk from the main area' : 'Ask a local — they will be impressed you know about it'}

### 2. ${hiddenSpots[1] || 'Second Secret Spot'}

${hiddenSpots[1] || 'Another location tourists typically miss'}

**The secret:** ${hiddenSpots[1]?.includes('photo') ? 'The best photography angle in the city' : 'A completely different perspective'}

## Neighborhoods Only Locals Know

### 3. ${localAreas[0]?.split(' —')[0] || 'Local District'}

${localAreas[0] || 'A neighborhood off the tourist map'}

**What you'll find:**
- No souvenirs, no tourist menus
- ${dest.foods[2] || 'Real local food'} at half the price of the center
- Actual ${dest.country} daily life

**Getting there:** ${dest.transport[0]} to the nearest stop, then a 5-minute walk

**What to do:**
- Walk every street without a map
- Eat at the place with no English menu
- Watch daily life unfold

### 4. ${localAreas[1]?.split(' —')[0] || 'Second Local Area'}

${localAreas[1] || 'Another authentic neighborhood'}

**Local tip:** ${dest.tips[0] || 'Visit early morning when locals are doing their daily shopping'}

## Secret Food Spots

### 5. ${secretFood[0] || 'Hidden Restaurant'}

**The dish:** ${dest.foods[1] || 'Local specialty'}

**Why it's secret:** ${secretFood[0]?.includes('family') ? 'Family-run for decades, never advertised' : 'No online presence, word-of-mouth only'}

**Price:** ${usd(dest.budget[0] * 0.2)} — a fraction of tourist restaurant prices

### 6. ${secretFood[1] || 'Second Hidden Food Spot'}

**The dish:** ${dest.foods[2] || 'Another local favorite'}

**Find it:** ${secretFood[1]?.includes('market') ? 'In the back corner of the local market' : 'Down an unmarked alley'}

### 7. ${secretFood[2] || 'Third Food Secret'}

**Local knowledge:** ${dest.tips[1] || 'Order what the person next to you is having'}

## Hidden Cultural Spots

### 8. ${hiddenSpots[2] || 'Secret Museum/Gallery'}

${hiddenSpots[2] || 'A cultural spot tourists overlook'}

**Why it's overlooked:** ${hiddenSpots[2]?.includes('museum') ? 'The famous museum gets all the attention' : 'No marketing, no crowds'}

**Cost:** ${usd(dest.budget[0] * 0.15)} or free

### 9. ${hiddenSpots[3] || 'Hidden Attraction'}

${hiddenSpots[3] || 'Something special off the beaten path'}

**The story:** ${hiddenSpots[3]?.includes('historic') ? 'Centuries of history, minutes of tourist attention' : 'Loved by locals, ignored by guidebooks'}

## Secret Markets & Shops

### 10. ${dest.shopping[0] || 'Local Market'}

**The secret section:** ${dest.shopping[0]?.includes('market') ? 'Skip the tourist entrance and go to the back' : 'The wholesale area where locals actually shop'}

**Best time:** 7-9 AM when vendors are setting up

**What to buy:**
- ${dest.foods[3] || 'Fresh produce'} at local prices
- ${dest.shopping[0]?.includes('craft') ? 'Handmade goods without markup' : 'Things you won\'t find in souvenir shops'}

### 11. ${hiddenSpots[4] || 'Secret Shop'}

${hiddenSpots[4] || 'A local favorite shop or market'}

**Why tourists miss it:** No English sign, no Instagram presence, just quality and authenticity.

## Hidden Day Trips

### 12. ${dest.dayTrips[1]?.split(' —')[0] || dest.dayTrips[0]?.split(' —')[0]}

Everyone goes to ${dest.dayTrips[0]?.split(' —')[0]}. Instead, try ${dest.dayTrips[1]?.split(' —')[0] || 'the less-visited alternative'}.

**Why it's better:**
- Fewer tour buses
- More authentic experience
- ${dest.dayTrips[1]?.includes('nature') ? 'Better nature and scenery' : 'Better local interaction'}

**Getting there:** Public transport (${usd(dest.budget[0] * 0.3)}) vs organized tour (${usd(dest.budget[1] * 1)})

## Secret Experiences

### 13. ${dest.romantic[0] || 'Special Experience'}

${dest.romantic[0] || 'An experience tourists rarely discover'}

**How to arrange:** Ask your hotel concierge, or book directly with local operators

### 14. ${hiddenSpots[5] || 'Hidden Activity'}

${hiddenSpots[5] || 'Something completely off the radar'}

**The insider way:** ${dest.tips[2] || 'Arrive early, stay late, and bring patience'}

### 15. The Best-Kept Secret

**What is it?** Simply wander ${localAreas[0]?.split(' —')[0] || 'a local neighborhood'} with nowhere to be.

**Why it's hidden:** It's not a place — it's a mindset. The best ${dest.name} experiences happen when you stop following guides and start following curiosity.

## How to Find Your Own Hidden Gems

1. **Walk past the first 3 restaurants** — the tourist traps end, real food begins

2. **Ask locals:** "Where do YOU eat lunch?" Not "What should tourists see?"

3. **Get lost on purpose** — put your phone away and wander

4. **Visit twice** — once as a tourist, once as a local

5. **${dest.tips[0] || 'Talk to taxi drivers and shopkeepers'}** — they know everything

## The Tourist Version vs. The Local Version

| Tourist Version | Local Version |
|---|---|
| ${dest.attractions[0]} | ${hiddenSpots[0]?.split(' —')[0] || 'Secret viewpoint'} |
| Central market tourist area | ${dest.shopping[0]?.split(' —')[0] || 'Local market'} back section |
| ${dest.areas[0]?.split(' —')[0]} restaurants | ${localAreas[0]?.split(' —')[0]} hole-in-the-wall |
| Organized tour to ${dest.dayTrips[0]?.split(' —')[0]} | DIY trip to ${dest.dayTrips[1]?.split(' —')[0] || 'alternative destination'} |

## Final Secret

The real hidden gem of ${dest.name} isn't a place — it's a way of experiencing the city. Slow down. Stay curious. Say yes to the unexpected.

The best stories come from the places you weren't planning to go.

${cta(dest)}

*Related: [First Time in ${dest.name}](/blog/first-time-visiting-${dest.id}) | [${dest.name} Travel Guide](/destinations/${dest.id})*`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Guides',
    tags: [dest.name, 'hidden gems', 'secret spots', 'off the beaten path', dest.country, 'local tips'],
    author_slug: 'yuki-tanaka',
    reading_time: estimateReadingTime(content),
    cover_image_alt: `Hidden gems in ${dest.name}`,
    cluster: 'destination-guides',
    imgId: dest.imgId,
  };
}
