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

// Template 1: Family Travel Guide
export function templateFamilyTravel(dest: Destination): BlogEntry {
  const slug = `family-travel-guide-${dest.id}`;
  const title = `${dest.name} with Kids: The Complete Family Travel Guide`;
  const description = `Plan the perfect family trip to ${dest.name}. Kid-friendly attractions, family hotels, restaurants that welcome children, and practical tips for traveling with kids.`.slice(0, 160);

  const familyActivities = pick(dest.family, 3);
  const kidFriendlyFood = pick(dest.foods, 3);
  const familyAreas = pick(dest.areas, 2);

  const content = `# ${dest.name} with Kids: The Complete Family Travel Guide

Traveling to ${dest.name} with children? You're in for an adventure the whole family will remember. ${dest.tagline} — and it's even more magical when experienced through a child's eyes.

This guide covers everything parents need to know: kid-friendly attractions, family hotels, restaurants that welcome children, stroller-friendliness, and practical tips for a smooth family trip.

## Is ${dest.name} Good for Families?

**Absolutely.** Here's why families love ${dest.name}:

- **${familyActivities[0] || dest.attractions[0]}** — genuinely entertaining for all ages
- **${dest.safety[0] || 'Generally safe and family-friendly'}**
- **${dest.climate}** — consider timing with school holidays
- **${dest.transport[0]}** — ${dest.transport.length > 1 ? 'family-friendly transport options' : 'manageable with kids'}

**Best for:** Kids aged 4 and up (under 4s will enjoy it too, but stroller accessibility varies)

## Top Kid-Friendly Attractions

### 1. ${familyActivities[0] || dest.attractions[0]}

${familyActivities[0] || dest.attractions[0]}

**Why kids love it:**
- Interactive and engaging
- Plenty of space to run around
- Educational without feeling like school

**Age range:** ${familyActivities[0]?.includes('museum') ? '5+' : familyActivities[0]?.includes('zoo') || familyActivities[0]?.includes('park') ? '2+' : '4+'}

**Time needed:** 2-3 hours

**Cost:** ${usd(dest.budget[0] * 0.3)} per child, ${usd(dest.budget[0] * 0.5)} per adult

### 2. ${familyActivities[1] || dest.attractions[1]}

${familyActivities[1] || dest.attractions[1]}

**Parent tip:** ${dest.tips[0] || 'Arrive early to avoid crowds'}

**Time needed:** 2-4 hours

### 3. ${familyActivities[2] || dest.attractions[2]}

${familyActivities[2] || dest.attractions[2]}

**Best for:** Kids who love ${familyActivities[2]?.includes('science') ? 'hands-on learning' : familyActivities[2]?.includes('animal') ? 'animals' : 'adventure'}

## Family-Friendly Neighborhoods

### ${familyAreas[0].split(' —')[0]}

${familyAreas[0]}

**Why families like it:**
- Pedestrian-friendly streets
- Close to major attractions
- Good mix of restaurants and cafés

**Family hotels in the area:** ${usd(dest.budget[1] * 0.9)} - ${usd(dest.budget[2] * 1.2)} per night for family rooms

### ${familyAreas[1].split(' —')[0]}

${familyAreas[1]}

**Good for families who want:**
- More space and quieter streets
- Local neighborhood feel
- Better value for money

## Eating Out with Kids

### Kid-Friendly Restaurants

${dest.name} is ${dest.foods.length > 4 ? 'great for family dining' : 'manageable for families'}. Here are the best options:

**${kidFriendlyFood[0]}:**
- Most kids will try it — ${dest.foods[0]?.includes('noodle') || dest.foods[0]?.includes('rice') || dest.foods[0]?.includes('bread') ? 'familiar flavors' : 'order mild versions'}
- Price: ${usd(dest.budget[0] * 0.25)} per child's portion

**${kidFriendlyFood[1]}:**
- Kid-approved flavors
- Easy to share

**${kidFriendlyFood[2]}:**
- Quick service for restless kids
- Finger food friendly

**Tips for dining out:**
1. Lunch is easier than dinner — kids are less tired
2. ${dest.etiquette[0] || 'Local customs apply'} — but families are generally welcomed
3. Pack snacks for between meals
4. Ask for children's portions — many restaurants accommodate

### Self-Catering

If your kids are picky eaters:
- **${dest.shopping[0] || 'Local markets'}** have fresh fruit, bread, and familiar snacks
- Supermarkets carry international brands
- Book accommodation with a kitchenette

## Getting Around with Kids

### Stroller-Friendliness

${dest.name} is ${dest.transport[0]?.includes('Metro') || dest.transport[0]?.includes('Tram') ? 'moderately stroller-friendly' : 'challenging with strollers in some areas'}:

- **${dest.areas[0].split(' —')[0]}** — ${dest.areas[0].includes('cobble') || dest.areas[0].includes('old') ? 'cobblestones make strollers difficult' : 'relatively smooth sidewalks'}
- **Public transport:** ${dest.transport[0]} — ${dest.continent === 'Europe' || dest.continent === 'Asia' ? 'generally stroller-accessible' : 'varies by station'}

**Recommendation:** Bring a lightweight umbrella stroller, or use a baby carrier for flexibility.

### Transport Tips

- **${dest.transport[0]}** — buy a family day pass if available
- **Taxis:** ${dest.transport[1] || 'Available and family-friendly'} — car seats not always available, bring your own
- **Walking:** ${dest.packing[0] || 'Comfortable shoes essential'} — kids tire quickly on cobblestones

## Family Accommodation

### Best Options for Families

**Family-friendly hotels (${usd(dest.budget[1])} - ${usd(dest.budget[2])} per night):**
- Look for: interconnecting rooms, family suites, breakfast included
- Location: ${familyAreas[0].split(' —')[0]} for convenience

**Vacation rentals (${usd(dest.budget[1] * 0.8)} - ${usd(dest.budget[2] * 1.5)} per night):**
- Better value for families of 4+
- Kitchen access for picky eaters
- More space for kids to play

**Budget family options (${usd(dest.budget[0] * 1.5)} - ${usd(dest.budget[1] * 0.7)} per night):**
- Family rooms in guesthouses
- Apartments in local neighborhoods

## Sample Family Itinerary (4 Days)

### Day 1: Arrival & Easy Start
- Settle into hotel
- Explore ${familyAreas[0].split(' —')[0]} neighborhood
- Early dinner at a family-friendly restaurant
- Early bedtime (jetlag management)

### Day 2: Big Attraction Day
- Morning: ${familyActivities[0] || dest.attractions[0]} (2-3 hours)
- Lunch break with playground time
- Afternoon: ${familyActivities[1] || dest.attractions[1]}
- Ice cream reward for the kids

### Day 3: Active Day
- ${dest.dayTrips[0] || 'Day trip from the city'} (kid-friendly version)
- Pack snacks and activities for transport
- Return early for rest time

### Day 4: Local Life & Departure
- ${dest.shopping[0] || 'Market visit'} for souvenirs
- ${familyAreas[1].split(' —')[0]} exploration
- Head to airport

## Practical Tips for Families

### Packing Essentials
1. **${dest.packing[0] || 'Comfortable walking shoes'}** for everyone
2. **${dest.packing[1] || 'Weather-appropriate layers'}**
3. Snacks from home for picky eaters
4. Entertainment for transit (tablets, coloring books)
5. First aid kit with children's medications
6. Favorite stuffed animal or comfort item

### Health & Safety
- **${dest.safety[0] || 'General safety awareness'}**
- Pharmacies stock children's medications
- ${dest.safety[1] || 'Keep kids close in crowded areas'}

### Budget for Families
**Daily family budget (2 adults + 2 kids):**
- Budget: ${usd(dest.budget[0] * 3)}
- Comfortable: ${usd(dest.budget[1] * 3.5)}
- Luxury: ${usd(dest.budget[2] * 4)}

### Best Time to Visit with Kids
**${dest.bestTime}** — ${dest.climate}

**Avoid:** ${dest.peakSeason} if you can — it's more crowded and expensive

**School holiday considerations:** Book accommodation 3-4 months ahead during peak family travel times.

## What Kids Will Remember

- **${familyActivities[0] || dest.attractions[0]}** — the "wow" moment
- **${kidFriendlyFood[0]}** — the new food they tried and loved
- **${familyAreas[0].split(' —')[0]}** — getting lost in the winding streets

${dest.name} creates family memories that last a lifetime. Yes, traveling with kids requires more planning, but the shared experiences are worth every moment.

${cta(dest)}

*Related: [Weekend in ${dest.name}](/blog/weekend-in-${dest.id}) | [${dest.name} Travel Guide](/destinations/${dest.id})*`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Guides',
    tags: [dest.name, 'family travel', 'kids', 'traveling with children', dest.country, 'family vacation'],
    author_slug: 'sofia-costa',
    reading_time: estimateReadingTime(content),
    cover_image_alt: `Family vacation in ${dest.name}`,
    cluster: 'family-travel',
    imgId: dest.imgId,
  };
}

