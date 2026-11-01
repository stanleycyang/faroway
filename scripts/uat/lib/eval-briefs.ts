import { UAT_BRIEFS, type UatBrief } from "./briefs";

// Authored coverage fixtures, not independently reviewed traveler reference answers.
function brief(
  id: string,
  destination: string,
  days: number,
  patch: Partial<UatBrief>,
): UatBrief {
  return {
    id,
    destination,
    startDate: "2027-01-11",
    endDate: `2027-01-${10 + days}`,
    travelers: 2,
    adults: 2,
    children: 0,
    interests: ["culture"],
    budget: "moderate",
    vibes: ["cultural"],
    travelerType: "couple",
    ...patch,
  };
}
export const DEVELOPMENT_BRIEFS: UatBrief[] = [
  ...UAT_BRIEFS,
  brief("queenstown-regional", "Queenstown, New Zealand", 5, {
    interests: ["nature", "food"],
    vibes: ["relaxed"],
    mobilityNeeds:
      "Prefer short walks, avoid strenuous hikes, and allow rest between excursions",
  }),
  brief("athens-group", "Athens, Greece", 3, {
    travelers: 6,
    adults: 6,
    travelerType: "friends",
    budget: "budget",
    interests: ["history", "food"],
    mobilityNeeds:
      "Keep the group together and leave time for relaxed shared meals",
  }),
  brief("tokyo-solo-budget", "Tokyo, Japan", 3, {
    travelers: 1,
    adults: 1,
    travelerType: "solo",
    budget: "budget",
    interests: ["food", "architecture"],
  }),
  brief("rome-single-day", "Rome, Italy", 1, {
    interests: ["history", "food"],
  }),
  brief("new-york-allergy", "New York, USA", 3, {
    dietaryRestrictions: ["peanut allergy"],
    requirements: {
      allergies: ["peanuts"],
      dietaryPreferences: [],
      accessibility: [],
      mobilityNotes:
        "Avoid claiming any restaurant is allergy-safe without direct confirmation.",
    },
  }),
  brief("edinburgh-wheelchair", "Edinburgh, Scotland", 3, {
    mobilityNeeds: "wheelchair access; avoid steps and steep walking routes",
    requirements: {
      allergies: [],
      dietaryPreferences: [],
      accessibility: ["step_free_entrance"],
      mobilityNotes:
        "Frequent seated breaks and accessible toilets; confirm access.",
    },
  }),
  brief("marrakech-vegan", "Marrakech, Morocco", 4, {
    dietaryRestrictions: ["vegan"],
    interests: ["food", "art"],
    budget: "budget",
  }),
  brief("singapore-family", "Singapore", 4, {
    travelers: 4,
    adults: 2,
    children: 2,
    travelerType: "family",
    interests: ["nature", "science"],
    mobilityNeeds: "Short walks and a midday rest every day",
  }),
  brief("paris-luxury", "Paris, France", 3, {
    budget: "luxury",
    interests: ["art", "food"],
    vibes: ["romantic", "luxury"],
  }),
  brief("reykjavik-winter", "Reykjavik, Iceland", 5, {
    interests: ["nature"],
    vibes: ["adventure"],
    mobilityNeeds:
      "Avoid long outdoor walks in winter; allow indoor alternatives",
  }),
  brief("istanbul-year-boundary", "Istanbul, Türkiye", 3, {
    startDate: "2026-12-30",
    endDate: "2027-01-01",
    interests: ["history", "food"],
    dietaryRestrictions: ["halal"],
  }),
];

// Reserved for final validation, not prompt tuning. Independent review is still required.
export const HOLDOUT_BRIEFS: UatBrief[] = [
  brief("osaka-solo-food", "Osaka, Japan", 3, {
    travelers: 1,
    adults: 1,
    travelerType: "solo",
    budget: "budget",
    interests: ["food", "culture"],
  }),
  brief("vienna-step-free", "Vienna, Austria", 3, {
    mobilityNeeds: "step-free routes, short walks and seated breaks",
    interests: ["music", "art"],
  }),
  brief("barcelona-family-allergy", "Barcelona, Spain", 4, {
    travelers: 4,
    adults: 2,
    children: 2,
    travelerType: "family",
    dietaryRestrictions: ["tree nut allergy"],
    requirements: {
      allergies: ["tree nuts"],
      dietaryPreferences: [],
      accessibility: [],
      mobilityNotes: "Midday rests; verify allergy handling directly.",
    },
  }),
  brief("porto-single-day", "Porto, Portugal", 1, {
    interests: ["architecture", "food"],
  }),
  brief("seoul-vegetarian", "Seoul, South Korea", 4, {
    dietaryRestrictions: ["vegetarian"],
    interests: ["culture", "food"],
  }),
  brief("tromso-winter", "Tromsø, Norway", 5, {
    interests: ["nature"],
    vibes: ["adventure"],
    mobilityNeeds: "Short outdoor visits with warm indoor alternatives",
  }),
];
