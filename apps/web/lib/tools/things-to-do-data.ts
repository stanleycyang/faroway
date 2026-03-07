import {
  getGuideBySlug,
  getGuideSlugs,
  type DestinationGuide,
} from "@/lib/destination-guides";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ThingToDo {
  title: string;
  description: string;
  emoji: string;
  category: string;
  tip?: string;
  bestTime?: string;
  duration?: string;
  budget?: string;
}

export interface ThingsToDoGuide {
  slug: string;
  name: string;
  country: string;
  continent: string;
  heroImage: string;
  tagline: string;
  intro: string;
  topAttractions: ThingToDo[];
  hiddenGems: ThingToDo[];
  foodExperiences: ThingToDo[];
  dayTrips: ThingToDo[];
  nightlife: ThingToDo[];
}

// ─── Extended content per destination ────────────────────────────────────────
// Enriches the base highlights from destination-guides.ts with additional
// categories: hidden gems, food, day trips, and nightlife.

const EXTENDED_THINGS: Record<
  string,
  {
    intro: string;
    hiddenGems: ThingToDo[];
    foodExperiences: ThingToDo[];
    dayTrips: ThingToDo[];
    nightlife: ThingToDo[];
  }
> = {
  tokyo: {
    intro:
      "Tokyo is a city of contrasts — ancient temples sit beside neon-lit skyscrapers, and Michelin-starred restaurants share streets with ramen counters. Whether you're into pop culture, culinary adventures, or serene gardens, Tokyo offers an endless list of things to do.",
    hiddenGems: [
      {
        title: "Yanaka District",
        description:
          "A charming old-town neighborhood untouched by WWII bombing. Wander the Yanaka Ginza shopping street, visit centuries-old temples, and pet the famous Yanaka cats.",
        emoji: "🐱",
        category: "Hidden Gem",
        tip: "Visit on a weekday morning for the most peaceful experience",
        duration: "2-3 hours",
        budget: "Free",
      },
      {
        title: "Shimokitazawa",
        description:
          "Tokyo's bohemian quarter packed with vintage shops, independent cafes, tiny live-music venues, and street art. It feels like a different city from the main hubs.",
        emoji: "🎸",
        category: "Hidden Gem",
        tip: "Best explored on foot — the tiny lanes don't follow a grid",
        duration: "Half day",
        budget: "$10-30",
      },
      {
        title: "Todoroki Valley",
        description:
          "A hidden ravine in suburban Setagaya with a forested walking path, a waterfall, and a Buddhist temple. Hard to believe it's inside Tokyo's city limits.",
        emoji: "🌿",
        category: "Hidden Gem",
        duration: "1-2 hours",
        budget: "Free",
      },
    ],
    foodExperiences: [
      {
        title: "Tsukiji Outer Market Food Tour",
        description:
          "Sample tamagoyaki (sweet omelette), fresh uni, wagyu skewers, and matcha desserts at the world's most famous fish market neighborhood.",
        emoji: "🍣",
        category: "Food",
        bestTime: "Early morning (7-10am)",
        duration: "2-3 hours",
        budget: "$20-50",
      },
      {
        title: "Ramen Alley in Shinjuku",
        description:
          "Squeeze into a standing-only counter and slurp tonkotsu or shoyu ramen alongside salarymen. Fuunji and Nagi are local legends.",
        emoji: "🍜",
        category: "Food",
        tip: "Use the vending machine to order — it's normal!",
        duration: "30-60 min",
        budget: "$8-12",
      },
      {
        title: "Depachika (Department Store Basements)",
        description:
          "Explore the lavish food halls beneath stores like Isetan, Mitsukoshi, and Takashimaya. Free samples abound, and the bento boxes are works of art.",
        emoji: "🍱",
        category: "Food",
        tip: "Visit 30 min before closing for heavy discounts",
        duration: "1-2 hours",
        budget: "$10-30",
      },
    ],
    dayTrips: [
      {
        title: "Kamakura",
        description:
          "A coastal temple town just 1 hour south of Tokyo, home to the iconic Great Buddha, bamboo groves, and excellent surf beaches.",
        emoji: "🗿",
        category: "Day Trip",
        duration: "Full day",
        budget: "$15-30 (train + entrance fees)",
      },
      {
        title: "Hakone",
        description:
          "Hot springs, Mt. Fuji views, open-air art museums, and the famous pirate ship on Lake Ashi. The Hakone Free Pass covers everything.",
        emoji: "♨️",
        category: "Day Trip",
        duration: "Full day",
        budget: "$40-60 (Hakone Free Pass)",
      },
      {
        title: "Nikko",
        description:
          "Ornate UNESCO shrines set in ancient cedar forests, 2 hours north. The Toshogu Shrine is one of Japan's most lavish architectural complexes.",
        emoji: "⛩️",
        category: "Day Trip",
        duration: "Full day",
        budget: "$30-50",
      },
    ],
    nightlife: [
      {
        title: "Golden Gai, Shinjuku",
        description:
          "Six narrow alleys crammed with 200+ tiny bars, each seating 5-10 people. Every bar has a unique theme — from jazz to horror movies.",
        emoji: "🍶",
        category: "Nightlife",
        tip: "Some bars charge a seating fee (¥500-1000). Check the door first",
        bestTime: "8pm onwards",
      },
      {
        title: "Robot Restaurant",
        description:
          "A neon-drenched sensory overload of robots, lasers, dancers, and taiko drums. Utterly bizarre and unmissably fun.",
        emoji: "🤖",
        category: "Nightlife",
        tip: "Book online for discounts — walk-up prices are higher",
        budget: "$50-80",
      },
    ],
  },
  paris: {
    intro:
      "Paris needs little introduction — the City of Light has inspired artists, writers, and dreamers for centuries. Beyond the Eiffel Tower and Louvre, you'll find neighborhood markets, hidden courtyards, world-class dining, and an unmatched art scene.",
    hiddenGems: [
      {
        title: "Promenade Plantée (Coulée Verte)",
        description:
          "The original elevated park (before NYC's High Line) runs along a disused railway viaduct. Walk above the rooftops through gardens and past artisan workshops.",
        emoji: "🌳",
        category: "Hidden Gem",
        duration: "1-2 hours",
        budget: "Free",
      },
      {
        title: "Musée de la Chasse et de la Nature",
        description:
          "A quirky museum in Le Marais combining contemporary art with natural history in a stunning 17th-century mansion. Far more surprising than it sounds.",
        emoji: "🦌",
        category: "Hidden Gem",
        duration: "1-2 hours",
        budget: "$10",
      },
      {
        title: "Rue Crémieux",
        description:
          "A pastel-colored pedestrian street in the 12th arrondissement that looks straight out of a Wes Anderson film. Perfect for photos.",
        emoji: "📸",
        category: "Hidden Gem",
        duration: "15 min",
        budget: "Free",
      },
    ],
    foodExperiences: [
      {
        title: "Marché d'Aligre",
        description:
          "One of Paris's oldest and most affordable markets. Stroll past cheese vendors, olive sellers, and produce stalls that locals actually shop at.",
        emoji: "🧀",
        category: "Food",
        bestTime: "Tuesday-Sunday mornings",
        duration: "1-2 hours",
        budget: "$10-20",
      },
      {
        title: "Croissant Crawl",
        description:
          "Sample butter croissants from the city's best boulangeries — Maison Landemaine, Du Pain et des Idées, and Cédric Grolet are musts.",
        emoji: "🥐",
        category: "Food",
        tip: "Go early — the best ones sell out by 10am",
        duration: "Half day",
        budget: "$10-15",
      },
      {
        title: "Le Bouillon Chartier",
        description:
          "A grand 1896 dining hall serving classic French bistro food at impossibly low prices. Expect shared tables and a convivial atmosphere.",
        emoji: "🍷",
        category: "Food",
        tip: "Queue early — they don't take reservations",
        duration: "1-2 hours",
        budget: "$15-25",
      },
    ],
    dayTrips: [
      {
        title: "Versailles",
        description:
          "The opulent palace of Louis XIV with its Hall of Mirrors and 800-hectare gardens. Just 40 minutes by RER train from central Paris.",
        emoji: "👑",
        category: "Day Trip",
        duration: "Full day",
        budget: "$25-40",
      },
      {
        title: "Giverny",
        description:
          "Claude Monet's house and the water lily gardens that inspired his most famous paintings. Magical from April to October.",
        emoji: "🎨",
        category: "Day Trip",
        bestTime: "May-June for best blooms",
        duration: "Half day",
        budget: "$20-30",
      },
      {
        title: "Champagne Region",
        description:
          "Tour the cellars of Moët, Veuve Clicquot, and Taittinger in Reims and Épernay. Just 45 minutes by TGV from Gare de l'Est.",
        emoji: "🥂",
        category: "Day Trip",
        duration: "Full day",
        budget: "$40-80",
      },
    ],
    nightlife: [
      {
        title: "Le Marais Bar Crawl",
        description:
          "The Marais district has the highest concentration of cocktail bars in Paris. Start at Candelaria (mezcal), move to Little Red Door (craft cocktails).",
        emoji: "🍸",
        category: "Nightlife",
        bestTime: "Thursday-Saturday from 9pm",
      },
      {
        title: "Seine River Cruise at Night",
        description:
          "See the Eiffel Tower sparkling, Notre-Dame illuminated, and bridges lit up from the water. Bateaux Mouches runs hourly.",
        emoji: "🚢",
        category: "Nightlife",
        budget: "$15-25",
        duration: "1 hour",
      },
    ],
  },
  bali: {
    intro:
      "Bali is Indonesia's crown jewel — a lush island where ancient Hindu temples perch on volcanic cliffs, terraced rice paddies glow emerald green, and world-class surf breaks line the coast. From yoga retreats to nightclub beach clubs, Bali has it all.",
    hiddenGems: [
      {
        title: "Sidemen Valley",
        description:
          "A peaceful alternative to Ubud with terraced rice fields, Mt. Agung views, and almost no tourists. Stay in a traditional homestay for the full experience.",
        emoji: "🌾",
        category: "Hidden Gem",
        duration: "1-2 days",
        budget: "$20-40/night",
      },
      {
        title: "Tibumana Waterfall",
        description:
          "A stunning jungle waterfall near Ubud without the crowds of Tegenungan. Follow the mossy stairs down to a serene swimming hole.",
        emoji: "💧",
        category: "Hidden Gem",
        duration: "2 hours",
        budget: "$2 entrance",
      },
      {
        title: "Jatiluwih Rice Terraces",
        description:
          "UNESCO-listed terraces that are far more impressive and less crowded than Tegallalang. Hike the trails that wind through the paddies.",
        emoji: "🌿",
        category: "Hidden Gem",
        duration: "Half day",
        budget: "$5 entrance",
      },
    ],
    foodExperiences: [
      {
        title: "Warung Hopping in Ubud",
        description:
          "Skip the tourist restaurants and eat at family-run warungs. Nasi campur, babi guling (suckling pig), and lawar are the must-tries.",
        emoji: "🍛",
        category: "Food",
        tip: "Warung Biah Biah and Warung Sopa are local favorites",
        budget: "$2-5 per meal",
      },
      {
        title: "Jimbaran Seafood on the Beach",
        description:
          "Sit at plastic tables on the sand at sunset while grills line the shore with fresh fish, prawns, and lobster. Point at what you want — it's grilled to order.",
        emoji: "🦐",
        category: "Food",
        bestTime: "Sunset",
        budget: "$15-30",
      },
      {
        title: "Balinese Cooking Class",
        description:
          "Learn to make satay, sambal matah, and black rice pudding with a local family. Most classes include a market visit.",
        emoji: "👩‍🍳",
        category: "Food",
        duration: "Half day",
        budget: "$25-45",
      },
    ],
    dayTrips: [
      {
        title: "Nusa Penida Island",
        description:
          "A dramatic limestone island 45 minutes by speedboat. Visit Kelingking Beach (T-Rex cliff), Angel's Billabong, and swim with manta rays.",
        emoji: "🏝️",
        category: "Day Trip",
        duration: "Full day",
        budget: "$40-60",
      },
      {
        title: "Mt. Batur Sunrise Trek",
        description:
          "Start at 2am and hike this active volcano to watch the sunrise from 1,717m. Breakfast eggs cooked in volcanic steam at the summit.",
        emoji: "🌋",
        category: "Day Trip",
        bestTime: "Start at 2am",
        duration: "6-8 hours",
        budget: "$35-50 (with guide)",
      },
      {
        title: "Gili Islands",
        description:
          "Three tiny car-free islands off Lombok with crystal water, sea turtles, and beach bars. Gili Air is the most relaxed, Gili T the most social.",
        emoji: "🐢",
        category: "Day Trip",
        duration: "Full day or overnight",
        budget: "$30-50 (fast boat)",
      },
    ],
    nightlife: [
      {
        title: "Seminyak Beach Clubs",
        description:
          "Potato Head, Ku De Ta, and La Brisa serve cocktails with Indian Ocean sunsets and world-class DJs after dark.",
        emoji: "🍹",
        category: "Nightlife",
        bestTime: "4pm sunset session onwards",
        budget: "$20-50",
      },
      {
        title: "Ubud Night Market",
        description:
          "After the day market closes, food stalls take over with grilled satay, martabak, and bubur. A sensory feast under string lights.",
        emoji: "🏮",
        category: "Nightlife",
        bestTime: "7-10pm",
        budget: "$3-8",
      },
    ],
  },
  barcelona: {
    intro:
      "Barcelona blends Gothic architecture with modernist masterpieces, Mediterranean beaches with mountain views, and Catalan culture with international energy. From Gaudí's fantastical buildings to tapas bars in El Born, every corner has something to discover.",
    hiddenGems: [
      {
        title: "Bunkers del Carmel",
        description:
          "Old Civil War anti-aircraft batteries turned into the city's best free viewpoint. The 360° panorama over Barcelona is better than any rooftop bar.",
        emoji: "🏰",
        category: "Hidden Gem",
        bestTime: "Sunset",
        duration: "1-2 hours",
        budget: "Free",
      },
      {
        title: "Sant Pau Recinte Modernista",
        description:
          "A UNESCO Art Nouveau hospital complex by Domènech i Montaner that rivals Gaudí's work but gets a fraction of the visitors.",
        emoji: "🏛️",
        category: "Hidden Gem",
        duration: "1-2 hours",
        budget: "$17",
      },
      {
        title: "El Born Cultural Centre",
        description:
          "A repurposed 19th-century iron market that now houses archaeological ruins of 1700s Barcelona underneath a stunning glass-and-iron canopy.",
        emoji: "🏗️",
        category: "Hidden Gem",
        duration: "1 hour",
        budget: "Free",
      },
    ],
    foodExperiences: [
      {
        title: "La Boqueria Market",
        description:
          "Barcelona's legendary food market on La Rambla. Skip the tourist stalls near the entrance and head deep inside for the freshest jamón, smoothies, and seafood.",
        emoji: "🍇",
        category: "Food",
        bestTime: "Weekday mornings",
        duration: "1-2 hours",
        budget: "$10-25",
      },
      {
        title: "Pintxos Crawl in El Born",
        description:
          "Bar-hop through El Born sampling Basque-style pintxos (tapas on sticks). Euskal Etxea and Bar del Pla are essential stops.",
        emoji: "🍢",
        category: "Food",
        bestTime: "7-10pm",
        duration: "2-3 hours",
        budget: "$20-35",
      },
      {
        title: "Vermouth Hour",
        description:
          "Join locals for the sacred pre-lunch vermouth at a traditional bodega. Pair it with olives, chips, and boquerones. Casa Mariol is a classic.",
        emoji: "🍸",
        category: "Food",
        bestTime: "12-2pm weekends",
        budget: "$5-10",
      },
    ],
    dayTrips: [
      {
        title: "Montserrat Monastery",
        description:
          "A jaw-dropping Benedictine monastery perched on serrated mountain peaks, 1 hour from Barcelona. Hike to Sant Joan for aerial views.",
        emoji: "⛰️",
        category: "Day Trip",
        duration: "Full day",
        budget: "$25-40",
      },
      {
        title: "Costa Brava Beaches",
        description:
          "Hop on a train to Tossa de Mar or Calella de Palafrugell for turquoise coves, medieval old towns, and far fewer crowds than Barceloneta.",
        emoji: "🏖️",
        category: "Day Trip",
        duration: "Full day",
        budget: "$15-25",
      },
      {
        title: "Girona",
        description:
          "A colorful medieval city with painted riverside houses, a Game of Thrones cathedral, and an Arab bath house. Just 38 minutes by AVE train.",
        emoji: "🏘️",
        category: "Day Trip",
        duration: "Full day",
        budget: "$20-30",
      },
    ],
    nightlife: [
      {
        title: "Barceloneta Beach Bars",
        description:
          "Chiringuitos (beach bars) line the sand with cocktails, music, and sunset views. Move to Razzmatazz or Sala Apolo after midnight for club nights.",
        emoji: "🏖️",
        category: "Nightlife",
        bestTime: "Sunset onwards, clubs after midnight",
      },
      {
        title: "El Raval After Dark",
        description:
          "The edgiest neighborhood in Barcelona, packed with dive bars, craft cocktail spots, and underground music venues. Bar Marsella has been pouring absinthe since 1820.",
        emoji: "🎵",
        category: "Nightlife",
        tip: "Start late — nothing happens before 11pm",
      },
    ],
  },
  london: {
    intro:
      "London is a city of villages — each neighborhood has its own personality, from the royal parks of Kensington to the street art of Shoreditch. With world-class free museums, legendary pubs, and one of the most diverse food scenes on earth, London rewards exploration.",
    hiddenGems: [
      {
        title: "Leadenhall Market",
        description:
          "A gorgeous Victorian covered market in the City of London that doubled as Diagon Alley in the Harry Potter films. Beautiful for photos and lunch.",
        emoji: "🏛️",
        category: "Hidden Gem",
        duration: "30-60 min",
        budget: "Free to browse",
      },
      {
        title: "Hampstead Heath Swimming Ponds",
        description:
          "Wild-swimming ponds fed by natural springs on the edge of London. There are separate men's, women's, and mixed ponds surrounded by woodland.",
        emoji: "🏊",
        category: "Hidden Gem",
        bestTime: "Summer mornings",
        budget: "$5",
      },
      {
        title: "Leighton House Museum",
        description:
          "The private home of Victorian artist Lord Leighton, featuring an Arab Hall with intricate Islamic tiles, a fountain, and gold mosaic dome.",
        emoji: "🎨",
        category: "Hidden Gem",
        duration: "1-2 hours",
        budget: "$12",
      },
    ],
    foodExperiences: [
      {
        title: "Borough Market",
        description:
          "London's finest food market under the railway arches. Raclette, Scotch eggs, Ethiopian stews, and sourdough from the city's best bakers.",
        emoji: "🍞",
        category: "Food",
        bestTime: "Thursday-Saturday",
        duration: "2-3 hours",
        budget: "$15-30",
      },
      {
        title: "Brick Lane Curry Houses",
        description:
          "A street-long strip of Bangladeshi restaurants in Shoreditch. Tayyabs and Lahore Kebab House are the standouts for BYO-friendly feasts.",
        emoji: "🍛",
        category: "Food",
        tip: "Ignore the touts outside — use reviews to choose",
        budget: "$10-20",
      },
      {
        title: "Sunday Roast at a Pub",
        description:
          "A quintessentially British tradition: roast beef, Yorkshire pudding, roasted potatoes, gravy, and a pint. The Harwood Arms is the only Michelin-starred pub in London.",
        emoji: "🍺",
        category: "Food",
        bestTime: "Sunday noon-3pm",
        budget: "$15-30",
      },
    ],
    dayTrips: [
      {
        title: "Stonehenge & Bath",
        description:
          "Combine the prehistoric stone circle with the Roman-era baths and Georgian architecture of Bath. Easy by train or organized tour.",
        emoji: "🪨",
        category: "Day Trip",
        duration: "Full day",
        budget: "$40-70",
      },
      {
        title: "Oxford",
        description:
          "The 'City of Dreaming Spires' with 38 historic colleges, the Bodleian Library, and the covered market. Just 1 hour by train.",
        emoji: "🎓",
        category: "Day Trip",
        duration: "Full day",
        budget: "$25-40",
      },
      {
        title: "Brighton",
        description:
          "A quirky seaside city with a pebble beach, the Royal Pavilion, North Laine's indie shops, and legendary fish and chips on the pier.",
        emoji: "🎡",
        category: "Day Trip",
        duration: "Full day",
        budget: "$20-35",
      },
    ],
    nightlife: [
      {
        title: "West End Theatre",
        description:
          "See a world-class show on London's equivalent of Broadway. Book discounted tickets at TKTS Leicester Square on the day.",
        emoji: "🎭",
        category: "Nightlife",
        tip: "Tuesday matinees are cheapest",
        budget: "$25-100",
      },
      {
        title: "Soho Pub Crawl",
        description:
          "Wind through Soho's narrow streets hopping between historic pubs. The French House, The Coach & Horses, and The Dog & Duck are classics.",
        emoji: "🍻",
        category: "Nightlife",
        bestTime: "6pm onwards",
        budget: "$20-40",
      },
    ],
  },
  rome: {
    intro:
      "Rome is an open-air museum where 2,000 years of history unfolds on every street. From the Colosseum to hidden trattorias in Trastevere, the Eternal City rewards those who wander without a map — every wrong turn leads to a piazza, fountain, or church worth seeing.",
    hiddenGems: [
      {
        title: "Aventine Keyhole",
        description:
          "Peer through the keyhole of the Knights of Malta gate on Aventine Hill for a perfectly framed view of St. Peter's dome through a garden corridor.",
        emoji: "🔑",
        category: "Hidden Gem",
        duration: "15 min",
        budget: "Free",
      },
      {
        title: "Quartiere Coppedè",
        description:
          "A surreal neighborhood of fairy-tale Art Nouveau buildings covered in frescoes, gargoyles, and Moorish arches. Almost no tourists know about it.",
        emoji: "🏰",
        category: "Hidden Gem",
        duration: "30-60 min",
        budget: "Free",
      },
      {
        title: "Centrale Montemartini",
        description:
          "Ancient Roman sculptures displayed inside a 1900s power plant. The contrast of classical marble against industrial machinery is stunning.",
        emoji: "⚡",
        category: "Hidden Gem",
        duration: "1-2 hours",
        budget: "$10",
      },
    ],
    foodExperiences: [
      {
        title: "Testaccio Food Tour",
        description:
          "The historic working-class neighborhood where Roman cuisine was born. Try supplì, cacio e pepe, and offal at century-old market stalls.",
        emoji: "🍝",
        category: "Food",
        duration: "3 hours",
        budget: "$15-30",
      },
      {
        title: "Gelato Tasting",
        description:
          "Skip the tourist joints with towering displays. Real artisan gelato is flat in the tray. Fatamorgana, Giolitti, and Come il Latte are top picks.",
        emoji: "🍦",
        category: "Food",
        tip: "If the pistachio is bright green, walk away — real pistachio gelato is brownish-green",
        budget: "$3-5",
      },
      {
        title: "Aperitivo Hour in Trastevere",
        description:
          "Buy a drink at a bar in Trastevere or Monti and get access to a buffet of Italian appetizers. It's basically a free dinner with a $10 spritz.",
        emoji: "🥂",
        category: "Food",
        bestTime: "6-8pm",
        budget: "$8-12",
      },
    ],
    dayTrips: [
      {
        title: "Pompeii & Amalfi Coast",
        description:
          "Take the high-speed train to Naples, then visit the ruins of Pompeii before continuing to Positano or Amalfi for the afternoon.",
        emoji: "🌋",
        category: "Day Trip",
        duration: "Full day (long)",
        budget: "$50-80",
      },
      {
        title: "Orvieto",
        description:
          "A hilltop Umbrian town with a jaw-dropping cathedral, underground caves, and some of the best white wine in Italy. 1 hour by train.",
        emoji: "🍷",
        category: "Day Trip",
        duration: "Full day",
        budget: "$25-40",
      },
      {
        title: "Tivoli Gardens",
        description:
          "Villa d'Este's Renaissance water gardens and Hadrian's Villa — a sprawling imperial complex. Just 45 minutes east of Rome.",
        emoji: "⛲",
        category: "Day Trip",
        duration: "Half day",
        budget: "$15-25",
      },
    ],
    nightlife: [
      {
        title: "Trastevere Bar Hopping",
        description:
          "The cobblestone streets of Trastevere come alive at night with wine bars, jazz clubs, and piazza seating. Start at Piazza di Santa Maria.",
        emoji: "🍷",
        category: "Nightlife",
        bestTime: "9pm onwards",
      },
      {
        title: "Testaccio Club Scene",
        description:
          "Former slaughterhouse buildings converted into Rome's best clubs. Goa Club for electronic music, Circolo degli Illuminati for house.",
        emoji: "🎶",
        category: "Nightlife",
        tip: "Nothing starts before midnight",
      },
    ],
  },
  "new-york": {
    intro:
      "New York City is the city that never sleeps — and for good reason. From world-class museums and Broadway shows to pizza slices at 3am and walks across the Brooklyn Bridge at dawn, NYC packs more into one square mile than most countries.",
    hiddenGems: [
      {
        title: "The Cloisters",
        description:
          "A medieval European monastery reconstructed in Fort Tryon Park, upper Manhattan. Houses the Met's medieval art collection with Hudson River views.",
        emoji: "🏰",
        category: "Hidden Gem",
        duration: "2-3 hours",
        budget: "$25 (included with Met ticket)",
      },
      {
        title: "Roosevelt Island Tramway",
        description:
          "An aerial tram over the East River for the price of a subway ride. Stunning Manhattan skyline views, especially at sunset.",
        emoji: "🚡",
        category: "Hidden Gem",
        duration: "30 min round trip",
        budget: "$2.90",
      },
      {
        title: "Green-Wood Cemetery, Brooklyn",
        description:
          "A 478-acre Victorian garden cemetery with stunning Gothic architecture, wild parrots, and panoramic views of the Statue of Liberty.",
        emoji: "🌳",
        category: "Hidden Gem",
        duration: "2-3 hours",
        budget: "Free",
      },
    ],
    foodExperiences: [
      {
        title: "Dollar Slice Tour",
        description:
          "Sample $1 pizza slices across Manhattan — Joe's Pizza in the Village, Prince Street Pizza's pepperoni square, and Di Fara in Brooklyn for the splurge.",
        emoji: "🍕",
        category: "Food",
        duration: "Half day",
        budget: "$5-15",
      },
      {
        title: "Smorgasburg",
        description:
          "Brooklyn's massive open-air food market (weekends) with 100+ vendors selling everything from ramen burgers to Thai rolled ice cream.",
        emoji: "🍔",
        category: "Food",
        bestTime: "Saturday 11am-6pm (Williamsburg)",
        budget: "$15-30",
      },
      {
        title: "Chinatown Dumpling Crawl",
        description:
          "Manhattan's Chinatown has the best xiao long bao, hand-pulled noodles, and scallion pancakes outside of Asia. Joe's Shanghai and Xi'an Famous Foods are staples.",
        emoji: "🥟",
        category: "Food",
        budget: "$8-15",
      },
    ],
    dayTrips: [
      {
        title: "Hudson Valley",
        description:
          "Wine trails, farm-to-table restaurants, and fall foliage just 90 minutes north. Visit Dia Beacon for world-class contemporary art.",
        emoji: "🍂",
        category: "Day Trip",
        bestTime: "October for fall colors",
        duration: "Full day",
        budget: "$30-50",
      },
      {
        title: "The Hamptons",
        description:
          "Long Island's famous beach towns with pristine sand, seafood shacks, and vineyard tours. Take the LIRR from Penn Station.",
        emoji: "🏖️",
        category: "Day Trip",
        bestTime: "June-September",
        duration: "Full day",
        budget: "$30-60",
      },
      {
        title: "Philadelphia",
        description:
          "Just 90 minutes by Amtrak for cheesesteaks, the Liberty Bell, the Philadelphia Museum of Art, and Reading Terminal Market.",
        emoji: "🔔",
        category: "Day Trip",
        duration: "Full day",
        budget: "$30-50",
      },
    ],
    nightlife: [
      {
        title: "Broadway Show",
        description:
          "See a world-class production in the Theater District. Try the TKTS booth in Times Square for same-day discounted tickets.",
        emoji: "🎭",
        category: "Nightlife",
        budget: "$50-200",
      },
      {
        title: "Jazz in Greenwich Village",
        description:
          "Blue Note, Village Vanguard, and Smalls Jazz Club have hosted legends for decades. The intimacy of a 50-seat jazz club is unmatched.",
        emoji: "🎷",
        category: "Nightlife",
        bestTime: "Late sets (11pm+) are cheaper",
        budget: "$20-40",
      },
    ],
  },
  dubai: {
    intro:
      "Dubai is a city of superlatives — the tallest building, the largest mall, islands shaped like palm trees. But beyond the glitz, you'll find atmospheric souks, desert adventures, and a melting pot of cuisines from every corner of the globe.",
    hiddenGems: [
      {
        title: "Al Fahidi Historical District",
        description:
          "Wind-tower houses and narrow lanes in the oldest part of Dubai. Home to art galleries, coffee shops, and the Dubai Museum. A world away from the skyscrapers.",
        emoji: "🏛️",
        category: "Hidden Gem",
        duration: "2-3 hours",
        budget: "Free",
      },
      {
        title: "Alserkal Avenue",
        description:
          "Dubai's contemporary arts district in an industrial warehouse complex. Galleries, indie cinemas, and specialty coffee in Al Quoz.",
        emoji: "🎨",
        category: "Hidden Gem",
        duration: "2-3 hours",
        budget: "Free",
      },
      {
        title: "Hatta Mountain Pools",
        description:
          "Natural rock pools in the Hajar Mountains, 90 minutes from the city. Kayak on the turquoise Hatta Dam or hike the mountain trails.",
        emoji: "🏔️",
        category: "Hidden Gem",
        duration: "Full day",
        budget: "$20-40",
      },
    ],
    foodExperiences: [
      {
        title: "Al Dhiyafah Road Street Food",
        description:
          "A long strip of budget-friendly restaurants serving shawarma, manakish, kunafa, and Iranian kebabs. Dubai's best cheap eats.",
        emoji: "🧆",
        category: "Food",
        bestTime: "Evening",
        budget: "$5-15",
      },
      {
        title: "Friday Brunch",
        description:
          "Dubai's signature social ritual: all-you-can-eat-and-drink brunch at a luxury hotel. Bubbalicious at Westin and Saffron at Atlantis are legendary.",
        emoji: "🍳",
        category: "Food",
        bestTime: "Friday 12-4pm",
        budget: "$80-200",
      },
      {
        title: "Spice & Gold Souks",
        description:
          "Wander through fragrant piles of saffron, cardamom, and frankincense in Deira, then cross to the Gold Souk for dazzling displays.",
        emoji: "✨",
        category: "Food",
        duration: "2-3 hours",
        budget: "Free to browse",
      },
    ],
    dayTrips: [
      {
        title: "Abu Dhabi & Louvre",
        description:
          "Visit the stunning Louvre Abu Dhabi, Sheikh Zayed Grand Mosque, and Yas Island. Just 90 minutes by car or bus.",
        emoji: "🕌",
        category: "Day Trip",
        duration: "Full day",
        budget: "$30-60",
      },
      {
        title: "Desert Safari",
        description:
          "Dune bashing in a 4x4, camel rides, sandboarding, and a BBQ dinner under the stars with belly dancing and henna art.",
        emoji: "🐪",
        category: "Day Trip",
        bestTime: "Late afternoon for sunset",
        duration: "Half day",
        budget: "$40-80",
      },
    ],
    nightlife: [
      {
        title: "Rooftop Bars",
        description:
          "Dubai's skyline is best enjoyed from above. Level 43, Pure Sky Lounge, and Atmosphere (on floor 122 of Burj Khalifa) offer jaw-dropping views.",
        emoji: "🌃",
        category: "Nightlife",
        tip: "Smart casual dress code at most venues",
        budget: "$30-60",
      },
      {
        title: "Dubai Fountain Show",
        description:
          "Free choreographed water and light shows at the base of Burj Khalifa every 30 minutes after sunset. Best viewed from a nearby restaurant terrace.",
        emoji: "⛲",
        category: "Nightlife",
        bestTime: "6pm onwards, every 30 min",
        budget: "Free",
      },
    ],
  },
  lisbon: {
    intro:
      "Lisbon is Europe's sunniest capital — a city of seven hills where vintage trams climb cobblestone streets, pastel facades hide world-class restaurants, and miradouros (viewpoints) offer sunset views over the Tagus River. It's affordable, walkable, and endlessly charming.",
    hiddenGems: [
      {
        title: "LX Factory",
        description:
          "A creative complex in a former textile factory under the 25 de Abril Bridge. Bookshops, design studios, brunch spots, and weekend markets.",
        emoji: "🏭",
        category: "Hidden Gem",
        duration: "2-3 hours",
        budget: "Free to browse",
      },
      {
        title: "Mouraria Neighborhood",
        description:
          "Lisbon's most multicultural district and the birthplace of fado music. Street art, family-run tascas, and no tourist crowds.",
        emoji: "🎵",
        category: "Hidden Gem",
        duration: "Half day",
        budget: "Free",
      },
      {
        title: "Praça do Comércio Underground Ruins",
        description:
          "Roman-era ruins discovered beneath the main square, accessible via the Lisboa Story Centre. A hidden archaeological treasure.",
        emoji: "🏛️",
        category: "Hidden Gem",
        duration: "1 hour",
        budget: "$7",
      },
    ],
    foodExperiences: [
      {
        title: "Pastéis de Belém",
        description:
          "The original pastel de nata bakery, making the famous custard tarts with a secret recipe since 1837. Queue is worth it — eat them warm.",
        emoji: "🥧",
        category: "Food",
        tip: "Sprinkle cinnamon and powdered sugar on top",
        budget: "$2-5",
      },
      {
        title: "Cervejaria Ramiro",
        description:
          "Lisbon's most famous seafood restaurant. Tiger prawns, percebes (goose barnacles), and the famous steak sandwich to finish.",
        emoji: "🦞",
        category: "Food",
        tip: "Go for late lunch to avoid the dinner queue",
        budget: "$30-60",
      },
      {
        title: "Ginjinha Tasting",
        description:
          "Sip ginjinha (sour cherry liqueur) from a tiny counter-only bar in Rossio. A Ginjinha and Ginjinha Sem Rival face each other — try both.",
        emoji: "🍒",
        category: "Food",
        budget: "$2 per shot",
        duration: "15 min",
      },
    ],
    dayTrips: [
      {
        title: "Sintra",
        description:
          "A fairy-tale town of colorful palaces set in misty forested hills. Pena Palace, Quinta da Regaleira, and the Moorish Castle are must-sees.",
        emoji: "🏰",
        category: "Day Trip",
        duration: "Full day",
        budget: "$20-40",
      },
      {
        title: "Cascais & Cabo da Roca",
        description:
          "A charming coastal town with beaches and seafood, plus the westernmost point of continental Europe at Cabo da Roca.",
        emoji: "🌊",
        category: "Day Trip",
        duration: "Full day",
        budget: "$10-20",
      },
      {
        title: "Setúbal & Arrábida",
        description:
          "Across the Tagus, find pristine beaches backed by a mountain nature park, fresh grilled fish, and some of Portugal's best moscatel wine.",
        emoji: "🍷",
        category: "Day Trip",
        duration: "Full day",
        budget: "$15-30",
      },
    ],
    nightlife: [
      {
        title: "Fado in Alfama",
        description:
          "Lisbon's traditional soulful music in its birthplace. Tasca do Chico and Mesa de Frades are intimate, authentic venues.",
        emoji: "🎶",
        category: "Nightlife",
        bestTime: "9pm onwards",
        budget: "$15-30 (min spend)",
      },
      {
        title: "Bairro Alto Bar Crawl",
        description:
          "A grid of narrow streets with 250+ bars in a few blocks. Buy a beer, stand in the street, and let the night take you.",
        emoji: "🍻",
        category: "Nightlife",
        bestTime: "Thursday-Saturday from 11pm",
        budget: "$10-20",
      },
    ],
  },
  santorini: {
    intro:
      "Santorini is the crown jewel of the Greek islands — a volcanic crescent of whitewashed villages perched on dramatic caldera cliffs. Famous for its sunsets, blue-domed churches, and extraordinary wines grown in volcanic soil.",
    hiddenGems: [
      {
        title: "Hike from Fira to Oia",
        description:
          "A stunning 10km cliffside trail connecting the two main towns with caldera views the entire way. Far better than the crowded bus.",
        emoji: "🥾",
        category: "Hidden Gem",
        duration: "3-4 hours",
        budget: "Free",
      },
      {
        title: "Akrotiri Archaeological Site",
        description:
          "A Minoan city preserved under volcanic ash (like Pompeii) with 3,600-year-old frescoes and multi-story buildings.",
        emoji: "🏛️",
        category: "Hidden Gem",
        duration: "1-2 hours",
        budget: "$14",
      },
      {
        title: "Thirassia Island",
        description:
          "Santorini's quiet neighbor across the caldera. Catch a local boat for authentic tavernas, zero crowds, and the Santorini of 30 years ago.",
        emoji: "🏝️",
        category: "Hidden Gem",
        duration: "Half day",
        budget: "$10-20 (boat fare)",
      },
    ],
    foodExperiences: [
      {
        title: "Wine Tasting at Santo Wines",
        description:
          "Volcanic terroir produces unique Assyrtiko whites. Taste them at sunset overlooking the caldera at Santo Wines or Venetsanos Winery.",
        emoji: "🍷",
        category: "Food",
        bestTime: "Late afternoon for sunset",
        budget: "$15-30",
      },
      {
        title: "Taverna in Ammoudi Bay",
        description:
          "Descend 300 steps from Oia to this tiny fishing port and eat grilled octopus with your feet almost in the Aegean.",
        emoji: "🐙",
        category: "Food",
        tip: "Walk down, taxi up (unless your legs are steel)",
        budget: "$20-40",
      },
    ],
    dayTrips: [
      {
        title: "Volcano & Hot Springs Boat Tour",
        description:
          "Sail to the volcanic island of Nea Kameni, hike to the crater, then swim in the warm sulfur springs at Palea Kameni.",
        emoji: "🌋",
        category: "Day Trip",
        duration: "Half day",
        budget: "$25-40",
      },
      {
        title: "Catamaran Sunset Cruise",
        description:
          "Sail around the caldera with swimming stops, a BBQ dinner on deck, and front-row seats for the famous Santorini sunset.",
        emoji: "⛵",
        category: "Day Trip",
        duration: "5 hours",
        budget: "$100-180",
      },
    ],
    nightlife: [
      {
        title: "Oia Sunset at the Castle",
        description:
          "The most famous sunset viewing spot in the world. Arrive at least an hour early to claim a spot — it's a spectacle worth the crowds.",
        emoji: "🌅",
        category: "Nightlife",
        bestTime: "1 hour before sunset",
        budget: "Free",
      },
      {
        title: "Fira Cocktail Bars",
        description:
          "Caldera-edge cocktail bars like Tango and PK Cocktail Bar serve drinks with a vertigo-inducing view straight down to the sea.",
        emoji: "🍹",
        category: "Nightlife",
        budget: "$12-20 per cocktail",
      },
    ],
  },
};

// ─── Fallback generator for destinations without extended content ─────────────

function buildFromHighlights(guide: DestinationGuide): ThingsToDoGuide {
  const extended = EXTENDED_THINGS[guide.slug];

  const topAttractions: ThingToDo[] = guide.highlights.map((h) => ({
    title: h.title,
    description: h.description,
    emoji: h.emoji,
    category: h.category,
  }));

  return {
    slug: guide.slug,
    name: guide.name,
    country: guide.country,
    continent: guide.continent,
    heroImage: guide.heroImage,
    tagline: guide.tagline,
    intro: extended?.intro || guide.description,
    topAttractions,
    hiddenGems: extended?.hiddenGems || [],
    foodExperiences: extended?.foodExperiences || [],
    dayTrips: extended?.dayTrips || [],
    nightlife: extended?.nightlife || [],
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export function getThingsToDoGuide(
  slug: string,
): ThingsToDoGuide | undefined {
  const guide = getGuideBySlug(slug);
  if (!guide) return undefined;
  return buildFromHighlights(guide);
}

export function getThingsToDoSlugs(): string[] {
  return getGuideSlugs();
}

export function hasExtendedContent(slug: string): boolean {
  return slug in EXTENDED_THINGS;
}
