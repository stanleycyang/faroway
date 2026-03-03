export interface Destination {
  id: string;
  name: string;
  country: string;
  continent: string;
  tagline: string;
  lang: string;
  currency: string;
  bestTime: string;
  peakSeason: string;
  climate: string;
  budget: [number, number, number]; // [budget/day, mid/day, luxury/day]
  attractions: string[];
  areas: string[];
  foods: string[];
  tips: string[];
  dayTrips: string[];
  hidden: string[];
  photoSpots: string[];
  romantic: string[];
  family: string[];
  nightlife: string[];
  shopping: string[];
  transport: string[];
  safety: string[];
  etiquette: string[];
  packing: string[];
  visa: string[];
  sustainable: string[];
  imgId: string;
  imgIds?: string[];
}

export const destinations: Destination[] = [
  {
    id: "muscat",
    name: "Muscat",
    country: "Oman",
    continent: "Asia",
    tagline: "Arabia's hidden gem where frankincense meets turquoise coves and ancient forts",
    lang: "Arabic",
    currency: "Omani Rial (OMR)",
    bestTime: "October to April",
    peakSeason: "December to February",
    climate: "Desert climate with extremely hot summers and mild winters",
    budget: [60, 130, 300],
    attractions: [
      "Sultan Qaboos Grand Mosque — one of the world's largest mosques, open to non-Muslims in the morning",
      "Muttrah Souq — labyrinthine market selling frankincense, silver jewelry, and traditional khanjar daggers",
      "Al Jalali and Al Mirani Forts — twin 16th-century Portuguese forts guarding Muscat harbor",
      "Mutrah Corniche — 3km waterfront promenade with dhow boats and mountain backdrop",
      "Royal Opera House Muscat — world-class performing arts venue, stunning Arabesque architecture",
      "Bait Al Zubair Museum — private collection showcasing Omani heritage, weapons, and jewelry"
    ],
    areas: [
      "Muttrah — the historic heart with the old souq, corniche, and working harbor",
      "Old Muscat — walled old city with the Sultan's palace and twin harbor forts",
      "Qurum — modern beach district with restaurants, parks, and the national museum",
      "Al Khuwair — embassy district and upscale residential area with malls",
      "Shati Al Qurum — trendy beach strip with cafés, galleries, and boutique restaurants"
    ],
    foods: [
      "Shuwa — slow-roasted lamb marinated in spices and cooked underground for up to 48 hours, served on celebratory occasions",
      "Majboos — spiced rice with meat or fish, Oman's national dish similar to biryani but with a unique flavor profile",
      "Mashuai — grilled kingfish served with lemon rice and salted fish sauce, a coastal Omani classic",
      "Halwa — dense, gelatinous sweet made with rose water, saffron, and nuts, served with Omani coffee",
      "Khubz Ragag — thin crispy bread served with honey, eggs, or cream cheese for breakfast",
      "Omani Coffee — lightly roasted cardamom coffee (qahwa) served with dates in every home and guesthouse"
    ],
    tips: [
      "Dress modestly everywhere — shoulders and knees covered is expected; the grand mosque requires full covering",
      "Alcohol is only served in licensed hotels and restaurants — don't expect it at local eateries",
      "Taxis have no meters; agree on the price before getting in, or use the Otaxi app for fair rates",
      "Friday is the holy day — most souqs and government sites are closed Friday morning",
      "The Muttrah Souq is best explored early morning (9-11 AM) before tour groups arrive",
      "Oman is one of the safest countries in the Arab world — solo travelers, including women, are very comfortable here"
    ],
    dayTrips: [
      "Wahiba Sands — vast red desert with dunes up to 100m high, 2.5 hours south; camp overnight for star-gazing",
      "Wadi Shab — stunning emerald pools and caves reached by boat; one of Arabia's most beautiful wadis, 2 hours south",
      "Nizwa — ancient capital with a spectacular round fort and Friday goat market, 1.5 hours inland",
      "Bimmah Sinkhole — turquoise freshwater lagoon in a geological wonder, 1 hour south on the coast road"
    ],
    hidden: [
      "Qurum Natural Park at sunset — locals gather here to walk, watch birds, and picnic away from tourist areas",
      "Fish Market in Muttrah at 5 AM — the most authentic Oman experience you'll find, locals buying the day's fresh catch",
      "Riyam Park — hillside park with a giant incense burner landmark and harbor views, usually tourist-free",
      "Al Alam Palace grounds — the Sultan's ceremonial palace is illuminated at night, best viewed from the corniche"
    ],
    photoSpots: [
      "Sultan Qaboos Grand Mosque at golden hour when the white marble glows amber and the gardens are quiet",
      "Muttrah Corniche from the hilltop viewpoint overlooking the harbor, dhows, and mountains",
      "Old Muscat gate archway framing the twin forts and harbor beyond",
      "Wadi Bani Khalid rock pools — emerald water surrounded by golden limestone walls"
    ],
    romantic: [
      "Sunset dhow cruise from Muttrah harbor watching the forts and corniche glow amber",
      "Dinner at Kargeen Caffe, an open-air Omani restaurant under fairy lights and frankincense smoke",
      "Overnight glamping on the dunes of Wahiba Sands under a canopy of Arabian stars"
    ],
    family: [
      "Bimmah Sinkhole swimming — safe, natural, and uniquely geological",
      "Camel rides at Al Sifah beach, 45 minutes from the city",
      "Royal Opera House guided tour for a glimpse of world-class architecture and culture"
    ],
    nightlife: [
      "The Beach by the W Hotel — upscale pool party scene on weekends",
      "Copacabana at Intercontinental Muscat — long-running expat favorite with live music",
      "Vista Bar at Shangri-La Al Bandar — rooftop drinks overlooking the marina"
    ],
    shopping: [
      "Muttrah Souq for frankincense, silver khanjar daggers, and Omani dishdasha fabrics",
      "Sabco Commercial Centre for Omani ceramics, handicrafts, and perfumes",
      "Lulu Hypermarket for local dates, halwa boxes, and Omani honey to take home"
    ],
    transport: [
      "Rent a car — Oman is best explored by self-driving; international license required",
      "Otaxi app is the local ride-hail service; more reliable than street taxis for fair pricing",
      "Mwasalat buses connect major districts cheaply but run infrequently"
    ],
    safety: [
      "Oman has extremely low crime rates — one of the safest Middle Eastern countries for tourists",
      "Summer heat (May–September) can be lethal — stay hydrated, avoid midday outdoor activities",
      "Wadi driving requires a 4WD during flash flood season (July–September); check weather before entering"
    ],
    etiquette: [
      "Greet Omani men with 'As-salamu alaykum' — avoid extending a hand first to the opposite gender",
      "Accept coffee and dates when offered — refusing is considered impolite",
      "Photography of women, military installations, and the palace requires permission or is prohibited"
    ],
    packing: [
      "Loose, lightweight long-sleeved shirts and long pants for men and women — for mosques and souqs",
      "Reef-safe sunscreen — Oman's wadis and coast are pristine; help keep them that way",
      "A pashmina or light scarf for women visiting mosques and cool air-conditioned spaces"
    ],
    visa: [
      "Most nationalities (US, UK, EU, Australia, Canada) get visa-on-arrival or e-Visa for ~$20 USD",
      "e-Visa available online at evisa.rop.gov.om; process takes 24-72 hours, valid 30 days",
      "GCC nationals (Saudi, UAE, Kuwait, Bahrain, Qatar) can enter with national ID — no visa required"
    ],
    sustainable: [
      "Oman bans single-use plastic bags since 2021 — bring a reusable bag for souq shopping",
      "Swim at Bandar Jissah beach instead of driving to more remote beaches to reduce wadi erosion",
      "Support local artisans in Muttrah Souq who make authentic silver jewelry and frankincense products by hand"
    ],
    imgId: "photo-1578895101408-1a36b834405b",
  },
  {
    id: "amman",
    name: "Amman",
    country: "Jordan",
    continent: "Asia",
    tagline: "Jordan's layered capital of ancient ruins, buzzing coffee culture, and legendary Levantine hospitality",
    lang: "Arabic",
    currency: "Jordanian Dinar (JOD)",
    bestTime: "March to May and September to November",
    peakSeason: "March to April (spring flowers) and October",
    climate: "Mediterranean with hot dry summers and cool wet winters",
    budget: [45, 100, 250],
    attractions: [
      "Amman Citadel (Jabal al-Qal'a) — 6,000 years of history on a hilltop with Temple of Hercules and Umayyad Palace",
      "Roman Theatre — 2nd-century AD amphitheatre seating 6,000 in the heart of downtown",
      "Rainbow Street — the city's most beloved promenade lined with cafés, bookshops, and galleries",
      "Jordan Museum — the most comprehensive collection of Jordanian heritage including the Dead Sea Scrolls",
      "Souk Jara — Friday open-air market in Jabal Amman with art, antiques, and local crafts",
      "King Abdullah Mosque — striking blue-domed mosque open to non-Muslim visitors with a small fee"
    ],
    areas: [
      "Downtown (Balad) — the old city with Roman ruins, gold souq, and street food vendors",
      "Jabal Amman (1st and 2nd Circles) — upscale older district with embassies, galleries, and Rainbow Street",
      "Jabal Al-Weibdeh — bohemian art district with murals, independent cafés, and the city's creative scene",
      "Abdali — modern commercial district with luxury hotels and shopping malls",
      "Sweifieh — expat-heavy district with restaurants, bars, and international chains"
    ],
    foods: [
      "Mansaf — Jordan's national dish: lamb cooked in fermented yogurt sauce (jameed) served over rice with flatbread; eaten communally by hand",
      "Falafel — Amman's street-corner falafel (especially on Rainbow Street) rivals anywhere in the world",
      "Kunafa — iconic Levantine dessert of shredded pastry soaked in sweet syrup with stretchy cheese, best from Habibah sweets",
      "Shawarma — Amman's shawarma uses lamb or chicken wrapped in saj bread with tahini and vegetables",
      "Hummus — made fresh daily; the best versions are served warm with olive oil and ful (fava beans)",
      "Maqluba — 'upside-down' rice dish with fried vegetables and meat, a beloved Jordanian home recipe"
    ],
    tips: [
      "Amman is a city of hills — comfortable shoes are non-negotiable; the citadel climb alone takes 20 minutes",
      "The Jordan Pass ($70-120) includes a Jordanian visa AND Petra entry — buy it before arriving to save money",
      "Uber operates in Amman and is safer and cheaper than negotiating with taxis",
      "Most restaurants don't open for dinner until 8 PM — Jordanians eat late",
      "Friday and Saturday are the weekend in Jordan — many shops and businesses are closed on Fridays",
      "Learn 'Yislamo ideyk' (bless your hands) to compliment Jordanian cooks — it earns enormous goodwill"
    ],
    dayTrips: [
      "Petra — the Rose City, Jordan's greatest wonder; 3-hour drive south; spend a full day minimum",
      "Wadi Rum — Mars-like red desert landscape; 4 hours south; overnight Bedouin camp is unmissable",
      "Dead Sea — lowest point on Earth; float in hypersaline water; 45 minutes west of Amman",
      "Jerash — best-preserved Roman city outside Italy with colonnaded streets and triumphal arches, 45 minutes north"
    ],
    hidden: [
      "Duke's Diwan — free museum in a 1924 Ottoman building downtown; the owner Abdullah gives personal tours",
      "Weibdeh Saturday Market — neighborhood art market with local ceramics, paintings, and vintage finds",
      "Nymphaeum — largely ignored Roman fountain monument in downtown Amman, rarely crowded",
      "Kan Zaman — restored 19th-century village turned restaurant complex in south Amman with traditional architecture"
    ],
    photoSpots: [
      "Citadel at blue hour just before sunset — Temple of Hercules columns glow golden against the city panorama",
      "Roman Theatre from the top tier looking down at the stage with the old city beyond",
      "Rainbow Street murals on a quiet morning before the cafés open",
      "Looking east from Jabal al-Qal'a at the white stone city cascading down hills in every direction"
    ],
    romantic: [
      "Sunset at the Citadel followed by dinner at Rakwet Arab on Rainbow Street under string lights",
      "Evening stroll through Jabal Al-Weibdeh's lantern-lit alleyways and gallery hopping",
      "Hammam Al Pasha — traditional Ottoman hammam experience for couples in the old city"
    ],
    family: [
      "Jordan Museum's interactive exhibits including replicas of Petra's siq and Dead Sea Scrolls",
      "Children's Museum Jordan in the 3rd Circle area — hands-on science exhibits",
      "Roman Theatre with the attached Folklore and Popular Traditions Museums"
    ],
    nightlife: [
      "Books@Café on Rainbow Street — three-floor bookshop-bar hybrid with rooftop views",
      "Jabal Al-Weibdeh's café strip — Kalha, Shams El Balad, and Eco Turismo for late-night coffee culture",
      "Champions Bar at Marriott Amman — hotel bar popular with expats for live sports screenings"
    ],
    shopping: [
      "Souk Jara (Friday mornings) for artisan ceramics, handmade jewelry, vintage Jordanian coins",
      "Jordan Craft Centre near 3rd Circle for high-quality certified traditional crafts",
      "Downtown gold souq for 21-karat gold jewelry at fixed competitive prices"
    ],
    transport: [
      "Uber is the most convenient way to get around — cheap and avoids taxi negotiation hassles",
      "Walking is possible in Jabal Amman and Weibdeh but hills make it tiring with luggage",
      "JETT bus to Petra and Aqaba from the Abdali bus terminal — comfortable and affordable"
    ],
    safety: [
      "Amman is very safe by regional standards — violent crime against tourists is extremely rare",
      "Stay aware in Downtown markets at night — petty theft can occur in crowded souqs",
      "Jordan's political stability is high; border tensions from neighboring countries rarely affect Amman"
    ],
    etiquette: [
      "Jordanian hospitality is legendary — accepting tea or coffee offered is expected and appreciated",
      "Men should not initiate handshakes with Jordanian women unless she extends her hand first",
      "Avoid political commentary about neighboring countries and local royalty"
    ],
    packing: [
      "Layers for spring and autumn — evenings can be surprisingly cold at Amman's 750m elevation",
      "Modest clothing (covered shoulders and knees) for mosques and conservative areas",
      "Reef-safe sunscreen for the Dead Sea and Wadi Rum excursions"
    ],
    visa: [
      "Jordan Pass ($70-120 USD, includes Petra entry) covers visa for most Western nationalities",
      "Visa on arrival available at Amman airport for most nationalities for ~$56 USD without Jordan Pass",
      "Israeli passport holders may enter Jordan via the Allenby Bridge crossing"
    ],
    sustainable: [
      "Stay at locally owned guesthouses in Wadi Musa (near Petra) rather than chain hotels to support Bedouin communities",
      "Book with community-based tourism operators in Wadi Rum like Rahayeb Desert Camp",
      "The Dana Biosphere Reserve is Jordan's most sustainable ecotourism destination — 3 hours south of Amman"
    ],
    imgId: "photo-1579606032821-4b18de1f9f42",
  },
  {
    id: "tbilisi",
    name: "Tbilisi",
    country: "Georgia",
    continent: "Europe",
    tagline: "The Caucasus crossroads of ancient wine culture, sulfur baths, and electrifying nightlife",
    lang: "Georgian",
    currency: "Georgian Lari (₾)",
    bestTime: "May to June and September to October",
    peakSeason: "July to August",
    climate: "Humid subtropical with hot summers, cold winters, and pleasant springs and autumns",
    budget: [35, 75, 180],
    attractions: [
      "Old Town (Abanotubani) — the sulfur bath district with domed bathhouses and balconied wooden houses carved from volcanic rock",
      "Narikala Fortress — 4th-century citadel above Old Town with panoramic views over the Mtkvari River",
      "Rustaveli Avenue — the grand central boulevard with opera house, national museum, and parliament",
      "Shida Kartli Art Museum at the Metekhi Church — cliff-edge church with exceptional views over Old Tbilisi",
      "Dry Bridge Market — sprawling outdoor antique and flea market beloved by locals and collectors",
      "Mtatsminda Park — hilltop amusement park and observatory reached by funicular"
    ],
    areas: [
      "Old Town (Dzveli Tbilisi) — the atmospheric historic heart with sulfur baths, wooden balconies, and the famous Peace Bridge",
      "Rustaveli Avenue — cultural and political center with theaters, galleries, and major hotels",
      "Fabrika — repurposed Soviet textile factory turned into Tbilisi's hippest food and arts hub",
      "Marjanishvili and Vera — residential neighborhoods with coffee shops, wine bars, and local life",
      "Vake — upscale residential district with Vake Park and the better restaurants"
    ],
    foods: [
      "Khinkali — soup dumplings filled with spiced meat; bite a hole to drink the broth before eating; never use a fork",
      "Khachapuri — cheese-filled bread in multiple regional styles; the Adjaruli boat-shaped version with egg and butter is the most famous",
      "Mtsvadi — Georgian pork or beef skewers grilled over vine wood for a distinctive smoky flavor",
      "Churchkhela — walnut-filled grape juice candy that looks like candles; sold everywhere in Old Town",
      "Badrijani Nigvzit — fried eggplant rolls filled with walnut paste, garlic, and spices",
      "Chacha — Georgia's potent grape pomace brandy, offered everywhere; accept graciously but sip slowly"
    ],
    tips: [
      "Georgia invented wine over 8,000 years ago; try qvevri orange wine (skin-contact, amber-colored) — nothing else tastes like it",
      "Tbilisi's sulfur baths (Chreli Abano or Orbeliani) are a must-do — private rooms cost $20-40 for 90 minutes",
      "The metronome currency exchange booths on Rustaveli give better rates than ATMs for USD/EUR",
      "Bolt (like Uber) is the main ride app — rides within the city center cost under $3",
      "Georgian supra (feast) culture means you will never leave a dinner hungry; pace yourself",
      "Tbilisi's nightlife is world-class — Bassiani, Shelter, and Café Gallery are legendary underground clubs"
    ],
    dayTrips: [
      "Mtskheta — ancient capital and UNESCO World Heritage site with Svetitskhoveli Cathedral, 25 minutes north",
      "Kazbegi — dramatic mountain town under Mt. Kazbek with the famous Gergeti Trinity Church, 3 hours north",
      "Signagi — romantic wine town in Kakheti wine region with a medieval wall and panoramic vineyards, 1.5 hours east",
      "Uplistsikhe — ancient rock-hewn cave city from 1000 BC carved into a volcanic cliff, 1.5 hours west"
    ],
    hidden: [
      "Leghvtakhevi Waterfall — hidden canyon and waterfall directly behind Abanotubani sulfur baths, almost no tourists",
      "Betlemi Street murals — winding hilltop street above Old Town with street art and sweeping city views",
      "Dezerter Bazaar — vast Soviet-era covered market where Tbilisians actually shop for spices, cheese, and produce",
      "Turtle Lake (Kus Tba) — forested lake above Vake Park, beloved local picnic spot with paddleboats and barbecue"
    ],
    photoSpots: [
      "Peace Bridge from Old Town side at night — illuminated steel and glass over the Mtkvari River",
      "Narikala Fortress at sunset with Old Town's balconied rooftops in the foreground",
      "Metekhi Church on the cliff edge at golden hour",
      "Tbilisi Botanical Garden waterfall canyon at midday when light filters through the canopy"
    ],
    romantic: [
      "Private sulfur bath at Orbeliani Baths followed by wine at a candlelit Old Town restaurant",
      "Sunset funicular ride to Mtatsminda and dinner at the revolving restaurant with city views",
      "Wine tasting at Wine Factory No. 1 in Fabrika followed by a late-night supra feast"
    ],
    family: [
      "Tbilisi Zoo (newly renovated) with snow leopards and Caucasian wildlife",
      "Mtatsminda Park funicular and amusement rides for children",
      "Uplistsikhe cave city — kids love exploring the underground tunnels and rooms"
    ],
    nightlife: [
      "Bassiani — world-renowned techno club inside Dinamo Stadium; LGBTQ+-friendly; expect queues on weekends",
      "Fabrika's courtyard — 30+ shipping container bars and restaurants; the social heart of new Tbilisi",
      "Rooms Hotel rooftop bar — cocktails overlooking the old city, attracts a stylish local crowd"
    ],
    shopping: [
      "Dry Bridge Market (weekends) for Soviet-era memorabilia, antique jewelry, old Georgian icons",
      "Fabrika market for independent Georgian designers and artisans",
      "Prospero's Books on Rustaveli — beloved English-language bookshop with travel literature and maps"
    ],
    transport: [
      "Bolt app for rides — most efficient and cheapest way to get around; always cheaper than taxis",
      "Metro (2 lines) covers main areas cheaply; buy a Metromoney card for ₾0.50 per ride",
      "Walking is the best way to explore Old Town and Rustaveli — most sights within 30 minutes on foot"
    ],
    safety: [
      "Tbilisi is generally very safe; violent crime against tourists is rare",
      "The Gldani and Isani districts are rougher — stick to central areas unless with a local",
      "Traffic is chaotic; pedestrian crossings are not always respected — cross carefully"
    ],
    etiquette: [
      "Refusing a Georgian toast is rude — you can sip rather than drain your glass, but never refuse entirely",
      "Georgians are exceptionally hospitable; accepting food or coffee in someone's home is expected",
      "The Georgian alphabet is unique — learning to say 'madloba' (thank you) earns immediate warmth"
    ],
    packing: [
      "Layers are essential — Tbilisi weather is volatile; mornings can be cool even in summer",
      "Good walking shoes for cobblestone Old Town streets",
      "A nice outfit for nightclubs — Tbilisi clubbing culture has dress codes at upscale venues"
    ],
    visa: [
      "Citizens of 94 countries including the US, UK, EU, and most of Asia get visa-free entry for up to 365 days",
      "Passport holders from countries not on the visa-free list can apply for e-Visa at evisa.gov.ge",
      "Entry by land from Armenia, Turkey, and Azerbaijan is possible and often cheaper than flying in"
    ],
    sustainable: [
      "Buy wine directly from small Kakheti producers at Dezerter Bazaar rather than supermarket imports",
      "Use Tbilisi's metro and Bolt shared rides instead of renting a car within the city",
      "Support guesthouses in Signagi and Mtskheta run by local families for authentic and community-benefiting stays"
    ],
    imgId: "photo-1565008576549-57569a49371d",
  },
  {
    id: "ljubljana",
    name: "Ljubljana",
    country: "Slovenia",
    continent: "Europe",
    tagline: "Europe's most livable small capital — a fairy-tale city of dragons, cycling lanes, and pristine alpine nature",
    lang: "Slovenian",
    currency: "Euro (€)",
    bestTime: "April to October",
    peakSeason: "June to August",
    climate: "Continental with warm summers, cold winters, and pleasant spring and autumn",
    budget: [60, 120, 280],
    attractions: [
      "Ljubljana Castle — hilltop fortress with panoramic city views reached by funicular; free to walk up",
      "Triple Bridge (Tromostovje) — Plečnik's iconic three-bridge cluster over the Ljubljanica River in the old city",
      "Dragon Bridge — Art Nouveau bridge with four dragon sculptures, the symbol of Ljubljana",
      "Central Market — Plečnik-designed open-air market along the river with fresh produce and local cheeses",
      "National Gallery of Slovenia — the country's finest art collection in a beautiful 19th-century palace",
      "Tivoli Park — vast forested city park perfect for walking, cycling, and summer concerts"
    ],
    areas: [
      "Old Town — the compact cobblestone center with the castle, Triple Bridge, and riverside restaurants",
      "BTC City — modern eastern district with the world's largest outdoor shopping center",
      "Metelkova City — former Yugoslav army barracks turned alternative arts and social center",
      "Šiška — northwestern residential district with excellent local restaurants and Ljubljana's best live music venues",
      "Trnovo — bohemian neighborhood south of the old town with student bars and Plečnik's canal"
    ],
    foods: [
      "Kranjska Klobasa — the iconic Carniolan sausage, boiled or grilled, served with mustard and horseradish",
      "Potica — traditional rolled walnut cake eaten at almost every Slovenian celebration",
      "Štruklji — rolled dumplings with walnut, tarragon, or cottage cheese filling; a Slovenian comfort food staple",
      "Prekmurska Gibanica — layered pastry with poppy seeds, walnuts, apples, and cottage cheese from eastern Slovenia",
      "Žganci — buckwheat spoon bread, Slovenia's oldest dish, served with sour milk or stewed meat",
      "Brinjevec — juniper berry brandy distilled from fermented juniper berries; a fiery Slovenian digestif"
    ],
    tips: [
      "Ljubljana is tiny and pedestrianized — the entire Old Town is car-free and walkable in under 20 minutes",
      "Rent a Bicikelj city bike (€1/hour) to explore beyond the old town — cycling infrastructure is excellent",
      "Ljubljana Card ($30/day) gives free transport, castle funicular, and museum entry — worth it for a 2-day visit",
      "The Central Market is closed on Sundays — plan accordingly if you want fresh local produce",
      "Lake Bled is the most crowded daytrip; go in the morning or visit Bohinj instead for fewer people",
      "Slovenian wine regions (Goriška Brda, Vipava) produce world-class wine that almost never leaves the country — try locally"
    ],
    dayTrips: [
      "Lake Bled — the postcard image of Slovenia; glacial lake with a castle on a cliff and an island church, 55 minutes northwest",
      "Postojna Cave — one of Europe's longest cave systems with underground train rides, 1 hour southwest",
      "Piran — perfectly preserved Venetian coastal town on the Adriatic, 1.5 hours southwest",
      "Triglav National Park — Julian Alps hiking with 2,864m summit and the Soča River's impossibly turquoise water, 1.5 hours northwest"
    ],
    hidden: [
      "Rožnik Hill — forested hill above Tivoli with a monastery, weekend picnickers, and city views without the castle crowds",
      "Krakovo district — Ljubljana's oldest neighborhood with Roman-era street grid and the prettiest residential houses",
      "Open Kitchen Friday Market — food truck festival every Friday (March-October) in Pogačarjev trg with 30+ vendors",
      "Šmarna Gora — local hill with a hilltop church just north of the city; Ljubljanans hike up for weekend brunch"
    ],
    photoSpots: [
      "Triple Bridge from the riverside café level at blue hour when the lights reflect in the Ljubljanica",
      "Ljubljana Castle at night from the Dragon Bridge, with the lit turrets above the old city rooftops",
      "Central Market on a weekday morning with colorful fruit stalls and the Franciscan church behind",
      "Trnovo canal on a Sunday with locals cycling and the weeping willows trailing in the water"
    ],
    romantic: [
      "Boat trip along the Ljubljanica River through the old city at sunset",
      "Wine tasting at Movia wine bar — Slovenia's top natural wine producer with atmospheric Old Town cellars",
      "Dinner at Strelec restaurant inside Ljubljana Castle with candlelit views over the entire city"
    ],
    family: [
      "Postojna Cave train ride and Predjama Castle (built into a cave cliff face, 9km away)",
      "Ljubljana Zoo in Tivoli Park — small but charming with Slovenian wolves and lynx",
      "Cycling the Tivoli Park paths and riverside promenade — perfectly safe for children"
    ],
    nightlife: [
      "Metelkova City — Europe's smallest autonomous cultural zone with live gigs, clubs, and alternative arts every weekend",
      "Pritličje Bar — legendary Old Town bar that transforms into a club after midnight",
      "Kino Šiška — concert hall in northwest Ljubljana for live music from folk to electronic"
    ],
    shopping: [
      "Open Kitchen Friday Market for local food producers and artisan snacks to bring home",
      "Rustika shop for Slovenian honey, potica, and locally made ceramics",
      "Antikvarnica Knjigarna on Mestni trg for Slovenian postcards, vintage maps, and secondhand books"
    ],
    transport: [
      "Ljubljana is car-free in the old town — walk or take the free electric Kavalir shuttles for the elderly and luggage",
      "Bicikelj bike share is the best way to get around the wider city",
      "Arriva and other long-distance buses connect Ljubljana to Lake Bled, Piran, and Triglav cheaply"
    ],
    safety: [
      "Ljubljana is one of Europe's safest capitals — crime is very low across the entire city",
      "The Metelkova area can be edgy late at night but is generally safe within the complex itself",
      "Standard European travel caution applies: watch for pickpockets in tourist areas"
    ],
    etiquette: [
      "Slovenians are reserved at first but warm up quickly — don't mistake initial quietness for unfriendliness",
      "Tipping 10% is appreciated but not obligatory; locals often round up the bill",
      "Respect cycling lanes — pedestrians who wander into bike paths will get a polite but firm bell"
    ],
    packing: [
      "A rain jacket in any season — Ljubljana gets afternoon showers frequently even in summer",
      "Hiking boots if you plan to explore Triglav National Park or Šmarna Gora",
      "Smart casual outfit for nicer restaurants — Ljubljana has a stylish dining scene"
    ],
    visa: [
      "Slovenia is in the Schengen Zone — EU/EEA and most Western nationalities (US, UK, Canada, Australia) need no visa",
      "US citizens can stay up to 90 days in 180 days across the Schengen Area without a visa",
      "Non-EU visitors requiring a visa apply for a Schengen short-stay visa through the Slovenian embassy"
    ],
    sustainable: [
      "Ljubljana was ranked Europe's most sustainable city multiple times — support this by using cycling and public transport",
      "Buy local produce at the Central Market from Slovenian farmers rather than supermarket chains",
      "Choose guesthouses in the Old Town over large chain hotels to keep tourism money in the community"
    ],
    imgId: "photo-1600181957868-12b0b9e6a268",
  },
  {
    id: "kotor",
    name: "Kotor",
    country: "Montenegro",
    continent: "Europe",
    tagline: "The Adriatic's most dramatic walled city — medieval Venice meets Balkan wilderness",
    lang: "Montenegrin",
    currency: "Euro (€)",
    bestTime: "May to June and September to October",
    peakSeason: "July to August (hot and very crowded)",
    climate: "Mediterranean with hot dry summers, mild rainy winters",
    budget: [50, 100, 250],
    attractions: [
      "Kotor Old Town — UNESCO-listed walled city with Venetian architecture, marble squares, and cat cafés",
      "City Walls — 4.5km of medieval fortification walls climbing 1,350 steps to the fortress above the city",
      "Perast Village — Baroque village on the bay with two island churches accessible by water taxi",
      "Our Lady of the Rocks — artificial island church built by sailors over 500 years, reached by boat from Perast",
      "Bay of Kotor (Boka Kotorska) — the southernmost fjord in Europe surrounded by dramatic limestone mountains",
      "Church of St. Tryphon — Romanesque-Baroque cathedral from 1166 in the heart of the old city"
    ],
    areas: [
      "Old Town — the walled medieval core with the cathedral, squares, and most restaurants",
      "Perast — quiet Baroque village 12km north on the bay, a perfect half-day escape from the city",
      "Dobrota — suburb immediately north of the walls with residential waterfront and local restaurants",
      "Prčanj — village 6km south with the most photogenic waterfront views of the mountains",
      "Tivat — modern town 10km south with Porto Montenegro marina and the international airport"
    ],
    foods: [
      "Crni Rižot — Adriatic black squid ink risotto, fresh and briny, found at every seafood restaurant",
      "Buzara — shellfish (mussels or shrimp) sautéed in white wine, garlic, and parsley; a Montenegrin coastal staple",
      "Prosciutto Njeguški — air-dried ham from the mountain village of Njeguši, sold in every market",
      "Kačamak — polenta-like cornmeal with potatoes, cheese, and kajmak cream; hearty mountain food",
      "Priganice — fried dough balls drizzled with honey or jam, a popular local breakfast snack",
      "Vranac wine — Montenegro's signature bold red wine from the Crmnica region; excellent with grilled meats"
    ],
    tips: [
      "Climb the city walls in the morning (before 9 AM) to beat the cruise ship crowds that arrive by 10 AM",
      "July and August are brutally hot and overcrowded — May, June, and September offer the same beauty with fewer people",
      "Water taxis from Kotor to Perast run every 30 minutes and cost about $4 each way",
      "The $8 wall-climbing ticket is best value in Montenegro — allow 2 hours for the full ascent to San Giovanni fortress",
      "Airbnb apartments in Dobrota give waterfront views without the noise of the old town",
      "Montenegro uses the Euro despite not being in the EU — cash is still preferred at many restaurants"
    ],
    dayTrips: [
      "Lovćen National Park — winding mountain road to the mausoleum of Montenegro's poet-king Petar II; 45 minutes; views of the bay are extraordinary",
      "Budva Riviera — the Montenegrin Riviera's party capital with sandy beaches, 25 minutes south",
      "Cetinje — Montenegro's historic royal capital and cultural center, 40 minutes through the mountains",
      "Ostrog Monastery — dramatic white monastery built directly into a cliff face, one of the holiest sites in the Balkans, 1.5 hours north"
    ],
    hidden: [
      "Škurda River Canyon — short walk from the north gate into a dramatic limestone gorge that most tourists never find",
      "St. Ivan's Fortress (Fortress of San Giovanni) — continue past the main viewpoint to the top for 360° views with no crowds",
      "Rose Beach near Tivat — locals-only rocky cove south of Porto Montenegro; bring your own snorkeling gear",
      "Gornji Stoliv village — ancient hillside village above Dobrota that you can walk to from the waterfront in 45 minutes"
    ],
    photoSpots: [
      "Old Town walls at sunrise before 7 AM when the cruise passengers haven't arrived and the light is magical",
      "Perast village from the water looking back at the town with the island churches and mountains",
      "Looking down from the city walls to the red rooftops of the old city with the bay beyond",
      "Our Lady of the Rocks at golden hour when the stone church glows orange on its tiny man-made island"
    ],
    romantic: [
      "Private boat charter on the Bay of Kotor for sunset with a bottle of Vranac and the mountains glowing pink",
      "Dinner at Galion restaurant just outside the south gate — tables over the water with old town views",
      "Hammam Kotor — Ottoman-era hammam experience in the old city for couples"
    ],
    family: [
      "Water taxi tour of the Bay of Kotor with stops at Perast and Our Lady of the Rocks — kids love the boat ride",
      "Climbing the city walls — a fun adventure for older children with fortress ruins to explore at the top",
      "Beaches at Plavi Horizonti near Tivat — calm sandy beach ideal for young children"
    ],
    nightlife: [
      "Maximus club on the Tivat road — the main summer party venue popular with locals and visitors",
      "Old Town bars on Trg od Mlijeka (Milk Square) — dozens of outdoor bar tables in a medieval square",
      "Antico Caffè — historic café-bar inside the old walls with live music on weekends"
    ],
    shopping: [
      "Old Town shops for silver filigree jewelry, hand-embroidered linen, and locally made olive oil",
      "Njeguški smoked ham and cheese stalls on the road to Lovćen National Park",
      "Local wine shops inside the old town for Vranac and Krstač (white) wines"
    ],
    transport: [
      "Walking is how you experience the Old Town — no cars inside the walls",
      "Water taxis connect Kotor to Perast and other bay towns cheaply and frequently",
      "Renting a car is essential for Lovćen, Ostrog, and inland Montenegro"
    ],
    safety: [
      "Kotor is very safe — the main concern is crowds and heat in peak season",
      "Watch your step on the medieval cobblestone streets — they are beautiful but slippery when wet",
      "The drive to Lovćen has sharp switchback mountain roads — drive carefully or take a guided tour"
    ],
    etiquette: [
      "Dress modestly when visiting churches — bare shoulders and short shorts are not appreciated",
      "Cat colonies in the Old Town are protected and beloved by locals — treat them with care",
      "Tipping 10-15% is appreciated at restaurants; leave cash directly for servers"
    ],
    packing: [
      "Water shoes for rocky Adriatic beaches",
      "Lightweight layers — mornings and evenings on the bay can be cool even in summer",
      "A hat and high-SPF sunscreen — the white limestone walls reflect intense heat in summer"
    ],
    visa: [
      "EU, US, UK, Canadian, Australian citizens get 90-day visa-free entry to Montenegro",
      "Montenegro is not in the Schengen Zone — your Montenegro days don't count toward your Schengen 90-day limit",
      "Electronic travel authorization (entry form) required for some nationalities — check government site before travel"
    ],
    sustainable: [
      "Visit Perast by bus or water taxi instead of renting a car — the bay road is congested in summer",
      "Eat at Dobrota and Prčanj restaurants rather than the tourist-trap spots inside the old city walls",
      "Avoid cruise ship days (usually Tuesdays-Thursdays) by checking the schedule at kotorkruzeri.me"
    ],
    imgId: "photo-1555993539-1732b0258235",
  },
  {
    id: "kathmandu",
    name: "Kathmandu",
    country: "Nepal",
    continent: "Asia",
    tagline: "Gateway to the Himalayas — spiritual chaos, ancient temples, and the world's greatest trekking hub",
    lang: "Nepali",
    currency: "Nepalese Rupee (NPR)",
    bestTime: "October to November and March to May",
    peakSeason: "October (post-monsoon, pre-winter)",
    climate: "Subtropical highland with warm summers, cool dry winters, and heavy monsoon from June-September",
    budget: [25, 60, 180],
    attractions: [
      "Pashupatinath Temple — sacred Hindu cremation ghats on the Bagmati River; the most important Shiva temple outside India",
      "Boudhanath Stupa — the world's largest spherical stupa; epicenter of Tibetan Buddhism in Nepal; prayer flags, monks, and circumambulation",
      "Swayambhunath (Monkey Temple) — ancient hilltop stupa with the all-seeing eyes of Buddha watching over the Kathmandu Valley",
      "Durbar Square — three UNESCO-listed royal palace squares in Kathmandu, Patan, and Bhaktapur with pagoda temples",
      "Thamel — the backpacker district and trekking hub with gear shops, rooftop cafés, and endless activity agencies",
      "Patan Durbar Square — arguably the finest Newar architecture in the valley with metalwork shops and the Patan Museum"
    ],
    areas: [
      "Thamel — the tourist center with trekking agencies, gear shops, rooftop restaurants, and nightlife",
      "Patan (Lalitpur) — the artisan city south of Kathmandu with finer architecture and a calmer pace",
      "Bhaktapur — preserved medieval city 14km east; the most intact Newar city in the valley",
      "Boudha — Tibetan Buddhist enclave around Boudhanath Stupa with monasteries and excellent momos",
      "Durbar Marg — upscale central Kathmandu with better restaurants and the Royal Palace gardens"
    ],
    foods: [
      "Momos — Tibetan-Nepali steamed dumplings filled with buffalo, chicken, or vegetables; Kathmandu's most beloved street food",
      "Dal Bhat — the national meal: lentil soup, steamed rice, vegetable curry, and pickles; unlimited refills are custom",
      "Thukpa — Tibetan noodle soup with vegetables or meat; warming and cheap, especially around Boudhanath",
      "Chatamari — Newari rice crêpe topped with egg, meat, and spices; the 'Newar pizza' from Bhaktapur",
      "Juju Dhau — 'King of Yogurt' from Bhaktapur; creamy, slightly sweet buffalo yogurt served in clay pots",
      "Tongba — fermented millet beer drunk through a bamboo straw, traditional to the eastern hills"
    ],
    tips: [
      "Book trekking permits in advance — TIMS card and Langtang/Annapurna permits are required and can sell out",
      "Air quality in Kathmandu Valley is poor in winter and dry season — a mask or buff is useful",
      "Negotiate guesthouse prices in Thamel — posted rates are starting points, not final prices",
      "The tourist price for sites like Pashupatinath ($15) covers entire complex access — bring the receipt",
      "Electricity cuts (load shedding) still happen — carry a power bank",
      "Altitude: Kathmandu sits at 1,400m; you may feel mild headaches in the first 24 hours"
    ],
    dayTrips: [
      "Nagarkot — hilltop village with Himalayan panorama including Everest on clear days, 32km east; arrive before 7 AM",
      "Dhulikhel — quieter hilltop alternative to Nagarkot with mountain views and a charming town, 30km east",
      "Changu Narayan — UNESCO-listed hilltop Vishnu temple, Nepal's oldest; short hike from Bhaktapur, 1 hour",
      "Pokhara — Nepal's second city on a lake with Annapurna views; 6-hour drive or 30-minute flight; base for Annapurna treks"
    ],
    hidden: [
      "Oku Bahal — hidden Newar courtyard temple in old Kathmandu visited by almost no tourists despite its beauty",
      "Kirtipur — hilltop Newar town southwest of the city with excellent valley views and ancient temples with no crowds",
      "Naxal Bhagwati Temple fish tank — local neighborhood shrine where fish are considered sacred and hand-fed by devotees",
      "Ichangu Narayan — easy hilltop temple 6km west of Thamel with viewpoints and no tourist entrance fees"
    ],
    photoSpots: [
      "Boudhanath at dawn when monks circumambulate the stupa with butter lamps and prayer wheels",
      "Swayambhunath at sunrise before the monkeys and tourists arrive, with the valley mist below",
      "Bhaktapur's Pottery Square at 7 AM with potters working clay in the morning light",
      "Pashupatinath cremation ghats from the east bank at late afternoon for powerful documentary photography"
    ],
    romantic: [
      "Rooftop dinner at Chez Caroline or 1905 restaurant in Thamel overlooking temple rooftops",
      "Sunrise at Nagarkot with the Himalayan range appearing above the clouds",
      "Traditional Newari thali feast at Bhaktapur Durbar Square by candlelight"
    ],
    family: [
      "Kathmandu Valley cycling tour — gentle loops through rice paddies and village temples",
      "Bungee jumping and white-water rafting day trip to Bhote Koshi River with reputable operators",
      "Interactive cooking class learning dal bhat and momos with local families"
    ],
    nightlife: [
      "Thamel Music Lounge — live Nepali folk music meets Western rock nightly from 8 PM",
      "Purple Haze Rock Bar — legendary Thamel live music venue open since the 1990s",
      "OR2K — rooftop chillout bar popular with travelers for hookah and evening vibes"
    ],
    shopping: [
      "Thamel for trekking gear (genuine brands alongside copies — inspect carefully)",
      "Patan for traditional bronze Ganesh statues, singing bowls, and pashmina scarves",
      "Durbar Marg for certified-quality handicrafts at the Nepal Handicraft Showroom"
    ],
    transport: [
      "Taxis have no meters — negotiate the fare before getting in; Kathmandu to Boudha should be ~$5",
      "Pathao app (motorcycle taxi) is the fastest way through Kathmandu traffic and costs under $2",
      "Electric Tempo (three-wheelers) run fixed routes in the old city for under $0.30"
    ],
    safety: [
      "Kathmandu is generally safe for tourists but petty theft in Thamel does occur — use hotel safes",
      "Avoid road travel after dark — roads are poorly lit and traffic accidents are common",
      "Only book trekking through registered, bonded agencies — ask to see their Tourism Board registration"
    ],
    etiquette: [
      "Remove shoes before entering temples and homes — you will always see a pile of shoes at the door",
      "Walk clockwise around stupas and mani walls — this is the prescribed Buddhist direction",
      "Do not touch religious statues or offer meat near Hindu temples"
    ],
    packing: [
      "Layered clothing — valley weather is warm in the day but cold at night, especially in winter",
      "Altitude medication (Diamox) if planning to trek above 3,500m — consult a doctor",
      "Waterproof trekking boots even if you're only in Kathmandu — sudden rain is common"
    ],
    visa: [
      "Most nationalities can get a Tourist Visa on arrival at Tribhuvan Airport for $30 (15 days), $50 (30 days), or $125 (90 days)",
      "Indian citizens need no visa — free entry with national ID card",
      "e-Visa available at nepalimmigration.gov.np before travel; speeds up the arrival process significantly"
    ],
    sustainable: [
      "Porter welfare: if trekking, ensure your agency pays porters fair wages and provides proper gear — look for IPPG-certified operators",
      "Carry a reusable water bottle and purification tablets — single-use plastic on trekking trails is a major pollution problem",
      "Visit Kirtipur and Bhaktapur instead of only Kathmandu to distribute tourism income to smaller communities"
    ],
    imgId: "photo-1605640840605-14ac1855827b",
  },
  {
    id: "medellin",
    name: "Medellín",
    country: "Colombia",
    continent: "South America",
    tagline: "The City of Eternal Spring — once infamous, now one of Latin America's most innovative and vibrant cities",
    lang: "Spanish",
    currency: "Colombian Peso (COP)",
    bestTime: "December to February and July to August",
    peakSeason: "December (Feria de las Flores festival)",
    climate: "Spring-like year-round at 1,500m elevation — 72°F/22°C average with two brief rainy seasons",
    budget: [35, 80, 200],
    attractions: [
      "Plaza Botero — 23 monumental bronze sculptures by Fernando Botero in the heart of the city center",
      "Comunas Cable Car (Metrocable) — gondola system connecting hilltop comunas to the metro; public transport and urban transformation icon",
      "El Poblado — the upscale neighborhood and café capital of Colombia with Parque El Lleras at its center",
      "Parque Arví — cloud forest park above the city reached by cable car; hiking, zip-lining, and artisan market",
      "Museum of Antioquia — world-class museum in the downtown cultural district; largest collection of Botero works",
      "Laureles and Estadio neighborhoods — authentic Medellín life away from tourists with local restaurants and football culture"
    ],
    areas: [
      "El Poblado — the tourist and expat hub with international restaurants, cocktail bars, and hostels; Parque El Lleras is the center of the action",
      "Laureles — residential neighborhood favored by locals and long-term visitors; better value and more authentic",
      "El Centro — the historic downtown with Botero Plaza, the Metrocable lower stations, and the market district",
      "Envigado — quiet upscale suburb south of El Poblado with excellent coffee shops and local dining",
      "Sabaneta — authentic south-Medellín suburb with the Parroquia de San Juan and some of Colombia's best fritanga restaurants"
    ],
    foods: [
      "Bandeja Paisa — the iconic Antioquian mega-plate: beans, rice, chicharrón, chorizo, egg, arepa, and avocado; Medellín's defining dish",
      "Arepa con Queso — thin grilled cornmeal flatbread with melted cheese; the daily breakfast staple",
      "Sancocho — thick soup of chicken or beef with potatoes, corn, and plantain; Sunday comfort food across Colombia",
      "Empanadas Paisas — corn empanadas fried crispy and filled with potato, egg, and meat; sold on every street corner",
      "Aguardiente — Colombia's anise-flavored sugarcane liquor; the spirit of every Medellín party and celebration",
      "Cazuela de Frijoles — Antioquian bean stew with pork rinds and hogao (tomato-onion sauce); the soul of local cooking"
    ],
    tips: [
      "The Medellín Metro and Metrocable are safe, affordable, and the best way to experience the city's transformation",
      "Speak basic Spanish — El Poblado is English-friendly but locals appreciate any attempt at the language",
      "Don't display expensive jewelry, cameras, or phones in the street — standard urban awareness applies",
      "Coffee in Medellín is exceptional; visit Juan Valdez, Pergamino, or Café Velvet for specialty beans",
      "The Feria de las Flores in August is spectacular — flower parade, silleteros, and the best of Antioquian culture",
      "Change money at official exchange houses (Casas de Cambio) — ATMs and street changers have unfavorable rates"
    ],
    dayTrips: [
      "Guatapé — pastel-colored lakeside town below the giant El Peñol rock; climb 740 steps to the top for views, 1.5 hours east",
      "Santa Fe de Antioquia — colonial gold-rush town with white churches and cobblestone streets, 1.5 hours north",
      "Coffee Region (Eje Cafetero) — Salento and the Cocora Valley with giant wax palms, 4 hours south; best as overnight trip",
      "Jardín — perfectly preserved small colonial town with a spectacular flower-filled central plaza, 3 hours south"
    ],
    hidden: [
      "Barrio Manila — quiet neighborhood between El Centro and Laureles with murals and independent galleries rarely visited by tourists",
      "Pueblito Paisa — hilltop replica of a traditional Antioquian village with the best panoramic city views",
      "Mercado del Río — covered food market near Parque de la Vida with 70+ local food stalls; best for lunch on weekdays",
      "El Tesoro — upscale local mall on the hillside in Poblado with a stunning city view terrace that no guidebook mentions"
    ],
    photoSpots: [
      "Plaza Botero with Fernando Botero's oversized bronze sculptures and the Antioquia Museum behind",
      "Comunas from the cable car looking down at the hillside brick neighborhoods and city below",
      "El Peñol rock summit (Guatapé day trip) for 360° panorama over 36 islands",
      "El Poblado at golden hour when the green hills turn amber and the city lights begin to flicker on"
    ],
    romantic: [
      "Sunset cocktails at Casa Mango rooftop bar in El Poblado overlooking the city valley",
      "Horseback riding through the coffee farms above Santa Elena village, 45 minutes from the city",
      "Dinner at Carmen restaurant — Medellín's finest dining experience with a tasting menu of Colombian modern cuisine"
    ],
    family: [
      "Parque Explora — interactive science museum with aquarium and butterfly garden; excellent for children",
      "Guatapé lake speedboat and swim — kids love the bright-colored town and the giant rock climb",
      "Selvámonos ecopark near Rionegro airport — zip-lining and nature walks in cloud forest"
    ],
    nightlife: [
      "Parque El Lleras in El Poblado — the open-air bar square where the night begins for most visitors",
      "Vintrash — beloved local bar on the border of Laureles with live music and local cocktails",
      "Calle 33 in Laureles — the real local nightlife strip with salsa bars, bars, and late-night street food"
    ],
    shopping: [
      "Mercado de San Alejo (first Saturday of each month) in El Prado for antiques, art, and vintage clothes",
      "El Hueco market in downtown — chaotic but authentic wholesale market for local textiles and household goods",
      "Pergamino Café for specialty Colombian coffee beans to take home — the best single-origin in the city"
    ],
    transport: [
      "Metro + Metrocable system is fast, safe, and costs ~$0.90 per ride; pick up a Cívica card on arrival",
      "InDriver app is the recommended taxi alternative — safer and cheaper than street taxis",
      "Cycling is improving; CitiBici bike share is expanding but the hills are challenging"
    ],
    safety: [
      "Medellín is dramatically safer than its reputation suggests but normal urban caution is essential",
      "Avoid Niquitao and the immediate surroundings of Parque Berrío in El Centro after dark",
      "Never accept drinks from strangers — scopolamine drugging is a risk in nightlife venues; stick to reputable bars"
    ],
    etiquette: [
      "Colombians are warm and direct — reciprocate the friendliness; it is genuine",
      "Greeting with a cheek kiss is standard for women meeting women or men; two men usually shake hands",
      "Being 30-60 minutes late to social events is culturally normal ('Colombian time')"
    ],
    packing: [
      "Light layers — Medellín at 1,500m is warm but can feel cool after rain; a light cardigan is useful in the evening",
      "Rain jacket or small umbrella — the city has two rainy seasons and afternoon downpours are common",
      "Comfortable walking shoes — the hills and cobblestone colonial towns require good footwear"
    ],
    visa: [
      "US, UK, EU, Canadian, and Australian citizens get 90-day visa-free entry to Colombia",
      "No tourist visa required — you receive a stamp on arrival; extensions to 180 days can be requested at migration offices",
      "Yellow fever vaccination certificate may be required if arriving from certain countries; check current requirements"
    ],
    sustainable: [
      "Volunteer with Biblioteca España in Santo Domingo — the library in the comunas that symbolizes Medellín's transformation",
      "Book community tours in the comunas through Zipline Tours or Real City Tours — money goes directly to local guides",
      "Buy Colombian specialty coffee directly from farms in the Eje Cafetero rather than airport shops"
    ],
    imgId: "photo-1599946347371-68eb71b16afc",
  },
  {
    id: "hoi-an",
    name: "Hội An",
    country: "Vietnam",
    continent: "Asia",
    tagline: "Vietnam's lantern-lit trading port — UNESCO World Heritage silk town with the best food in Southeast Asia",
    lang: "Vietnamese",
    currency: "Vietnamese Dong (₫)",
    bestTime: "February to April",
    peakSeason: "July to August and December to January",
    climate: "Tropical monsoon; dry and warm February-August; flooding possible October-November",
    budget: [30, 75, 200],
    attractions: [
      "Ancient Town — the UNESCO-listed trading port with 1,000+ preserved heritage buildings, Japanese bridges, and merchant houses",
      "Japanese Covered Bridge (Chùa Cầu) — 400-year-old wooden bridge-temple, the symbol of Hội An",
      "Thu Bồn River — the ancient trade waterway; morning boat trips to reach My Son or lantern-lit evening boat rides",
      "An Bang Beach — the best of Hội An's beaches; 4km from the old town with good surf schools and seafood restaurants",
      "Phung Hung Ancient House — 17th-century merchant home with 8 generations of family history and free guided tours",
      "Cẩm Thanh Coconut Palm Forest — jungle waterway with bamboo basket boats and bird watching, 20 minutes by bicycle"
    ],
    areas: [
      "Ancient Town — the car-free historic center; most accommodation, restaurants, and sights within a 20-minute walk",
      "Cẩm Nam — island south of the river with local rice farms, village life, and the best morning pho",
      "An Bàng — beach village 4km from the old town with a growing café and restaurant scene",
      "Cua Dai — closer beach area with upscale resorts; erosion has reduced the beach width significantly in recent years",
      "Tra Que Village — organic vegetable farming village 3km north of town; cooking classes and early morning tours"
    ],
    foods: [
      "Cao Lầu — Hội An's signature dish: thick chewy noodles in a savory pork broth made from water drawn from a specific ancient well; available nowhere else in Vietnam",
      "White Rose Dumplings (Bánh Bao Vạc) — delicate shrimp dumplings shaped like roses; a Hội An family secret recipe",
      "Bánh Mì Phượng — the most famous bánh mì in the world; Anthony Bourdain called it 'the best sandwich I've ever eaten'; queue from 6 AM",
      "Cơm Gà Hội An — Hội An-style chicken rice with yellow turmeric rice and hand-shredded poached chicken",
      "Mì Quảng — turmeric-rich noodle dish with pork, shrimp, and a small amount of broth; Central Vietnamese specialty",
      "Chè Ba Màu — three-color dessert drink with mung bean, jelly, and red beans in coconut milk; perfect after a hot afternoon in the Ancient Town"
    ],
    tips: [
      "Buy the Ancient Town ticket ($5) for entry to 5 heritage sites — buy at the ticket office, not touts on the street",
      "Rent a bicycle ($2/day) — the flat terrain makes Hội An perfect for cycling to beaches and villages",
      "Go to Bánh Mì Phượng before 8 AM — the queue later in the day can be 45 minutes long",
      "Lantern Festival on the 14th of every lunar month — the Ancient Town goes car-free and lights up with hundreds of lanterns on the river",
      "Have clothes custom-tailored — Hội An has 400+ tailor shops; allow at least 24 hours for fittings and quality work",
      "The beach in February-April is ideal; avoid October-November during typhoon and flooding season"
    ],
    dayTrips: [
      "My Son Sanctuary — Cham ruins from the 4th century in a jungle valley, 50 minutes west; take an early morning tour to beat the heat",
      "Marble Mountains — five limestone hills with caves, Buddhist shrines, and city views; 25 minutes north near Da Nang",
      "Da Nang — Vietnam's most dynamic third city with the Dragon Bridge, modern beaches, and Han Market, 30 minutes north",
      "Cham Islands — snorkeling marine reserve 15km offshore by speedboat (45 minutes); best April-August"
    ],
    hidden: [
      "Cam Kim Island — across the river from the Ancient Town; bicycle to the woodcarving workshops and see craftsmen making the town's famous furniture",
      "Morning market on Tran Phu Street at 5 AM — the Ancient Town's fresh produce market visited by locals before tourists wake up",
      "Thanh Ha pottery village — village of traditional terracotta potters 3km west; make your own pot on a wheel for $3",
      "Rêu Flagstone Bridge — tiny medieval stepping-stone bridge in the rice paddies west of the Ancient Town; almost never photographed"
    ],
    photoSpots: [
      "Japanese Covered Bridge at dusk when the lanterns are lit and the reflections appear in the calm canal below",
      "Ancient Town from the Thu Bồn riverside at golden hour — tiled rooftops, yellow walls, lanterns",
      "Tra Que organic gardens at 6 AM with morning mist and farmers tending rows of herbs",
      "Full Moon Lantern Festival (14th of lunar month) — paper lanterns released on the river at night"
    ],
    romantic: [
      "Evening boat ride on the Thu Bồn River with floating lanterns and cocktails at sunset",
      "Couples cooking class at Morning Glory Cooking School — learn to make Hội An's signature dishes together",
      "Cycling through rice paddies to An Bang beach followed by fresh seafood dinner at sunset"
    ],
    family: [
      "Bamboo basket boat rides in the Cẩm Thanh coconut forest — kids love the spinning boats",
      "Lantern-making class in the Ancient Town — family-friendly creative workshop from $5 per person",
      "Cham Islands snorkeling day trip with child-friendly tour operators"
    ],
    nightlife: [
      "White Marble Wine Bar — sophisticated cocktail bar in the Ancient Town with extensive wine list",
      "Q Bar on the riverfront — sunset cocktails with the best view of the river and Japanese Bridge",
      "Ancient Town walking at night — the car-free evening streets lit with lanterns are magical without needing a specific venue"
    ],
    shopping: [
      "Custom tailoring — bring reference photos and allow 24-48 hours; Yaly Couture and A Dong Silk are the most reliable",
      "Indochine Art Gallery for original Vietnamese lacquerware, silk paintings, and photography",
      "Night Market on An Hội Island for lanterns, silk scarves, and handmade accessories"
    ],
    transport: [
      "Bicycle ($2/day) — the best and most authentic way to explore Hội An and the surrounding villages",
      "Grab app for rides to Da Nang airport (30 min, ~$10) and the beaches",
      "Ancient Town is car-free noon-9 PM — you will walk or cycle the historic core"
    ],
    safety: [
      "Hội An is very safe — one of Vietnam's safest tourist destinations",
      "Watch for flooding during October-November; streets in the Ancient Town can flood to knee-depth",
      "Bag snatching from motorbikes has been reported; keep bags on the inside, away from the road"
    ],
    etiquette: [
      "Cover up when entering temples in the Ancient Town — keep a scarf or light shirt available",
      "Don't wear swimwear on Ancient Town streets — it is prohibited and disrespectful",
      "Bargaining is acceptable at markets but be fair — a $1 difference is significant for street vendors"
    ],
    packing: [
      "Light linen clothes — humidity and heat make breathable fabric essential",
      "Sandals that can get wet — streets flood and you will walk riverside paths",
      "Portable waterproof phone case for Thu Bồn river activities and beach"
    ],
    visa: [
      "US, UK, German, French, and most Western nationalities get 45 days visa-free from 2023",
      "e-Visa valid for 90 days, multiple entry, available at evisa.xuatnhapcanh.gov.vn for $25 USD",
      "Visa on arrival via pre-approved letter from a Vietnam travel agency is another option — check current requirements before travel"
    ],
    sustainable: [
      "Rent a bicycle instead of a motorbike — the Ancient Town is a UNESCO site and emissions increase degradation",
      "Book cooking classes with Morning Glory, which sources ingredients from Tra Que organic village",
      "Skip plastic water bottles — refill at your guesthouse or buy a large jug to share with travel companions"
    ],
    imgId: "photo-1583417319070-4a69db38a482",
  },
  {
    id: "fes",
    name: "Fès",
    country: "Morocco",
    continent: "Africa",
    tagline: "The world's largest car-free city — a 1,200-year-old medina that makes you believe time travel is possible",
    lang: "Arabic/Darija",
    currency: "Moroccan Dirham (MAD)",
    bestTime: "March to May and September to November",
    peakSeason: "April and October",
    climate: "Semi-arid Mediterranean with hot dry summers and cool wet winters",
    budget: [35, 80, 220],
    attractions: [
      "Fès el-Bali Medina — UNESCO World Heritage city; 9,400 streets and alleys forming the world's largest car-free urban area",
      "Chouara Tannery — medieval leather dyeing complex unchanged since the 10th century; best viewed from roof terraces of surrounding leather shops",
      "Al-Qarawiyyin University — founded in 859 AD, the world's oldest continuously operating university; the attached mosque is the most sacred in Morocco",
      "Bou Inania Madrasa — 14th-century Islamic theological school with stunning carved stucco, zellige tilework, and cedar wood",
      "Dar Batha Museum — 19th-century royal palace turned museum of Moroccan decorative arts and Fassi ceramics",
      "Nejjarine Fountain and Fondouq — medieval artisan warehouse-hotel with a wood museum and artisan workshops"
    ],
    areas: [
      "Fès el-Bali — the ancient walled medina; getting lost here is the entire point",
      "Fès el-Jdid — the 'new' 13th-century city with the Royal Palace and Mellah (Jewish quarter)",
      "Ville Nouvelle — the French colonial new town with wider streets, restaurants, and the train station",
      "Bab Bou Jeloud — the Blue Gate entrance to the medina; the best starting point for any medina walk",
      "Andalusian Quarter — the eastern medina neighborhood across the river, less touristy and more residential"
    ],
    foods: [
      "Pastilla (Bastilla) — a flaky filo pastry pie filled with pigeon (or chicken) with almonds, egg, and dusted with cinnamon sugar; Fès's most extraordinary dish",
      "Harira — saffron-spiced tomato and lentil soup served at Iftar (breaking fast) and at medina stalls from midday",
      "Mechoui — whole lamb slow-roasted in a clay oven in the medina basement restaurants; traditionally ordered by weight",
      "Rfissa — shredded msemen flatbread in a chicken and lentil broth with fenugreek; a Fassi celebration dish",
      "Sellou — a dense, sweet paste of toasted flour, sesame, almonds, and spices eaten during Ramadan and special occasions",
      "Mint Tea — Moroccan 'Berber whiskey'; ceremonies of tea-pouring from a height are an act of hospitality not to be rushed"
    ],
    tips: [
      "Hire a licensed medina guide for your first half-day — the medina is genuinely impossible to navigate alone initially",
      "Getting lost is not a problem — you're always within 15 minutes of a landmark; locals are helpful when asked",
      "The Chouara Tannery is best seen from 8-11 AM when the dye colors are freshest and workers most active",
      "Bring a sprig of fresh mint to hold under your nose at the tannery — the smell of urine-based dye is intense",
      "Bargaining is mandatory in the souqs — start at 40% of the asking price and work from there",
      "Fès gets cold at night even in spring; bring a warm layer for medina evenings"
    ],
    dayTrips: [
      "Meknes — Morocco's 'Versailles' built by Sultan Moulay Ismail, 1 hour west; Bab Mansour gate is spectacular",
      "Volubilis — best-preserved Roman ruins in North Africa with intact mosaics, 1.5 hours northwest",
      "Ifrane — Morocco's 'Little Switzerland' mountain town with Swiss chalet architecture, 1 hour south",
      "Middle Atlas cedar forests — Barbary macaque monkeys in cedar forests near Azrou, 1.5 hours south"
    ],
    hidden: [
      "Merenid Tombs at sunset — 14th-century hilltop tombs above the medina with the best panoramic view of Fès; almost no tourists",
      "Fondouq El-Nejjarine rooftop — the wood museum's roof terrace is open to ticket holders and gives a birds-eye medina view",
      "Andalusian Quarter evening walk — the east side of Fès el-Bali at dusk is quieter, more residential, and more authentic",
      "Moulay Idriss II Shrine surrounding streets — the alleys around the shrine smell of incense and bakeries; non-Muslims can't enter but the ambiance is unforgettable"
    ],
    photoSpots: [
      "Chouara Tannery from the rooftop leather shop terrace at 9 AM — a National Geographic image waiting to happen",
      "Bou Inania Madrasa's courtyard looking up at the carved stucco and zellige tilework",
      "Merenid Tombs at blue hour with the entire medina spread below in the valley",
      "Bab Bou Jeloud (Blue Gate) from inside the medina with the blue and green tiles framing the entrance"
    ],
    romantic: [
      "Dinner at a rooftop riad restaurant with medina views and traditional Moroccan musicians",
      "Sunset at the Merenid Tombs picnic viewpoint with dates, mint tea, and the orange-tinged medina below",
      "Traditional hammam experience for two at a riad with rose-water steam and argan oil massage"
    ],
    family: [
      "Medina artisan workshops — watching potters, weavers, and leather workers is endlessly fascinating for children",
      "Mule-watching at Bab Bou Jeloud — hundreds of mules are the medina's delivery system; kids love counting them",
      "Volubilis Roman ruins day trip — children enjoy the gladiator arena and intact floor mosaics"
    ],
    nightlife: [
      "Café Clock — cultural café with live music, storytelling, and camel burgers in the medina; evening programs from 7 PM",
      "Riad Fès rooftop bar — the most beautiful rooftop in the city, open to non-guests for cocktails",
      "Ville Nouvelle bars and brasseries — the French new town has more conventional bars for Western-style nights out"
    ],
    shopping: [
      "Brass and copper lanterns in the medina near Seffarine Square — the metalworkers' quarter where craftsmen still hammer by hand",
      "Leather goods at Chouara Tannery's surrounding shops — the leather is genuine; negotiate hard",
      "Fès blue pottery at Ain Kheil workshops near Bab Ftouh — the blue-and-white geometric ceramics are unique to Fès"
    ],
    transport: [
      "Medina is 100% pedestrian — no cars, bicycles, or motorbikes; mules and donkeys are the main transport inside",
      "Petit taxis (red) for Ville Nouvelle to medina routes; agree fare before departure — meters are rarely used",
      "CTM buses from Fès to Casablanca, Marrakech, and Rabat; comfortable, air-conditioned, and cheap"
    ],
    safety: [
      "Fès is safe but medina touts can be persistent — a firm, polite 'no thank you' in French works best",
      "Do not follow strangers who offer to show you 'their cousin's shop' — this is a classic medina scam",
      "Keep bags zipped and close to your body in the main medina streets; pickpocketing does occur in crowds"
    ],
    etiquette: [
      "Dress modestly — shoulders and knees covered is expected and appreciated in the medina and religious areas",
      "Ask before photographing people — especially women; many will decline and this must be respected",
      "Non-Muslims may not enter mosques or the Qarawiyyin — appreciate the exterior and context without pushing the boundary"
    ],
    packing: [
      "Comfortable walking shoes with ankle support — medina streets are uneven cobblestone",
      "Modest clothing for the medina and religious sites",
      "Small daypack for medina wandering — large bags on wheels become impossible in narrow alleyways"
    ],
    visa: [
      "US, UK, EU, Canadian, and Australian citizens get 90-day visa-free entry to Morocco",
      "No visa application needed — stamp on arrival at Mohammed V Airport in Casablanca or Fès-Saïss Airport",
      "Israeli passport holders have been able to enter Morocco since normalization in 2020 — check current bilateral agreements"
    ],
    sustainable: [
      "Stay in a family-run riad inside Fès el-Bali rather than a hotel in the Ville Nouvelle — keeps economic benefit in the medina community",
      "Buy from artisan cooperatives certified by the Artisanat du Maroc seal — ensures fair wages for craftsmen",
      "Walk everywhere in the medina rather than taking mule taxis — the animals are often overloaded; only use when necessary"
    ],
    imgId: "photo-1539650116574-75c0c6d73f6e",
  },
  {
    id: "zanzibar",
    name: "Zanzibar",
    country: "Tanzania",
    continent: "Africa",
    tagline: "The Spice Island — dhow sailing, Indian Ocean reefs, clove-scented old town, and the whitest beaches in Africa",
    lang: "Swahili",
    currency: "Tanzanian Shilling (TZS) / USD widely accepted",
    bestTime: "June to October and December to February",
    peakSeason: "July to August",
    climate: "Tropical oceanic; hot and humid year-round; two rainy seasons (March-May and November)",
    budget: [50, 120, 400],
    attractions: [
      "Stone Town — UNESCO-listed Swahili city with Persian, Arab, Indian, and British architectural layers; labyrinthine alleys and carved wooden doors",
      "Jozani Chwaka Bay National Park — the only national park on Zanzibar; habitat of the endangered red colobus monkey",
      "Nungwi Beach — northern tip of the island; the most beautiful white sand beach with traditional dhow building village adjacent",
      "Mnemba Atoll — private reef system with world-class snorkeling and diving; accessible from Matemwe Beach on the northeast coast",
      "Slave Trade Exhibition at the Anglican Cathedral — built over the former slave market; deeply moving historical site",
      "Prison Island (Changuu) — 25-minute boat ride from Stone Town; home to 100-year-old Aldabra giant tortoises and clear snorkeling"
    ],
    areas: [
      "Stone Town — the historic Swahili trading port; all history, culture, and evening dining concentrated here",
      "Nungwi — the island's most developed beach resort village; lively, great for snorkeling and nightlife",
      "Paje — southeast coast; preferred by kitesurfers and backpackers; quieter than Nungwi",
      "Matemwe — northeast village; the closest launching point for Mnemba Atoll diving",
      "Kendwa — beach village immediately west of Nungwi; longer swimmable tide window than Nungwi proper"
    ],
    foods: [
      "Zanzibar Pizza — street food at Forodhani Night Market; not really pizza but a pan-fried egg-and-meat filled flatbread; a Zanzibar institution",
      "Urojo (Zanzibar Mix) — the most complex street food on the island: cassava chips, fried bhajia, mango, lime, coconut, and tamarind in a tangy broth",
      "Grilled Seafood at Forodhani Gardens — fresh lobster, octopus, barracuda, and calamari grilled on open coals nightly; prices negotiable but worth it",
      "Biriyani ya Ng'ombe — Zanzibari beef biryani cooked with whole spices; distinct from Indian versions with a richer, cinnamon-heavy aroma",
      "Mchuzi wa Samaki — fish curry in coconut milk with Zanzibari spices; the defining dish of Swahili coast cuisine",
      "Spice Tea — ginger, cardamom, clove, and cinnamon tea made from fresh-picked spices; offered at every guesthouse"
    ],
    tips: [
      "Book a spice farm tour in the morning (cooler) — half-day tours from Stone Town cost $15-25 and include the most varied spice tastings anywhere",
      "Mnemba Atoll diving requires going through your dive shop (usually Blue Safari or One Ocean) — expect $80-100 for a 2-tank dive",
      "Forodhani Night Market starts at 6 PM — arrive early when food is freshest; the food stalls close around 10 PM",
      "Stone Town is car-free in many alleys — hire a local guide for $15/half day to find the best carved door photography",
      "Low tide at Nungwi can make the beach non-swimmable — Kendwa beach is better at all tides",
      "Bargaining for dhow trips, spice tours, and tuk-tuks is expected — first price is always 2-3x the fair rate"
    ],
    dayTrips: [
      "Dolphin Tour at Kizimkazi — 90-minute speedboat to the southern tip to spot wild spinner dolphins in the bay; book through a reputable operator for ethical practices",
      "Prison Island — giant tortoise sanctuary and snorkeling, 45-minute boat ride from Stone Town",
      "Jozani Forest and East Coast drive — combine the monkey forest with the seaweed farms and less-visited east beaches",
      "Pemba Island — day trip possible by ferry (3.5 hours); the 'other' Zanzibar island is greener, wilder, and diver's paradise"
    ],
    hidden: [
      "Kidichi Persian Baths — 1850s hammam built for the Sultan's wife in the interior of the island; almost never visited",
      "Mercury's Bar Stone Town — the waterfront bar near the birthplace of Freddie Mercury (born here in 1946) plays his music nightly",
      "Matemwe Village at low tide — the sandbank at low tide extends 500m from shore and locals fish by hand; walk out and watch",
      "Chakwa Beach — local-secret swimming beach north of Nungwi with no tourist infrastructure and no vendors"
    ],
    photoSpots: [
      "Stone Town rooftop at sunset — find any guesthouse roof terrace and capture the silhouette of minarets and dhow masts against orange sky",
      "Forodhani Night Market — blue gas flames, smoke, and the harbor lights create incredible food photography",
      "Jozani Forest with red colobus monkeys in the canopy",
      "Nungwi beach dhow at sunset — traditional wooden sail boat with perfect beach light"
    ],
    romantic: [
      "Private sunset dhow cruise with champagne from Stone Town harbor — book through your hotel for $60-80 per couple",
      "Dinner at Emerson on Hurumzi rooftop — the highest restaurant in Stone Town with stargazing and live taarab music",
      "Exclusive beach resort stay at North Island or &Beyond Mnemba — ultra-luxury barefoot romance"
    ],
    family: [
      "Prison Island tortoise visit — children adore hand-feeding the 100-year-old Aldabra giant tortoises",
      "Jozani monkey forest — the red colobus monkeys are completely habituated to humans and come close",
      "Kidogo Kiboje ('Dhow countries') kids cooking class in Stone Town — learn Swahili cooking with local families"
    ],
    nightlife: [
      "Forodhani Gardens evening — not technically nightlife but the evening street food market is the social center of Stone Town",
      "Mercury's Bar — live music, ocean views, and the best cocktails in Stone Town",
      "Nungwi and Kendwa beach parties on weekends — full-moon beach parties with bonfires and DJ sets"
    ],
    shopping: [
      "Darajani Market for fresh vanilla pods, cloves, cinnamon sticks, and saffron at a fraction of supermarket prices",
      "Stone Town art galleries near Shangani for Tingatinga paintings and Makonde wood carvings",
      "Zanzibar Butterfly Centre for locally made butterfly-wing jewelry and postcards"
    ],
    transport: [
      "Dalla-dalla (shared minibuses) run fixed routes across the island for $0.30-1 — slow but authentic",
      "Renting a scooter ($20/day) is the best way to explore the island independently",
      "Taxis and private cars for hire through your guesthouse; negotiate a full-day rate for exploring multiple beaches"
    ],
    safety: [
      "Zanzibar is generally safe but petty theft in Stone Town at night does occur — don't walk alone on poorly lit back alleys after midnight",
      "Political tensions between the island and the mainland occasionally surface; check FCO or State Department advisories before travel",
      "Use reef-safe sunscreen — the Mnemba Atoll is a protected marine area and chemical sunscreens damage coral"
    ],
    etiquette: [
      "Zanzibar is 99% Muslim — dress modestly outside of beach areas; cover up for Stone Town and villages",
      "Ramadan significantly changes Stone Town dining; plan meals accordingly if visiting during the holy month",
      "Ask permission before photographing local people — Swahili culture is proud and photography of women without permission is inappropriate"
    ],
    packing: [
      "Reef-safe sunscreen — mandatory for Mnemba Atoll and other reef snorkeling",
      "Lightweight modest cover-up for Stone Town exploration — a sarong works perfectly for both",
      "Underwater camera or GoPro for snorkeling and dhow trips"
    ],
    visa: [
      "Most Western nationalities get a visa on arrival at Zanzibar International Airport for $50 USD",
      "e-Visa available at immigration.go.tz for Tanzania mainland; valid for Zanzibar too",
      "East African Tourist Visa ($100) covers Tanzania, Uganda, and Kenya — useful if combining countries"
    ],
    sustainable: [
      "Book with ZATI-registered spice farm tours — certified guides ensure fair wages for farmers",
      "Use reef-safe sunscreen at all snorkeling and diving sites — Mnemba is one of the most important coral ecosystems in the Indian Ocean",
      "Stay at locally-owned guesthouses in Stone Town rather than all-inclusive beach resorts that import most food and staff"
    ],
    imgId: "photo-1548706787-d29d0823a675",
  },
];
