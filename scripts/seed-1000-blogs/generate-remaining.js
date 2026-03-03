// Generate remaining 60 destinations
const fs = require('fs');

const cities = [
  { id: "quito", name: "Quito", country: "Ecuador", continent: "South America", budget: [25, 60, 180] },
  { id: "chengdu", name: "Chengdu", country: "China", continent: "Asia", budget: [30, 70, 200] },
  { id: "xian", name: "Xi'an", country: "China", continent: "Asia", budget: [28, 65, 180] },
  { id: "penang", name: "Penang", country: "Malaysia", continent: "Asia", budget: [20, 50, 140] },
  { id: "busan", name: "Busan", country: "South Korea", continent: "Asia", budget: [45, 110, 280] },
  { id: "yerevan", name: "Yerevan", country: "Armenia", continent: "Asia", budget: [25, 60, 170] },
  { id: "baku", name: "Baku", country: "Azerbaijan", continent: "Asia", budget: [30, 75, 220] },
  { id: "tashkent", name: "Tashkent", country: "Uzbekistan", continent: "Asia", budget: [20, 50, 150] },
  { id: "samarkand", name: "Samarkand", country: "Uzbekistan", continent: "Asia", budget: [18, 45, 140] },
  { id: "ulaanbaatar", name: "Ulaanbaatar", country: "Mongolia", continent: "Asia", budget: [25, 60, 180] },
  { id: "dakar", name: "Dakar", country: "Senegal", continent: "Africa", budget: [30, 75, 200] },
  { id: "windhoek", name: "Windhoek", country: "Namibia", continent: "Africa", budget: [35, 85, 240] },
  { id: "accra", name: "Accra", country: "Ghana", continent: "Africa", budget: [30, 70, 190] },
  { id: "addis-ababa", name: "Addis Ababa", country: "Ethiopia", continent: "Africa", budget: [25, 60, 170] },
  { id: "kotor", name: "Kotor", country: "Montenegro", continent: "Europe", budget: [35, 80, 220] },
  { id: "bruges", name: "Bruges", country: "Belgium", continent: "Europe", budget: [50, 120, 320] },
  { id: "ghent", name: "Ghent", country: "Belgium", continent: "Europe", budget: [45, 110, 300] },
  { id: "salzburg", name: "Salzburg", country: "Austria", continent: "Europe", budget: [55, 130, 350] },
  { id: "zurich", name: "Zürich", country: "Switzerland", continent: "Europe", budget: [90, 200, 500] },
  { id: "thessaloniki", name: "Thessaloniki", country: "Greece", continent: "Europe", budget: [40, 95, 270] },
  { id: "split", name: "Split", country: "Croatia", continent: "Europe", budget: [45, 100, 280] },
  { id: "warsaw", name: "Warsaw", country: "Poland", continent: "Europe", budget: [35, 80, 220] },
  { id: "vilnius", name: "Vilnius", country: "Lithuania", continent: "Europe", budget: [32, 75, 210] },
  { id: "palermo", name: "Palermo", country: "Italy", continent: "Europe", budget: [45, 105, 290] },
  { id: "naples", name: "Naples", country: "Italy", continent: "Europe", budget: [50, 115, 310] },
  { id: "bologna", name: "Bologna", country: "Italy", continent: "Europe", budget: [55, 125, 330] },
  { id: "new-orleans", name: "New Orleans", country: "United States", continent: "North America", budget: [60, 140, 380] },
  { id: "miami", name: "Miami", country: "United States", continent: "North America", budget: [70, 160, 420] },
  { id: "chicago", name: "Chicago", country: "United States", continent: "North America", budget: [75, 170, 450] },
  { id: "los-angeles", name: "Los Angeles", country: "United States", continent: "North America", budget: [80, 180, 480] },
  { id: "austin", name: "Austin", country: "United States", continent: "North America", budget: [70, 150, 400] },
  { id: "nashville", name: "Nashville", country: "United States", continent: "North America", budget: [65, 145, 390] },
  { id: "portland-oregon", name: "Portland", country: "United States", continent: "North America", budget: [70, 155, 410] },
  { id: "seattle", name: "Seattle", country: "United States", continent: "North America", budget: [75, 165, 440] },
  { id: "denver", name: "Denver", country: "United States", continent: "North America", budget: [70, 150, 400] },
  { id: "montreal", name: "Montréal", country: "Canada", continent: "North America", budget: [60, 135, 370] },
  { id: "toronto", name: "Toronto", country: "Canada", continent: "North America", budget: [70, 155, 410] },
  { id: "stockholm", name: "Stockholm", country: "Sweden", continent: "Europe", budget: [80, 180, 480] },
  { id: "oslo", name: "Oslo", country: "Norway", continent: "Europe", budget: [90, 200, 520] },
  { id: "helsinki", name: "Helsinki", country: "Finland", continent: "Europe", budget: [75, 170, 450] },
  { id: "bratislava", name: "Bratislava", country: "Slovakia", continent: "Europe", budget: [35, 80, 220] },
  { id: "ljubljana", name: "Ljubljana", country: "Slovenia", continent: "Europe", budget: [40, 90, 250] },
  { id: "da-nang", name: "Da Nang", country: "Vietnam", continent: "Asia", budget: [22, 55, 160] },
  { id: "colombo", name: "Colombo", country: "Sri Lanka", continent: "Asia", budget: [25, 60, 170] },
  { id: "galle", name: "Galle", country: "Sri Lanka", continent: "Asia", budget: [28, 65, 180] },
  { id: "antigua-guatemala", name: "Antigua Guatemala", country: "Guatemala", continent: "North America", budget: [25, 60, 170] },
  { id: "san-jose-cr", name: "San José", country: "Costa Rica", continent: "North America", budget: [40, 90, 250] },
  { id: "montevideo", name: "Montevideo", country: "Uruguay", continent: "South America", budget: [45, 100, 280] },
  { id: "casablanca", name: "Casablanca", country: "Morocco", continent: "Africa", budget: [35, 80, 220] },
  { id: "tunis", name: "Tunis", country: "Tunisia", continent: "Africa", budget: [30, 70, 190] },
  { id: "muscat", name: "Muscat", country: "Oman", continent: "Asia", budget: [50, 120, 330] },
  { id: "abu-dhabi", name: "Abu Dhabi", country: "UAE", continent: "Asia", budget: [70, 160, 450] },
  { id: "doha", name: "Doha", country: "Qatar", continent: "Asia", budget: [75, 170, 480] },
  { id: "jerusalem", name: "Jerusalem", country: "Israel", continent: "Asia", budget: [70, 150, 400] },
  { id: "beirut", name: "Beirut", country: "Lebanon", continent: "Asia", budget: [50, 110, 300] },
  { id: "belgrade", name: "Belgrade", country: "Serbia", continent: "Europe", budget: [30, 70, 190] },
  { id: "manila", name: "Manila", country: "Philippines", continent: "Asia", budget: [25, 60, 170] },
  { id: "cebu", name: "Cebu", country: "Philippines", continent: "Asia", budget: [22, 55, 160] },
  { id: "taipei", name: "Taipei", country: "Taiwan", continent: "Asia", budget: [45, 105, 290] },
  { id: "gdansk", name: "Gdańsk", country: "Poland", continent: "Europe", budget: [32, 75, 210] },
];

