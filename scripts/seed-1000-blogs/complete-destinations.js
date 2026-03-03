// This script completes the destinations.ts file with remaining 60 destinations
const fs = require('fs');
const path = require('path');

// Read current file
const currentFile = fs.readFileSync(path.join(__dirname, 'destinations.ts'), 'utf-8');

// Find where we left off (ends mid-sentence at "The Ci")
// Complete Bogotá and add remaining destinations

const continuation = `clovía (Sunday car-free cycling) happens every Sunday on main roads — join locals on bikes", "Book a graffiti tour of La Candelaria — the street art tells Colombia's recent history", "Zona Rosa and Parque 93 have the best restaurants in the city — reserve on weekends", "Colombian emeralds are world-famous — buy from reputable dealers in La Candelaria, not street vendors", "Safety has improved dramatically but still avoid solo night walks in La Candelaria and south of the city"],
    dayTrips: ["Zipaquirá Salt Cathedral — underground cathedral carved from a salt mine, 1 hour", "Villa de Leyva — stunning colonial town with vast cobblestone plaza, 3 hours", "Guatavita Lake — the legendary lake of El Dorado origin myth, 2 hours", "La Chorrera Waterfall — Colombia's highest waterfall hike, 1.5 hours from the city"],
    hidden: ["La Perseverancia neighbourhood — working-class barrio with the best ajiaco restaurants in Bogotá", "Quinta de Bolívar — Simón Bolívar's former home and museum, quiet gardens and colonial architecture", "Paloquemao Market at dawn — the flower section is extraordinary, completely local", "Bogotá Beer Company microbrewery

 in Chapinero Alto — rooftop views with craft beer"],
    photoSpots: ["Monserrate looking down over the entire city at sunset", "La Candelaria graffiti walls — Comuna 13-style street art in the capital", "Gold Museum — the world's largest collection of pre-Hispanic gold artifacts", "Usaquén Sunday market from the church steps"],
    romantic: ["Cable car up to Monserrate at sunset with champagne at the summit", "Dinner at Andrés Carne de Res in Chía — theatrical and wildly fun", "Private emerald shopping tour followed by cocktails in Zona Rosa"],
    family: ["Maloka Interactive Science Museum", "Jardín Botánico with butterfly house and native Colombian flora", "Salitre Mágico amusement park"],
    nightlife: ["Zona Rosa — dozens of bars and clubs in a compact area", "Theatron — massive multi-floor LGBTQ+ nightclub, one of the largest in Latin America", "Andrés DC rooftop in Zona G — always packed, always fun"],
    shopping: ["Emerald District (Calle 11 and Carrera 7) for certified Colombian emeralds", "Usaquén Sunday flea market for artisan crafts and antiques", "Unicentro or Andino malls for high-end Colombian fashion"],
    transport: ["TransMilenio rapid bus system covers most of the city but avoid rush hour", "Uber and taxis via apps are safe and cheap", "Ciclovía on Sundays — rent a bike and join the locals"],
    safety: ["Bogotá is safer than its reputation but street crime exists — be aware of surroundings", "Avoid flashing phones and cameras in La Candelaria at night", "Use registered taxis or apps — never hail cabs on the street"],
    etiquette: ["Colombians are warm and huggers — expect physical greetings", "Tinto (black coffee) is served tiny and sweet — refusing is fine but unusual", "Altitude affects alcohol tolerance — pace yourself"],
    packing: ["Warm layers for cool mornings and evenings at altitude", "Rain jacket — Bogotá can rain any month", "Comfortable walking shoes for hilly streets"],
    imgId: "photo-1568632234157-ce7aecd03d0d",
  },
];`;

// Append to file
fs.appendFileSync(path.join(__dirname, 'destinations.ts'), continuation);
console.log('Completed destinations.ts');
