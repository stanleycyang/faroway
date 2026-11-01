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

export function timingFixtureDay(conflict = false): TripDay {
  const day: TripDay = {
    ...sampleDays[0],
    date: "2027-01-11",
    title: "Gardens, a pause, and an afternoon of discovery",
    morning: {
      activities: [
        {
          ...activity,
          id: "garden",
          name: "Singapore Botanic Gardens & National Orchid Garden",
        },
      ],
      meals: [],
    },
    afternoon: {
      activities: [
        {
          ...activity,
          id: "museum",
          name: "ArtScience Museum",
          timeOfDay: "afternoon",
        },
      ],
      meals: [],
    },
    tips: [
      "Proposed local timing: duplicated legacy text",
      "Bring water for the garden walk.",
    ],
  };
  day.timingProposal = {
    policy: "midday-rest-v1",
    basis: JSON.stringify({
      date: day.date,
      slots: [day.morning, day.afternoon, day.evening].map((slot) => ({
        activities: slot.activities.map((a) => [a.id, a.name, a.duration]),
        meals: slot.meals.map((m) => [m.id, m.name]),
      })),
    }),
    fitsPolicy: !conflict,
    verified: false,
    conflict: conflict
      ? { eventId: "activity:museum", overrunMinutes: 30 }
      : null,
    events: conflict
      ? []
      : [
          {
            id: "activity:garden",
            kind: "activity",
            durationMinutes: 90,
            startMinute: 540,
            endMinute: 630,
            bufferBeforeMinutes: 0,
          },
          {
            id: "rest:midday",
            kind: "rest",
            durationMinutes: 60,
            startMinute: 780,
            endMinute: 840,
            bufferBeforeMinutes: 0,
          },
          {
            id: "activity:museum",
            kind: "activity",
            durationMinutes: 90,
            startMinute: 870,
            endMinute: 960,
            bufferBeforeMinutes: 30,
          },
        ],
  };
  return day;
}