// Template 2: Couples/Romantic Travel
export function templateCouplesTravel(dest: Destination): BlogEntry {
  const slug = `${dest.id}-for-couples`;
  const title = `${dest.name} for Couples: Romantic Experiences & Honeymoon Guide`;
  const description = `Plan a romantic getaway to ${dest.name}. Best hotels for couples, romantic restaurants, sunset spots, and honeymoon-worthy experiences.`.slice(0, 160);

  const romanticExp = pick(dest.romantic, 3);
  const romanticDining = pick(dest.foods, 3);
  const romanticAreas = pick(dest.areas, 2);

  const content = `# ${dest.name} for Couples: The Ultimate Romantic Getaway Guide

${dest.name} is made for lovers. ${dest.tagline} — and when you experience it with someone you love, the city becomes pure romance.

Whether you're planning a honeymoon, anniversary trip, or spontaneous romantic escape, this guide covers everything couples need to know: the best romantic hotels, candlelit restaurants, sunset spots, and experiences designed for two.

## Why ${dest.name} is Perfect for Couples

- **${romanticExp[0] || dest.attractions[0]}** — quintessential romantic experience
- **${dest.climate}** — ${dest.bestTime} is particularly romantic
- **${dest.foods[0]}** — culinary experiences meant for sharing
- **${romanticAreas[0].split(' —')[0]}** — neighborhoods made for wandering hand-in-hand

## Most Romantic Experiences

### 1. ${romanticExp[0] || 'Sunset Experience'}

${romanticExp[0] || `Watch the sunset from ${dest.photoSpots[0] || 'a panoramic viewpoint'}`}

**Why it's romantic:** The city glows golden as day turns to night. This is the moment to pop champagne or simply hold hands in silence.

**Best time:** 1 hour before sunset
**Cost:** ${romanticExp[0]?.includes('dinner') ? usd(dest.budget[2] * 0.8) : 'Free to ' + usd(dest.budget[1] * 0.5)}

### 2. ${romanticExp[1] || 'Intimate Dining'}

${romanticExp[1] || `Private dinner at a ${dest.areas[0].split(' —')[0]} restaurant with candlelight`}

**Reserve ahead:** ${dest.tips[0] || 'Book 1-2 weeks in advance for weekend tables'}

**Cost:** ${usd(dest.budget[2] * 0.6)} - ${usd(dest.budget[2] * 1.2)} for two

### 3. ${romanticExp[2] || 'Special Activity'}

${romanticExp[2] || `Couples experience at a ${dest.name} spa or wellness center`}

**Why couples love it:** Shared experience, relaxation, and quality time together

## Romantic Hotels & Accommodation

### Luxury Romantic Hotels (${usd(dest.budget[2] * 1.5)} - ${usd(dest.budget[2] * 3)} per night)

**What makes them romantic:**
- King beds with city/water views
- Couples spa treatments
- In-room dining options
- Rooftop bars for nightcaps

**Location:** Stay in **${romanticAreas[0].split(' —')[0]}** for the most romantic setting.

### Boutique Romantic Hotels (${usd(dest.budget[1] * 1.2)} - ${usd(dest.budget[2] * 1.2)} per night)

**Perfect for:**
- Intimate atmosphere
- Personal service
- Unique character
- Often in historic buildings

### Budget-Romantic (${usd(dest.budget[1] * 0.7)} - ${usd(dest.budget[1] * 1)} per night)

Romance doesn't require a big budget:
- Clean private rooms in charming guesthouses
- Vacation rentals with romantic balconies
- Breakfast in bed from the local bakery

## Romantic Dining

### Fine Dining for Two

**${romanticDining[0]}** at an upscale restaurant is unmissable. ${dest.name}'s best chefs transform this classic into art.

**Expect to pay:** ${usd(dest.budget[2] * 0.5)} - ${usd(dest.budget[2] * 1)} for two (with wine)

**Reservations:** Essential, especially for weekend dinners

### Casual Romantic Spots

**${romanticDining[1]}** at a cozy local spot:
- Share a bottle of ${dest.continent === 'Europe' ? 'local wine' : dest.continent === 'Asia' ? 'sake or local spirits' : 'wine'}
- People-watch from a terrace table
- No dress code, just connection

**Cost:** ${usd(dest.budget[1] * 0.5)} for two

### Street Food Romance

Yes, street food can be romantic:
- **${romanticDining[2]}** shared standing at a stall
- Midnight snacks after a night out
- Finding hidden food vendors together

## Sunset Spots for Couples

1. **${dest.photoSpots[0] || dest.attractions[0]}** — ${dest.photoSpots.length > 1 ? 'the most iconic view' : 'beautiful at sunset'}

2. **${dest.photoSpots[1] || romanticAreas[0].split(' —')[0]}** — ${dest.photoSpots.length > 2 ? 'quieter and more intimate' : 'lovely in evening light'}

3. **${dest.hidden[0] || dest.areas[1].split(' —')[0]}** — ${dest.hidden.length > 1 ? 'secret local spot' : 'away from the crowds'}

**Tip:** ${dest.tips[0] || 'Arrive 30 minutes before sunset for best positioning'}

## Romantic Day Trips

### ${dest.dayTrips[0].split(' —')[0]}

${dest.dayTrips[0]}

**Why it's romantic:** ${dest.dayTrips[0]?.includes('wine') ? 'Wine tasting through vineyards' : dest.dayTrips[0]?.includes('beach') ? 'Beach picnic for two' : 'Escape the city together'}

**Cost:** ${usd(dest.budget[1] * 1.5)} for private car hire, ${usd(dest.budget[0] * 0.6)} for public transport

### ${dest.dayTrips[1]?.split(' —')[0] || dest.dayTrips[0].split(' —')[0]}

${dest.dayTrips[1] || dest.dayTrips[0]}

**Romantic highlight:** ${dest.dayTrips[1]?.includes('sunset') || dest.dayTrips[1]?.includes('romantic') ? 'Perfect for a proposal' : 'Shared adventure builds connection'}

## Honeymoon Itinerary (7 Days)

### Days 1-2: Romance in the City
- Luxury hotel check-in with champagne
- ${romanticExp[0] || 'Sunset experience'}
- Fine dining at ${romanticAreas[0].split(' —')[0]}

### Days 3-4: Cultural Exploration
- ${dest.attractions[0]} together
- ${romanticExp[1] || 'Cooking class for two'}
- ${romanticAreas[1].split(' —')[0]} neighborhood wandering

### Days 5-6: Day Trip & Adventure
- ${dest.dayTrips[0].split(' —')[0]} — private experience
- Couples spa afternoon
- Room service dinner

### Day 7: Slow Departure
- Breakfast in bed
- Final ${romanticAreas[0].split(' —')[0]} stroll
- Airport transfer

## Budget for Romantic Trips

**Weekend getaway (3 nights):**
- Budget romantic: ${usd(dest.budget[1] * 4)}
- Comfortable: ${usd(dest.budget[2] * 4)}
- Luxury honeymoon: ${usd(dest.budget[2] * 8)}

**Per day as a couple:**
| Style | Daily Cost |
|---|---|
| Budget | ${usd(dest.budget[1] * 1.5)} |
| Comfortable | ${usd(dest.budget[2] * 1.5)} |
| Luxury | ${usd(dest.budget[2] * 3)} |

## Romantic Tips

1. **${dest.tips[0] || 'Book romantic experiences in advance'}**
2. **${dest.etiquette[0] || 'Learn a few romantic local phrases'}**
3. **Unplug:** Leave phones in the hotel room for at least one dinner
4. **Capture it:** Hire a photographer for a couples photoshoot (${usd(dest.budget[1] * 1.5)})
5. **${dest.romantic[0] || 'Schedule one splurge experience'}**

## Best Time for a Romantic Trip

**${dest.bestTime}** — ${dest.climate}

**Most romantic season:** ${dest.peakSeason.includes('spring') || dest.peakSeason.includes('autumn') ? dest.peakSeason : dest.bestTime}

**Avoid:** Peak family travel times if you want quiet romantic dinners

## What Makes ${dest.name} Romantic

- **${romanticAreas[0]}** — made for aimless wandering together
- **${romanticDining[0]}** — food is a love language here
- **${dest.climate}** — ${dest.climate.includes('mild') || dest.climate.includes('warm') ? 'weather made for outdoor romance' : 'cozy indoor moments'}
- **${dest.photoSpots[0] || dest.attractions[0]}** — backdrops for lifetime memories

${dest.name} doesn't just set the stage for romance — it becomes part of your love story.

${cta(dest)}

*Related: [Luxury Travel in ${dest.name}](/blog/luxury-travel-${dest.id}) | [Weekend in ${dest.name}](/blog/weekend-in-${dest.id})*`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Guides',
    tags: [dest.name, 'romantic travel', 'couples', 'honeymoon', dest.country, 'romance'],
    author_slug: 'maria-garcia',
    reading_time: estimateReadingTime(content),
    cover_image_alt: `Romantic ${dest.name} for couples`,
    cluster: 'romance-travel',
    imgId: dest.imgId,
  };
}

