/**
 * Insert the Cartagena 5-day itinerary blog post into Supabase.
 *
 * Usage:
 *   npx tsx scripts/insert-cartagena-post.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(envPath: string): void {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(__dirname, '../apps/web/.env.local'));
loadEnvFile(path.resolve(__dirname, '../apps/web/.env'));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CONTENT = `
# 5 Days in Cartagena: The Perfect Itinerary (2026)

Cartagena is one of the most photogenic cities in South America — a UNESCO-listed walled city of candy-colored colonial buildings, bougainvillea-draped balconies, and Caribbean beaches within an hour's reach. Five days gives you enough time to explore the old city deeply and take a couple of day trips without feeling rushed.

Here's exactly how to spend 5 days in Cartagena, with real costs for budget and mid-range travelers.

## Quick Facts

- **Country:** Colombia
- **Currency:** Colombian Peso (COP) — approx. 4,000 COP = $1 USD
- **Language:** Spanish
- **Best time to visit:** December–April (dry season)
- **Budget:** $60/day (hostel + street food + local transport)
- **Mid-range:** $120/day (boutique hotel + restaurants + tours)

Before you go, check if you need a visa. Use the [Faroway Visa Checker](/tools/visa-checker) to instantly see Colombia's visa requirements for your passport.

---

## Day 1: The Walled City (Ciudad Amurallada)

Start where Cartagena's story begins — inside the 400-year-old walls.

**Morning**
Wake up early and walk the city walls at sunrise before the tour groups arrive. The full loop takes about 45 minutes and offers views over the Caribbean on one side and the old city rooftops on the other. It's free to walk.

Head to the **Castillo San Felipe de Barajas**, the largest Spanish fortification in the Americas. Arrive when it opens at 8am to beat the heat. Budget 90 minutes. Entry: ~20,000 COP ($5).

**Afternoon**
Lunch in the walled city — try *bandeja paisa* at a local *corrientazo* restaurant for under 15,000 COP ($4). Avoid the tourist-facing spots on Plaza de los Coches if you're on a budget.

Spend the afternoon wandering. Don't miss:
- **Plaza de Bolivar** — shaded square with the cathedral and palace of the Inquisition
- **Calle de la Factoria** — one of the most photographed streets
- **La Iglesia de San Pedro Claver** — 17th-century church with a beautiful courtyard

**Evening**
Sunset cocktails at one of the rooftop bars in the old city (Café del Mar is the classic pick, expect to pay 30,000–50,000 COP per drink). Dinner at a mid-range restaurant in Getsemaní — across the wall and cheaper than the historic center.

**Day 1 costs:** Budget $55 / Mid-range $110

---

## Day 2: Getsemaní — Neighborhood & Nightlife

Getsemaní was Cartagena's working-class neighborhood, now its most interesting. The gentrification is real but so is the energy.

**Morning**
Rent a bike (10,000 COP/hour) and explore the neighborhood streets. Look for the famous street murals — the neighborhood is an open-air gallery. **Trinidad Square (Plaza de la Trinidad)** is the heart of it, surrounded by colonial buildings painted in electric colors.

Visit the **Convento de la Popa** on the hill above the city for panoramic views of the bay, the old city, and the Caribbean beyond. Taxi up (negotiate, budget 20,000 COP), walk down.

**Afternoon**
Lunch at a local spot in Getsemaní — *arepa de choclo*, *patacones*, and fresh fruit juices. Budget 20,000 COP.

If you have energy, visit the **Gold Museum (Museo del Oro Zenú)** — free admission, world-class pre-Columbian gold artifacts. Small but excellent.

**Evening**
Getsemaní is Cartagena's nightlife hub. Start with happy hour at **Café Havana** (live salsa, opens around 9pm), then the neighborhood comes alive with outdoor bars and street food stalls. Beers run 8,000–15,000 COP. Stay as late as you like — this is what Cartagena is famous for after dark.

**Day 2 costs:** Budget $50 / Mid-range $100

---

## Day 3: Islas del Rosario — Coral Reefs & Snorkeling

This is the unmissable day trip. The Rosario Islands are a national park archipelago 45km southwest of Cartagena with clear Caribbean water and healthy coral reefs.

**Getting there**
Boats depart from Muelle Turistico de la Bodeguita at 8am–9am. Book through your hostel or a tour agency the day before. A full-day shared boat trip including snorkeling gear and a stop at Playa Blanca runs 80,000–120,000 COP ($20–30). Private boats cost significantly more.

**On the islands**
You'll stop at 2–3 spots: a coral reef for snorkeling (bring your own reef-safe sunscreen — it matters here), a beach island for lunch, and sometimes an aquarium (optional, extra cost). The reefs are genuinely impressive — parrotfish, sea turtles, and healthy coral gardens.

Lunch is usually included or available on the island for 25,000–40,000 COP. Grilled fish, coconut rice, and *patacones* is the standard plate.

Boats return to Cartagena by 4–5pm.

**Day 3 costs:** Budget $35 (shared boat, pack your own food) / Mid-range $65 (private snorkel tour, island lunch)

---

## Day 4: Playa Blanca or Bocagrande Beach

Two options depending on your vibe.

### Option A: Playa Blanca (more remote, better beach)
Playa Blanca on the Barú Peninsula is the best beach near Cartagena — a proper Caribbean stretch of white sand and turquoise water, without the resort infrastructure of the islands. Take a *colectivo* from Castillogrande for ~15,000 COP each way, or join an organized van trip (cheaper than boats).

Arrive before 10am to claim a hammock and umbrella (10,000–15,000 COP rental). Stay for lunch — fresh grilled fish and *ceviche* sold directly on the beach. Be back in town by 5pm.

**Vendor tip:** Vendors on Playa Blanca are persistent. Set a firm budget and stick to it — 50,000 COP will cover a full meal + drinks + umbrella for the day.

### Option B: Bocagrande (easy, urban beach)
If you're tired of transit, Bocagrande is Cartagena's built-up beach neighborhood — think Miami Beach but Colombian. The beach is crowded and the water is okay. Main appeal: walkable from the old city, good restaurant strip on Avenida San Martin, and a great spot for a lazy afternoon with cold beer.

**Evening (both options)**
Return to the old city for your last proper dinner. Book in advance at one of the standout restaurants — La Cevicheria (reservations essential), Carmen, or Alma.

**Day 4 costs:** Budget $40 / Mid-range $90

---

## Day 5: Markets, Shopping & Airport

Final morning before your flight.

**Morning**
Hit the **Las Bóvedas market** inside the city walls — arched former dungeons now selling Colombian crafts, emeralds, hammocks, and textiles. Prices are fixed at many stalls but bargaining is still expected. Good souvenirs: *mochila* bags (woven bags from the Wayuu people), emerald jewelry, ceramic magnet sets.

For better emerald prices, go to the dedicated jewelry shops on Calle de Ayos rather than the tourist market.

**Before you leave**
Grab a final coffee and *buñuelo* (fried cheese puff) from a street vendor. One last walk through the walled city — it looks completely different in the morning light.

**Getting to the airport**
Rafael Núñez International Airport (CTG) is 10 minutes from the old city by taxi. Negotiate in advance — 20,000–30,000 COP is fair. Rideshares (InDriver) are even cheaper.

**Day 5 costs:** Budget $30 / Mid-range $80

---

## Total Trip Cost Estimate

| Category | Budget (5 days) | Mid-range (5 days) |
|----------|----------------|-------------------|
| Accommodation | $50–75 | $200–350 |
| Food & drinks | $80–100 | $200–250 |
| Activities & transport | $80–100 | $150–200 |
| **Total** | **$210–275** | **$550–800** |

*Flights not included. Cartagena is served by direct flights from Miami, New York, and Panama City.*

---

## Getting There & Around

- **By air:** Rafael Núñez Airport (CTG). Direct flights from Miami (3h), New York (5h via Panama), and connections via Bogotá (1.5h).
- **Within Cartagena:** The old city and Getsemaní are walkable. Taxis are cheap and widely available — always negotiate before getting in.
- **Day trips:** Book through your accommodation or the main pier. Avoid random touts offering deals on the street.

---

## FAQ

### Is Cartagena safe for tourists?
The tourist areas — the walled city, Getsemaní, and Bocagrande — are generally safe. Use the same common sense you would in any city: don't flash expensive gear, avoid walking alone late at night in unfamiliar areas, and take registered taxis or rideshares after dark.

### What's the best time to visit Cartagena?
December through April is dry season — hot, sunny, and busy. May through November brings rain and humidity but far fewer tourists and lower prices. The shoulder months (May, November) are a sweet spot: mostly dry, lower costs.

### Do I need a visa for Colombia?
Most Western passport holders get 90 days visa-free on arrival. Use the [Faroway Visa Checker](/tools/visa-checker) to confirm requirements for your specific passport.

### What currency should I bring?
Colombian Pesos (COP). USD is accepted at tourist spots but you'll pay a worse rate. ATMs are widely available in the tourist areas — Bancolombia machines have the lowest fees for foreign cards.

### How many days in Cartagena is enough?
3 days covers the highlights. 5 days is ideal if you want to day-trip to the islands and Playa Blanca without feeling rushed. One week is comfortable if you want to day-trip to Mompox or other nearby towns.
`.trim();

async function main() {
  console.log('📝 Inserting Cartagena 5-day itinerary post...');

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('blog_posts')
    .upsert(
      {
        slug: 'cartagena-5-day-itinerary',
        title: '5 Days in Cartagena: The Perfect Itinerary (2026)',
        description: 'Exactly how to spend 5 days in Cartagena, Colombia — from the walled city to Rosario Islands. Includes costs, transport, and what to skip.',
        content: CONTENT,
        category: 'Destination Guides',
        tags: ['cartagena', 'colombia', 'itinerary', 'south-america', '5-days'],
        cluster: 'destination-guides',
        author_slug: 'faroway-team',
        status: 'published',
        reading_time: 8,
        featured: false,
        cover_image_alt: '5-day Cartagena itinerary — walled city, Islas del Rosario, Playa Blanca',
        published_at: now,
        last_updated: now,
      },
      { onConflict: 'slug' }
    );

  if (error) {
    console.error('❌ Failed to insert post:', error.message);
    process.exit(1);
  }

  console.log('✅ Cartagena 5-day itinerary post inserted/updated.');
  console.log('   Slug: cartagena-5-day-itinerary');
  console.log('   Targets: "cartagena itinerary 5 days" (792 impr, pos 7.5)');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
