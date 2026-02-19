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
  continent: 'Asia' | 'Europe' | 'Americas' | 'Africa' | 'Oceania';
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
    slug: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    continent: 'Asia',
    tagline: 'Where ancient tradition meets neon-lit innovation',
    description:
      'Tokyo dazzles with its blend of ultra-modern skyscrapers, serene temples, world-class cuisine, and quirky pop culture. From the bustling streets of Shibuya to the peaceful gardens of Meiji Shrine, every corner tells a different story.',
    heroImage: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1920&q=85',
    cardImage: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
    vibes: ['Culture & Tech', 'Foodie', 'Urban'],
    quickFacts: {
      bestTime: 'March – May, Sep – Nov',
      language: 'Japanese',
      currency: 'JPY (¥)',
      timezone: 'JST (UTC+9)',
      avgBudget: '$100–150/day',
    },
    highlights: [
      { title: 'Shibuya Crossing', description: 'The world\'s busiest pedestrian intersection — an iconic Tokyo experience', emoji: '🚶', category: 'Landmark' },
      { title: 'Tsukiji Outer Market', description: 'Fresh sushi, tamagoyaki, and street food from the legendary fish market area', emoji: '🍣', category: 'Food' },
      { title: 'Meiji Shrine', description: 'A tranquil Shinto shrine surrounded by lush forest in the heart of the city', emoji: '⛩️', category: 'Culture' },
      { title: 'Akihabara', description: 'Electric Town — anime, manga, gaming, and gadget paradise', emoji: '🎮', category: 'Entertainment' },
      { title: 'Shinjuku Gyoen', description: 'One of Tokyo\'s most beautiful gardens, stunning during cherry blossom season', emoji: '🌸', category: 'Nature' },
      { title: 'TeamLab Borderless', description: 'Immersive digital art museum that blurs the line between art and visitor', emoji: '🎨', category: 'Art' },
    ],
    sampleItinerary: [
      { day: 1, title: 'Arrival & Shibuya', activities: ['Land at Narita/Haneda and take express to hotel', 'Explore Shibuya Crossing and Hachiko statue', 'Dinner at a local izakaya in Shinjuku'] },
      { day: 2, title: 'Temples & Markets', activities: ['Morning at Meiji Shrine and Harajuku', 'Lunch at Tsukiji Outer Market', 'Afternoon in Asakusa and Senso-ji Temple', 'Evening stroll along Sumida River'] },
      { day: 3, title: 'Culture & Pop', activities: ['Morning at Shinjuku Gyoen gardens', 'Explore Akihabara\'s electric town', 'Visit TeamLab Borderless', 'Farewell ramen in Golden Gai'] },
    ],
    travelTips: [
      'Get a Suica/Pasmo IC card for seamless transit — it works on trains, buses, and vending machines.',
      'Most restaurants don\'t accept tips. Bowing slightly when thanking staff is appreciated.',
      'Download Google Translate with the Japanese offline pack — many signs are only in Japanese.',
      'Visit convenience stores (7-Eleven, Lawson) for surprisingly excellent food and ATMs that accept foreign cards.',
    ],
  },
  {
    slug: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    continent: 'Asia',
    tagline: 'Island of the gods — beaches, rice terraces, and spiritual calm',
    description:
      'Bali offers an enchanting mix of pristine beaches, emerald rice paddies, ancient temples, and a thriving wellness scene. Whether you\'re surfing in Canggu, exploring Ubud\'s art markets, or watching the sunset at Uluwatu, Bali casts a spell you won\'t soon forget.',
    heroImage: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1920&q=85',
    cardImage: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80',
    vibes: ['Beach & Wellness', 'Nature', 'Culture'],
    quickFacts: {
      bestTime: 'April – October (dry season)',
      language: 'Indonesian / Balinese',
      currency: 'IDR (Rp)',
      timezone: 'WITA (UTC+8)',
      avgBudget: '$40–80/day',
    },
    highlights: [
      { title: 'Tegallalang Rice Terraces', description: 'Iconic tiered rice paddies with jungle swing photo ops and cafe views', emoji: '🌾', category: 'Nature' },
      { title: 'Uluwatu Temple', description: 'Clifftop temple with breathtaking sunset views and traditional Kecak dance', emoji: '⛩️', category: 'Culture' },
      { title: 'Ubud Monkey Forest', description: 'Sacred sanctuary with playful macaques and ancient moss-covered statues', emoji: '🐒', category: 'Nature' },
      { title: 'Seminyak Beach', description: 'Trendy beach with upscale beach clubs, sunset cocktails, and surf vibes', emoji: '🏖️', category: 'Beach' },
      { title: 'Tirta Empul', description: 'Sacred water temple where locals and visitors participate in purification rituals', emoji: '💧', category: 'Spiritual' },
      { title: 'Canggu Surf Scene', description: 'Laid-back surf town with coworking spaces, smoothie bowls, and great waves', emoji: '🏄', category: 'Adventure' },
    ],
    sampleItinerary: [
      { day: 1, title: 'Arrive & Seminyak', activities: ['Arrive at Ngurah Rai airport', 'Check into Seminyak villa', 'Sunset at Potato Head Beach Club', 'Dinner at a warung (local restaurant)'] },
      { day: 2, title: 'Ubud Culture Day', activities: ['Morning yoga class', 'Explore Tegallalang Rice Terraces', 'Visit Ubud Monkey Forest', 'Afternoon at Ubud Art Market'] },
      { day: 3, title: 'Temple & Beach', activities: ['Morning purification at Tirta Empul', 'Lunch overlooking the valley', 'Afternoon at Uluwatu Temple', 'Kecak dance at sunset'] },
    ],
    travelTips: [
      'Rent a scooter for maximum flexibility, but always wear a helmet and carry your international driving permit.',
      'Bargaining is expected at markets — start at about 40% of the asking price.',
      'Dress modestly when visiting temples. Sarongs are often provided at entrances.',
      'The tap water is not safe to drink. Stick to bottled or filtered water.',
    ],
  },
  {
    slug: 'bangkok',
    name: 'Bangkok',
    country: 'Thailand',
    continent: 'Asia',
    tagline: 'A sensory overload of temples, street food, and vibrant night markets',
    description:
      'Bangkok is a city that never sleeps — a chaotic, beautiful blend of glittering temples, legendary street food, rooftop bars, and floating markets. From the Grand Palace to Khao San Road, it\'s a feast for every sense.',
    heroImage: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1920&q=85',
    cardImage: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&q=80',
    vibes: ['Foodie', 'Culture', 'Nightlife'],
    quickFacts: {
      bestTime: 'November – February',
      language: 'Thai',
      currency: 'THB (฿)',
      timezone: 'ICT (UTC+7)',
      avgBudget: '$30–60/day',
    },
    highlights: [
      { title: 'Grand Palace', description: 'Dazzling complex of buildings that served as the royal residence for 150 years', emoji: '👑', category: 'Landmark' },
      { title: 'Wat Arun', description: 'Temple of Dawn — a stunning riverside pagoda beautifully lit at night', emoji: '🌅', category: 'Culture' },
      { title: 'Chatuchak Weekend Market', description: 'One of the world\'s largest markets with over 15,000 stalls', emoji: '🛍️', category: 'Shopping' },
      { title: 'Street Food on Yaowarat', description: 'Chinatown\'s legendary food street with Michelin-rated stalls', emoji: '🍜', category: 'Food' },
      { title: 'Rooftop Bars', description: 'Sky-high cocktails with panoramic city views at Sirocco or Octave', emoji: '🍸', category: 'Nightlife' },
      { title: 'Floating Markets', description: 'Colorful canal-side markets selling fresh produce, souvenirs, and pad thai from boats', emoji: '🛶', category: 'Experience' },
    ],
    sampleItinerary: [
      { day: 1, title: 'Temples & Palace', activities: ['Visit the Grand Palace and Wat Phra Kaew', 'Lunch by the river', 'Ferry to Wat Arun for sunset views', 'Evening street food in Chinatown'] },
      { day: 2, title: 'Markets & Culture', activities: ['Morning at Chatuchak Weekend Market', 'Thai massage in the afternoon', 'Explore Khao San Road', 'Rooftop cocktails at sunset'] },
      { day: 3, title: 'Day Trip & Farewell', activities: ['Morning floating market trip', 'Afternoon Thai cooking class', 'Farewell dinner at a riverside restaurant'] },
    ],
    travelTips: [
      'Use the BTS Skytrain and MRT to avoid Bangkok\'s legendary traffic jams.',
      'Always carry cash for street food and markets — most don\'t accept cards.',
      'Stay hydrated! Bangkok is hot year-round. Carry a water bottle.',
      'Download the Grab app — it\'s Southeast Asia\'s Uber and works perfectly in Bangkok.',
    ],
  },
  {
    slug: 'dubai',
    name: 'Dubai',
    country: 'UAE',
    continent: 'Asia',
    tagline: 'From desert dunes to futuristic skylines — a city of superlatives',
    description:
      'Dubai pushes every boundary — the tallest building, the largest mall, and man-made islands visible from space. Beyond the glitz, you\'ll find traditional souks, desert adventures, and some of the world\'s best dining.',
    heroImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1920&q=85',
    cardImage: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80',
    vibes: ['Luxury', 'Urban', 'Adventure'],
    quickFacts: {
      bestTime: 'November – March',
      language: 'Arabic / English',
      currency: 'AED (د.إ)',
      timezone: 'GST (UTC+4)',
      avgBudget: '$120–200/day',
    },
    highlights: [
      { title: 'Burj Khalifa', description: 'The world\'s tallest building at 828m — observation deck views are jaw-dropping', emoji: '🏗️', category: 'Landmark' },
      { title: 'Desert Safari', description: 'Dune bashing, camel rides, and BBQ dinner under the stars', emoji: '🐪', category: 'Adventure' },
      { title: 'Dubai Mall', description: 'The world\'s largest mall with an aquarium, ice rink, and 1,200+ stores', emoji: '🛍️', category: 'Shopping' },
      { title: 'Palm Jumeirah', description: 'Iconic palm-shaped island with luxury resorts and Atlantis waterpark', emoji: '🏝️', category: 'Beach' },
      { title: 'Gold & Spice Souks', description: 'Traditional markets in Old Dubai with gold, frankincense, and saffron', emoji: '✨', category: 'Culture' },
      { title: 'Dubai Marina', description: 'Waterfront promenade with dining, yachts, and stunning skyscraper views', emoji: '🌃', category: 'Urban' },
    ],
    sampleItinerary: [
      { day: 1, title: 'Downtown Dubai', activities: ['Visit Burj Khalifa observation deck', 'Explore Dubai Mall and aquarium', 'Watch the Dubai Fountain show at sunset'] },
      { day: 2, title: 'Old & New', activities: ['Morning at Gold and Spice Souks', 'Abra boat ride across Dubai Creek', 'Afternoon at Palm Jumeirah & Atlantis', 'Dinner at Dubai Marina'] },
      { day: 3, title: 'Desert & Departure', activities: ['Morning beach time at JBR', 'Afternoon desert safari with dune bashing', 'BBQ dinner under the stars'] },
    ],
    travelTips: [
      'Dress modestly in public areas outside hotels and beach clubs — cover shoulders and knees.',
      'The Metro is clean, air-conditioned, and connects all major attractions.',
      'Friday is the weekend day — many businesses close or have reduced hours.',
      'Alcohol is available in licensed restaurants and hotels, but public intoxication is illegal.',
    ],
  },

  // ─── Europe ────────────────────────────────────────────────────────────────
  {
    slug: 'paris',
    name: 'Paris',
    country: 'France',
    continent: 'Europe',
    tagline: 'The City of Light — romance, art, and croissants in every arrondissement',
    description:
      'Paris is timeless. Whether you\'re gazing at the Eiffel Tower, wandering through the Louvre, or sipping coffee at a sidewalk café in Le Marais, every moment feels like a scene from a movie. The city\'s art, cuisine, and architecture are unmatched.',
    heroImage: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1920&q=85',
    cardImage: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80',
    vibes: ['Romance & Art', 'Foodie', 'Culture'],
    quickFacts: {
      bestTime: 'April – June, Sep – Oct',
      language: 'French',
      currency: 'EUR (€)',
      timezone: 'CET (UTC+1)',
      avgBudget: '$120–180/day',
    },
    highlights: [
      { title: 'Eiffel Tower', description: 'The iconic iron lattice tower — best viewed from Trocadéro or at night when it sparkles', emoji: '🗼', category: 'Landmark' },
      { title: 'Louvre Museum', description: 'Home to the Mona Lisa and 380,000 other works — plan at least half a day', emoji: '🖼️', category: 'Art' },
      { title: 'Montmartre', description: 'Charming hilltop village with Sacré-Cœur, street artists, and sweeping city views', emoji: '🎨', category: 'Culture' },
      { title: 'Le Marais', description: 'Historic district with boutiques, falafel shops, and Paris\'s best people-watching', emoji: '🥐', category: 'Food' },
      { title: 'Seine River Cruise', description: 'Glide past Notre-Dame, the Louvre, and the Musée d\'Orsay at golden hour', emoji: '🚢', category: 'Experience' },
      { title: 'Versailles Day Trip', description: 'The opulent palace and gardens of Louis XIV, just 40 minutes from central Paris', emoji: '👑', category: 'History' },
    ],
    sampleItinerary: [
      { day: 1, title: 'Icons of Paris', activities: ['Morning at the Eiffel Tower and Trocadéro', 'Lunch at a brasserie near Champ de Mars', 'Afternoon at the Louvre', 'Evening Seine river cruise'] },
      { day: 2, title: 'Art & Neighborhoods', activities: ['Morning walk through Montmartre to Sacré-Cœur', 'Lunch in Le Marais', 'Explore the Latin Quarter and Shakespeare & Co bookshop', 'Dinner in Saint-Germain-des-Prés'] },
      { day: 3, title: 'Versailles & Farewell', activities: ['Day trip to Palace of Versailles', 'Wander the gardens and Grand Trianon', 'Return to Paris for a farewell dinner'] },
    ],
    travelTips: [
      'Buy a Paris Museum Pass (2 or 4 days) to skip lines at 50+ museums and monuments.',
      'The Métro is the fastest way to get around. A carnet of 10 tickets saves money.',
      'Service is included in all restaurant bills — no need to tip beyond rounding up.',
      'Learn a few French phrases. Starting with "Bonjour" goes a long way with locals.',
    ],
  },
  {
    slug: 'barcelona',
    name: 'Barcelona',
    country: 'Spain',
    continent: 'Europe',
    tagline: 'Sun, Gaudí, and tapas on the Mediterranean coast',
    description:
      'Barcelona blends beach life with architectural wonder. Gaudí\'s Sagrada Família, the vibrant La Rambla, and the hidden corners of the Gothic Quarter make it one of Europe\'s most dynamic cities. Add world-class tapas and you have perfection.',
    heroImage: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=1920&q=85',
    cardImage: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80',
    vibes: ['Beach & Culture', 'Foodie', 'Architecture'],
    quickFacts: {
      bestTime: 'May – June, September',
      language: 'Spanish / Catalan',
      currency: 'EUR (€)',
      timezone: 'CET (UTC+1)',
      avgBudget: '$80–130/day',
    },
    highlights: [
      { title: 'Sagrada Família', description: 'Gaudí\'s unfinished masterpiece — a basilica like nothing else on Earth', emoji: '⛪', category: 'Architecture' },
      { title: 'Park Güell', description: 'Whimsical mosaic terraces and panoramic views of the city and sea', emoji: '🦎', category: 'Art' },
      { title: 'La Boqueria Market', description: 'Vibrant food market on La Rambla with fresh juices, jamón, and seafood tapas', emoji: '🍇', category: 'Food' },
      { title: 'Gothic Quarter', description: 'Medieval labyrinth of narrow streets, plazas, and hidden bars', emoji: '🏛️', category: 'Culture' },
      { title: 'Barceloneta Beach', description: 'City beach where locals and visitors sunbathe, swim, and play volleyball', emoji: '🏖️', category: 'Beach' },
      { title: 'Camp Nou', description: 'Legendary home stadium of FC Barcelona — a must for football fans', emoji: '⚽', category: 'Sports' },
    ],
    sampleItinerary: [
      { day: 1, title: 'Gaudí & Gothic', activities: ['Morning at Sagrada Família (book tickets in advance)', 'Walk through the Gothic Quarter', 'Tapas lunch at La Boqueria', 'Evening paseo along La Rambla'] },
      { day: 2, title: 'Park & Beach', activities: ['Morning at Park Güell', 'Lunch in Gràcia neighborhood', 'Afternoon at Barceloneta Beach', 'Sunset cocktails at a chiringuito'] },
      { day: 3, title: 'Local Life', activities: ['Explore El Born and Picasso Museum', 'Vermouth hour at a local bar', 'Late lunch paella by the harbor', 'Farewell flamenco show'] },
    ],
    travelTips: [
      'Book Sagrada Família tickets weeks in advance — they sell out fast.',
      'Beware of pickpockets on La Rambla and in crowded tourist areas.',
      'Spaniards eat late: lunch at 2pm, dinner after 9pm. Plan accordingly.',
      'The T-Casual metro pass gives you 10 rides at a discount.',
    ],
  },
  {
    slug: 'santorini',
    name: 'Santorini',
    country: 'Greece',
    continent: 'Europe',
    tagline: 'White-washed cliffs, blue domes, and the most famous sunset in the world',
    description:
      'Santorini is the poster child of the Greek islands — dramatic caldera views, iconic blue-domed churches, black-sand beaches, and sunsets that stop you in your tracks. It\'s romance and relaxation distilled into one volcanic island.',
    heroImage: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=1920&q=85',
    cardImage: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800&q=80',
    vibes: ['Scenic & Romantic', 'Beach', 'Relaxation'],
    quickFacts: {
      bestTime: 'April – October',
      language: 'Greek',
      currency: 'EUR (€)',
      timezone: 'EET (UTC+2)',
      avgBudget: '$100–180/day',
    },
    highlights: [
      { title: 'Oia Sunset', description: 'The world\'s most photographed sunset — arrive early to claim a spot', emoji: '🌅', category: 'Experience' },
      { title: 'Fira to Oia Hike', description: '10km clifftop trail with jaw-dropping caldera views the entire way', emoji: '🥾', category: 'Adventure' },
      { title: 'Red Beach', description: 'Dramatic red volcanic cliffs meeting deep blue Aegean waters', emoji: '🏖️', category: 'Beach' },
      { title: 'Wine Tasting', description: 'Volcanic soil produces unique Assyrtiko whites — visit a cliffside winery', emoji: '🍷', category: 'Food' },
      { title: 'Akrotiri Ruins', description: 'A Minoan city buried by the same eruption that shaped the caldera', emoji: '🏛️', category: 'History' },
      { title: 'Caldera Boat Tour', description: 'Sail the volcanic crater, visit hot springs, and snorkel in crystal-clear water', emoji: '⛵', category: 'Adventure' },
    ],
    sampleItinerary: [
      { day: 1, title: 'Arrive & Fira', activities: ['Arrive by ferry or flight', 'Explore Fira town and caldera viewpoints', 'Wine tasting at Santo Wines', 'Dinner overlooking the caldera'] },
      { day: 2, title: 'Oia & Sunset', activities: ['Morning hike from Fira to Oia (or take the bus)', 'Explore Oia\'s blue dome churches', 'Lunch at Ammoudi Bay', 'The famous Oia sunset'] },
      { day: 3, title: 'Beaches & Sailing', activities: ['Morning at Red Beach or Perissa black sand beach', 'Afternoon caldera catamaran cruise', 'Hot springs swim', 'Farewell seafood dinner'] },
    ],
    travelTips: [
      'Visit in shoulder season (April–May, Sep–Oct) to avoid massive crowds and lower prices.',
      'Book caldera-view accommodation months ahead — it sells out fast.',
      'Rent an ATV or car to explore beyond the main towns. Buses can be crowded.',
      'Bring good walking shoes — the cobblestone paths and stairs are steep.',
    ],
  },
  {
    slug: 'london',
    name: 'London',
    country: 'United Kingdom',
    continent: 'Europe',
    tagline: 'Royal history, world-class museums, and a thriving multicultural food scene',
    description:
      'London is a city of layers — royal palaces, centuries-old pubs, cutting-edge galleries, and neighborhoods that each feel like their own city. With free world-class museums, iconic landmarks, and food from every corner of the globe, there\'s always something new to discover.',
    heroImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1920&q=85',
    cardImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80',
    vibes: ['Culture', 'History', 'Urban'],
    quickFacts: {
      bestTime: 'May – September',
      language: 'English',
      currency: 'GBP (£)',
      timezone: 'GMT (UTC+0)',
      avgBudget: '$120–200/day',
    },
    highlights: [
      { title: 'British Museum', description: 'Free admission to one of the world\'s greatest collections of human history', emoji: '🏛️', category: 'Culture' },
      { title: 'Tower of London', description: 'Medieval fortress housing the Crown Jewels and 1,000 years of history', emoji: '👑', category: 'History' },
      { title: 'Borough Market', description: 'London\'s oldest food market — artisan cheeses, fresh oysters, and pastries', emoji: '🧀', category: 'Food' },
      { title: 'West End Shows', description: 'World-renowned theater district with Les Mis, Phantom, and more', emoji: '🎭', category: 'Entertainment' },
      { title: 'Hyde Park', description: 'Royal park perfect for boating, cycling, or a peaceful afternoon escape', emoji: '🌳', category: 'Nature' },
      { title: 'Camden Market', description: 'Eclectic market with vintage clothes, street food, and live music', emoji: '🎸', category: 'Shopping' },
    ],
    sampleItinerary: [
      { day: 1, title: 'Royal London', activities: ['Watch the Changing of the Guard at Buckingham Palace', 'Walk through St James\'s Park', 'Visit the Tower of London and Crown Jewels', 'Dinner in Covent Garden'] },
      { day: 2, title: 'Museums & Markets', activities: ['Morning at the British Museum (free)', 'Lunch at Borough Market', 'Afternoon at Tate Modern', 'Evening West End show'] },
      { day: 3, title: 'Neighborhoods', activities: ['Morning walk through Notting Hill and Portobello Road', 'Explore Camden Market', 'Afternoon tea experience', 'Sunset from Primrose Hill'] },
    ],
    travelTips: [
      'Get an Oyster card or use contactless payment for the Tube — it\'s the cheapest way to travel.',
      'Most major museums are free. The British Museum, Natural History Museum, and Tate Modern are must-visits.',
      'Book West End tickets on TodayTix for day-of discounts.',
      'Pubs typically stop serving at 11pm. Plan dinner reservations accordingly.',
    ],
  },
  {
    slug: 'rome',
    name: 'Rome',
    country: 'Italy',
    continent: 'Europe',
    tagline: 'The Eternal City — where every cobblestone tells a 2,000-year story',
    description:
      'Rome is an open-air museum where ancient ruins stand alongside baroque fountains and bustling trattorias. From the Colosseum to the Vatican, from authentic cacio e pepe to gelato by the Trevi Fountain, Rome is a feast for every sense.',
    heroImage: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1920&q=85',
    cardImage: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80',
    vibes: ['History', 'Foodie', 'Culture'],
    quickFacts: {
      bestTime: 'April – June, Sep – Oct',
      language: 'Italian',
      currency: 'EUR (€)',
      timezone: 'CET (UTC+1)',
      avgBudget: '$90–140/day',
    },
    highlights: [
      { title: 'Colosseum', description: 'The iconic 2,000-year-old amphitheater that once hosted gladiatorial combat', emoji: '🏟️', category: 'History' },
      { title: 'Vatican Museums & Sistine Chapel', description: 'Michelangelo\'s ceiling and the vast papal art collection', emoji: '🎨', category: 'Art' },
      { title: 'Trastevere', description: 'Charming cobblestone neighborhood with the best trattorias in Rome', emoji: '🍝', category: 'Food' },
      { title: 'Trevi Fountain', description: 'Baroque masterpiece — toss a coin to ensure your return to Rome', emoji: '⛲', category: 'Landmark' },
      { title: 'Pantheon', description: 'Perfectly preserved 2,000-year-old temple with its famous oculus dome', emoji: '🏛️', category: 'Architecture' },
      { title: 'Roman Forum', description: 'Walk among the ruins of ancient Rome\'s political and commercial center', emoji: '🏗️', category: 'History' },
    ],
    sampleItinerary: [
      { day: 1, title: 'Ancient Rome', activities: ['Morning at the Colosseum and Roman Forum', 'Lunch near Piazza Navona', 'Visit the Pantheon', 'Gelato and coin toss at Trevi Fountain'] },
      { day: 2, title: 'Vatican & Art', activities: ['Early morning Vatican Museums (book skip-the-line)', 'Sistine Chapel and St. Peter\'s Basilica', 'Lunch in Prati', 'Afternoon walk through Villa Borghese gardens'] },
      { day: 3, title: 'La Dolce Vita', activities: ['Morning at Campo de\' Fiori market', 'Cooking class: pasta-making', 'Explore Trastevere\'s winding streets', 'Farewell dinner in a family-run trattoria'] },
    ],
    travelTips: [
      'Book Colosseum and Vatican tickets online well in advance — same-day queues can be 2+ hours.',
      'Avoid restaurants with picture menus right next to major landmarks — tourist traps. Walk one block away for better food.',
      'Carry a water bottle — Rome has free drinking fountains (nasoni) throughout the city.',
      'Dress modestly for the Vatican: no bare shoulders or knees, or you\'ll be turned away.',
    ],
  },
  {
    slug: 'lisbon',
    name: 'Lisbon',
    country: 'Portugal',
    continent: 'Europe',
    tagline: 'Colorful tiles, hilltop views, and the best pastéis de nata in the world',
    description:
      'Lisbon is Europe\'s sunniest capital — a city of seven hills, vintage trams, fado music, and pastel-colored buildings. It offers incredible value, world-class seafood, and a creative energy that makes it one of Europe\'s most exciting destinations.',
    heroImage: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1920&q=85',
    cardImage: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=800&q=80',
    vibes: ['Culture', 'Foodie', 'Nightlife'],
    quickFacts: {
      bestTime: 'March – October',
      language: 'Portuguese',
      currency: 'EUR (€)',
      timezone: 'WET (UTC+0)',
      avgBudget: '$60–100/day',
    },
    highlights: [
      { title: 'Belém Tower & Pastéis', description: 'UNESCO tower and the bakery where Portugal\'s famous custard tarts were invented', emoji: '🏰', category: 'History' },
      { title: 'Alfama District', description: 'Lisbon\'s oldest neighborhood — winding alleys, fado bars, and stunning miradouros', emoji: '🎶', category: 'Culture' },
      { title: 'Tram 28', description: 'Iconic yellow tram that rattles through Lisbon\'s most photogenic neighborhoods', emoji: '🚃', category: 'Experience' },
      { title: 'Time Out Market', description: 'Curated food hall with Lisbon\'s best chefs under one roof', emoji: '🍽️', category: 'Food' },
      { title: 'Sintra Day Trip', description: 'Fairytale palaces, misty forests, and Moorish castles just 30 minutes away', emoji: '🏰', category: 'Day Trip' },
      { title: 'LX Factory', description: 'Creative hub in a converted industrial complex with shops, galleries, and brunch spots', emoji: '🎨', category: 'Art' },
    ],
    sampleItinerary: [
      { day: 1, title: 'Historic Lisbon', activities: ['Ride Tram 28 through Alfama', 'Visit São Jorge Castle for panoramic views', 'Lunch at Time Out Market', 'Explore the Baixa and Rossio Square'] },
      { day: 2, title: 'Belém & Culture', activities: ['Morning at Belém Tower and Jerónimos Monastery', 'Pastéis de nata at Pastéis de Belém', 'Afternoon at LX Factory', 'Evening fado show in Alfama'] },
      { day: 3, title: 'Sintra Day Trip', activities: ['Train to Sintra (30 min)', 'Explore Pena Palace and gardens', 'Visit the Moorish Castle', 'Return for a farewell seafood dinner'] },
    ],
    travelTips: [
      'Wear comfortable shoes with good grip — the cobblestone hills are beautiful but slippery.',
      'Try a ginjinha (cherry liqueur) at one of the tiny bars near Rossio — it\'s a Lisbon tradition.',
      'Book Sintra palace tickets online. The queues without them can be extremely long.',
      'Lisbon is one of Europe\'s most affordable capitals — eat where the locals eat for incredible value.',
    ],
  },
  {
    slug: 'reykjavik',
    name: 'Reykjavik',
    country: 'Iceland',
    continent: 'Europe',
    tagline: 'Fire and ice — Northern Lights, volcanoes, and geothermal hot springs',
    description:
      'Reykjavik is the gateway to Iceland\'s otherworldly landscape — glaciers, waterfalls, geysers, and volcanic beaches. The world\'s northernmost capital packs a creative punch with its colorful houses, craft beer scene, and midnight sun.',
    heroImage: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=1920&q=85',
    cardImage: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=800&q=80',
    vibes: ['Nature', 'Adventure', 'Scenic'],
    quickFacts: {
      bestTime: 'Jun – Aug (summer) or Sep – Mar (Northern Lights)',
      language: 'Icelandic / English',
      currency: 'ISK (kr)',
      timezone: 'GMT (UTC+0)',
      avgBudget: '$150–250/day',
    },
    highlights: [
      { title: 'Northern Lights', description: 'Dance of green and purple across the Arctic sky (September–March)', emoji: '🌌', category: 'Nature' },
      { title: 'Blue Lagoon', description: 'Iconic geothermal spa with milky-blue waters and silica face masks', emoji: '♨️', category: 'Wellness' },
      { title: 'Golden Circle', description: 'Classic day trip: Þingvellir, Geysir, and the mighty Gullfoss waterfall', emoji: '🌊', category: 'Nature' },
      { title: 'Black Sand Beach', description: 'Reynisfjara\'s dramatic basalt columns and roaring Atlantic waves', emoji: '🖤', category: 'Scenic' },
      { title: 'Glacier Hiking', description: 'Walk on a glacier with crampons and an expert guide', emoji: '🏔️', category: 'Adventure' },
      { title: 'Whale Watching', description: 'Spot humpback whales, dolphins, and puffins from Reykjavik\'s harbor', emoji: '🐋', category: 'Wildlife' },
    ],
    sampleItinerary: [
      { day: 1, title: 'Reykjavik & Blue Lagoon', activities: ['Explore Hallgrímskirkja and downtown Reykjavik', 'Lunch at a local seafood restaurant', 'Afternoon at the Blue Lagoon', 'Northern Lights tour (winter only)'] },
      { day: 2, title: 'Golden Circle', activities: ['Visit Þingvellir National Park', 'Watch Strokkur geyser erupt', 'Marvel at Gullfoss waterfall', 'Tomato soup at Friðheimar greenhouse'] },
      { day: 3, title: 'South Coast', activities: ['Drive the Ring Road south', 'Visit Seljalandsfoss and Skógafoss waterfalls', 'Black sand beach at Reynisfjara', 'Optional glacier hike'] },
    ],
    travelTips: [
      'Iceland is expensive. Budget travelers should cook at Bónus supermarket and stay at guesthouses.',
      'Layer up! Weather changes every 15 minutes. A wind/waterproof outer layer is essential.',
      'Rent a car for maximum freedom — public transport outside Reykjavik is very limited.',
      'Never drive off marked roads. Iceland\'s fragile landscape takes decades to recover from tire tracks.',
    ],
  },

  // ─── Americas ──────────────────────────────────────────────────────────────
  {
    slug: 'new-york',
    name: 'New York',
    country: 'USA',
    continent: 'Americas',
    tagline: 'The city that never sleeps — energy, culture, and ambition on every block',
    description:
      'New York City is the world\'s ultimate urban playground. From the bright lights of Times Square to the quiet paths of Central Park, from Michelin-starred restaurants to $1 pizza slices, NYC has everything cranked to maximum.',
    heroImage: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1920&q=85',
    cardImage: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80',
    vibes: ['Urban & Nightlife', 'Culture', 'Foodie'],
    quickFacts: {
      bestTime: 'April – June, Sep – Nov',
      language: 'English',
      currency: 'USD ($)',
      timezone: 'EST (UTC-5)',
      avgBudget: '$150–250/day',
    },
    highlights: [
      { title: 'Central Park', description: '843 acres of green oasis in the middle of Manhattan', emoji: '🌳', category: 'Nature' },
      { title: 'Statue of Liberty', description: 'The iconic symbol of freedom and democracy on Liberty Island', emoji: '🗽', category: 'Landmark' },
      { title: 'Broadway', description: 'World-famous theater district with shows for every taste', emoji: '🎭', category: 'Entertainment' },
      { title: 'Brooklyn Bridge', description: 'Walk the iconic bridge for stunning Manhattan skyline views', emoji: '🌉', category: 'Landmark' },
      { title: 'Metropolitan Museum', description: 'One of the world\'s greatest art museums with 5,000 years of art', emoji: '🏛️', category: 'Art' },
      { title: 'Chelsea Market & High Line', description: 'Elevated park and artisanal food hall in a former railway', emoji: '🍩', category: 'Food' },
    ],
    sampleItinerary: [
      { day: 1, title: 'Manhattan Icons', activities: ['Morning at the Statue of Liberty and Ellis Island', 'Walk across the Brooklyn Bridge', 'Pizza in DUMBO with skyline views', 'Evening in Times Square and Broadway show'] },
      { day: 2, title: 'Culture & Parks', activities: ['Morning jog or walk through Central Park', 'Visit the Metropolitan Museum of Art', 'Lunch at a classic NYC deli', 'Walk the High Line at sunset'] },
      { day: 3, title: 'Neighborhoods', activities: ['Explore SoHo and Greenwich Village', 'Lunch at Chelsea Market', 'Afternoon in Williamsburg, Brooklyn', 'Farewell dinner in Little Italy or Chinatown'] },
    ],
    travelTips: [
      'Get an unlimited MetroCard for the subway — it\'s the fastest and cheapest way around.',
      'Book Broadway tickets on TodayTix or at the TKTS booth in Times Square for same-day discounts.',
      'Skip the tourist traps in Times Square for food. Walk a few blocks in any direction for better options.',
      'Many museums have "pay what you wish" hours — check their websites.',
    ],
  },

  // ─── Africa ────────────────────────────────────────────────────────────────
  {
    slug: 'marrakech',
    name: 'Marrakech',
    country: 'Morocco',
    continent: 'Africa',
    tagline: 'Spices, souks, and sunsets over the Atlas Mountains',
    description:
      'Marrakech is a sensory explosion — the calls of market vendors, the scent of saffron and mint, the vivid colors of zellige tiles. Its legendary medina, stunning riads, and the chaos of Jemaa el-Fna square create an experience unlike any other.',
    heroImage: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=1920&q=85',
    cardImage: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=800&q=80',
    vibes: ['Culture', 'Adventure', 'Foodie'],
    quickFacts: {
      bestTime: 'March – May, Sep – Nov',
      language: 'Arabic / French',
      currency: 'MAD (د.م.)',
      timezone: 'WET (UTC+0)',
      avgBudget: '$40–80/day',
    },
    highlights: [
      { title: 'Jemaa el-Fna', description: 'The legendary square that comes alive at night with food stalls, musicians, and storytellers', emoji: '🎪', category: 'Culture' },
      { title: 'Medina Souks', description: 'Labyrinthine markets selling leather, spices, ceramics, and everything in between', emoji: '🛍️', category: 'Shopping' },
      { title: 'Majorelle Garden', description: 'Yves Saint Laurent\'s stunning cobalt-blue botanical garden', emoji: '🌺', category: 'Nature' },
      { title: 'Atlas Mountains', description: 'Day trip to Berber villages and mountain passes with epic views', emoji: '🏔️', category: 'Adventure' },
      { title: 'Riad Stay', description: 'Sleep in a traditional courtyard house with fountains, tiles, and rooftop terraces', emoji: '🏡', category: 'Accommodation' },
      { title: 'Hammam Experience', description: 'Traditional steam bath with black soap scrub — the ultimate Moroccan wellness ritual', emoji: '🧖', category: 'Wellness' },
    ],
    sampleItinerary: [
      { day: 1, title: 'Medina & Souks', activities: ['Get orientated with a guided medina walk', 'Navigate the souks for leather, spices, and ceramics', 'Lunch at a rooftop café overlooking Jemaa el-Fna', 'Evening in the square as it transforms'] },
      { day: 2, title: 'Gardens & Wellness', activities: ['Morning at Majorelle Garden', 'Explore the Bahia Palace', 'Afternoon hammam experience', 'Traditional Moroccan dinner at a riad'] },
      { day: 3, title: 'Atlas Day Trip', activities: ['Drive through the Atlas Mountain passes', 'Visit a Berber village', 'Lunch with mountain views', 'Return for sunset from a rooftop terrace'] },
    ],
    travelTips: [
      'Bargaining is expected and part of the fun. Start at about 30-40% of the asking price.',
      'Hire a local guide for your first medina visit — it\'s easy to get lost (that\'s part of the charm).',
      'Stay in a riad for the authentic experience. Many have beautiful courtyards and serve incredible breakfasts.',
      'Women traveling alone should dress modestly and be prepared for persistent (but usually harmless) attention from vendors.',
    ],
  },
  {
    slug: 'cape-town',
    name: 'Cape Town',
    country: 'South Africa',
    continent: 'Africa',
    tagline: 'Where mountains meet the ocean — adventure, wine, and raw natural beauty',
    description:
      'Cape Town is one of the most beautiful cities on Earth. Table Mountain looms over a city of world-class wine estates, pristine beaches, vibrant neighborhoods, and the raw beauty of the Cape Peninsula. It\'s adventure, culture, and luxury rolled into one.',
    heroImage: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1920&q=85',
    cardImage: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800&q=80',
    vibes: ['Nature', 'Adventure', 'Wine'],
    quickFacts: {
      bestTime: 'November – March (summer)',
      language: 'English / Afrikaans',
      currency: 'ZAR (R)',
      timezone: 'SAST (UTC+2)',
      avgBudget: '$50–100/day',
    },
    highlights: [
      { title: 'Table Mountain', description: 'Flat-topped mountain with 360° views — hike or take the cable car', emoji: '⛰️', category: 'Nature' },
      { title: 'Cape Point', description: 'Dramatic cliffs where the Atlantic meets the Indian Ocean', emoji: '🌊', category: 'Scenic' },
      { title: 'Stellenbosch Wine Route', description: 'World-class wine tasting at estates surrounded by mountains', emoji: '🍷', category: 'Food' },
      { title: 'V&A Waterfront', description: 'Bustling harbor with restaurants, craft markets, and the Zeitz MOCAA museum', emoji: '🚢', category: 'Urban' },
      { title: 'Boulders Beach Penguins', description: 'Walk among a colony of adorable African penguins', emoji: '🐧', category: 'Wildlife' },
      { title: 'Bo-Kaap', description: 'Colorful historic neighborhood with Cape Malay culture and cuisine', emoji: '🏠', category: 'Culture' },
    ],
    sampleItinerary: [
      { day: 1, title: 'City & Mountain', activities: ['Morning cable car up Table Mountain', 'Walk the city bowl and Bo-Kaap', 'Lunch at V&A Waterfront', 'Sunset at Signal Hill'] },
      { day: 2, title: 'Cape Peninsula', activities: ['Drive Chapman\'s Peak coastal road', 'Visit the penguins at Boulders Beach', 'Cape Point and Cape of Good Hope', 'Fish & chips in Kalk Bay'] },
      { day: 3, title: 'Wine Country', activities: ['Morning drive to Stellenbosch', 'Wine tasting at 2-3 estates', 'Lunch at a vineyard restaurant', 'Return via Franschhoek'] },
    ],
    travelTips: [
      'Rent a car — Cape Town\'s best attractions are spread out and public transit is limited.',
      'Book Table Mountain cable car tickets online. It closes in high winds, so go on your first clear day.',
      'Cape Town has water scarcity — be mindful of water usage (short showers, etc.).',
      'Uber is safe and widely used. Use it for nighttime travel.',
    ],
  },

  // ─── Oceania ───────────────────────────────────────────────────────────────
  {
    slug: 'sydney',
    name: 'Sydney',
    country: 'Australia',
    continent: 'Oceania',
    tagline: 'Iconic harbor, golden beaches, and laid-back Australian vibes',
    description:
      'Sydney is where stunning natural beauty meets a cosmopolitan city. The Opera House and Harbour Bridge form one of the world\'s most recognizable skylines, while Bondi Beach, the Blue Mountains, and a thriving food scene make it a destination that truly has it all.',
    heroImage: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1920&q=85',
    cardImage: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&q=80',
    vibes: ['Beach', 'Urban', 'Nature'],
    quickFacts: {
      bestTime: 'September – November, March – May',
      language: 'English',
      currency: 'AUD ($)',
      timezone: 'AEST (UTC+10)',
      avgBudget: '$100–180/day',
    },
    highlights: [
      { title: 'Sydney Opera House', description: 'Architectural masterpiece on the harbor — catch a show or take a tour', emoji: '🎭', category: 'Landmark' },
      { title: 'Bondi to Coogee Walk', description: '6km coastal trail past golden beaches, ocean pools, and clifftop views', emoji: '🏖️', category: 'Nature' },
      { title: 'Harbour Bridge Climb', description: 'Scale the iconic bridge for 360° views of the harbor and city', emoji: '🌉', category: 'Adventure' },
      { title: 'The Rocks', description: 'Historic waterfront neighborhood with markets, pubs, and Aboriginal art', emoji: '🏘️', category: 'Culture' },
      { title: 'Blue Mountains', description: 'Day trip to dramatic valleys, eucalyptus forests, and the Three Sisters', emoji: '🏔️', category: 'Nature' },
      { title: 'Taronga Zoo', description: 'Wildlife park with views of the Opera House — meet koalas and platypuses', emoji: '🐨', category: 'Wildlife' },
    ],
    sampleItinerary: [
      { day: 1, title: 'Harbor Icons', activities: ['Morning at the Sydney Opera House', 'Walk through The Rocks and weekend markets', 'Ferry across to Manly Beach', 'Sunset from Mrs Macquarie\'s Chair'] },
      { day: 2, title: 'Beach Day', activities: ['Morning Bondi to Coogee coastal walk', 'Swim and brunch in Bondi', 'Afternoon at Taronga Zoo via ferry', 'Dinner in Surry Hills'] },
      { day: 3, title: 'Blue Mountains', activities: ['Day trip to Blue Mountains (2hr train)', 'See the Three Sisters at Echo Point', 'Scenic World rides', 'Return for a farewell dinner at Circular Quay'] },
    ],
    travelTips: [
      'Get an Opal card for trains, buses, and ferries. The ferry to Manly is essentially a scenic harbor cruise.',
      'Australian sun is intense — wear SPF 50+ even on cloudy days.',
      'Eat at the local RSL or bowling clubs for surprisingly good and affordable meals.',
      'Tipping is not expected in Australia, but rounding up is appreciated for great service.',
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
  if (continent === 'All') return destinationGuides;
  return destinationGuides.filter((d) => d.continent === continent);
}

export function getContinents(): string[] {
  return ['All', ...Array.from(new Set(destinationGuides.map((d) => d.continent)))];
}
