export interface UatBrief {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  adults: number;
  children: number;
  childAges?: number[];
  roomCount?: number;
  interests: string[];
  budget: "budget" | "moderate" | "luxury";
  vibes: string[];
  travelerType: "solo" | "couple" | "family" | "friends" | "business";
  dietaryRestrictions?: string[];
  mobilityNeeds?: string;
  requirements?: {
    allergies: string[];
    dietaryPreferences: string[];
    accessibility: string[];
    mobilityNotes?: string;
  };
}

export function assertValidBriefParty(brief: UatBrief): void {
  if (
    ![brief.travelers, brief.adults, brief.children].every(Number.isInteger) ||
    brief.adults < 1 ||
    brief.children < 0 ||
    brief.travelers !== brief.adults + brief.children ||
    (brief.roomCount !== undefined &&
      (!Number.isInteger(brief.roomCount) ||
        brief.roomCount < 1 ||
        brief.roomCount > brief.travelers)) ||
    (brief.childAges !== undefined &&
      (!Array.isArray(brief.childAges) ||
        brief.childAges.length !== brief.children ||
        brief.childAges.some(
          (age) => !Number.isInteger(age) || age < 0 || age > 17,
        )))
  )
    throw new Error("Invalid evaluation brief party, child ages or room count");
}

export const UAT_BRIEFS: UatBrief[] = [
  {
    id: "lisbon-city-break",
    destination: "Lisbon, Portugal",
    startDate: "2026-12-07",
    endDate: "2026-12-09",
    travelers: 2,
    adults: 2,
    children: 0,
    interests: ["culture", "food"],
    budget: "moderate",
    vibes: ["cultural", "foodie"],
    travelerType: "friends",
  },
  {
    id: "copenhagen-family",
    destination: "Copenhagen, Denmark",
    startDate: "2026-12-07",
    endDate: "2026-12-09",
    travelers: 3,
    adults: 2,
    children: 1,
    interests: ["culture", "food"],
    budget: "moderate",
    vibes: ["cultural", "foodie"],
    travelerType: "family",
    dietaryRestrictions: ["vegetarian"],
    mobilityNeeds: "step-free access",
    requirements: {
      allergies: [],
      dietaryPreferences: ["vegetarian"],
      accessibility: ["step_free_entrance"],
      mobilityNotes:
        "Slow pace, short walks, frequent seated breaks; confirm accessibility before visiting.",
    },
  },
  {
    id: "interlaken-sparse",
    destination: "Interlaken, Switzerland",
    startDate: "2026-11-02",
    endDate: "2026-11-08",
    travelers: 2,
    adults: 2,
    children: 0,
    interests: ["nature"],
    budget: "moderate",
    vibes: ["adventure"],
    travelerType: "couple",
  },
];

export function inclusiveDays(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days: string[] = [];
  for (
    let cursor = start.getTime();
    cursor <= end.getTime();
    cursor += 86_400_000
  ) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return days;
}
