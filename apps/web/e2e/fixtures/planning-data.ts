import type { TripDay, HotelResult, ItineraryActivity } from "@faroway/types";

export const cover =
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1200&auto=format&fit=crop&q=80";
const activity: ItineraryActivity = {
  id: "fixture-walk",
  name: "A quiet walk through Saint-Germain",
  description: "Small galleries, bookshops, and time to linger over a coffee.",
  duration: 90,
  estimatedCost: { amount: 0, status: "unknown", currency: "EUR" },
  timeOfDay: "morning",
  category: "cultural",
  location: { name: "Saint-Germain-des-Prés" },
  vibeMatch: {
    matchedVibes: ["cultural"],
    reasoning: "A leisurely introduction to the neighborhood.",
  },
};
export const sampleDays: TripDay[] = [
  "A first taste of Paris",
  "Art and the Left Bank",
  "Markets and neighborhood walks",
].map((title, index) => ({
  dayNumber: index + 1,
  date: `2099-06-0${index + 1}`,
  title,
  summary:
    "A gently paced day of neighborhood discoveries, good food, and room to follow your curiosity.",
  morning: {
    activities: [
      {
        ...activity,
        id: `fixture-walk-${index}`,
        name:
          index === 0
            ? activity.name
            : index === 1
              ? "An afternoon at the Musée d’Orsay"
              : "The neighborhood market",
      },
    ],
    meals: [],
  },
  afternoon: { activities: [], meals: [] },
  evening: { activities: [], meals: [] },
  tips: [],
  totalEstimatedCost: { amount: 0, currency: "EUR" },
}));
export const sampleHotel: HotelResult = {
  id: "fixture-hotel",
  name: "A stay in Saint-Germain",
  description:
    "A suggested base for a trip of galleries, neighborhood walks, and unhurried mornings.",
  images: [],
  amenities: ["Central location", "Breakfast", "Concierge"],
  location: { name: "Saint-Germain", address: "Paris", lat: 48.85, lng: 2.33 },
  vibeScore: 90,
  vibeMatch: ["cultural"],
};