// Template 3: First-Timer Guide
export function templateFirstTimer(dest: Destination): BlogEntry {
  const slug = `first-time-visiting-${dest.id}`;
  const title = `First Time in ${dest.name}? Everything You Need to Know`;
  const description = `Visiting ${dest.name} for the first time? This guide covers everything first-timers need: must-see sights, common mistakes, practical tips, and insider advice.`.slice(0, 160);

  const mustSees = pick(dest.attractions, 5);
  const essentialTips = pick(dest.tips, 4);
  const firstTimerAreas = pick(dest.areas, 3);

  const content = `# First Time in ${dest.name}? The Complete First-Timer's Guide

So you're visiting ${dest.name} for the first time. Congratulations — you're about to experience one of ${dest.continent}'s most incredible cities.

${dest.tagline} — and while that might sound overwhelming, this guide breaks down exactly what first-time visitors need to know. No fluff, no filler — just practical advice from someone who's made all the mistakes so you don't have to.

## First-Timer Essentials

### Before You Go

**Visa:** Check ${dest.country}'s visa requirements for your nationality (many nationalities get visa-free or visa-on-arrival access)

**Best time to visit:** ${dest.bestTime}

**${dest.peakSeason}:** Expect crowds and higher prices

**Currency:** ${dest.currency}
- ATMs: Widely available
- Cards: ${dest.continent === 'Europe' || dest.country === 'Japan' || dest.country === 'Singapore' ? 'Accepted almost everywhere' : 'Carry some cash, especially for markets and small vendors'}

**Language:** ${dest.lang}
- English: ${dest.country === 'United Kingdom' || dest.country === 'United States' || dest.country === 'Australia' ? 'Primary language' : dest.continent === 'Europe' ? 'Widely spoken in tourist areas' : 'Limited — download Google Translate'}

### What to Book in Advance

1. **Accommodation** — especially ${dest.peakSeason.toLowerCase()}
2. **${mustSees[0]}** — ${dest.tips[0]?.includes('book') ? 'Definitely requires advance booking' : 'Consider booking to skip lines'}
3. **${mustSees[1] || dest.attractions[1]}** — ${dest.tips.length > 2 ? dest.tips[1] : 'If you want specific time slots'}

## The 5 Must-See Attractions

If you only have a few days, these are non-negotiable:

### 1. ${mustSees[0]}
The one thing everyone visits ${dest.name} for. ${dest.tips[0] || 'Go early to beat the crowds.'}

**Time needed:** 1.5-2 hours
**Cost:** ${usd(dest.budget[0] * 0.3)}

### 2. ${mustSees[1] || dest.attractions[1]}
${dest.attractions.length > 3 ? 'Just as impressive as the main attraction, but often less crowded.' : 'Essential for understanding the city.'}

**Time needed:** 1-2 hours

### 3. ${mustSees[2] || dest.attractions[2]}
${dest.attractions.length > 4 ? 'This is where you will feel the real pulse of the city.' : 'A different perspective on local culture.'}

### 4. ${mustSees[3] || dest.areas[0].split(' —')[0]}
${firstTimerAreas[0]}

**Time needed:** Half day of wandering

### 5. ${mustSees[4] || dest.hidden[0]}
${dest.hidden.length > 1 ? 'The one place locals wish tourists didn\'t know about.' : 'A local favorite that deserves your time.'}

## Where to Stay (First Visit)

**Best neighborhoods for first-timers:**

### ${firstTimerAreas[0].split(' —')[0]} (Recommended)
${firstTimerAreas[0]}

**Why:** Central, walkable to major sights, good restaurant scene
**Budget:** ${usd(dest.budget[1])} per night average

### ${firstTimerAreas[1].split(' —')[0]}
${firstTimerAreas[1]}

**Why:** ${firstTimerAreas[1].includes('local') ? 'More authentic, better value' : 'Good alternative with different character'}
**Budget:** ${usd(dest.budget[1] * 0.8)} per night average

### ${firstTimerAreas[2]?.split(' —')[0] || dest.areas[2]?.split(' —')[0] || 'Outskirts'}
${firstTimerAreas[2] || dest.areas[2] || 'Quieter residential areas'}

**Why:** Best for travelers who want quiet evenings
**Budget:** ${usd(dest.budget[0] * 1.2)} per night average

## First-Timer Mistakes to Avoid

### 1. Trying to See Everything
${dest.name} has ${dest.attractions.length > 5 ? 'dozens of' : 'many'} amazing things to see. Pick 3-4 per day maximum.

### 2. Only Eating Near Tourist Sites
The restaurants around ${mustSees[0]} are overpriced. Walk 5 minutes in any direction for better food at better prices.

### 3. Ignoring Local Etiquette
${essentialTips[0] || dest.etiquette[0] || 'Research local customs before you go'}

### 4. Not Learning Basic Phrases
Even "hello," "thank you," and "please" in ${dest.lang} will change how locals treat you.

### 5. Skipping Neighborhoods for Museums
${firstTimerAreas[1].split(' —')[0]} is more memorable than your fourth museum. Leave time for wandering.

## Getting Around

**${dest.transport[0]}**
- ${dest.transport[0]} is the main way locals get around
- ${dest.transport.length > 1 ? `Also: ${dest.transport[1]}` : 'Taxis/rideshare for longer distances'}

**Airport to City:**
- ${dest.continent === 'Europe' ? 'Train is usually the best option' : dest.continent === 'Asia' ? 'Airport express or taxi' : 'Taxi or rideshare'}
- Budget: ${usd(dest.budget[0] * 0.5)} - ${usd(dest.budget[1] * 0.3)}

**Walking:**
- ${dest.name} is ${dest.areas.length > 4 ? 'very walkable in the center' : 'partially walkable'}
- ${dest.packing[0] || 'Bring comfortable shoes'}

## Food for First-Timers

### Must-Try Dishes

1. **${dest.foods[0]}** — The signature dish. You'll see it everywhere.

2. **${dest.foods[1] || dest.foods[0]}** — ${dest.foods.length > 2 ? 'A close second in popularity' : 'Another local favorite'}

3. **${dest.foods[2] || dest.foods[0]}** — ${dest.foods.length > 3 ? 'The one tourists often miss' : 'Worth seeking out'}

### Where to Eat

- **${dest.shopping[0] || 'Local market'}** — Best for breakfast and lunch
- **${firstTimerAreas[1].split(' —')[0]}** — Better value than the main tourist areas
- **Avoid:** Restaurants with photos in the menu near ${mustSees[0]}

## First-Time Budget Guide

**Daily budget breakdown:**

| Style | Per Day |
|---|---|
| Budget | ${usd(dest.budget[0])} |
| Mid-range | ${usd(dest.budget[1])} |
| Comfortable | ${usd(dest.budget[2])} |

**Money-saving tips:**
1. ${essentialTips[1] || 'Use public transport'}
2. ${essentialTips[2] || 'Eat where locals eat'}
3. Book attractions online for discounts
4. ${essentialTips[3] || 'Visit during shoulder season'}

## Safety for First-Timers

${dest.safety[0] || 'The city is generally safe for tourists.'}

**Be aware of:**
- ${dest.safety[1] || 'Pickpockets in crowded areas'}
- ${dest.safety[2] || 'Scams targeting tourists'}

**Emergency contacts:**
- Police: Local emergency number
- Embassy: Find your embassy address before you go

## Practical Tips

### What to Pack
1. **${dest.packing[0]}**
2. **${dest.packing[1] || 'Layers for variable weather'}**
3. **${dest.packing[2] || 'Rain protection'}**
4. Universal power adapter
5. Photocopy of passport

### Weather
${dest.climate}

**Pack for:** ${dest.bestTime.includes('summer') ? 'Warm days, potentially hot' : dest.bestTime.includes('winter') ? 'Cold temperatures' : 'Variable conditions'}

### Cultural Notes
- **${dest.etiquette[0] || 'Greet people respectfully'}**
- **${dest.etiquette[1] || 'Learn basic local customs'}**
- **${dest.etiquette[2] || 'Dress appropriately for religious sites'}**

## First-Timer Itinerary (3-4 Days)

### Day 1: Orientation
- Morning: ${mustSees[0]}
- Lunch: ${dest.shopping[0] || 'Local market'}
- Afternoon: ${firstTimerAreas[0].split(' —')[0]} neighborhood walk
- Dinner: ${dest.foods[0]} at a local restaurant

### Day 2: Deep Dive
- Morning: ${mustSees[1] || dest.attractions[1]}
- Lunch: ${firstTimerAreas[1].split(' —')[0]}
- Afternoon: ${mustSees[2] || dest.attractions[2]}
- Evening: ${dest.nightlife[0] || 'Local bar or restaurant'}

### Day 3: Beyond the Center
- Day trip to ${dest.dayTrips[0].split(' —')[0]}
- OR: ${firstTimerAreas[2]?.split(' —')[0] || 'Explore a new neighborhood'}

### Day 4 (Optional): Your Choice
- Revisit favorites
- ${mustSees[3] || dest.hidden[0]}
- Shopping for souvenirs

## Will You Love ${dest.name}?

**Yes, if you:**
- Enjoy ${dest.foods[0]?.includes('food') ? 'food' : 'culture and history'}
- Like ${firstTimerAreas[0].includes('walkable') || firstTimerAreas[0].includes('explor') ? 'walkable cities' : 'discovering new places'}
- Want ${dest.continent === 'Europe' ? 'European charm' : dest.continent === 'Asia' ? 'Asian culture' : 'unique experiences'}

**Maybe skip if you:**
- Hate crowds (visit off-season instead)
- Need everything in English (but you'll manage)
- Prefer beach vacations (though ${dest.dayTrips.some(d => d.includes('beach')) ? 'there are beaches nearby' : 'there are other coastal destinations in the region'})

## Your First ${dest.name} Trip Starts Here

You've got the information. Now book that flight.

${dest.name} is ${dest.budget[0] < 50 ? 'affordable' : dest.budget[0] < 80 ? 'reasonably priced' : 'worth the investment'}. It's ${dest.safety.length > 1 ? 'safe' : 'manageable'} for tourists. And it's going to exceed your expectations.

See you there.

${cta(dest)}

*Related: [${dest.name} on a Budget](/blog/${dest.id}-on-a-budget) | [Weekend in ${dest.name}](/blog/weekend-in-${dest.id})*`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Guides',
    tags: [dest.name, 'first time', 'travel guide', 'beginners', dest.country, 'tips'],
    author_slug: 'alex-chen',
    reading_time: estimateReadingTime(content),
    cover_image_alt: `First time visiting ${dest.name}`,
    cluster: 'destination-guides',
    imgId: dest.imgId,
  };
}
