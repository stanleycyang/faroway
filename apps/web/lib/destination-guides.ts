import { IMAGE_PATHS, getImageUrl } from "@faroway/constants";

export interface DestinationHighlight {
  title: string;
  description: string;
  emoji: string;
  category: string;
}

export interface ItineraryDay {
  day: number;
  title: string;
  activities: string[];
}

export interface DestinationGuide {
  slug: string;
  name: string;
  country: string;
  continent: "Asia" | "Europe" | "Americas" | "Africa" | "Oceania";
  tagline: string;
  description: string;
  heroImage: string;
  cardImage: string;
  vibes: string[];
  quickFacts: {
    bestTime: string;
    language: string;
    currency: string;
    timezone: string;
    avgBudget: string;
  };
  highlights: DestinationHighlight[];
  sampleItinerary: ItineraryDay[];
  travelTips: string[];
}

export const destinationGuides: DestinationGuide[] = [
  // ─── Asia ──────────────────────────────────────────────────────────────────
  {
    slug: "tokyo",
    name: "Tokyo",
    country: "Japan",
    continent: "Asia",
    tagline: "Where ancient tradition meets neon-lit innovation",
    description:
      "Tokyo dazzles with its blend of ultra-modern skyscrapers, serene temples, world-class cuisine, and quirky pop culture. From the bustling streets of Shibuya to the peaceful gardens of Meiji Shrine, every corner tells a different story.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.tokyo),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.tokyo),
    vibes: ["Culture & Tech", "Foodie", "Urban"],
    quickFacts: {
      bestTime: "March – May, Sep – Nov",
      language: "Japanese",
      currency: "JPY (¥)",
      timezone: "JST (UTC+9)",
      avgBudget: "$100–150/day",
    },
    highlights: [
      {
        title: "Shibuya Crossing",
        description:
          "The world's busiest pedestrian intersection — an iconic Tokyo experience",
        emoji: "🚶",
        category: "Landmark",
      },
      {
        title: "Tsukiji Outer Market",
        description:
          "Fresh sushi, tamagoyaki, and street food from the legendary fish market area",
        emoji: "🍣",
        category: "Food",
      },
      {
        title: "Meiji Shrine",
        description:
          "A tranquil Shinto shrine surrounded by lush forest in the heart of the city",
        emoji: "⛩️",
        category: "Culture",
      },
      {
        title: "Akihabara",
        description:
          "Electric Town — anime, manga, gaming, and gadget paradise",
        emoji: "🎮",
        category: "Entertainment",
      },
      {
        title: "Shinjuku Gyoen",
        description:
          "One of Tokyo's most beautiful gardens, stunning during cherry blossom season",
        emoji: "🌸",
        category: "Nature",
      },
      {
        title: "TeamLab Borderless",
        description:
          "Immersive digital art museum that blurs the line between art and visitor",
        emoji: "🎨",
        category: "Art",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Arrival & Shibuya",
        activities: [
          "Land at Narita/Haneda and take express to hotel",
          "Explore Shibuya Crossing and Hachiko statue",
          "Dinner at a local izakaya in Shinjuku",
        ],
      },
      {
        day: 2,
        title: "Temples & Markets",
        activities: [
          "Morning at Meiji Shrine and Harajuku",
          "Lunch at Tsukiji Outer Market",
          "Afternoon in Asakusa and Senso-ji Temple",
          "Evening stroll along Sumida River",
        ],
      },
      {
        day: 3,
        title: "Culture & Pop",
        activities: [
          "Morning at Shinjuku Gyoen gardens",
          "Explore Akihabara's electric town",
          "Visit TeamLab Borderless",
          "Farewell ramen in Golden Gai",
        ],
      },
    ],
    travelTips: [
      "Get a Suica/Pasmo IC card for seamless transit — it works on trains, buses, and vending machines.",
      "Most restaurants don't accept tips. Bowing slightly when thanking staff is appreciated.",
      "Download Google Translate with the Japanese offline pack — many signs are only in Japanese.",
      "Visit convenience stores (7-Eleven, Lawson) for surprisingly excellent food and ATMs that accept foreign cards.",
    ],
  },
  {
    slug: "bali",
    name: "Bali",
    country: "Indonesia",
    continent: "Asia",
    tagline: "Island of the gods — beaches, rice terraces, and spiritual calm",
    description:
      "Bali offers an enchanting mix of pristine beaches, emerald rice paddies, ancient temples, and a thriving wellness scene. Whether you're surfing in Canggu, exploring Ubud's art markets, or watching the sunset at Uluwatu, Bali casts a spell you won't soon forget.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.bali),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.bali),
    vibes: ["Beach & Wellness", "Nature", "Culture"],
    quickFacts: {
      bestTime: "April – October (dry season)",
      language: "Indonesian / Balinese",
      currency: "IDR (Rp)",
      timezone: "WITA (UTC+8)",
      avgBudget: "$40–80/day",
    },
    highlights: [
      {
        title: "Tegallalang Rice Terraces",
        description:
          "Iconic tiered rice paddies with jungle swing photo ops and cafe views",
        emoji: "🌾",
        category: "Nature",
      },
      {
        title: "Uluwatu Temple",
        description:
          "Clifftop temple with breathtaking sunset views and traditional Kecak dance",
        emoji: "⛩️",
        category: "Culture",
      },
      {
        title: "Ubud Monkey Forest",
        description:
          "Sacred sanctuary with playful macaques and ancient moss-covered statues",
        emoji: "🐒",
        category: "Nature",
      },
      {
        title: "Seminyak Beach",
        description:
          "Trendy beach with upscale beach clubs, sunset cocktails, and surf vibes",
        emoji: "🏖️",
        category: "Beach",
      },
      {
        title: "Tirta Empul",
        description:
          "Sacred water temple where locals and visitors participate in purification rituals",
        emoji: "💧",
        category: "Spiritual",
      },
      {
        title: "Canggu Surf Scene",
        description:
          "Laid-back surf town with coworking spaces, smoothie bowls, and great waves",
        emoji: "🏄",
        category: "Adventure",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Arrive & Seminyak",
        activities: [
          "Arrive at Ngurah Rai airport",
          "Check into Seminyak villa",
          "Sunset at Potato Head Beach Club",
          "Dinner at a warung (local restaurant)",
        ],
      },
      {
        day: 2,
        title: "Ubud Culture Day",
        activities: [
          "Morning yoga class",
          "Explore Tegallalang Rice Terraces",
          "Visit Ubud Monkey Forest",
          "Afternoon at Ubud Art Market",
        ],
      },
      {
        day: 3,
        title: "Temple & Beach",
        activities: [
          "Morning purification at Tirta Empul",
          "Lunch overlooking the valley",
          "Afternoon at Uluwatu Temple",
          "Kecak dance at sunset",
        ],
      },
    ],
    travelTips: [
      "Rent a scooter for maximum flexibility, but always wear a helmet and carry your international driving permit.",
      "Bargaining is expected at markets — start at about 40% of the asking price.",
      "Dress modestly when visiting temples. Sarongs are often provided at entrances.",
      "The tap water is not safe to drink. Stick to bottled or filtered water.",
    ],
  },
  {
    slug: "bangkok",
    name: "Bangkok",
    country: "Thailand",
    continent: "Asia",
    tagline:
      "A sensory overload of temples, street food, and vibrant night markets",
    description:
      "Bangkok is a city that never sleeps — a chaotic, beautiful blend of glittering temples, legendary street food, rooftop bars, and floating markets. From the Grand Palace to Khao San Road, it's a feast for every sense.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.bangkok),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.bangkok),
    vibes: ["Foodie", "Culture", "Nightlife"],
    quickFacts: {
      bestTime: "November – February",
      language: "Thai",
      currency: "THB (฿)",
      timezone: "ICT (UTC+7)",
      avgBudget: "$30–60/day",
    },
    highlights: [
      {
        title: "Grand Palace",
        description:
          "Dazzling complex of buildings that served as the royal residence for 150 years",
        emoji: "👑",
        category: "Landmark",
      },
      {
        title: "Wat Arun",
        description:
          "Temple of Dawn — a stunning riverside pagoda beautifully lit at night",
        emoji: "🌅",
        category: "Culture",
      },
      {
        title: "Chatuchak Weekend Market",
        description:
          "One of the world's largest markets with over 15,000 stalls",
        emoji: "🛍️",
        category: "Shopping",
      },
      {
        title: "Street Food on Yaowarat",
        description:
          "Chinatown's legendary food street with Michelin-rated stalls",
        emoji: "🍜",
        category: "Food",
      },
      {
        title: "Rooftop Bars",
        description:
          "Sky-high cocktails with panoramic city views at Sirocco or Octave",
        emoji: "🍸",
        category: "Nightlife",
      },
      {
        title: "Floating Markets",
        description:
          "Colorful canal-side markets selling fresh produce, souvenirs, and pad thai from boats",
        emoji: "🛶",
        category: "Experience",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Temples & Palace",
        activities: [
          "Visit the Grand Palace and Wat Phra Kaew",
          "Lunch by the river",
          "Ferry to Wat Arun for sunset views",
          "Evening street food in Chinatown",
        ],
      },
      {
        day: 2,
        title: "Markets & Culture",
        activities: [
          "Morning at Chatuchak Weekend Market",
          "Thai massage in the afternoon",
          "Explore Khao San Road",
          "Rooftop cocktails at sunset",
        ],
      },
      {
        day: 3,
        title: "Day Trip & Farewell",
        activities: [
          "Morning floating market trip",
          "Afternoon Thai cooking class",
          "Farewell dinner at a riverside restaurant",
        ],
      },
    ],
    travelTips: [
      "Use the BTS Skytrain and MRT to avoid Bangkok's legendary traffic jams.",
      "Always carry cash for street food and markets — most don't accept cards.",
      "Stay hydrated! Bangkok is hot year-round. Carry a water bottle.",
      "Download the Grab app — it's Southeast Asia's Uber and works perfectly in Bangkok.",
    ],
  },
  {
    slug: "dubai",
    name: "Dubai",
    country: "UAE",
    continent: "Asia",
    tagline:
      "From desert dunes to futuristic skylines — a city of superlatives",
    description:
      "Dubai pushes every boundary — the tallest building, the largest mall, and man-made islands visible from space. Beyond the glitz, you'll find traditional souks, desert adventures, and some of the world's best dining.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.dubai),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.dubai),
    vibes: ["Luxury", "Urban", "Adventure"],
    quickFacts: {
      bestTime: "November – March",
      language: "Arabic / English",
      currency: "AED (د.إ)",
      timezone: "GST (UTC+4)",
      avgBudget: "$120–200/day",
    },
    highlights: [
      {
        title: "Burj Khalifa",
        description:
          "The world's tallest building at 828m — observation deck views are jaw-dropping",
        emoji: "🏗️",
        category: "Landmark",
      },
      {
        title: "Desert Safari",
        description:
          "Dune bashing, camel rides, and BBQ dinner under the stars",
        emoji: "🐪",
        category: "Adventure",
      },
      {
        title: "Dubai Mall",
        description:
          "The world's largest mall with an aquarium, ice rink, and 1,200+ stores",
        emoji: "🛍️",
        category: "Shopping",
      },
      {
        title: "Palm Jumeirah",
        description:
          "Iconic palm-shaped island with luxury resorts and Atlantis waterpark",
        emoji: "🏝️",
        category: "Beach",
      },
      {
        title: "Gold & Spice Souks",
        description:
          "Traditional markets in Old Dubai with gold, frankincense, and saffron",
        emoji: "✨",
        category: "Culture",
      },
      {
        title: "Dubai Marina",
        description:
          "Waterfront promenade with dining, yachts, and stunning skyscraper views",
        emoji: "🌃",
        category: "Urban",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Downtown Dubai",
        activities: [
          "Visit Burj Khalifa observation deck",
          "Explore Dubai Mall and aquarium",
          "Watch the Dubai Fountain show at sunset",
        ],
      },
      {
        day: 2,
        title: "Old & New",
        activities: [
          "Morning at Gold and Spice Souks",
          "Abra boat ride across Dubai Creek",
          "Afternoon at Palm Jumeirah & Atlantis",
          "Dinner at Dubai Marina",
        ],
      },
      {
        day: 3,
        title: "Desert & Departure",
        activities: [
          "Morning beach time at JBR",
          "Afternoon desert safari with dune bashing",
          "BBQ dinner under the stars",
        ],
      },
    ],
    travelTips: [
      "Dress modestly in public areas outside hotels and beach clubs — cover shoulders and knees.",
      "The Metro is clean, air-conditioned, and connects all major attractions.",
      "Friday is the weekend day — many businesses close or have reduced hours.",
      "Alcohol is available in licensed restaurants and hotels, but public intoxication is illegal.",
    ],
  },

  // ─── Europe ────────────────────────────────────────────────────────────────
  {
    slug: "paris",
    name: "Paris",
    country: "France",
    continent: "Europe",
    tagline:
      "The City of Light — romance, art, and croissants in every arrondissement",
    description:
      "Paris is timeless. Whether you're gazing at the Eiffel Tower, wandering through the Louvre, or sipping coffee at a sidewalk café in Le Marais, every moment feels like a scene from a movie. The city's art, cuisine, and architecture are unmatched.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.paris),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.paris),
    vibes: ["Romance & Art", "Foodie", "Culture"],
    quickFacts: {
      bestTime: "April – June, Sep – Oct",
      language: "French",
      currency: "EUR (€)",
      timezone: "CET (UTC+1)",
      avgBudget: "$120–180/day",
    },
    highlights: [
      {
        title: "Eiffel Tower",
        description:
          "The iconic iron lattice tower — best viewed from Trocadéro or at night when it sparkles",
        emoji: "🗼",
        category: "Landmark",
      },
      {
        title: "Louvre Museum",
        description:
          "Home to the Mona Lisa and 380,000 other works — plan at least half a day",
        emoji: "🖼️",
        category: "Art",
      },
      {
        title: "Montmartre",
        description:
          "Charming hilltop village with Sacré-Cœur, street artists, and sweeping city views",
        emoji: "🎨",
        category: "Culture",
      },
      {
        title: "Le Marais",
        description:
          "Historic district with boutiques, falafel shops, and Paris's best people-watching",
        emoji: "🥐",
        category: "Food",
      },
      {
        title: "Seine River Cruise",
        description:
          "Glide past Notre-Dame, the Louvre, and the Musée d'Orsay at golden hour",
        emoji: "🚢",
        category: "Experience",
      },
      {
        title: "Versailles Day Trip",
        description:
          "The opulent palace and gardens of Louis XIV, just 40 minutes from central Paris",
        emoji: "👑",
        category: "History",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Icons of Paris",
        activities: [
          "Morning at the Eiffel Tower and Trocadéro",
          "Lunch at a brasserie near Champ de Mars",
          "Afternoon at the Louvre",
          "Evening Seine river cruise",
        ],
      },
      {
        day: 2,
        title: "Art & Neighborhoods",
        activities: [
          "Morning walk through Montmartre to Sacré-Cœur",
          "Lunch in Le Marais",
          "Explore the Latin Quarter and Shakespeare & Co bookshop",
          "Dinner in Saint-Germain-des-Prés",
        ],
      },
      {
        day: 3,
        title: "Versailles & Farewell",
        activities: [
          "Day trip to Palace of Versailles",
          "Wander the gardens and Grand Trianon",
          "Return to Paris for a farewell dinner",
        ],
      },
    ],
    travelTips: [
      "Buy a Paris Museum Pass (2 or 4 days) to skip lines at 50+ museums and monuments.",
      "The Métro is the fastest way to get around. A carnet of 10 tickets saves money.",
      "Service is included in all restaurant bills — no need to tip beyond rounding up.",
      'Learn a few French phrases. Starting with "Bonjour" goes a long way with locals.',
    ],
  },
  {
    slug: "barcelona",
    name: "Barcelona",
    country: "Spain",
    continent: "Europe",
    tagline: "Sun, Gaudí, and tapas on the Mediterranean coast",
    description:
      "Barcelona blends beach life with architectural wonder. Gaudí's Sagrada Família, the vibrant La Rambla, and the hidden corners of the Gothic Quarter make it one of Europe's most dynamic cities. Add world-class tapas and you have perfection.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.barcelona),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.barcelona),
    vibes: ["Beach & Culture", "Foodie", "Architecture"],
    quickFacts: {
      bestTime: "May – June, September",
      language: "Spanish / Catalan",
      currency: "EUR (€)",
      timezone: "CET (UTC+1)",
      avgBudget: "$80–130/day",
    },
    highlights: [
      {
        title: "Sagrada Família",
        description:
          "Gaudí's unfinished masterpiece — a basilica like nothing else on Earth",
        emoji: "⛪",
        category: "Architecture",
      },
      {
        title: "Park Güell",
        description:
          "Whimsical mosaic terraces and panoramic views of the city and sea",
        emoji: "🦎",
        category: "Art",
      },
      {
        title: "La Boqueria Market",
        description:
          "Vibrant food market on La Rambla with fresh juices, jamón, and seafood tapas",
        emoji: "🍇",
        category: "Food",
      },
      {
        title: "Gothic Quarter",
        description:
          "Medieval labyrinth of narrow streets, plazas, and hidden bars",
        emoji: "🏛️",
        category: "Culture",
      },
      {
        title: "Barceloneta Beach",
        description:
          "City beach where locals and visitors sunbathe, swim, and play volleyball",
        emoji: "🏖️",
        category: "Beach",
      },
      {
        title: "Camp Nou",
        description:
          "Legendary home stadium of FC Barcelona — a must for football fans",
        emoji: "⚽",
        category: "Sports",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Gaudí & Gothic",
        activities: [
          "Morning at Sagrada Família (book tickets in advance)",
          "Walk through the Gothic Quarter",
          "Tapas lunch at La Boqueria",
          "Evening paseo along La Rambla",
        ],
      },
      {
        day: 2,
        title: "Park & Beach",
        activities: [
          "Morning at Park Güell",
          "Lunch in Gràcia neighborhood",
          "Afternoon at Barceloneta Beach",
          "Sunset cocktails at a chiringuito",
        ],
      },
      {
        day: 3,
        title: "Local Life",
        activities: [
          "Explore El Born and Picasso Museum",
          "Vermouth hour at a local bar",
          "Late lunch paella by the harbor",
          "Farewell flamenco show",
        ],
      },
    ],
    travelTips: [
      "Book Sagrada Família tickets weeks in advance — they sell out fast.",
      "Beware of pickpockets on La Rambla and in crowded tourist areas.",
      "Spaniards eat late: lunch at 2pm, dinner after 9pm. Plan accordingly.",
      "The T-Casual metro pass gives you 10 rides at a discount.",
    ],
  },
  {
    slug: "santorini",
    name: "Santorini",
    country: "Greece",
    continent: "Europe",
    tagline:
      "White-washed cliffs, blue domes, and the most famous sunset in the world",
    description:
      "Santorini is the poster child of the Greek islands — dramatic caldera views, iconic blue-domed churches, black-sand beaches, and sunsets that stop you in your tracks. It's romance and relaxation distilled into one volcanic island.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.santorini),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.santorini),
    vibes: ["Scenic & Romantic", "Beach", "Relaxation"],
    quickFacts: {
      bestTime: "April – October",
      language: "Greek",
      currency: "EUR (€)",
      timezone: "EET (UTC+2)",
      avgBudget: "$100–180/day",
    },
    highlights: [
      {
        title: "Oia Sunset",
        description:
          "The world's most photographed sunset — arrive early to claim a spot",
        emoji: "🌅",
        category: "Experience",
      },
      {
        title: "Fira to Oia Hike",
        description:
          "10km clifftop trail with jaw-dropping caldera views the entire way",
        emoji: "🥾",
        category: "Adventure",
      },
      {
        title: "Red Beach",
        description:
          "Dramatic red volcanic cliffs meeting deep blue Aegean waters",
        emoji: "🏖️",
        category: "Beach",
      },
      {
        title: "Wine Tasting",
        description:
          "Volcanic soil produces unique Assyrtiko whites — visit a cliffside winery",
        emoji: "🍷",
        category: "Food",
      },
      {
        title: "Akrotiri Ruins",
        description:
          "A Minoan city buried by the same eruption that shaped the caldera",
        emoji: "🏛️",
        category: "History",
      },
      {
        title: "Caldera Boat Tour",
        description:
          "Sail the volcanic crater, visit hot springs, and snorkel in crystal-clear water",
        emoji: "⛵",
        category: "Adventure",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Arrive & Fira",
        activities: [
          "Arrive by ferry or flight",
          "Explore Fira town and caldera viewpoints",
          "Wine tasting at Santo Wines",
          "Dinner overlooking the caldera",
        ],
      },
      {
        day: 2,
        title: "Oia & Sunset",
        activities: [
          "Morning hike from Fira to Oia (or take the bus)",
          "Explore Oia's blue dome churches",
          "Lunch at Ammoudi Bay",
          "The famous Oia sunset",
        ],
      },
      {
        day: 3,
        title: "Beaches & Sailing",
        activities: [
          "Morning at Red Beach or Perissa black sand beach",
          "Afternoon caldera catamaran cruise",
          "Hot springs swim",
          "Farewell seafood dinner",
        ],
      },
    ],
    travelTips: [
      "Visit in shoulder season (April–May, Sep–Oct) to avoid massive crowds and lower prices.",
      "Book caldera-view accommodation months ahead — it sells out fast.",
      "Rent an ATV or car to explore beyond the main towns. Buses can be crowded.",
      "Bring good walking shoes — the cobblestone paths and stairs are steep.",
    ],
  },
  {
    slug: "london",
    name: "London",
    country: "United Kingdom",
    continent: "Europe",
    tagline:
      "Royal history, world-class museums, and a thriving multicultural food scene",
    description:
      "London is a city of layers — royal palaces, centuries-old pubs, cutting-edge galleries, and neighborhoods that each feel like their own city. With free world-class museums, iconic landmarks, and food from every corner of the globe, there's always something new to discover.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.london),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.london),
    vibes: ["Culture", "History", "Urban"],
    quickFacts: {
      bestTime: "May – September",
      language: "English",
      currency: "GBP (£)",
      timezone: "GMT (UTC+0)",
      avgBudget: "$120–200/day",
    },
    highlights: [
      {
        title: "British Museum",
        description:
          "Free admission to one of the world's greatest collections of human history",
        emoji: "🏛️",
        category: "Culture",
      },
      {
        title: "Tower of London",
        description:
          "Medieval fortress housing the Crown Jewels and 1,000 years of history",
        emoji: "👑",
        category: "History",
      },
      {
        title: "Borough Market",
        description:
          "London's oldest food market — artisan cheeses, fresh oysters, and pastries",
        emoji: "🧀",
        category: "Food",
      },
      {
        title: "West End Shows",
        description:
          "World-renowned theater district with Les Mis, Phantom, and more",
        emoji: "🎭",
        category: "Entertainment",
      },
      {
        title: "Hyde Park",
        description:
          "Royal park perfect for boating, cycling, or a peaceful afternoon escape",
        emoji: "🌳",
        category: "Nature",
      },
      {
        title: "Camden Market",
        description:
          "Eclectic market with vintage clothes, street food, and live music",
        emoji: "🎸",
        category: "Shopping",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Royal London",
        activities: [
          "Watch the Changing of the Guard at Buckingham Palace",
          "Walk through St James's Park",
          "Visit the Tower of London and Crown Jewels",
          "Dinner in Covent Garden",
        ],
      },
      {
        day: 2,
        title: "Museums & Markets",
        activities: [
          "Morning at the British Museum (free)",
          "Lunch at Borough Market",
          "Afternoon at Tate Modern",
          "Evening West End show",
        ],
      },
      {
        day: 3,
        title: "Neighborhoods",
        activities: [
          "Morning walk through Notting Hill and Portobello Road",
          "Explore Camden Market",
          "Afternoon tea experience",
          "Sunset from Primrose Hill",
        ],
      },
    ],
    travelTips: [
      "Get an Oyster card or use contactless payment for the Tube — it's the cheapest way to travel.",
      "Most major museums are free. The British Museum, Natural History Museum, and Tate Modern are must-visits.",
      "Book West End tickets on TodayTix for day-of discounts.",
      "Pubs typically stop serving at 11pm. Plan dinner reservations accordingly.",
    ],
  },
  {
    slug: "rome",
    name: "Rome",
    country: "Italy",
    continent: "Europe",
    tagline:
      "The Eternal City — where every cobblestone tells a 2,000-year story",
    description:
      "Rome is an open-air museum where ancient ruins stand alongside baroque fountains and bustling trattorias. From the Colosseum to the Vatican, from authentic cacio e pepe to gelato by the Trevi Fountain, Rome is a feast for every sense.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.rome),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.rome),
    vibes: ["History", "Foodie", "Culture"],
    quickFacts: {
      bestTime: "April – June, Sep – Oct",
      language: "Italian",
      currency: "EUR (€)",
      timezone: "CET (UTC+1)",
      avgBudget: "$90–140/day",
    },
    highlights: [
      {
        title: "Colosseum",
        description:
          "The iconic 2,000-year-old amphitheater that once hosted gladiatorial combat",
        emoji: "🏟️",
        category: "History",
      },
      {
        title: "Vatican Museums & Sistine Chapel",
        description: "Michelangelo's ceiling and the vast papal art collection",
        emoji: "🎨",
        category: "Art",
      },
      {
        title: "Trastevere",
        description:
          "Charming cobblestone neighborhood with the best trattorias in Rome",
        emoji: "🍝",
        category: "Food",
      },
      {
        title: "Trevi Fountain",
        description:
          "Baroque masterpiece — toss a coin to ensure your return to Rome",
        emoji: "⛲",
        category: "Landmark",
      },
      {
        title: "Pantheon",
        description:
          "Perfectly preserved 2,000-year-old temple with its famous oculus dome",
        emoji: "🏛️",
        category: "Architecture",
      },
      {
        title: "Roman Forum",
        description:
          "Walk among the ruins of ancient Rome's political and commercial center",
        emoji: "🏗️",
        category: "History",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Ancient Rome",
        activities: [
          "Morning at the Colosseum and Roman Forum",
          "Lunch near Piazza Navona",
          "Visit the Pantheon",
          "Gelato and coin toss at Trevi Fountain",
        ],
      },
      {
        day: 2,
        title: "Vatican & Art",
        activities: [
          "Early morning Vatican Museums (book skip-the-line)",
          "Sistine Chapel and St. Peter's Basilica",
          "Lunch in Prati",
          "Afternoon walk through Villa Borghese gardens",
        ],
      },
      {
        day: 3,
        title: "La Dolce Vita",
        activities: [
          "Morning at Campo de' Fiori market",
          "Cooking class: pasta-making",
          "Explore Trastevere's winding streets",
          "Farewell dinner in a family-run trattoria",
        ],
      },
    ],
    travelTips: [
      "Book Colosseum and Vatican tickets online well in advance — same-day queues can be 2+ hours.",
      "Avoid restaurants with picture menus right next to major landmarks — tourist traps. Walk one block away for better food.",
      "Carry a water bottle — Rome has free drinking fountains (nasoni) throughout the city.",
      "Dress modestly for the Vatican: no bare shoulders or knees, or you'll be turned away.",
    ],
  },
  {
    slug: "lisbon",
    name: "Lisbon",
    country: "Portugal",
    continent: "Europe",
    tagline:
      "Colorful tiles, hilltop views, and the best pastéis de nata in the world",
    description:
      "Lisbon is Europe's sunniest capital — a city of seven hills, vintage trams, fado music, and pastel-colored buildings. It offers incredible value, world-class seafood, and a creative energy that makes it one of Europe's most exciting destinations.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.lisbon),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.lisbon),
    vibes: ["Culture", "Foodie", "Nightlife"],
    quickFacts: {
      bestTime: "March – October",
      language: "Portuguese",
      currency: "EUR (€)",
      timezone: "WET (UTC+0)",
      avgBudget: "$60–100/day",
    },
    highlights: [
      {
        title: "Belém Tower & Pastéis",
        description:
          "UNESCO tower and the bakery where Portugal's famous custard tarts were invented",
        emoji: "🏰",
        category: "History",
      },
      {
        title: "Alfama District",
        description:
          "Lisbon's oldest neighborhood — winding alleys, fado bars, and stunning miradouros",
        emoji: "🎶",
        category: "Culture",
      },
      {
        title: "Tram 28",
        description:
          "Iconic yellow tram that rattles through Lisbon's most photogenic neighborhoods",
        emoji: "🚃",
        category: "Experience",
      },
      {
        title: "Time Out Market",
        description:
          "Curated food hall with Lisbon's best chefs under one roof",
        emoji: "🍽️",
        category: "Food",
      },
      {
        title: "Sintra Day Trip",
        description:
          "Fairytale palaces, misty forests, and Moorish castles just 30 minutes away",
        emoji: "🏰",
        category: "Day Trip",
      },
      {
        title: "LX Factory",
        description:
          "Creative hub in a converted industrial complex with shops, galleries, and brunch spots",
        emoji: "🎨",
        category: "Art",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Historic Lisbon",
        activities: [
          "Ride Tram 28 through Alfama",
          "Visit São Jorge Castle for panoramic views",
          "Lunch at Time Out Market",
          "Explore the Baixa and Rossio Square",
        ],
      },
      {
        day: 2,
        title: "Belém & Culture",
        activities: [
          "Morning at Belém Tower and Jerónimos Monastery",
          "Pastéis de nata at Pastéis de Belém",
          "Afternoon at LX Factory",
          "Evening fado show in Alfama",
        ],
      },
      {
        day: 3,
        title: "Sintra Day Trip",
        activities: [
          "Train to Sintra (30 min)",
          "Explore Pena Palace and gardens",
          "Visit the Moorish Castle",
          "Return for a farewell seafood dinner",
        ],
      },
    ],
    travelTips: [
      "Wear comfortable shoes with good grip — the cobblestone hills are beautiful but slippery.",
      "Try a ginjinha (cherry liqueur) at one of the tiny bars near Rossio — it's a Lisbon tradition.",
      "Book Sintra palace tickets online. The queues without them can be extremely long.",
      "Lisbon is one of Europe's most affordable capitals — eat where the locals eat for incredible value.",
    ],
  },
  {
    slug: "reykjavik",
    name: "Reykjavik",
    country: "Iceland",
    continent: "Europe",
    tagline:
      "Fire and ice — Northern Lights, volcanoes, and geothermal hot springs",
    description:
      "Reykjavik is the gateway to Iceland's otherworldly landscape — glaciers, waterfalls, geysers, and volcanic beaches. The world's northernmost capital packs a creative punch with its colorful houses, craft beer scene, and midnight sun.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.reykjavik),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.reykjavik),
    vibes: ["Nature", "Adventure", "Scenic"],
    quickFacts: {
      bestTime: "Jun – Aug (summer) or Sep – Mar (Northern Lights)",
      language: "Icelandic / English",
      currency: "ISK (kr)",
      timezone: "GMT (UTC+0)",
      avgBudget: "$150–250/day",
    },
    highlights: [
      {
        title: "Northern Lights",
        description:
          "Dance of green and purple across the Arctic sky (September–March)",
        emoji: "🌌",
        category: "Nature",
      },
      {
        title: "Blue Lagoon",
        description:
          "Iconic geothermal spa with milky-blue waters and silica face masks",
        emoji: "♨️",
        category: "Wellness",
      },
      {
        title: "Golden Circle",
        description:
          "Classic day trip: Þingvellir, Geysir, and the mighty Gullfoss waterfall",
        emoji: "🌊",
        category: "Nature",
      },
      {
        title: "Black Sand Beach",
        description:
          "Reynisfjara's dramatic basalt columns and roaring Atlantic waves",
        emoji: "🖤",
        category: "Scenic",
      },
      {
        title: "Glacier Hiking",
        description: "Walk on a glacier with crampons and an expert guide",
        emoji: "🏔️",
        category: "Adventure",
      },
      {
        title: "Whale Watching",
        description:
          "Spot humpback whales, dolphins, and puffins from Reykjavik's harbor",
        emoji: "🐋",
        category: "Wildlife",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Reykjavik & Blue Lagoon",
        activities: [
          "Explore Hallgrímskirkja and downtown Reykjavik",
          "Lunch at a local seafood restaurant",
          "Afternoon at the Blue Lagoon",
          "Northern Lights tour (winter only)",
        ],
      },
      {
        day: 2,
        title: "Golden Circle",
        activities: [
          "Visit Þingvellir National Park",
          "Watch Strokkur geyser erupt",
          "Marvel at Gullfoss waterfall",
          "Tomato soup at Friðheimar greenhouse",
        ],
      },
      {
        day: 3,
        title: "South Coast",
        activities: [
          "Drive the Ring Road south",
          "Visit Seljalandsfoss and Skógafoss waterfalls",
          "Black sand beach at Reynisfjara",
          "Optional glacier hike",
        ],
      },
    ],
    travelTips: [
      "Iceland is expensive. Budget travelers should cook at Bónus supermarket and stay at guesthouses.",
      "Layer up! Weather changes every 15 minutes. A wind/waterproof outer layer is essential.",
      "Rent a car for maximum freedom — public transport outside Reykjavik is very limited.",
      "Never drive off marked roads. Iceland's fragile landscape takes decades to recover from tire tracks.",
    ],
  },

  // ─── Americas ──────────────────────────────────────────────────────────────
  {
    slug: "new-york",
    name: "New York",
    country: "USA",
    continent: "Americas",
    tagline:
      "The city that never sleeps — energy, culture, and ambition on every block",
    description:
      "New York City is the world's ultimate urban playground. From the bright lights of Times Square to the quiet paths of Central Park, from Michelin-starred restaurants to $1 pizza slices, NYC has everything cranked to maximum.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations["new-york"]),
    cardImage: getImageUrl(IMAGE_PATHS.destinations["new-york"]),
    vibes: ["Urban & Nightlife", "Culture", "Foodie"],
    quickFacts: {
      bestTime: "April – June, Sep – Nov",
      language: "English",
      currency: "USD ($)",
      timezone: "EST (UTC-5)",
      avgBudget: "$150–250/day",
    },
    highlights: [
      {
        title: "Central Park",
        description: "843 acres of green oasis in the middle of Manhattan",
        emoji: "🌳",
        category: "Nature",
      },
      {
        title: "Statue of Liberty",
        description:
          "The iconic symbol of freedom and democracy on Liberty Island",
        emoji: "🗽",
        category: "Landmark",
      },
      {
        title: "Broadway",
        description: "World-famous theater district with shows for every taste",
        emoji: "🎭",
        category: "Entertainment",
      },
      {
        title: "Brooklyn Bridge",
        description:
          "Walk the iconic bridge for stunning Manhattan skyline views",
        emoji: "🌉",
        category: "Landmark",
      },
      {
        title: "Metropolitan Museum",
        description:
          "One of the world's greatest art museums with 5,000 years of art",
        emoji: "🏛️",
        category: "Art",
      },
      {
        title: "Chelsea Market & High Line",
        description:
          "Elevated park and artisanal food hall in a former railway",
        emoji: "🍩",
        category: "Food",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Manhattan Icons",
        activities: [
          "Morning at the Statue of Liberty and Ellis Island",
          "Walk across the Brooklyn Bridge",
          "Pizza in DUMBO with skyline views",
          "Evening in Times Square and Broadway show",
        ],
      },
      {
        day: 2,
        title: "Culture & Parks",
        activities: [
          "Morning jog or walk through Central Park",
          "Visit the Metropolitan Museum of Art",
          "Lunch at a classic NYC deli",
          "Walk the High Line at sunset",
        ],
      },
      {
        day: 3,
        title: "Neighborhoods",
        activities: [
          "Explore SoHo and Greenwich Village",
          "Lunch at Chelsea Market",
          "Afternoon in Williamsburg, Brooklyn",
          "Farewell dinner in Little Italy or Chinatown",
        ],
      },
    ],
    travelTips: [
      "Get an unlimited MetroCard for the subway — it's the fastest and cheapest way around.",
      "Book Broadway tickets on TodayTix or at the TKTS booth in Times Square for same-day discounts.",
      "Skip the tourist traps in Times Square for food. Walk a few blocks in any direction for better options.",
      'Many museums have "pay what you wish" hours — check their websites.',
    ],
  },

  // ─── Africa ────────────────────────────────────────────────────────────────
  {
    slug: "marrakech",
    name: "Marrakech",
    country: "Morocco",
    continent: "Africa",
    tagline: "Spices, souks, and sunsets over the Atlas Mountains",
    description:
      "Marrakech is a sensory explosion — the calls of market vendors, the scent of saffron and mint, the vivid colors of zellige tiles. Its legendary medina, stunning riads, and the chaos of Jemaa el-Fna square create an experience unlike any other.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.marrakech),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.marrakech),
    vibes: ["Culture", "Adventure", "Foodie"],
    quickFacts: {
      bestTime: "March – May, Sep – Nov",
      language: "Arabic / French",
      currency: "MAD (د.م.)",
      timezone: "WET (UTC+0)",
      avgBudget: "$40–80/day",
    },
    highlights: [
      {
        title: "Jemaa el-Fna",
        description:
          "The legendary square that comes alive at night with food stalls, musicians, and storytellers",
        emoji: "🎪",
        category: "Culture",
      },
      {
        title: "Medina Souks",
        description:
          "Labyrinthine markets selling leather, spices, ceramics, and everything in between",
        emoji: "🛍️",
        category: "Shopping",
      },
      {
        title: "Majorelle Garden",
        description:
          "Yves Saint Laurent's stunning cobalt-blue botanical garden",
        emoji: "🌺",
        category: "Nature",
      },
      {
        title: "Atlas Mountains",
        description:
          "Day trip to Berber villages and mountain passes with epic views",
        emoji: "🏔️",
        category: "Adventure",
      },
      {
        title: "Riad Stay",
        description:
          "Sleep in a traditional courtyard house with fountains, tiles, and rooftop terraces",
        emoji: "🏡",
        category: "Accommodation",
      },
      {
        title: "Hammam Experience",
        description:
          "Traditional steam bath with black soap scrub — the ultimate Moroccan wellness ritual",
        emoji: "🧖",
        category: "Wellness",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Medina & Souks",
        activities: [
          "Get orientated with a guided medina walk",
          "Navigate the souks for leather, spices, and ceramics",
          "Lunch at a rooftop café overlooking Jemaa el-Fna",
          "Evening in the square as it transforms",
        ],
      },
      {
        day: 2,
        title: "Gardens & Wellness",
        activities: [
          "Morning at Majorelle Garden",
          "Explore the Bahia Palace",
          "Afternoon hammam experience",
          "Traditional Moroccan dinner at a riad",
        ],
      },
      {
        day: 3,
        title: "Atlas Day Trip",
        activities: [
          "Drive through the Atlas Mountain passes",
          "Visit a Berber village",
          "Lunch with mountain views",
          "Return for sunset from a rooftop terrace",
        ],
      },
    ],
    travelTips: [
      "Bargaining is expected and part of the fun. Start at about 30-40% of the asking price.",
      "Hire a local guide for your first medina visit — it's easy to get lost (that's part of the charm).",
      "Stay in a riad for the authentic experience. Many have beautiful courtyards and serve incredible breakfasts.",
      "Women traveling alone should dress modestly and be prepared for persistent (but usually harmless) attention from vendors.",
    ],
  },
  {
    slug: "cape-town",
    name: "Cape Town",
    country: "South Africa",
    continent: "Africa",
    tagline:
      "Where mountains meet the ocean — adventure, wine, and raw natural beauty",
    description:
      "Cape Town is one of the most beautiful cities on Earth. Table Mountain looms over a city of world-class wine estates, pristine beaches, vibrant neighborhoods, and the raw beauty of the Cape Peninsula. It's adventure, culture, and luxury rolled into one.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations["cape-town"]),
    cardImage: getImageUrl(IMAGE_PATHS.destinations["cape-town"]),
    vibes: ["Nature", "Adventure", "Wine"],
    quickFacts: {
      bestTime: "November – March (summer)",
      language: "English / Afrikaans",
      currency: "ZAR (R)",
      timezone: "SAST (UTC+2)",
      avgBudget: "$50–100/day",
    },
    highlights: [
      {
        title: "Table Mountain",
        description:
          "Flat-topped mountain with 360° views — hike or take the cable car",
        emoji: "⛰️",
        category: "Nature",
      },
      {
        title: "Cape Point",
        description:
          "Dramatic cliffs where the Atlantic meets the Indian Ocean",
        emoji: "🌊",
        category: "Scenic",
      },
      {
        title: "Stellenbosch Wine Route",
        description:
          "World-class wine tasting at estates surrounded by mountains",
        emoji: "🍷",
        category: "Food",
      },
      {
        title: "V&A Waterfront",
        description:
          "Bustling harbor with restaurants, craft markets, and the Zeitz MOCAA museum",
        emoji: "🚢",
        category: "Urban",
      },
      {
        title: "Boulders Beach Penguins",
        description: "Walk among a colony of adorable African penguins",
        emoji: "🐧",
        category: "Wildlife",
      },
      {
        title: "Bo-Kaap",
        description:
          "Colorful historic neighborhood with Cape Malay culture and cuisine",
        emoji: "🏠",
        category: "Culture",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "City & Mountain",
        activities: [
          "Morning cable car up Table Mountain",
          "Walk the city bowl and Bo-Kaap",
          "Lunch at V&A Waterfront",
          "Sunset at Signal Hill",
        ],
      },
      {
        day: 2,
        title: "Cape Peninsula",
        activities: [
          "Drive Chapman's Peak coastal road",
          "Visit the penguins at Boulders Beach",
          "Cape Point and Cape of Good Hope",
          "Fish & chips in Kalk Bay",
        ],
      },
      {
        day: 3,
        title: "Wine Country",
        activities: [
          "Morning drive to Stellenbosch",
          "Wine tasting at 2-3 estates",
          "Lunch at a vineyard restaurant",
          "Return via Franschhoek",
        ],
      },
    ],
    travelTips: [
      "Rent a car — Cape Town's best attractions are spread out and public transit is limited.",
      "Book Table Mountain cable car tickets online. It closes in high winds, so go on your first clear day.",
      "Cape Town has water scarcity — be mindful of water usage (short showers, etc.).",
      "Uber is safe and widely used. Use it for nighttime travel.",
    ],
  },

  // ─── More Asia ────────────────────────────────────────────────────────────
  {
    slug: "singapore",
    name: "Singapore",
    country: "Singapore",
    continent: "Asia",
    tagline:
      "A futuristic city-state where cultures, cuisines, and gardens collide",
    description:
      "Singapore punches well above its weight. This tiny island nation is a dazzling mix of hawker-stall feasts, lush botanical gardens, futuristic architecture, and some of the cleanest streets on Earth. From Marina Bay Sands to Little India, every district is a new world.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.singapore),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.singapore),
    vibes: ["Foodie", "Urban", "Culture"],
    quickFacts: {
      bestTime: "February – April",
      language: "English / Mandarin / Malay / Tamil",
      currency: "SGD (S$)",
      timezone: "SGT (UTC+8)",
      avgBudget: "$100–180/day",
    },
    highlights: [
      {
        title: "Marina Bay Sands",
        description:
          "Iconic hotel with infinity pool, SkyPark, and stunning laser light show",
        emoji: "🏙️",
        category: "Landmark",
      },
      {
        title: "Gardens by the Bay",
        description:
          "Futuristic Supertree Grove and Cloud Forest dome surrounded by bay views",
        emoji: "🌳",
        category: "Nature",
      },
      {
        title: "Hawker Centres",
        description:
          "Michelin-rated street food for under $5 — chicken rice, laksa, and satay",
        emoji: "🍜",
        category: "Food",
      },
      {
        title: "Little India & Chinatown",
        description:
          "Vibrant ethnic quarters with temples, markets, and authentic cuisine",
        emoji: "🕉️",
        category: "Culture",
      },
      {
        title: "Sentosa Island",
        description:
          "Resort island with Universal Studios, beaches, and S.E.A. Aquarium",
        emoji: "🎢",
        category: "Entertainment",
      },
      {
        title: "Orchard Road",
        description:
          "Singapore's legendary shopping boulevard with luxury malls and flagship stores",
        emoji: "🛍️",
        category: "Shopping",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Marina Bay & Gardens",
        activities: [
          "Visit Marina Bay Sands SkyPark",
          "Explore Gardens by the Bay and Cloud Forest",
          "Lunch at a hawker centre (Maxwell or Lau Pa Sat)",
          "Evening light show at Supertree Grove",
        ],
      },
      {
        day: 2,
        title: "Culture & Food",
        activities: [
          "Morning in Little India and Chinatown",
          "Try Hainanese chicken rice and laksa",
          "Afternoon at the National Gallery",
          "Sunset cocktails at rooftop bar",
        ],
      },
      {
        day: 3,
        title: "Sentosa & Shopping",
        activities: [
          "Morning at Sentosa Island or Universal Studios",
          "Lunch at Vivo City",
          "Afternoon shopping on Orchard Road",
          "Farewell dinner at a fine-dining restaurant",
        ],
      },
    ],
    travelTips: [
      "The MRT is incredibly efficient and cheap — get an EZ-Link card for all transit.",
      "Chewing gum is technically banned. Don't bring it into the country.",
      "Hawker centres are the best food in Singapore. Look for stalls with long local queues.",
      "Singapore is hot and humid year-round. Carry an umbrella for sudden tropical downpours.",
    ],
  },
  {
    slug: "kyoto",
    name: "Kyoto",
    country: "Japan",
    continent: "Asia",
    tagline: "Japan's cultural heart — temples, geisha, and zen gardens",
    description:
      "Kyoto was Japan's capital for over a thousand years, and its legacy lives on in 2,000+ temples, traditional tea houses, bamboo groves, and geisha districts. It's the spiritual counterpart to Tokyo's electric energy.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.kyoto),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.kyoto),
    vibes: ["Culture", "Spiritual", "Nature"],
    quickFacts: {
      bestTime: "March – May, October – November",
      language: "Japanese",
      currency: "JPY (¥)",
      timezone: "JST (UTC+9)",
      avgBudget: "$90–140/day",
    },
    highlights: [
      {
        title: "Fushimi Inari Shrine",
        description:
          "Thousands of vermillion torii gates winding up a sacred mountain",
        emoji: "⛩️",
        category: "Culture",
      },
      {
        title: "Arashiyama Bamboo Grove",
        description:
          "Ethereal path through towering bamboo stalks on the city's western edge",
        emoji: "🎋",
        category: "Nature",
      },
      {
        title: "Kinkaku-ji (Golden Pavilion)",
        description:
          "Gold-leaf temple reflected perfectly in a mirror-like pond",
        emoji: "✨",
        category: "Landmark",
      },
      {
        title: "Gion District",
        description:
          "Historic geisha quarter with tea houses, lantern-lit streets, and traditional arts",
        emoji: "🎎",
        category: "Culture",
      },
      {
        title: "Nishiki Market",
        description:
          "Kyoto's 400-year-old kitchen — pickles, matcha sweets, and fresh tofu",
        emoji: "🍵",
        category: "Food",
      },
      {
        title: "Philosopher's Path",
        description:
          "Cherry-tree-lined canal walk connecting temples in the eastern hills",
        emoji: "🌸",
        category: "Nature",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Temples & Shrines",
        activities: [
          "Early morning at Fushimi Inari (beat the crowds)",
          "Visit Kinkaku-ji (Golden Pavilion)",
          "Lunch at Nishiki Market",
          "Afternoon at Kiyomizu-dera Temple",
        ],
      },
      {
        day: 2,
        title: "Bamboo & Geisha",
        activities: [
          "Morning walk through Arashiyama Bamboo Grove",
          "Visit Tenryu-ji Temple and gardens",
          "Afternoon stroll along the Philosopher's Path",
          "Evening in Gion — spot a geisha",
        ],
      },
      {
        day: 3,
        title: "Tea & Tradition",
        activities: [
          "Traditional tea ceremony experience",
          "Visit Ryoan-ji rock garden",
          "Lunch at a traditional kaiseki restaurant",
          "Day trip to Nara to see the deer and Great Buddha",
        ],
      },
    ],
    travelTips: [
      "Get a Kyoto bus day pass for unlimited rides — most temples are accessible by bus.",
      "Visit Fushimi Inari at sunrise to avoid crowds and get magical photos.",
      "Cherry blossom season (late March–mid April) is peak. Book accommodation 3+ months ahead.",
      "Rent a bicycle — Kyoto is flat and cycling is the best way to explore between temples.",
    ],
  },
  {
    slug: "hanoi",
    name: "Hanoi",
    country: "Vietnam",
    continent: "Asia",
    tagline:
      "Thousand-year-old capital with French flair and legendary street food",
    description:
      "Hanoi is a city of contrasts — ancient pagodas sit beside French colonial architecture, motorbike-filled streets open onto tranquil lakes, and steaming bowls of pho are served at every corner. It's chaotic, charming, and utterly captivating.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.hanoi),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.hanoi),
    vibes: ["Culture", "Foodie", "History"],
    quickFacts: {
      bestTime: "October – December",
      language: "Vietnamese",
      currency: "VND (₫)",
      timezone: "ICT (UTC+7)",
      avgBudget: "$25–50/day",
    },
    highlights: [
      {
        title: "Old Quarter",
        description:
          "36 ancient streets each named after the goods once traded there",
        emoji: "🏘️",
        category: "Culture",
      },
      {
        title: "Pho & Street Food",
        description:
          "Legendary soup and bun cha served on tiny plastic stools — a foodie pilgrimage",
        emoji: "🍜",
        category: "Food",
      },
      {
        title: "Hoan Kiem Lake",
        description:
          "Sacred lake in the heart of the city, best at dawn when locals practice tai chi",
        emoji: "🌅",
        category: "Nature",
      },
      {
        title: "Temple of Literature",
        description:
          "Vietnam's first university, founded in 1070 — a peaceful oasis of gardens and courtyards",
        emoji: "🏛️",
        category: "History",
      },
      {
        title: "Ha Long Bay Day Trip",
        description:
          "UNESCO-listed bay with thousands of limestone karsts rising from emerald waters",
        emoji: "⛵",
        category: "Adventure",
      },
      {
        title: "Water Puppet Theatre",
        description:
          "Traditional Vietnamese art form dating back to the 11th century",
        emoji: "🎭",
        category: "Entertainment",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Old Quarter & Street Food",
        activities: [
          "Walk the 36 streets of the Old Quarter",
          "Pho breakfast at a local stall",
          "Visit Hoan Kiem Lake and Ngoc Son Temple",
          "Evening street food tour",
        ],
      },
      {
        day: 2,
        title: "Culture & History",
        activities: [
          "Morning at the Temple of Literature",
          "Visit Ho Chi Minh Mausoleum complex",
          "Lunch at bun cha restaurant",
          "Water puppet show in the evening",
        ],
      },
      {
        day: 3,
        title: "Ha Long Bay",
        activities: [
          "Day trip or overnight cruise to Ha Long Bay",
          "Kayak through limestone karsts",
          "Swim in emerald waters",
          "Seafood lunch on the boat",
        ],
      },
    ],
    travelTips: [
      "Cross the street with confidence — walk slowly and steadily, and the motorbikes will flow around you.",
      "Use Grab (Southeast Asia's Uber) for getting around. Always use the meter or app for taxis.",
      "Egg coffee (ca phe trung) is a Hanoi specialty — try it at Giang Cafe.",
      "Bargain at markets but be respectful. Start at about 50% of the asking price.",
    ],
  },
  {
    slug: "phuket",
    name: "Phuket",
    country: "Thailand",
    continent: "Asia",
    tagline:
      "Thailand's largest island — turquoise waters, jungle hills, and vibrant nightlife",
    description:
      "Phuket is Thailand's beach paradise — from the lively shores of Patong to the quiet coves of Kata and the luxury retreats of Kamala. Beyond the beaches, there are temples, night markets, and island-hopping adventures to Phi Phi and James Bond Island.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.phuket),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.phuket),
    vibes: ["Beach", "Nightlife", "Adventure"],
    quickFacts: {
      bestTime: "November – March",
      language: "Thai",
      currency: "THB (฿)",
      timezone: "ICT (UTC+7)",
      avgBudget: "$40–90/day",
    },
    highlights: [
      {
        title: "Phi Phi Islands",
        description:
          "Day trip to stunning turquoise lagoons and Maya Bay (from The Beach)",
        emoji: "🏝️",
        category: "Beach",
      },
      {
        title: "Patong Beach",
        description:
          "Phuket's most famous beach with watersports, restaurants, and nightlife",
        emoji: "🏖️",
        category: "Beach",
      },
      {
        title: "Big Buddha",
        description:
          "45-meter marble statue sitting atop Nakkerd Hill with panoramic views",
        emoji: "🧘",
        category: "Culture",
      },
      {
        title: "Old Phuket Town",
        description:
          "Sino-Portuguese architecture, street art, and local cafes",
        emoji: "🏘️",
        category: "Culture",
      },
      {
        title: "Phang Nga Bay",
        description:
          "Dramatic limestone karsts including the famous James Bond Island",
        emoji: "⛵",
        category: "Nature",
      },
      {
        title: "Night Markets",
        description:
          "Sunday Walking Street and Naka Market for food, shopping, and live music",
        emoji: "🛍️",
        category: "Shopping",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Beach & Town",
        activities: [
          "Morning at Kata or Karon Beach",
          "Lunch in Old Phuket Town",
          "Visit Big Buddha at sunset",
          "Dinner and nightlife in Patong",
        ],
      },
      {
        day: 2,
        title: "Island Hopping",
        activities: [
          "Full-day boat trip to Phi Phi Islands",
          "Snorkel at Maya Bay and Pileh Lagoon",
          "Beach time on Bamboo Island",
          "Evening night market",
        ],
      },
      {
        day: 3,
        title: "Phang Nga Bay",
        activities: [
          "Morning sea kayaking in Phang Nga Bay",
          "Visit James Bond Island",
          "Lunch at a floating village",
          "Afternoon Thai massage on the beach",
        ],
      },
    ],
    travelTips: [
      "Rent a scooter for freedom, but always wear a helmet and be cautious on hilly roads.",
      "Book island tours through your hotel or a reputable agency — avoid beach touts.",
      "The west coast has the best sunsets and beaches. The east coast is calmer and less touristy.",
      "Always negotiate tuk-tuk prices before getting in, or use the Grab app.",
    ],
  },
  {
    slug: "seoul",
    name: "Seoul",
    country: "South Korea",
    continent: "Asia",
    tagline:
      "K-pop, palaces, and BBQ — tradition meets trend in Asia's coolest capital",
    description:
      "Seoul is a city of contrasts where 600-year-old palaces share the skyline with K-pop billboards and neon-lit streets. The food scene is extraordinary, from sizzling Korean BBQ to street food in Myeongdong, and the nightlife in Hongdae never stops.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.seoul),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.seoul),
    vibes: ["Culture & Tech", "Foodie", "Nightlife"],
    quickFacts: {
      bestTime: "March – May, September – November",
      language: "Korean",
      currency: "KRW (₩)",
      timezone: "KST (UTC+9)",
      avgBudget: "$70–120/day",
    },
    highlights: [
      {
        title: "Gyeongbokgung Palace",
        description:
          "Grand 14th-century palace with changing of the guard ceremony and hanbok rentals",
        emoji: "👑",
        category: "History",
      },
      {
        title: "Myeongdong Shopping",
        description:
          "K-beauty flagship stores, street food, and neon-lit shopping streets",
        emoji: "🛍️",
        category: "Shopping",
      },
      {
        title: "Korean BBQ",
        description:
          "Grill your own meat at a BBQ restaurant — a quintessential Seoul experience",
        emoji: "🥩",
        category: "Food",
      },
      {
        title: "Bukchon Hanok Village",
        description:
          "Traditional Korean houses nestled between palaces with city views",
        emoji: "🏘️",
        category: "Culture",
      },
      {
        title: "Hongdae Nightlife",
        description:
          "University district with live music, clubs, and street performers",
        emoji: "🎵",
        category: "Nightlife",
      },
      {
        title: "N Seoul Tower",
        description:
          "Iconic tower on Namsan Mountain with love locks and panoramic views",
        emoji: "🗼",
        category: "Landmark",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Palaces & Tradition",
        activities: [
          "Morning at Gyeongbokgung Palace (rent a hanbok)",
          "Walk through Bukchon Hanok Village",
          "Lunch at a traditional Korean restaurant",
          "Afternoon at Changdeokgung Secret Garden",
        ],
      },
      {
        day: 2,
        title: "Shopping & Food",
        activities: [
          "Morning shopping in Myeongdong",
          "Try street food: tteokbokki, hotteok, corn dogs",
          "Afternoon at COEX Mall and Starfield Library",
          "Evening Korean BBQ feast",
        ],
      },
      {
        day: 3,
        title: "Nightlife & Views",
        activities: [
          "Cable car up to N Seoul Tower",
          "Explore Itaewon and Yongsan",
          "Visit the War Memorial",
          "Evening in Hongdae for clubs and live music",
        ],
      },
    ],
    travelTips: [
      "Get a T-money card for seamless subway, bus, and convenience store payments.",
      "Download Naver Map — Google Maps is less accurate in South Korea.",
      "Rent a hanbok at Gyeongbokgung for free palace entry and great photos.",
      "Korean BBQ etiquette: the youngest person at the table usually grills the meat.",
    ],
  },
  {
    slug: "jaipur",
    name: "Jaipur",
    country: "India",
    continent: "Asia",
    tagline:
      "The Pink City — Rajasthani royalty, forts, and kaleidoscopic bazaars",
    description:
      "Jaipur is Rajasthan's dazzling capital, painted in shades of pink and gold. Majestic forts crown the surrounding hills, ornate palaces hide behind bustling bazaars, and the food — from dal baati to lassi — is as vibrant as the textiles.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.jaipur),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.jaipur),
    vibes: ["Culture", "History", "Foodie"],
    quickFacts: {
      bestTime: "October – March",
      language: "Hindi / Rajasthani",
      currency: "INR (₹)",
      timezone: "IST (UTC+5:30)",
      avgBudget: "$25–60/day",
    },
    highlights: [
      {
        title: "Amber Fort",
        description:
          "Hilltop fortress-palace with mirror halls, courtyards, and sweeping views",
        emoji: "🏰",
        category: "History",
      },
      {
        title: "Hawa Mahal",
        description: "The iconic Palace of Winds with 953 honeycomb windows",
        emoji: "🏛️",
        category: "Landmark",
      },
      {
        title: "City Palace",
        description:
          "Royal residence blending Rajasthani and Mughal architecture in the heart of the Pink City",
        emoji: "👑",
        category: "Culture",
      },
      {
        title: "Johari Bazaar",
        description:
          "Legendary jewelry and textile market in the old walled city",
        emoji: "💎",
        category: "Shopping",
      },
      {
        title: "Jantar Mantar",
        description:
          "UNESCO-listed astronomical observation site with giant stone instruments",
        emoji: "🔭",
        category: "History",
      },
      {
        title: "Nahargarh Fort",
        description: "Sunset viewpoint overlooking the entire Pink City",
        emoji: "🌅",
        category: "Scenic",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Forts & Palaces",
        activities: [
          "Morning visit to Amber Fort",
          "Explore City Palace and Jantar Mantar",
          "Lunch at a rooftop restaurant near Hawa Mahal",
          "Sunset at Nahargarh Fort",
        ],
      },
      {
        day: 2,
        title: "Bazaars & Culture",
        activities: [
          "Morning at Hawa Mahal",
          "Shop Johari Bazaar for gems and textiles",
          "Traditional Rajasthani thali lunch",
          "Afternoon at Albert Hall Museum",
        ],
      },
      {
        day: 3,
        title: "Day Trip & Farewell",
        activities: [
          "Day trip to Pushkar or Abhaneri stepwell",
          "Visit a local block-printing workshop",
          "Evening cooking class",
          "Farewell dinner at a heritage hotel",
        ],
      },
    ],
    travelTips: [
      "Hire a driver for the day — it's affordable and the easiest way to see the spread-out forts.",
      "Bargain confidently in bazaars — prices for tourists can start at 3-5x the real price.",
      "Visit forts early morning to beat the heat and the tour bus crowds.",
      "Drink only bottled water and be cautious with street food until your stomach adjusts.",
    ],
  },
  {
    slug: "petra",
    name: "Petra",
    country: "Jordan",
    continent: "Asia",
    tagline:
      "The rose-red city half as old as time — carved into desert cliffs",
    description:
      "Petra is one of the New Seven Wonders of the World. Walking through the narrow Siq canyon to find the Treasury carved into rose-red sandstone is one of travel's most breathtaking moments. This ancient Nabataean city dates back to 300 BC.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.petra),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.petra),
    vibes: ["History", "Adventure", "Scenic"],
    quickFacts: {
      bestTime: "March – May, September – November",
      language: "Arabic / English",
      currency: "JOD (د.ا)",
      timezone: "EET (UTC+2)",
      avgBudget: "$60–120/day",
    },
    highlights: [
      {
        title: "The Treasury (Al-Khazneh)",
        description:
          "Petra's iconic carved facade — the moment you emerge from the Siq is unforgettable",
        emoji: "🏛️",
        category: "Landmark",
      },
      {
        title: "The Siq",
        description:
          "1.2km narrow gorge with towering rock walls leading to the Treasury",
        emoji: "🏜️",
        category: "Nature",
      },
      {
        title: "Monastery (Ad Deir)",
        description:
          "800-step climb rewarded with a massive carved facade and desert panoramas",
        emoji: "⛰️",
        category: "Adventure",
      },
      {
        title: "Petra by Night",
        description:
          "The Treasury illuminated by 1,500 candles under the stars",
        emoji: "🕯️",
        category: "Experience",
      },
      {
        title: "Royal Tombs",
        description:
          "Row of enormous carved facades glowing in the afternoon sun",
        emoji: "🏗️",
        category: "History",
      },
      {
        title: "Wadi Rum",
        description:
          "Day trip to the Mars-like desert landscape — jeep tours, camping under stars",
        emoji: "🏜️",
        category: "Adventure",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "The Lost City",
        activities: [
          "Walk through the Siq at sunrise",
          "Marvel at the Treasury",
          "Explore the Street of Facades and Theatre",
          "Climb to the Royal Tombs",
          "Petra by Night (Mon/Wed/Thu)",
        ],
      },
      {
        day: 2,
        title: "Monastery & Beyond",
        activities: [
          "Morning climb to the Monastery (800 steps)",
          "Explore the High Place of Sacrifice trail",
          "Lunch at a Bedouin tent café",
          "Visit the Petra Museum",
        ],
      },
      {
        day: 3,
        title: "Wadi Rum",
        activities: [
          "Drive to Wadi Rum desert",
          "Jeep tour through red sand dunes",
          "Visit natural rock bridges",
          "Overnight in a Bedouin desert camp",
        ],
      },
    ],
    travelTips: [
      "Buy a 2-day Petra pass — the site is enormous and one day isn't enough.",
      "Start early (gates open at 6am) to beat tour groups and the heat.",
      "Wear sturdy shoes and bring plenty of water — you'll walk 8-15km per day.",
      "The Jordan Pass includes Petra entry + visa fee — buy it online before your trip.",
    ],
  },

  // ─── More Europe ─────────────────────────────────────────────────────────
  {
    slug: "amsterdam",
    name: "Amsterdam",
    country: "Netherlands",
    continent: "Europe",
    tagline:
      "Canals, bikes, and masterpieces — Europe's most free-spirited city",
    description:
      "Amsterdam is a city of gabled canal houses, world-class museums, and a famously liberal culture. Cruise the canals, lose yourself in the Rijksmuseum, cycle along tree-lined streets, and discover why this compact city ranks among Europe's finest.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.amsterdam),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.amsterdam),
    vibes: ["Culture", "Nightlife", "Art"],
    quickFacts: {
      bestTime: "April – May (tulip season)",
      language: "Dutch / English",
      currency: "EUR (€)",
      timezone: "CET (UTC+1)",
      avgBudget: "$100–160/day",
    },
    highlights: [
      {
        title: "Rijksmuseum",
        description:
          "Home to Vermeer's Milkmaid and Rembrandt's Night Watch — a must-visit",
        emoji: "🖼️",
        category: "Art",
      },
      {
        title: "Anne Frank House",
        description:
          "The secret annex where Anne Frank wrote her diary during WWII",
        emoji: "📖",
        category: "History",
      },
      {
        title: "Canal Ring",
        description:
          "UNESCO World Heritage canals best explored by boat or bike",
        emoji: "🚤",
        category: "Scenic",
      },
      {
        title: "Vondelpark",
        description:
          "Amsterdam's beloved green heart — perfect for picnics and people-watching",
        emoji: "🌳",
        category: "Nature",
      },
      {
        title: "Jordaan District",
        description:
          "Charming neighborhood with indie boutiques, cafes, and cheese shops",
        emoji: "🧀",
        category: "Culture",
      },
      {
        title: "Keukenhof Gardens",
        description:
          "Seasonal tulip paradise with 7 million flowers (mid-March to mid-May)",
        emoji: "🌷",
        category: "Nature",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Museums & Canals",
        activities: [
          "Morning at the Rijksmuseum",
          "Canal cruise through the center",
          "Lunch in the Jordaan",
          "Anne Frank House (book ahead)",
        ],
      },
      {
        day: 2,
        title: "Neighborhoods",
        activities: [
          "Rent a bike and cycle the canal ring",
          "Explore the Nine Streets shopping area",
          "Afternoon at Vondelpark",
          "Evening in De Pijp — Albert Cuyp Market",
        ],
      },
      {
        day: 3,
        title: "Day Trip",
        activities: [
          "Visit Keukenhof (spring) or Zaanse Schans windmills",
          "Traditional Dutch pancake lunch",
          "Explore the Red Light District (daytime walk)",
          "Farewell dinner on a canal-side terrace",
        ],
      },
    ],
    travelTips: [
      "Book Anne Frank House tickets exactly 6 weeks in advance — they sell out immediately.",
      "Rent a bike from a local shop (not tourist rental). It's the best way to explore.",
      'Dutch people speak excellent English. Learning "dank je" (thank you) is appreciated.',
      "Watch out for bike lanes! Walking in them is the quickest way to upset a local.",
    ],
  },
  {
    slug: "istanbul",
    name: "Istanbul",
    country: "Turkey",
    continent: "Europe",
    tagline: "Where East meets West — mosques, bazaars, and Bosphorus sunsets",
    description:
      "Istanbul straddles two continents and thousands of years of history. The Blue Mosque, Hagia Sophia, and Grand Bazaar sit alongside trendy rooftop bars and a thriving food scene. The Bosphorus strait adds a dramatic backdrop to one of the world's most storied cities.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.istanbul),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.istanbul),
    vibes: ["Culture", "History", "Foodie"],
    quickFacts: {
      bestTime: "April – May, September – November",
      language: "Turkish",
      currency: "TRY (₺)",
      timezone: "TRT (UTC+3)",
      avgBudget: "$50–100/day",
    },
    highlights: [
      {
        title: "Hagia Sophia",
        description:
          "Architectural marvel that spent centuries as a church, then mosque, then museum, now mosque again",
        emoji: "🕌",
        category: "History",
      },
      {
        title: "Grand Bazaar",
        description:
          "One of the world's oldest covered markets with 4,000+ shops",
        emoji: "🛍️",
        category: "Shopping",
      },
      {
        title: "Blue Mosque",
        description:
          "Stunning Ottoman-era mosque with six minarets and intricate blue Iznik tiles",
        emoji: "🕌",
        category: "Culture",
      },
      {
        title: "Bosphorus Cruise",
        description:
          "Sail between Europe and Asia with views of palaces, forts, and bridges",
        emoji: "🚢",
        category: "Experience",
      },
      {
        title: "Topkapi Palace",
        description:
          "Ottoman sultan's residence with treasury, harem, and stunning Bosphorus views",
        emoji: "👑",
        category: "History",
      },
      {
        title: "Turkish Breakfast",
        description:
          "Epic spread of cheeses, olives, eggs, honey, and fresh bread",
        emoji: "🍳",
        category: "Food",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Sultanahmet",
        activities: [
          "Morning at Hagia Sophia",
          "Visit the Blue Mosque",
          "Lunch at a lokanta",
          "Explore Topkapi Palace",
          "Turkish bath (hamam) experience",
        ],
      },
      {
        day: 2,
        title: "Bazaars & Bosphorus",
        activities: [
          "Morning shopping at the Grand Bazaar",
          "Visit the Spice Bazaar",
          "Afternoon Bosphorus ferry cruise",
          "Dinner in Karaköy",
        ],
      },
      {
        day: 3,
        title: "Asian Side & Farewell",
        activities: [
          "Ferry to Kadıköy on the Asian side",
          "Explore the food market and street art",
          "Turkish breakfast spread",
          "Farewell sunset from Galata Tower",
        ],
      },
    ],
    travelTips: [
      "Get an Istanbulkart for transit — it works on ferries, trams, metro, and buses.",
      "Remove your shoes before entering mosques. Women should bring a headscarf.",
      "Use the public ferries for Bosphorus views — they're a fraction of the cost of tourist cruises.",
      "Turkish tea is offered everywhere and refusing is considered impolite. Embrace it!",
    ],
  },
  {
    slug: "prague",
    name: "Prague",
    country: "Czech Republic",
    continent: "Europe",
    tagline:
      "Gothic spires, beer gardens, and fairy-tale charm in the heart of Europe",
    description:
      "Prague is one of Europe's most beautiful cities — a fairy-tale landscape of Gothic churches, Baroque palaces, and winding cobblestone streets. The beer is world-class and cheaper than water, and the Old Town Square rivals any in Europe.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.prague),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.prague),
    vibes: ["History", "Nightlife", "Architecture"],
    quickFacts: {
      bestTime: "April – June, September – October",
      language: "Czech",
      currency: "CZK (Kč)",
      timezone: "CET (UTC+1)",
      avgBudget: "$60–100/day",
    },
    highlights: [
      {
        title: "Charles Bridge",
        description:
          "Iconic 14th-century stone bridge lined with 30 Baroque statues",
        emoji: "🌉",
        category: "Landmark",
      },
      {
        title: "Prague Castle",
        description:
          "The world's largest ancient castle complex with St. Vitus Cathedral",
        emoji: "🏰",
        category: "History",
      },
      {
        title: "Old Town Square",
        description:
          "Medieval square with the Astronomical Clock, Tyn Church, and lively markets",
        emoji: "⏰",
        category: "Culture",
      },
      {
        title: "Czech Beer Culture",
        description:
          "The birthplace of Pilsner — taste world-class lagers at traditional pubs",
        emoji: "🍺",
        category: "Food",
      },
      {
        title: "Petřín Hill",
        description:
          "Hilltop park with a mini Eiffel Tower and panoramic views of the city",
        emoji: "🗼",
        category: "Nature",
      },
      {
        title: "Jewish Quarter",
        description:
          "Historic synagogues and the atmospheric Old Jewish Cemetery",
        emoji: "✡️",
        category: "History",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Old Town",
        activities: [
          "Watch the Astronomical Clock strike the hour",
          "Explore Old Town Square and Tyn Church",
          "Walk across Charles Bridge (go early)",
          "Evening beer at a traditional Czech pub",
        ],
      },
      {
        day: 2,
        title: "Castle & Hills",
        activities: [
          "Morning at Prague Castle and St. Vitus Cathedral",
          "Walk through the charming Lesser Town",
          "Climb Petřín Hill for views",
          "Dinner at a riverside restaurant",
        ],
      },
      {
        day: 3,
        title: "Culture & Beer",
        activities: [
          "Visit the Jewish Quarter and synagogues",
          "Lunch at a classic Czech hospoda",
          "Explore Vinohrady neighborhood",
          "Farewell craft beer crawl",
        ],
      },
    ],
    travelTips: [
      "Cross Charles Bridge at sunrise to avoid the crowds — it gets very packed by 10am.",
      "Czech Republic uses Koruna, not Euro. Currency exchange on the street is often a scam.",
      "Beer is exceptionally cheap — often under $2 for a pint at a local pub.",
      "Tipping 10% is customary in restaurants. Always round up at pubs.",
    ],
  },
  {
    slug: "vienna",
    name: "Vienna",
    country: "Austria",
    continent: "Europe",
    tagline:
      "Imperial grandeur, coffee culture, and the soundtrack of classical music",
    description:
      "Vienna is the city of Mozart, Klimt, and Sachertorte. Grand Hapsburg palaces, elegant coffee houses, and some of Europe's finest museums make it a refined yet surprisingly livable capital. The classical music scene is unmatched anywhere on Earth.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.vienna),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.vienna),
    vibes: ["Culture", "Art", "Foodie"],
    quickFacts: {
      bestTime: "April – October",
      language: "German",
      currency: "EUR (€)",
      timezone: "CET (UTC+1)",
      avgBudget: "$90–150/day",
    },
    highlights: [
      {
        title: "Schönbrunn Palace",
        description:
          "Imperial summer residence with 1,441 rooms and stunning gardens",
        emoji: "👑",
        category: "History",
      },
      {
        title: "Viennese Coffee Houses",
        description:
          "UNESCO-listed tradition — linger over Melange and Sachertorte",
        emoji: "☕",
        category: "Food",
      },
      {
        title: "St. Stephen's Cathedral",
        description:
          "Gothic masterpiece in the heart of the city with panoramic tower views",
        emoji: "⛪",
        category: "Landmark",
      },
      {
        title: "Belvedere Museum",
        description:
          "Home to Klimt's The Kiss and an impressive Austrian art collection",
        emoji: "💋",
        category: "Art",
      },
      {
        title: "Vienna State Opera",
        description:
          "World-class performances in a stunning 19th-century opera house",
        emoji: "🎶",
        category: "Entertainment",
      },
      {
        title: "Naschmarkt",
        description:
          "Vienna's most popular market with international food stalls and antiques",
        emoji: "🍽️",
        category: "Food",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Imperial Vienna",
        activities: [
          "Morning at Schönbrunn Palace and gardens",
          "Traditional Viennese lunch at a Gasthaus",
          "Visit St. Stephen's Cathedral",
          "Evening concert or opera",
        ],
      },
      {
        day: 2,
        title: "Art & Coffee",
        activities: [
          "Morning at the Belvedere (see The Kiss)",
          "Coffee and Sachertorte at Café Central",
          "Explore the MuseumsQuartier",
          "Evening stroll along the Ringstrasse",
        ],
      },
      {
        day: 3,
        title: "Markets & Charm",
        activities: [
          "Brunch at Naschmarkt",
          "Explore the Hofburg Imperial Palace",
          "Afternoon at the Prater amusement park",
          "Farewell Wiener Schnitzel dinner",
        ],
      },
    ],
    travelTips: [
      "Buy standing-room tickets at the Vienna State Opera for as little as €3.",
      "Vienna's tap water comes from the Alps — it's excellent and free everywhere.",
      "The Vienna Card gives unlimited transit plus museum discounts for 24-72 hours.",
      "Tipping 5-10% is standard. Round up your bill at coffee houses.",
    ],
  },
  {
    slug: "dublin",
    name: "Dublin",
    country: "Ireland",
    continent: "Europe",
    tagline:
      "Literary pubs, Celtic heritage, and the friendliest locals in Europe",
    description:
      "Dublin is a city of stories — told over pints of Guinness in centuries-old pubs, in the pages of Joyce and Wilde, and in the music that spills out of every bar on Temple Bar. The craic (fun) is real, and the welcome is legendary.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.dublin),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.dublin),
    vibes: ["Culture", "Nightlife", "History"],
    quickFacts: {
      bestTime: "May – September",
      language: "English / Irish",
      currency: "EUR (€)",
      timezone: "GMT (UTC+0)",
      avgBudget: "$90–150/day",
    },
    highlights: [
      {
        title: "Temple Bar",
        description:
          "Famous cultural quarter with cobblestone streets, live music pubs, and galleries",
        emoji: "🎸",
        category: "Nightlife",
      },
      {
        title: "Guinness Storehouse",
        description:
          "Interactive experience ending with a pint and 360° city views at the Gravity Bar",
        emoji: "🍺",
        category: "Experience",
      },
      {
        title: "Trinity College & Book of Kells",
        description:
          "9th-century illuminated manuscript in a stunning Long Room library",
        emoji: "📚",
        category: "History",
      },
      {
        title: "St. Patrick's Cathedral",
        description:
          "Ireland's largest church, founded in 1191 beside an ancient holy well",
        emoji: "⛪",
        category: "Culture",
      },
      {
        title: "Cliffs of Moher Day Trip",
        description: "Dramatic 700-foot sea cliffs on the Wild Atlantic Way",
        emoji: "🌊",
        category: "Nature",
      },
      {
        title: "Traditional Music Sessions",
        description:
          "Impromptu live trad music in pubs across the city — every night of the week",
        emoji: "🎵",
        category: "Entertainment",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "History & Pints",
        activities: [
          "Morning at Trinity College and Book of Kells",
          "Walk through Georgian Dublin",
          "Afternoon at Guinness Storehouse",
          "Evening pub crawl in Temple Bar",
        ],
      },
      {
        day: 2,
        title: "Culture & Coast",
        activities: [
          "Visit Kilmainham Gaol",
          "Lunch at a traditional Irish pub",
          "DART train to the seaside village of Howth",
          "Fresh seafood and cliff walk",
        ],
      },
      {
        day: 3,
        title: "Day Trip & Farewell",
        activities: [
          "Day trip to the Cliffs of Moher or Glendalough",
          "Explore the Irish countryside",
          "Return for a farewell traditional music session",
          "Fish and chips supper",
        ],
      },
    ],
    travelTips: [
      "Irish weather is unpredictable — always carry a rain jacket, even in summer.",
      "The DART coastal train is a scenic and affordable way to explore the coast.",
      "Tipping 10-15% is standard at sit-down restaurants but not expected at pubs.",
      "Avoid Temple Bar for food and drinks — it's overpriced. Walk two blocks for better value.",
    ],
  },
  {
    slug: "copenhagen",
    name: "Copenhagen",
    country: "Denmark",
    continent: "Europe",
    tagline:
      "Design capital of the world — bikes, hygge, and New Nordic cuisine",
    description:
      "Copenhagen is the epitome of Scandinavian cool. Colorful Nyhavn, innovative New Nordic restaurants, and impeccable design are everywhere. The Danes have mastered hygge (cozy contentment), and you'll feel it in every candlelit café and waterfront terrace.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.copenhagen),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.copenhagen),
    vibes: ["Design", "Foodie", "Culture"],
    quickFacts: {
      bestTime: "May – September",
      language: "Danish / English",
      currency: "DKK (kr)",
      timezone: "CET (UTC+1)",
      avgBudget: "$120–200/day",
    },
    highlights: [
      {
        title: "Nyhavn",
        description:
          "Colorful 17th-century waterfront with boats, cafes, and iconic pastel houses",
        emoji: "🏘️",
        category: "Landmark",
      },
      {
        title: "Tivoli Gardens",
        description:
          "Enchanting 19th-century amusement park in the heart of the city",
        emoji: "🎢",
        category: "Entertainment",
      },
      {
        title: "New Nordic Cuisine",
        description:
          "Home of Noma and the New Nordic movement — world-class dining",
        emoji: "🍽️",
        category: "Food",
      },
      {
        title: "Christiania",
        description:
          "Self-proclaimed autonomous neighborhood with street art and alternative culture",
        emoji: "🎨",
        category: "Culture",
      },
      {
        title: "The Little Mermaid",
        description: "Iconic bronze statue on the Langelinie promenade",
        emoji: "🧜",
        category: "Landmark",
      },
      {
        title: "Cycling Culture",
        description:
          "Explore the city like a local on one of the best cycling networks in the world",
        emoji: "🚲",
        category: "Experience",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Icons & Hygge",
        activities: [
          "Stroll along Nyhavn for coffee and photos",
          "Visit The Little Mermaid",
          "Explore Kastellet fortress",
          "Afternoon at Tivoli Gardens",
          "Dinner at a New Nordic restaurant",
        ],
      },
      {
        day: 2,
        title: "Design & Culture",
        activities: [
          "Rent a bike and explore the city",
          "Visit the Design Museum",
          "Lunch at Torvehallerne food market",
          "Explore Christiania",
          "Sunset canal boat tour",
        ],
      },
      {
        day: 3,
        title: "Day Trip",
        activities: [
          "Train to Kronborg Castle (Hamlet's castle)",
          "Or visit Louisiana Museum of Modern Art",
          "Return for smørrebrød lunch",
          "Farewell dinner at a local wine bar",
        ],
      },
    ],
    travelTips: [
      "Get the Copenhagen Card for free transit and 80+ attraction entries.",
      "Rent a bike — Copenhagen is incredibly flat and cycle-friendly.",
      "Copenhagen is expensive. Save money by eating smørrebrød (open sandwiches) for lunch.",
      "Almost nobody uses cash. Card and mobile payments work everywhere.",
    ],
  },
  {
    slug: "interlaken",
    name: "Interlaken",
    country: "Switzerland",
    continent: "Europe",
    tagline:
      "Adventure capital of Switzerland nestled between two alpine lakes",
    description:
      "Interlaken sits between Lakes Thun and Brienz, surrounded by the Eiger, Mönch, and Jungfrau peaks. It's the launchpad for Switzerland's most iconic mountain scenery and Europe's premier adventure sports destination.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.interlaken),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.interlaken),
    vibes: ["Adventure", "Nature", "Scenic"],
    quickFacts: {
      bestTime: "June – September (summer), December – March (skiing)",
      language: "German / French",
      currency: "CHF (Fr)",
      timezone: "CET (UTC+1)",
      avgBudget: "$150–300/day",
    },
    highlights: [
      {
        title: "Jungfraujoch",
        description:
          "Top of Europe — train to 3,454m for glacier views and ice palace",
        emoji: "🏔️",
        category: "Landmark",
      },
      {
        title: "Paragliding",
        description:
          "Tandem paraglide over the lakes with Alpine peaks all around",
        emoji: "🪂",
        category: "Adventure",
      },
      {
        title: "Lake Brienz",
        description: "Crystal-clear turquoise lake with scenic boat cruises",
        emoji: "🚤",
        category: "Nature",
      },
      {
        title: "Grindelwald First",
        description:
          "Cliff walk, zip line, and mountain cart rides with Eiger views",
        emoji: "🎿",
        category: "Adventure",
      },
      {
        title: "Lauterbrunnen Valley",
        description: "Valley of 72 waterfalls surrounded by sheer cliff walls",
        emoji: "🌊",
        category: "Nature",
      },
      {
        title: "Harder Kulm",
        description:
          "Panoramic viewpoint overlooking both lakes and the Jungfrau massif",
        emoji: "👀",
        category: "Scenic",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Lakes & Views",
        activities: [
          "Take the funicular up Harder Kulm for panoramic views",
          "Boat cruise on Lake Thun",
          "Walk through Interlaken town center",
          "Swiss fondue dinner",
        ],
      },
      {
        day: 2,
        title: "Jungfraujoch",
        activities: [
          "Train to Jungfraujoch Top of Europe",
          "Visit the Ice Palace and Sphinx Observatory",
          "Walk on the Aletsch Glacier",
          "Evening in Grindelwald village",
        ],
      },
      {
        day: 3,
        title: "Adventure Day",
        activities: [
          "Morning paragliding over the lakes",
          "Visit Lauterbrunnen and Staubbach Falls",
          "Take the train to Mürren village",
          "Farewell dinner with mountain views",
        ],
      },
    ],
    travelTips: [
      "The Swiss Travel Pass gives unlimited train/bus/boat travel and mountain discounts.",
      "Switzerland is very expensive. Self-cater at Coop or Migros supermarkets to save.",
      "Book the Jungfraujoch train early and check the webcam for clear weather before going.",
      "The SBB Mobile app is essential for Swiss train schedules and tickets.",
    ],
  },
  {
    slug: "amalfi-coast",
    name: "Amalfi Coast",
    country: "Italy",
    continent: "Europe",
    tagline: "Cliffside villages, turquoise waters, and limoncello at sunset",
    description:
      "The Amalfi Coast is a 50km stretch of Mediterranean perfection — pastel villages cling to dramatic cliffs, winding roads reveal new panoramas at every turn, and the scent of lemon groves fills the air. Positano, Amalfi, and Ravello each offer their own magic.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations["amalfi-coast"]),
    cardImage: getImageUrl(IMAGE_PATHS.destinations["amalfi-coast"]),
    vibes: ["Scenic", "Romance", "Foodie"],
    quickFacts: {
      bestTime: "May – June, September – October",
      language: "Italian",
      currency: "EUR (€)",
      timezone: "CET (UTC+1)",
      avgBudget: "$120–250/day",
    },
    highlights: [
      {
        title: "Positano",
        description:
          "Cascading pastel village tumbling down to a pebble beach — the Amalfi icon",
        emoji: "🏘️",
        category: "Scenic",
      },
      {
        title: "Path of the Gods",
        description:
          "Spectacular clifftop hiking trail with views of the entire coastline",
        emoji: "🥾",
        category: "Adventure",
      },
      {
        title: "Ravello",
        description:
          "Hilltop garden town with Villa Rufolo, classical concerts, and infinite views",
        emoji: "🎶",
        category: "Culture",
      },
      {
        title: "Amalfi Cathedral",
        description:
          "Striking 9th-century cathedral with Arab-Norman architecture",
        emoji: "⛪",
        category: "History",
      },
      {
        title: "Limoncello Tasting",
        description:
          "Tour a lemon grove and taste the coast's famous lemon liqueur",
        emoji: "🍋",
        category: "Food",
      },
      {
        title: "Capri Day Trip",
        description:
          "Island of glamour with the Blue Grotto, chairlift to Monte Solaro, and designer shopping",
        emoji: "🏝️",
        category: "Day Trip",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Positano",
        activities: [
          "Arrive and settle into your hotel with sea views",
          "Walk down to Positano beach",
          "Lunch at a cliffside restaurant",
          "Sunset aperitivo with limoncello",
        ],
      },
      {
        day: 2,
        title: "Amalfi & Ravello",
        activities: [
          "SITA bus or ferry to Amalfi town",
          "Visit Amalfi Cathedral",
          "Bus up to Ravello and Villa Rufolo gardens",
          "Dinner overlooking the coast",
        ],
      },
      {
        day: 3,
        title: "Hike & Capri",
        activities: [
          "Morning: Path of the Gods hike",
          "Or day trip to Capri by ferry",
          "Visit the Blue Grotto",
          "Farewell seafood dinner in Positano",
        ],
      },
    ],
    travelTips: [
      "Rent a private boat for the best coastal experience — split costs with others to save.",
      "The SITA buses are cheap but packed in summer. Ferries between towns are more pleasant.",
      "Visit in shoulder season (May or September) to avoid extreme crowds and heat.",
      "Wear comfortable shoes — the Amalfi Coast is all stairs and steep paths.",
    ],
  },
  {
    slug: "ibiza",
    name: "Ibiza",
    country: "Spain",
    continent: "Europe",
    tagline: "World-famous clubs, hidden coves, and Balearic sunsets",
    description:
      "Ibiza is more than just a party island. Yes, the clubs are legendary, but beyond the DJ booths lie whitewashed villages, pine-fringed coves, yoga retreats, and some of the Mediterranean's most beautiful beaches. It's two islands in one.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.ibiza),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.ibiza),
    vibes: ["Nightlife", "Beach", "Wellness"],
    quickFacts: {
      bestTime: "May – October",
      language: "Spanish / Catalan",
      currency: "EUR (€)",
      timezone: "CET (UTC+1)",
      avgBudget: "$100–200/day",
    },
    highlights: [
      {
        title: "Ushuaïa & Pacha",
        description:
          "World-famous superclubs hosting the biggest DJs on the planet",
        emoji: "🎧",
        category: "Nightlife",
      },
      {
        title: "Dalt Vila",
        description:
          "UNESCO World Heritage walled old town with panoramic views",
        emoji: "🏰",
        category: "History",
      },
      {
        title: "Cala Comte",
        description:
          "Stunning multi-layered turquoise cove — one of the Med's best beaches",
        emoji: "🏖️",
        category: "Beach",
      },
      {
        title: "Es Vedrà",
        description:
          "Mystical rock island rising from the sea — best viewed at sunset from Cala d'Hort",
        emoji: "🪨",
        category: "Scenic",
      },
      {
        title: "Hippy Markets",
        description:
          "Las Dalias and Punta Arabí markets with artisan crafts and live music",
        emoji: "🌸",
        category: "Shopping",
      },
      {
        title: "Formentera Day Trip",
        description:
          "Ferry to the tiny sister island with Caribbean-clear waters and quiet beaches",
        emoji: "⛵",
        category: "Day Trip",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Town & Beach",
        activities: [
          "Explore Dalt Vila old town",
          "Lunch at Ibiza port",
          "Afternoon at Cala Comte beach",
          "Sunset dinner overlooking Es Vedrà",
        ],
      },
      {
        day: 2,
        title: "Formentera & Clubs",
        activities: [
          "Ferry to Formentera for the day",
          "Swim at Illetes beach",
          "Return for dinner in San Antonio",
          "Night at Ushuaïa or Amnesia",
        ],
      },
      {
        day: 3,
        title: "Markets & Chill",
        activities: [
          "Morning yoga on the beach",
          "Visit Las Dalias hippy market",
          "Explore Santa Gertrudis village",
          "Farewell beach club sunset at Café del Mar",
        ],
      },
    ],
    travelTips: [
      "Club tickets are cheaper when bought online in advance — door prices are significantly higher.",
      "Rent a car or scooter to explore the hidden coves and north of the island.",
      "Ibiza has two sides: west coast for sunsets and parties, east coast for quiet coves.",
      "Water and food in clubs is very expensive. Pre-drink and eat before going out.",
    ],
  },
  {
    slug: "chamonix",
    name: "Chamonix",
    country: "France",
    continent: "Europe",
    tagline:
      "At the foot of Mont Blanc — Alpine adventure at its most dramatic",
    description:
      "Chamonix-Mont-Blanc is the birthplace of modern mountaineering and home to Europe's highest peak. In winter it's a world-class ski destination; in summer it offers spectacular hiking, paragliding, and the famous Aiguille du Midi cable car ride.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.chamonix),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.chamonix),
    vibes: ["Adventure", "Nature", "Scenic"],
    quickFacts: {
      bestTime: "June – September (hiking), December – March (skiing)",
      language: "French",
      currency: "EUR (€)",
      timezone: "CET (UTC+1)",
      avgBudget: "$120–250/day",
    },
    highlights: [
      {
        title: "Aiguille du Midi",
        description:
          "Cable car to 3,842m for close-up views of Mont Blanc and the French Alps",
        emoji: "🚡",
        category: "Landmark",
      },
      {
        title: "Mont Blanc",
        description:
          "Western Europe's highest peak (4,808m) — the ultimate mountaineering challenge",
        emoji: "🏔️",
        category: "Adventure",
      },
      {
        title: "Mer de Glace",
        description:
          "France's largest glacier, accessible by heritage mountain railway",
        emoji: "🧊",
        category: "Nature",
      },
      {
        title: "Lac Blanc",
        description:
          "Iconic alpine lake reflecting the Mont Blanc massif — classic day hike",
        emoji: "🏞️",
        category: "Nature",
      },
      {
        title: "Ski Resorts",
        description:
          "Vallée Blanche off-piste descent and Grands Montets for expert skiing",
        emoji: "⛷️",
        category: "Adventure",
      },
      {
        title: "Chamonix Town",
        description:
          "Charming Alpine village with excellent restaurants, bars, and outdoor gear shops",
        emoji: "🏘️",
        category: "Culture",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Peaks & Views",
        activities: [
          "Morning cable car to Aiguille du Midi",
          "Walk on the glass Step into the Void platform",
          "Train to Mer de Glace glacier",
          "Evening dinner in Chamonix town",
        ],
      },
      {
        day: 2,
        title: "Hiking Day",
        activities: [
          "Hike to Lac Blanc (5-6 hours round trip)",
          "Picnic lunch with Mont Blanc views",
          "Afternoon swim in a mountain lake",
          "Dinner at a mountain refuge",
        ],
      },
      {
        day: 3,
        title: "Adventure & Chill",
        activities: [
          "Morning paragliding over the valley",
          "Or take the Tramway du Mont-Blanc",
          "Lunch at a mountain chalet",
          "Farewell fondue dinner",
        ],
      },
    ],
    travelTips: [
      "The Mont Blanc Unlimited pass covers all cable cars, trains, and mountain transport.",
      "Book Aiguille du Midi tickets online — it sells out in peak season.",
      "Weather changes fast in the mountains. Always carry layers and check forecasts.",
      "The Chamonix bus is free with a guest card from your accommodation.",
    ],
  },

  // ─── Americas ────────────────────────────────────────────────────────────
  {
    slug: "cancun",
    name: "Cancun",
    country: "Mexico",
    continent: "Americas",
    tagline: "Caribbean beaches, Mayan ruins, and all-inclusive paradise",
    description:
      "Cancun combines powdery white beaches and turquoise Caribbean water with ancient Mayan history and a buzzing nightlife. Beyond the Hotel Zone, you'll find the underwater museum, cenotes for swimming, and the ruins of Chichén Itzá within day-trip distance.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.cancun),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.cancun),
    vibes: ["Beach", "Nightlife", "History"],
    quickFacts: {
      bestTime: "December – April",
      language: "Spanish",
      currency: "MXN ($)",
      timezone: "EST (UTC-5)",
      avgBudget: "$80–150/day",
    },
    highlights: [
      {
        title: "Hotel Zone Beaches",
        description:
          "Miles of white sand and turquoise water along a narrow island strip",
        emoji: "🏖️",
        category: "Beach",
      },
      {
        title: "Chichén Itzá",
        description:
          "One of the New Seven Wonders — Mayan pyramid and ancient city",
        emoji: "🏛️",
        category: "History",
      },
      {
        title: "Cenotes",
        description:
          "Swim in mystical underground limestone sinkholes sacred to the Maya",
        emoji: "💧",
        category: "Nature",
      },
      {
        title: "Isla Mujeres",
        description:
          "Laid-back island with snorkeling, golf carts, and stunning Playa Norte",
        emoji: "🏝️",
        category: "Beach",
      },
      {
        title: "MUSA Underwater Museum",
        description: "Snorkel or dive among 500+ submerged sculptures",
        emoji: "🤿",
        category: "Art",
      },
      {
        title: "Tulum Ruins",
        description:
          "Clifftop Mayan ruins overlooking a pristine Caribbean beach",
        emoji: "🏗️",
        category: "History",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Beach & Island",
        activities: [
          "Morning at the Hotel Zone beach",
          "Ferry to Isla Mujeres",
          "Snorkeling and Playa Norte",
          "Sunset dinner back in Cancun",
        ],
      },
      {
        day: 2,
        title: "Cenotes & Culture",
        activities: [
          "Swim in a cenote (Ik Kil or Suytun)",
          "Visit Chichén Itzá",
          "Traditional Yucatecan lunch",
          "Evening at Downtown Cancun",
        ],
      },
      {
        day: 3,
        title: "Tulum & Fun",
        activities: [
          "Day trip to Tulum ruins",
          "Beach time below the ruins",
          "Cenote swim at Gran Cenote",
          "Farewell dinner and nightlife in the Hotel Zone",
        ],
      },
    ],
    travelTips: [
      "ADO buses are comfortable and cheap for Chichén Itzá and Tulum day trips.",
      "Avoid the hurricane season (August–October). December–April is ideal.",
      "Drink bottled water only. Be cautious with ice in drinks outside resorts.",
      "Use pesos instead of USD for better prices at local restaurants and shops.",
    ],
  },
  {
    slug: "rio-de-janeiro",
    name: "Rio de Janeiro",
    country: "Brazil",
    continent: "Americas",
    tagline:
      "Samba rhythms, golden beaches, and a Christ who watches over it all",
    description:
      "Rio de Janeiro is a city of dramatic beauty — Sugarloaf Mountain and Christ the Redeemer overlook sweeping white-sand beaches, lush forests, and a population that knows how to celebrate life. Carnival is just the exclamation point on a year-round party.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations["rio-de-janeiro"]),
    cardImage: getImageUrl(IMAGE_PATHS.destinations["rio-de-janeiro"]),
    vibes: ["Beach", "Nightlife", "Culture"],
    quickFacts: {
      bestTime: "May – October (winter, dry)",
      language: "Portuguese",
      currency: "BRL (R$)",
      timezone: "BRT (UTC-3)",
      avgBudget: "$50–100/day",
    },
    highlights: [
      {
        title: "Christ the Redeemer",
        description:
          "One of the New Seven Wonders — iconic statue atop Corcovado mountain",
        emoji: "✝️",
        category: "Landmark",
      },
      {
        title: "Sugarloaf Mountain",
        description:
          "Cable car to the peak for 360° views of beaches, city, and mountains",
        emoji: "🚡",
        category: "Scenic",
      },
      {
        title: "Copacabana & Ipanema",
        description:
          "World-famous beaches with volleyball, caipirinhas, and stunning sunsets",
        emoji: "🏖️",
        category: "Beach",
      },
      {
        title: "Carnival",
        description:
          "The world's biggest party — samba schools, parades, and street blocos",
        emoji: "🎭",
        category: "Culture",
      },
      {
        title: "Tijuca Forest",
        description:
          "Urban rainforest with hiking trails, waterfalls, and wildlife",
        emoji: "🌴",
        category: "Nature",
      },
      {
        title: "Santa Teresa",
        description:
          "Bohemian hillside neighborhood with art studios, restaurants, and Selarón Steps",
        emoji: "🎨",
        category: "Culture",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Icons",
        activities: [
          "Morning train up to Christ the Redeemer",
          "Cable car to Sugarloaf Mountain",
          "Lunch in Urca neighborhood",
          "Afternoon at Ipanema Beach",
          "Sunset caipirinhas",
        ],
      },
      {
        day: 2,
        title: "Beaches & Culture",
        activities: [
          "Morning at Copacabana Beach",
          "Visit the Selarón Steps and Santa Teresa",
          "Lunch at a traditional boteco",
          "Evening samba at Lapa",
        ],
      },
      {
        day: 3,
        title: "Nature & Farewell",
        activities: [
          "Hike in Tijuca Forest",
          "Visit the Botanical Garden",
          "Afternoon at Leblon Beach",
          "Farewell churrascaria dinner",
        ],
      },
    ],
    travelTips: [
      "Use Uber — it's safe, cheap, and widely available. Avoid unmarked taxis.",
      "Don't bring valuables to the beach. Use a waterproof pouch for essentials.",
      "Learn basic Portuguese. Unlike some tourist cities, English isn't widely spoken.",
      "Visit during winter (May–Oct) for lower prices and fewer crowds but still warm weather.",
    ],
  },
  {
    slug: "costa-rica",
    name: "Costa Rica",
    country: "Costa Rica",
    continent: "Americas",
    tagline: "Pura vida — rainforests, volcanoes, and two oceans of adventure",
    description:
      "Costa Rica is a nature-lover's paradise packed into a small country. From cloud forests and active volcanoes to Pacific surf breaks and Caribbean coral reefs, it's one of the most biodiverse places on Earth. The local motto \"Pura Vida\" says it all.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations["costa-rica"]),
    cardImage: getImageUrl(IMAGE_PATHS.destinations["costa-rica"]),
    vibes: ["Nature", "Adventure", "Wildlife"],
    quickFacts: {
      bestTime: "December – April (dry season)",
      language: "Spanish",
      currency: "CRC (₡) / USD accepted",
      timezone: "CST (UTC-6)",
      avgBudget: "$60–120/day",
    },
    highlights: [
      {
        title: "Arenal Volcano",
        description:
          "Perfectly conical volcano with hot springs, zip lines, and lush trails",
        emoji: "🌋",
        category: "Nature",
      },
      {
        title: "Monteverde Cloud Forest",
        description:
          "Misty reserve with hanging bridges, quetzals, and incredible biodiversity",
        emoji: "🌿",
        category: "Nature",
      },
      {
        title: "Manuel Antonio",
        description:
          "National park with white-sand beaches, monkeys, and jungle trails",
        emoji: "🐒",
        category: "Wildlife",
      },
      {
        title: "Zip Lining",
        description:
          "Fly through the rainforest canopy — Costa Rica invented the zip line tour",
        emoji: "🏄",
        category: "Adventure",
      },
      {
        title: "Surf Towns",
        description:
          "Tamarindo and Santa Teresa offer world-class Pacific surf breaks",
        emoji: "🏄",
        category: "Beach",
      },
      {
        title: "Tortuguero",
        description: "Sea turtle nesting site accessible only by boat or plane",
        emoji: "🐢",
        category: "Wildlife",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Arenal",
        activities: [
          "Drive or fly to La Fortuna",
          "Hike around Arenal Volcano",
          "Zip line through the canopy",
          "Evening at volcanic hot springs",
        ],
      },
      {
        day: 2,
        title: "Cloud Forest",
        activities: [
          "Drive to Monteverde",
          "Hanging bridges walk in the cloud forest",
          "Look for the resplendent quetzal",
          "Night wildlife tour",
        ],
      },
      {
        day: 3,
        title: "Beach & Wildlife",
        activities: [
          "Transfer to Manuel Antonio",
          "Morning in the national park (monkeys, sloths, beaches)",
          "Snorkeling or kayaking",
          "Farewell sunset on the beach",
        ],
      },
    ],
    travelTips: [
      "Rent a 4x4 — many roads are unpaved and river crossings are common.",
      "Bring rain gear year-round. Even in dry season, the cloud forest is wet.",
      "USD is widely accepted, but carry colones for rural areas and small vendors.",
      "Book activities through your hotel — they know reputable operators and get you the best prices.",
    ],
  },
  {
    slug: "buenos-aires",
    name: "Buenos Aires",
    country: "Argentina",
    continent: "Americas",
    tagline:
      "The Paris of South America — tango, steak, and late-night passion",
    description:
      "Buenos Aires pulses with European elegance and Latin American fire. Tree-lined boulevards, colorful neighborhoods, world-class steakhouses, and tango halls that don't open until midnight make it one of the most seductive cities on the planet.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations["buenos-aires"]),
    cardImage: getImageUrl(IMAGE_PATHS.destinations["buenos-aires"]),
    vibes: ["Culture", "Foodie", "Nightlife"],
    quickFacts: {
      bestTime: "March – May, September – November",
      language: "Spanish",
      currency: "ARS ($)",
      timezone: "ART (UTC-3)",
      avgBudget: "$40–80/day",
    },
    highlights: [
      {
        title: "La Boca & Caminito",
        description:
          "Colorful street in the historic port district — birthplace of tango",
        emoji: "💃",
        category: "Culture",
      },
      {
        title: "Asado & Steakhouses",
        description:
          "Argentine beef grilled to perfection at parillas — a carnivore's dream",
        emoji: "🥩",
        category: "Food",
      },
      {
        title: "Recoleta Cemetery",
        description:
          "Ornate mausoleum where Eva Perón rests among the elite of Buenos Aires",
        emoji: "🏛️",
        category: "History",
      },
      {
        title: "San Telmo Market",
        description:
          "Sunday antique market with tango dancers, street food, and vintage finds",
        emoji: "🛍️",
        category: "Shopping",
      },
      {
        title: "Tango Shows",
        description:
          "From touristy dinner shows to authentic milongas — tango is everywhere",
        emoji: "🎶",
        category: "Entertainment",
      },
      {
        title: "Palermo",
        description:
          "Trendy neighborhood with designer boutiques, craft cocktails, and leafy parks",
        emoji: "🌳",
        category: "Urban",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "History & Tango",
        activities: [
          "Walk through La Boca and Caminito",
          "Visit Recoleta Cemetery",
          "Afternoon coffee at a traditional café",
          "Evening tango show at a milonga",
        ],
      },
      {
        day: 2,
        title: "Markets & Meat",
        activities: [
          "Sunday at San Telmo antique market",
          "Street tango and live music",
          "Asado lunch at a top parilla",
          "Explore Palermo Soho and Hollywood",
        ],
      },
      {
        day: 3,
        title: "Culture & Nightlife",
        activities: [
          "Visit MALBA modern art museum",
          "Stroll through the Bosques de Palermo",
          "Dinner at a closed-door restaurant (puerta cerrada)",
          "Late-night tango milonga",
        ],
      },
    ],
    travelTips: [
      "Argentines eat late — dinner rarely starts before 9pm, nightlife kicks off after midnight.",
      'Bring USD cash and exchange at "cuevas" (blue dollar exchange) for much better rates than banks.',
      "Tipping 10% is standard at restaurants. Cover charges are common and separate.",
      "The Subte (subway) is cheap but closes early. Use Uber or Cabify for late-night travel.",
    ],
  },
  {
    slug: "havana",
    name: "Havana",
    country: "Cuba",
    continent: "Americas",
    tagline: "Vintage cars, crumbling grandeur, and the rhythm of son cubano",
    description:
      "Havana is a time capsule of colonial architecture, 1950s American cars, and revolutionary history. The music flows from every balcony, the Malecón seawall buzzes at sunset, and the warmth of the people is unmatched. It's unlike anywhere else.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.havana),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.havana),
    vibes: ["Culture", "History", "Music"],
    quickFacts: {
      bestTime: "November – April",
      language: "Spanish",
      currency: "CUP (₱) / USD",
      timezone: "CST (UTC-5)",
      avgBudget: "$40–80/day",
    },
    highlights: [
      {
        title: "Old Havana (Habana Vieja)",
        description:
          "UNESCO World Heritage colonial quarter with plazas, cathedrals, and faded grandeur",
        emoji: "🏘️",
        category: "History",
      },
      {
        title: "Malecón",
        description:
          "Iconic 8km seafront promenade — Havana's living room at sunset",
        emoji: "🌅",
        category: "Experience",
      },
      {
        title: "Classic Car Tour",
        description: "Cruise the city in a pink 1957 Chevy convertible",
        emoji: "🚗",
        category: "Experience",
      },
      {
        title: "La Bodeguita del Medio",
        description: "Hemingway's favorite bar — the birthplace of the mojito",
        emoji: "🍹",
        category: "Food",
      },
      {
        title: "Fábrica de Arte Cubano",
        description:
          "Havana's coolest cultural space with art, music, and dancing",
        emoji: "🎨",
        category: "Culture",
      },
      {
        title: "Viñales Valley",
        description:
          "Day trip to stunning tobacco country with mogote hills and cave systems",
        emoji: "🌄",
        category: "Nature",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Old Havana",
        activities: [
          "Explore the plazas of Habana Vieja",
          "Mojito at La Bodeguita del Medio",
          "Classic car tour around the city",
          "Sunset on the Malecón",
        ],
      },
      {
        day: 2,
        title: "Culture & Music",
        activities: [
          "Visit the Museum of the Revolution",
          "Walk through Centro Havana",
          "Afro-Cuban rumba performance",
          "Night at Fábrica de Arte Cubano",
        ],
      },
      {
        day: 3,
        title: "Viñales",
        activities: [
          "Day trip to Viñales Valley",
          "Visit a tobacco farm",
          "Cave and mogote exploration",
          "Return for farewell dinner at a paladar",
        ],
      },
    ],
    travelTips: [
      "Bring cash (USD or EUR) — credit cards from US banks don't work. ATMs are unreliable.",
      "Stay in a casa particular (private home) for an authentic and affordable experience.",
      "Internet is limited. Buy ETECSA WiFi cards at hotels or parks.",
      "Negotiate prices before getting in a taxi. Ask your casa host for fair rates.",
    ],
  },
  {
    slug: "vancouver",
    name: "Vancouver",
    country: "Canada",
    continent: "Americas",
    tagline: "Mountains meet ocean in Canada's most beautiful city",
    description:
      "Vancouver is where snow-capped mountains meet the Pacific Ocean. Ski in the morning, kayak in the afternoon, and dine on world-class Asian fusion in the evening. Stanley Park, Granville Island, and the city's diversity make it endlessly explorable.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.vancouver),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.vancouver),
    vibes: ["Nature", "Foodie", "Urban"],
    quickFacts: {
      bestTime: "June – September",
      language: "English / French",
      currency: "CAD (C$)",
      timezone: "PST (UTC-8)",
      avgBudget: "$100–180/day",
    },
    highlights: [
      {
        title: "Stanley Park",
        description:
          "1,000-acre urban park with a seawall, totem poles, and rainforest trails",
        emoji: "🌲",
        category: "Nature",
      },
      {
        title: "Granville Island",
        description:
          "Vibrant market peninsula with artisan food, galleries, and craft breweries",
        emoji: "🍽️",
        category: "Food",
      },
      {
        title: "Grouse Mountain",
        description:
          "City-accessible mountain with hiking, skiing, and grizzly bear refuge",
        emoji: "🏔️",
        category: "Adventure",
      },
      {
        title: "Capilano Suspension Bridge",
        description:
          "Walk 70m above the rainforest floor on a swaying 137m bridge",
        emoji: "🌉",
        category: "Nature",
      },
      {
        title: "Gastown",
        description:
          "Historic neighborhood with a steam clock, independent shops, and restaurants",
        emoji: "⏰",
        category: "Culture",
      },
      {
        title: "Asian Food Scene",
        description:
          "Some of the best Chinese, Japanese, and Korean food outside of Asia",
        emoji: "🥢",
        category: "Food",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Urban Nature",
        activities: [
          "Bike the Stanley Park seawall",
          "Explore Granville Island Market",
          "Walk through Gastown",
          "Dinner in Yaletown",
        ],
      },
      {
        day: 2,
        title: "Mountain Day",
        activities: [
          "Morning at Capilano Suspension Bridge",
          "Grouse Mountain Grind hike (or gondola up)",
          "Lunch at the peak",
          "Afternoon in Chinatown",
          "Sushi dinner on Robson Street",
        ],
      },
      {
        day: 3,
        title: "Coast & Farewell",
        activities: [
          "Ferry to Bowen Island or Deep Cove",
          "Kayaking in Indian Arm",
          "Return for craft beer in the breweries district",
          "Farewell dinner at a farm-to-table restaurant",
        ],
      },
    ],
    travelTips: [
      "The SkyTrain from the airport to downtown is convenient and affordable.",
      "Vancouver rain is legendary (Oct–Mar). Always have a rain jacket handy.",
      "Rent a bike for Stanley Park — it's the best way to see the seawall.",
      "Dim sum in Richmond (just south of the city) rivals Hong Kong.",
    ],
  },

  // ─── Africa ──────────────────────────────────────────────────────────────
  {
    slug: "cairo",
    name: "Cairo",
    country: "Egypt",
    continent: "Africa",
    tagline: "The Pyramids, the Nile, and 5,000 years of civilization",
    description:
      "Cairo is the gateway to ancient Egypt — the Pyramids of Giza and the Sphinx sit on the city's edge, the Egyptian Museum holds Tutankhamun's treasures, and the city's chaotic energy, street food, and Islamic architecture are an adventure unto themselves.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.cairo),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.cairo),
    vibes: ["History", "Culture", "Adventure"],
    quickFacts: {
      bestTime: "October – April",
      language: "Arabic / English",
      currency: "EGP (E£)",
      timezone: "EET (UTC+2)",
      avgBudget: "$30–70/day",
    },
    highlights: [
      {
        title: "Pyramids of Giza",
        description:
          "The last surviving Wonder of the Ancient World — 4,500 years of awe",
        emoji: "🏜️",
        category: "Landmark",
      },
      {
        title: "Grand Egyptian Museum",
        description:
          "Brand-new museum housing 100,000+ artifacts including Tutankhamun's collection",
        emoji: "🏛️",
        category: "History",
      },
      {
        title: "Khan el-Khalili",
        description:
          "Labyrinthine medieval bazaar with spices, lanterns, and silver jewelry",
        emoji: "🛍️",
        category: "Shopping",
      },
      {
        title: "Islamic Cairo",
        description:
          "Historic district with stunning mosques, madrasas, and Fatimid architecture",
        emoji: "🕌",
        category: "Culture",
      },
      {
        title: "Nile Dinner Cruise",
        description: "Evening cruise with dinner and traditional belly dancing",
        emoji: "🚢",
        category: "Experience",
      },
      {
        title: "Saqqara Step Pyramid",
        description: "Egypt's oldest pyramid and the tomb that started it all",
        emoji: "🏗️",
        category: "History",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Pyramids Day",
        activities: [
          "Morning at the Pyramids of Giza and Sphinx",
          "Camel ride at the pyramids viewpoint",
          "Visit Saqqara Step Pyramid",
          "Evening Nile dinner cruise",
        ],
      },
      {
        day: 2,
        title: "Museums & Bazaars",
        activities: [
          "Morning at the Grand Egyptian Museum",
          "Walk through Islamic Cairo",
          "Lunch at a koshari restaurant",
          "Afternoon bargaining at Khan el-Khalili",
        ],
      },
      {
        day: 3,
        title: "Coptic Cairo & Farewell",
        activities: [
          "Visit Coptic Cairo and the Hanging Church",
          "Explore the Citadel and Muhammad Ali Mosque",
          "Egyptian street food tour",
          "Farewell shisha and tea",
        ],
      },
    ],
    travelTips: [
      "Hire a private guide for the Pyramids — it's affordable and keeps persistent touts at bay.",
      "Cairo traffic is legendary. Use Uber/Careem and plan extra time for every journey.",
      "Dress modestly, especially when visiting mosques. Women should carry a scarf.",
      "Bargain everywhere except restaurants. Expect to pay 30-50% of the first asking price.",
    ],
  },
  {
    slug: "zanzibar",
    name: "Zanzibar",
    country: "Tanzania",
    continent: "Africa",
    tagline:
      "Spice island paradise — turquoise water, coral reefs, and Stone Town history",
    description:
      "Zanzibar is a tropical archipelago off Tanzania's coast, famed for pristine white-sand beaches, vibrant coral reefs, and the UNESCO-listed Stone Town with its spice markets, carved wooden doors, and Swahili heritage.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.zanzibar),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.zanzibar),
    vibes: ["Beach", "Culture", "Nature"],
    quickFacts: {
      bestTime: "June – October (dry season)",
      language: "Swahili / English",
      currency: "TZS (TSh) / USD accepted",
      timezone: "EAT (UTC+3)",
      avgBudget: "$40–100/day",
    },
    highlights: [
      {
        title: "Stone Town",
        description:
          "UNESCO World Heritage labyrinth of spice markets, bazaars, and sultan palaces",
        emoji: "🏘️",
        category: "History",
      },
      {
        title: "Nungwi Beach",
        description:
          "Stunning white-sand beach on the northern tip with the best swimming",
        emoji: "🏖️",
        category: "Beach",
      },
      {
        title: "Spice Tour",
        description:
          "Visit a spice farm to see vanilla, clove, cinnamon, and nutmeg growing",
        emoji: "🌿",
        category: "Experience",
      },
      {
        title: "Mnemba Atoll",
        description:
          "Snorkeling and diving paradise with dolphins, turtles, and tropical fish",
        emoji: "🐠",
        category: "Nature",
      },
      {
        title: "Jozani Forest",
        description:
          "Home to the rare red colobus monkey found nowhere else on Earth",
        emoji: "🐒",
        category: "Wildlife",
      },
      {
        title: "Forodhani Night Market",
        description:
          "Waterfront food market with grilled seafood, sugarcane juice, and Zanzibar pizza",
        emoji: "🍢",
        category: "Food",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Stone Town",
        activities: [
          "Guided walk through Stone Town's narrow streets",
          "Visit the Sultan's Palace and House of Wonders",
          "Spice tour in the afternoon",
          "Dinner at Forodhani Night Market",
        ],
      },
      {
        day: 2,
        title: "Beach Day",
        activities: [
          "Transfer to Nungwi or Kendwa beach",
          "Swim and relax on white sand",
          "Snorkeling trip to Mnemba Atoll",
          "Beach bonfire at sunset",
        ],
      },
      {
        day: 3,
        title: "Nature & Farewell",
        activities: [
          "Morning at Jozani Forest for red colobus monkeys",
          "Visit a seaweed farm",
          "Afternoon dhow sailing trip",
          "Farewell seafood dinner on the beach",
        ],
      },
    ],
    travelTips: [
      "Zanzibar is largely Muslim — dress modestly in Stone Town (cover shoulders and knees).",
      "USD is widely accepted but carry small denominations — change for large bills is hard to find.",
      "Book boat transfers in advance if visiting Mnemba or other islands.",
      "Negotiate taxi prices before getting in. Ask your hotel for standard rates.",
    ],
  },

  // ─── Oceania ───────────────────────────────────────────────────────────────
  {
    slug: "queenstown",
    name: "Queenstown",
    country: "New Zealand",
    continent: "Oceania",
    tagline:
      "Adventure capital of the world — bungee, ski, and Middle-earth magic",
    description:
      "Queenstown sits on the shores of Lake Wakatipu surrounded by the Remarkables mountain range. It's New Zealand's premier adventure destination — bungee jumping, jet boating, skiing, and the gateway to Milford Sound. Lord of the Rings fans will feel at home.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.queenstown),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.queenstown),
    vibes: ["Adventure", "Nature", "Scenic"],
    quickFacts: {
      bestTime: "December – March (summer), June – August (skiing)",
      language: "English",
      currency: "NZD (NZ$)",
      timezone: "NZST (UTC+12)",
      avgBudget: "$100–200/day",
    },
    highlights: [
      {
        title: "Bungee Jumping",
        description:
          "The birthplace of bungee — jump from the Kawarau Bridge or Nevis (134m)",
        emoji: "🤸",
        category: "Adventure",
      },
      {
        title: "Milford Sound",
        description:
          "Fiordland cruise through dramatic peaks, waterfalls, and dolphins",
        emoji: "🌊",
        category: "Nature",
      },
      {
        title: "Ski Resorts",
        description:
          "Remarkables and Coronet Peak for world-class Southern Alps skiing",
        emoji: "⛷️",
        category: "Adventure",
      },
      {
        title: "Skyline Gondola",
        description:
          "Ride to Bob's Peak for panoramic lake and mountain views plus luge rides",
        emoji: "🚡",
        category: "Scenic",
      },
      {
        title: "Jet Boating",
        description: "High-speed 360° spins through the Shotover Canyon",
        emoji: "🚤",
        category: "Adventure",
      },
      {
        title: "Glenorchy",
        description:
          "Lord of the Rings filming location with pristine lake and mountain scenery",
        emoji: "🧝",
        category: "Nature",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Lake & Town",
        activities: [
          "Skyline Gondola and luge rides",
          "Walk along Lake Wakatipu",
          "Explore Queenstown's restaurants and shops",
          "Fergburger for dinner (legendary burgers)",
        ],
      },
      {
        day: 2,
        title: "Adventure Day",
        activities: [
          "Morning bungee at Kawarau Bridge",
          "Jet boat ride on Shotover River",
          "Afternoon at Onsen Hot Pools",
          "Evening at a craft brewery",
        ],
      },
      {
        day: 3,
        title: "Milford Sound",
        activities: [
          "Day trip to Milford Sound (scenic drive)",
          "Cruise through the fiord",
          "Stop at Mirror Lakes",
          "Return via Te Anau",
        ],
      },
    ],
    travelTips: [
      "Book Milford Sound tours well in advance — it's a long drive (4+ hours each way).",
      "Rent a car for flexibility. The drives around Queenstown are spectacularly scenic.",
      "Weather can change rapidly. Bring layers even in summer.",
      "The Combos (multi-activity packages) save money if you plan on doing multiple adventures.",
    ],
  },
  {
    slug: "maldives",
    name: "Maldives",
    country: "Maldives",
    continent: "Asia",
    tagline:
      "Overwater villas, crystal lagoons, and the most turquoise water on Earth",
    description:
      "The Maldives is the ultimate tropical escape — 1,200 islands scattered across 26 atolls in the Indian Ocean. Overwater bungalows, glass-floor villas, world-class diving, and sunsets that look photoshopped. It's paradise, plain and simple.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.maldives),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.maldives),
    vibes: ["Beach", "Luxury", "Romance"],
    quickFacts: {
      bestTime: "November – April (dry season)",
      language: "Dhivehi / English",
      currency: "MVR (Rf) / USD accepted",
      timezone: "MVT (UTC+5)",
      avgBudget: "$200–500/day",
    },
    highlights: [
      {
        title: "Overwater Villas",
        description:
          "Stay in a villa perched above crystal-clear lagoon with glass floors",
        emoji: "🏝️",
        category: "Accommodation",
      },
      {
        title: "Snorkeling with Mantas",
        description:
          "Swim alongside manta rays at Hanifaru Bay — a bucket-list experience",
        emoji: "🐠",
        category: "Adventure",
      },
      {
        title: "Bioluminescent Beach",
        description:
          "Magical glowing plankton lights up the shore at night on some islands",
        emoji: "✨",
        category: "Nature",
      },
      {
        title: "Diving",
        description:
          "World-class reef and wreck diving with whale sharks, turtles, and coral gardens",
        emoji: "🤿",
        category: "Adventure",
      },
      {
        title: "Underwater Restaurant",
        description:
          "Dine surrounded by ocean life at the world's first all-glass undersea restaurant",
        emoji: "🍽️",
        category: "Experience",
      },
      {
        title: "Sandbank Picnics",
        description:
          "Private lunch on a tiny uninhabited sandbar in the middle of the ocean",
        emoji: "🏖️",
        category: "Experience",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Arrival in Paradise",
        activities: [
          "Seaplane or speedboat transfer to your resort",
          "Settle into your overwater villa",
          "Afternoon snorkeling off your deck",
          "Sunset cruise on a dhoni boat",
        ],
      },
      {
        day: 2,
        title: "Ocean Adventures",
        activities: [
          "Morning diving or snorkeling trip",
          "Sandbank picnic lunch",
          "Afternoon spa treatment over the water",
          "Stargazing from your villa deck",
        ],
      },
      {
        day: 3,
        title: "Island Life",
        activities: [
          "Sunrise yoga on the beach",
          "Kayak or paddleboard in the lagoon",
          "Visit a local island for Maldivian culture",
          "Farewell dinner on the beach",
        ],
      },
    ],
    travelTips: [
      "Budget option: stay at guesthouses on local islands instead of resorts for 1/10th the price.",
      "Alcohol is only available at resorts — local islands are dry.",
      "The Maldives is a Muslim country. Dress modestly on local islands (bikinis only at resorts/bikini beaches).",
      "Book seaplane transfers early — they only operate during daylight hours.",
    ],
  },

  // ─── Oceania (continued) ─────────────────────────────────────────────────
  {
    slug: "sydney",
    name: "Sydney",
    country: "Australia",
    continent: "Oceania",
    tagline: "Iconic harbor, golden beaches, and laid-back Australian vibes",
    description:
      "Sydney is where stunning natural beauty meets a cosmopolitan city. The Opera House and Harbour Bridge form one of the world's most recognizable skylines, while Bondi Beach, the Blue Mountains, and a thriving food scene make it a destination that truly has it all.",
    heroImage: getImageUrl(IMAGE_PATHS.destinations.sydney),
    cardImage: getImageUrl(IMAGE_PATHS.destinations.sydney),
    vibes: ["Beach", "Urban", "Nature"],
    quickFacts: {
      bestTime: "September – November, March – May",
      language: "English",
      currency: "AUD ($)",
      timezone: "AEST (UTC+10)",
      avgBudget: "$100–180/day",
    },
    highlights: [
      {
        title: "Sydney Opera House",
        description:
          "Architectural masterpiece on the harbor — catch a show or take a tour",
        emoji: "🎭",
        category: "Landmark",
      },
      {
        title: "Bondi to Coogee Walk",
        description:
          "6km coastal trail past golden beaches, ocean pools, and clifftop views",
        emoji: "🏖️",
        category: "Nature",
      },
      {
        title: "Harbour Bridge Climb",
        description:
          "Scale the iconic bridge for 360° views of the harbor and city",
        emoji: "🌉",
        category: "Adventure",
      },
      {
        title: "The Rocks",
        description:
          "Historic waterfront neighborhood with markets, pubs, and Aboriginal art",
        emoji: "🏘️",
        category: "Culture",
      },
      {
        title: "Blue Mountains",
        description:
          "Day trip to dramatic valleys, eucalyptus forests, and the Three Sisters",
        emoji: "🏔️",
        category: "Nature",
      },
      {
        title: "Taronga Zoo",
        description:
          "Wildlife park with views of the Opera House — meet koalas and platypuses",
        emoji: "🐨",
        category: "Wildlife",
      },
    ],
    sampleItinerary: [
      {
        day: 1,
        title: "Harbor Icons",
        activities: [
          "Morning at the Sydney Opera House",
          "Walk through The Rocks and weekend markets",
          "Ferry across to Manly Beach",
          "Sunset from Mrs Macquarie's Chair",
        ],
      },
      {
        day: 2,
        title: "Beach Day",
        activities: [
          "Morning Bondi to Coogee coastal walk",
          "Swim and brunch in Bondi",
          "Afternoon at Taronga Zoo via ferry",
          "Dinner in Surry Hills",
        ],
      },
      {
        day: 3,
        title: "Blue Mountains",
        activities: [
          "Day trip to Blue Mountains (2hr train)",
          "See the Three Sisters at Echo Point",
          "Scenic World rides",
          "Return for a farewell dinner at Circular Quay",
        ],
      },
    ],
    travelTips: [
      "Get an Opal card for trains, buses, and ferries. The ferry to Manly is essentially a scenic harbor cruise.",
      "Australian sun is intense — wear SPF 50+ even on cloudy days.",
      "Eat at the local RSL or bowling clubs for surprisingly good and affordable meals.",
      "Tipping is not expected in Australia, but rounding up is appreciated for great service.",
    ],
  },
];

// ─── Helper functions ────────────────────────────────────────────────────────

export function getAllGuides(): DestinationGuide[] {
  return destinationGuides;
}

export function getGuideBySlug(slug: string): DestinationGuide | undefined {
  return destinationGuides.find((d) => d.slug === slug);
}

export function getGuideSlugs(): string[] {
  return destinationGuides.map((d) => d.slug);
}

export function getGuidesByContinent(continent: string): DestinationGuide[] {
  if (continent === "All") return destinationGuides;
  return destinationGuides.filter((d) => d.continent === continent);
}

export function getContinents(): string[] {
  return [
    "All",
    ...Array.from(new Set(destinationGuides.map((d) => d.continent))),
  ];
}
