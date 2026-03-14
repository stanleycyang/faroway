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
  return `\n\n---\n\n*Planning your ${dest.name} trip? [Use Faroway's AI planner](/) to build your perfect itinerary in 60 seconds — free.*`;
}

// ---------------------------------------------------------------------------
// Template 1 — Packing Checklist
// ---------------------------------------------------------------------------

export function templatePackingChecklist(dest: Destination, idx = 0): BlogEntry {
  const slug = `${dest.id}-packing-list`;
  const title = `${dest.name} Packing List: What to Bring (And What to Leave Home)`;
  const description = `Complete ${dest.name} packing checklist for ${dest.climate} weather. Climate-specific essentials, cultural tips, and what NOT to pack.`.slice(0, 160);

  const content = `# ${dest.name} Packing List: What to Bring (And What to Leave Home)

Packing for ${dest.name} is different than packing for your average trip. The climate is **${dest.climate}**, the culture has its own dress codes, and you'll be doing a lot of walking through ${dest.areas[0]?.split(' — ')?.[0] || 'the main areas'}.

This checklist is tailored specifically for ${dest.name} — not a generic packing list you could use anywhere.

---

## Climate-Specific Essentials

**${dest.name} has a ${dest.climate} climate.** ${dest.climate.includes('hot') || dest.climate.includes('tropical') ? 'Heat and humidity are serious. Pack light, breathable fabrics.' : dest.climate.includes('cold') ? 'Cold weather dominates. Layers are non-negotiable.' : 'Moderate climate means layers and versatility win.'}

### Clothing

${dest.packing.map(p => `- [ ] ${p}`).join('\n')}
- [ ] ${dest.climate.includes('hot') ? 'Lightweight, moisture-wicking shirts' : dest.climate.includes('cold') ? 'Thermal base layers' : 'Layerable shirts and sweaters'}
- [ ] ${dest.climate.includes('hot') ? 'Shorts and breathable pants' : dest.climate.includes('cold') ? 'Insulated pants or jeans' : 'Versatile pants that work day and night'}
- [ ] Comfortable walking shoes — you'll walk 5–10 miles/day in ${dest.name}
- [ ] ${dest.climate.includes('rain') || dest.climate.includes('wet') ? 'Waterproof jacket or poncho' : 'Light jacket for evenings'}
- [ ] ${dest.romantic?.length || dest.nightlife?.length ? 'One nicer outfit for dinners or nightlife' : 'Casual outfits only needed'}

### Weather Gear

- [ ] Sunscreen SPF 50 ${dest.climate.includes('hot') || dest.climate.includes('sunny') ? '(non-negotiable)' : '(still useful)'}
- [ ] Sunglasses with UV protection
- [ ] ${dest.climate.includes('rain') || dest.bestTime.includes('wet') ? 'Compact travel umbrella — rain is common' : 'Hat for sun protection'}
- [ ] ${dest.climate.includes('hot') ? 'Portable fan or cooling towel' : dest.climate.includes('cold') ? 'Warm hat and gloves' : 'Light scarf for versatility'}

---

## Cultural Essentials

${dest.name} has specific cultural norms you need to respect:

### Dress Code

${dest.etiquette.slice(0, 2).map(e => `- ${e}`).join('\n')}
${dest.attractions[0]?.toLowerCase().includes('temple') || dest.attractions[0]?.toLowerCase().includes('mosque') || dest.attractions[0]?.toLowerCase().includes('church') ? '- [ ] Modest clothing for religious sites — covered shoulders and knees required' : ''}
${dest.areas[0]?.toLowerCase().includes('beach') ? '- [ ] Beach cover-up — swimwear only at the beach' : ''}

### Etiquette Items

- [ ] ${dest.lang === 'English' ? 'No language barrier' : `Phrasebook or translation app for ${dest.lang}`}
- [ ] Cash in ${dest.currency} — ${dest.shopping?.[0]?.includes('market') || dest.foods[0]?.includes('street') ? 'many vendors are cash-only' : 'cards accepted most places but cash useful'}
- [ ] ${dest.etiquette.some(e => e.toLowerCase().includes('tip')) ? 'Small bills for tipping' : 'Tipping isn\'t expected but appreciated'}

---

## Tech & Documents

### Must-Haves

- [ ] Passport (valid for 6+ months beyond travel dates)
- [ ] ${dest.country === 'USA' ? 'Government-issued ID' : 'Visa (check requirements for your nationality)'}
- [ ] Travel insurance documents (medical + trip cancellation)
- [ ] Printed hotel confirmations and flight details (backup)
- [ ] Phone + international plan or local SIM card
- [ ] Portable charger (10,000+ mAh)
- [ ] ${dest.lang === 'English' ? 'Standard US/EU plug adapter' : 'Universal plug adapter'} for ${dest.country}

### Useful Apps to Download Before You Go

- Google Maps (download ${dest.name} offline map)
- ${dest.transport[0]?.toLowerCase().includes('uber') || dest.transport[0]?.toLowerCase().includes('taxi') ? 'Uber or local rideshare app' : 'Public transit app'}
- Google Translate (download ${dest.lang} for offline use)
- Faroway (for itinerary planning on the go!)

---

## Health & Safety

### Medical Kit

- [ ] Prescription medications (in original bottles with labels)
- [ ] Pain reliever (ibuprofen or acetaminophen)
- [ ] ${dest.climate.includes('hot') || dest.climate.includes('tropical') ? 'Anti-diarrheal medication — stomach issues are common' : 'Cold/flu medicine'}
- [ ] Band-aids and antibiotic ointment
- [ ] ${dest.climate.includes('hot') ? 'Electrolyte packets for hydration' : 'Motion sickness tablets'}
- [ ] ${dest.safety.some(s => s.toLowerCase().includes('mosquito')) ? 'Insect repellent with DEET' : 'Sunburn relief gel'}

### Safety Items

${dest.safety.slice(0, 3).map(s => `- ${s}`).join('\n')}
- [ ] Money belt or hidden pocket for valuables
- [ ] Photocopy of passport + credit cards (separate from originals)
- [ ] Emergency contact list

---

## What NOT to Pack

### Leave These at Home

- ❌ Too many clothes — you'll wear the same 3 outfits on repeat anyway
- ❌ Expensive jewelry — unnecessary risk in ${dest.name}
- ❌ ${dest.shopping?.length ? 'Empty suitcase space for shopping — buy local' : 'Bulky items you can buy there if needed'}
- ❌ Hairdryer (most hotels provide one)
- ❌ ${dest.climate.includes('hot') ? 'Heavy jackets or winter gear' : dest.climate.includes('cold') ? 'Shorts and tank tops' : 'Extreme weather gear'}

---

## ${dest.name}-Specific Tips

${dest.tips.slice(0, 3).map(t => `> **Tip:** ${t}`).join('\n\n')}

---

## Download the Printable Checklist

This list covers everything for ${dest.name}. Print it out, check items off as you pack, and you'll arrive fully prepared for ${dest.climate} weather and ${dest.tagline.toLowerCase()}.

${faroway_cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Tips',
    tags: [dest.name, `${dest.name} packing list`, 'packing checklist', dest.country, 'travel packing', dest.climate, 'what to pack'],
    author_slug: rotateAuthor(idx),
    reading_time: estimateReadingTime(content),
    cover_image_alt: `${dest.name} packing list and travel checklist`,
    cluster: 'travel-checklists',
    imgId: dest.imgId,
  };
}

// ---------------------------------------------------------------------------
// Template 2 — Travel Checklist
// ---------------------------------------------------------------------------

export function templateTravelChecklist(dest: Destination, idx = 0): BlogEntry {
  const slug = `${dest.id}-travel-checklist`;
  const title = `${dest.name} Travel Checklist: Everything You Need Before You Go`;
  const description = `Complete pre-trip checklist for ${dest.name}. Documents, bookings, money, health, and safety essentials to check off before departure.`.slice(0, 160);

  const content = `# ${dest.name} Travel Checklist: Everything You Need Before You Go

Planning a trip to ${dest.name}? This checklist covers every essential task — from booking flights to downloading offline maps — so nothing falls through the cracks.

Use this as your master planning guide. Check items off as you go, and you'll arrive in ${dest.name} fully prepared.

---

## 3 Months Before: Big Picture Planning

### Flights & Accommodation

- [ ] Book round-trip flights to ${dest.name}
- [ ] Book accommodation in **${dest.areas[0]?.split(' — ')?.[0] || 'central area'}** (best base for first-timers)
- [ ] ${dest.dayTrips?.length ? `Research day trips (${dest.dayTrips[0]?.split(' — ')?.[0] || 'nearby destinations'})` : 'Plan multi-day stays if visiting other cities'}
- [ ] Buy travel insurance (medical + trip cancellation)

### Documents

- [ ] Check passport expiration (must be valid 6+ months beyond travel)
- [ ] ${dest.country === 'USA' ? 'No visa required for US citizens' : `Apply for visa if required for ${dest.country}`}
- [ ] Make photocopies of passport, visas, and credit cards
- [ ] Scan all documents to cloud storage (Google Drive, Dropbox)

### Budget

- [ ] Set daily budget: $${dest.budget[0]} (budget), $${dest.budget[1]} (mid-range), or $${dest.budget[2]} (luxury)
- [ ] Notify bank and credit card companies of travel dates
- [ ] Order ${dest.currency} or plan to withdraw at ATM on arrival
- [ ] Download currency converter app

---

## 1 Month Before: Logistics & Bookings

### Must-Do Activities

- [ ] ${dest.attractions[0]} — ${dest.attractions[0]?.toLowerCase().includes('museum') || dest.attractions[0]?.toLowerCase().includes('tower') ? 'book tickets online to skip lines' : 'check opening hours and entry requirements'}
- [ ] ${dest.attractions[1]} — ${dest.tips[0]?.toLowerCase().includes('book') ? 'advance booking recommended' : 'arrive early to avoid crowds'}
- [ ] ${dest.romantic?.[0] || dest.family?.[0] || `Explore ${dest.areas[1]?.split(' — ')?.[0] || 'local neighborhoods'}`}

### Transportation

${dest.transport.slice(0, 3).map(t => `- [ ] ${t}`).join('\n')}
- [ ] Download ${dest.transport[0]?.toLowerCase().includes('subway') || dest.transport[0]?.toLowerCase().includes('metro') ? 'subway map and transit app' : dest.transport[0]?.toLowerCase().includes('uber') ? 'Uber or local rideshare app' : 'local transport app'}
- [ ] ${dest.tips.some(t => t.toLowerCase().includes('card') || t.toLowerCase().includes('pass')) ? dest.tips.find(t => t.toLowerCase().includes('card') || t.toLowerCase().includes('pass')) : 'Research multi-day transit passes for savings'}

### Health & Safety

- [ ] Check CDC travel health notices for ${dest.country}
- [ ] ${dest.country.includes('tropical') || dest.climate.includes('tropical') ? 'Get vaccinations if recommended (Hep A, Typhoid)' : 'No special vaccinations required'}
- [ ] Pack prescription medications in original bottles
- [ ] ${dest.safety[0] || 'Review local safety advice and emergency numbers'}

---

## 1 Week Before: Final Details

### Packing

- [ ] Pack for **${dest.climate}** weather
- [ ] ${dest.packing[0] || 'Comfortable walking shoes — essential'}
- [ ] ${dest.packing[1] || 'Weather-appropriate clothing layers'}
- [ ] Sunscreen SPF 50 ${dest.climate.includes('hot') ? '(critical for hot climate)' : ''}
- [ ] ${dest.climate.includes('rain') ? 'Compact umbrella' : 'Light jacket for evenings'}
- [ ] Phone charger + portable battery pack
- [ ] Universal plug adapter for ${dest.country}

### Apps & Maps

- [ ] Download **Google Maps offline map** for ${dest.name}
- [ ] Download **Google Translate** with ${dest.lang} for offline use
- [ ] Install **Faroway app** for on-the-go itinerary updates
- [ ] ${dest.transport[0]?.includes('app') ? 'Install local rideshare or transit app' : 'Save key addresses in Maps'}

### Money

- [ ] Withdraw some ${dest.currency} or plan ATM withdrawal on arrival
- [ ] Carry $100–200 USD backup cash
- [ ] ${dest.etiquette.some(e => e.toLowerCase().includes('tip')) ? 'Pack small bills for tipping' : 'Tipping not expected but small bills useful'}
- [ ] Save bank international helpline number

---

## Day Before Departure

### Final Checks

- [ ] Print or save digital copies of:
  - Flight confirmation
  - Hotel reservation
  - Travel insurance policy
  - Emergency contact numbers
- [ ] Charge all devices (phone, camera, portable charger)
- [ ] Pack carry-on essentials (medications, valuables, change of clothes)
- [ ] Set up international phone plan or buy local SIM on arrival
- [ ] ${dest.bestTime.includes(new Date().toLocaleString('default', { month: 'long' })) ? `Perfect timing — you're going during ${dest.bestTime}!` : `Note: You're traveling during ${dest.climate} season`}

### Itinerary Review

- [ ] Review your [${dest.name} itinerary](/blog/3-days-in-${dest.id}) one more time
- [ ] Double-check restaurant reservations for special dinners
- [ ] Confirm any day-trip bookings (${dest.dayTrips?.[0]?.split(' — ')?.[0] || 'if applicable'})
- [ ] Save offline copy of your itinerary in Faroway

---

## On Arrival in ${dest.name}

### First 2 Hours

- [ ] Exchange money or find ATM in arrivals hall
- [ ] Buy local SIM card or activate international plan
- [ ] ${dest.transport[0]?.toLowerCase().includes('card') ? `Get transit card (${dest.transport[0]?.match(/\b[A-Z][a-z]+\b/) || 'public transport pass'})` : 'Arrange transport to hotel (taxi/rideshare)'}
- [ ] Check into accommodation and drop bags
- [ ] Walk to ${dest.attractions[0]} or ${dest.areas[0]?.split(' — ')?.[0] || 'main square'} to orient yourself

### First Evening

- [ ] Eat ${dest.foods[0]?.split(' — ')?.[0] || 'local specialty'} at a nearby restaurant
- [ ] ${dest.tips[0] || 'Review tomorrow\'s itinerary and get a good night\'s sleep'}

---

## Essential ${dest.name} Resources

- [${dest.name} 5-day itinerary](/blog/5-days-in-${dest.id})
- [${dest.name} food guide](/blog/${dest.id}-food-guide)
- [Getting around ${dest.name}](/blog/getting-around-${dest.id})
- [${dest.name} destination overview](/destinations/${dest.id})

${faroway_cta(dest)}`;

  return {
    slug,
    title,
    description,
    content,
    category: 'Tips',
    tags: [dest.name, `${dest.name} checklist`, 'travel checklist', dest.country, 'trip planning', 'pre-trip preparation'],
    author_slug: rotateAuthor(idx + 1),
    reading_time: estimateReadingTime(content),
    cover_image_alt: `${dest.name} travel checklist — complete pre-trip guide`,
    cluster: 'travel-checklists',
    imgId: dest.imgId,
  };
}