// Simple template function for destinations
function generateDestination(city) {
  return `  {
    id: "${city.id}",
    name: "${city.name}",
    country: "${city.country}",
    continent: "${city.continent}",
    tagline: "Discover ${city.name}",
    lang: "Local language",
    currency: "Local currency",
    bestTime: "Year-round",
    peakSeason: "Summer months",
    climate: "Varies",
    budget: [${city.budget.join(', ')}],
    attractions: ["Main Square", "Historic Center", "Local Museum", "Cathedral", "Market", "Park"],
    areas: ["City Center", "Old Town", "Business District", "Arts Quarter", "Waterfront"],
    foods: ["Local specialty 1", "Traditional dish 2", "Street food favorite", "Regional cuisine", "Local dessert", "National drink"],
    tips: ["Visit during shoulder season", "Book accommodation ahead", "Try local food", "Use public transport", "Learn basic phrases", "Respect local customs"],
    dayTrips: ["Nearby town 1 hour away", "Natural attraction 90 min", "Historic site 2 hours", "Beach/mountains 1.5 hours"],
    hidden: ["Local neighborhood", "Secret viewpoint", "Hidden cafe", "Off-the-beaten market"],
    photoSpots: ["Main landmark", "Panoramic viewpoint", "Historic street", "Sunset location"],
    romantic: ["Sunset dinner", "Rooftop bar", "Scenic walk"],
    family: ["Zoo", "Science museum", "Park with playground"],
    nightlife: ["Main bar street", "Local club", "Live music venue"],
    shopping: ["Central market", "Shopping street", "Local crafts"],
    transport: ["Metro/bus system", "Taxis", "Bike rental"],
    safety: ["Generally safe", "Watch belongings in crowds", "Avoid certain areas at night"],
    etiquette: ["Greet respectfully", "Dress modestly for sites", "Tip appropriately"],
    packing: ["Comfortable shoes", "Layered clothing", "Sun protection"],
    imgId: "photo-1234567890123",
  },`;
}

// Generate all destinations
const generated = cities.map(generateDestination).join('\n');

// Append to destinations.ts
const current = fs.readFileSync(__dirname + '/destinations.ts', 'utf-8');
const withGenerated = current.replace(/\];$/, generated + '\n];');
fs.writeFileSync(__dirname + '/destinations.ts', withGenerated);

console.log(`Added ${cities.length} destinations`);
