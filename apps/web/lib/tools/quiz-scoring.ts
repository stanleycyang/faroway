import {
  destinationGuides,
  type DestinationGuide,
} from "@/lib/destination-guides";
import type { QuizOption } from "./quiz-questions";

// Map destination vibes to scoring tags
export const DESTINATION_TAGS: Record<string, string[]> = {
  tokyo: ["culture", "foodie", "urban", "solo", "moderate"],
  bali: ["beach", "wellness", "nature", "relaxation", "tropical", "budget"],
  bangkok: [
    "foodie",
    "culture",
    "nightlife",
    "budget",
    "adventure",
    "tropical",
  ],
  dubai: ["luxury", "urban", "adventure", "romantic"],
  paris: ["romantic", "culture", "foodie", "history", "urban", "moderate"],
  barcelona: ["beach", "culture", "foodie", "mediterranean", "nightlife"],
  santorini: [
    "romantic",
    "scenic",
    "beach",
    "relaxation",
    "mediterranean",
    "luxury",
  ],
  london: ["culture", "history", "urban", "foodie", "family"],
  rome: ["history", "foodie", "culture", "romantic", "mediterranean"],
  lisbon: ["culture", "foodie", "nightlife", "budget", "mediterranean"],
  reykjavik: ["nature", "adventure", "scenic", "solo"],
  "new-york": ["urban", "nightlife", "culture", "foodie", "solo"],
  marrakech: ["culture", "adventure", "foodie", "budget"],
  "cape-town": ["nature", "adventure", "scenic", "budget", "beach"],
  singapore: ["foodie", "urban", "family", "luxury", "tropical", "solo"],
  kyoto: ["culture", "history", "scenic", "wellness", "romantic", "moderate"],
  hanoi: ["foodie", "culture", "history", "budget", "solo"],
  phuket: [
    "beach",
    "tropical",
    "relaxation",
    "budget",
    "nightlife",
    "wellness",
  ],
  seoul: ["foodie", "urban", "culture", "nightlife", "solo", "moderate"],
  jaipur: ["culture", "history", "budget", "adventure", "scenic"],
  petra: ["history", "adventure", "scenic", "culture", "solo"],
  amsterdam: ["culture", "urban", "nightlife", "solo", "moderate"],
  istanbul: ["history", "culture", "foodie", "budget", "urban"],
  prague: ["history", "culture", "romantic", "budget", "nightlife"],
  vienna: ["culture", "history", "romantic", "moderate", "family"],
  dublin: ["culture", "history", "nightlife", "solo", "moderate"],
  copenhagen: ["urban", "foodie", "culture", "family", "solo"],
  interlaken: ["nature", "adventure", "scenic", "luxury", "family"],
  "amalfi-coast": [
    "scenic",
    "romantic",
    "beach",
    "mediterranean",
    "luxury",
    "foodie",
  ],
  ibiza: ["beach", "nightlife", "mediterranean", "relaxation", "luxury"],
  chamonix: ["adventure", "nature", "scenic", "luxury", "moderate"],
  cancun: [
    "beach",
    "tropical",
    "relaxation",
    "nightlife",
    "family",
    "moderate",
  ],
  "rio-de-janeiro": [
    "beach",
    "nightlife",
    "nature",
    "adventure",
    "tropical",
    "budget",
  ],
  "costa-rica": [
    "nature",
    "adventure",
    "beach",
    "tropical",
    "wellness",
    "family",
  ],
  "buenos-aires": ["culture", "foodie", "nightlife", "romantic", "budget"],
  havana: ["culture", "history", "budget", "tropical", "nightlife"],
  vancouver: ["nature", "urban", "scenic", "foodie", "family", "moderate"],
  cairo: ["history", "culture", "adventure", "budget"],
  zanzibar: [
    "beach",
    "tropical",
    "relaxation",
    "culture",
    "romantic",
    "budget",
  ],
  queenstown: ["adventure", "nature", "scenic", "solo", "moderate"],
  maldives: [
    "beach",
    "luxury",
    "romantic",
    "relaxation",
    "tropical",
    "wellness",
  ],
  sydney: ["beach", "urban", "nature", "family", "moderate"],
};

export interface QuizResult {
  destination: DestinationGuide;
  score: number;
  matchPercent: number;
  matchReasons: string[];
}

export function scoreDestinations(answers: QuizOption[][]): QuizResult[] {
  // Aggregate tag weights from all answers
  const tagScores: Record<string, number> = {};
  for (const answerSet of answers) {
    for (const option of answerSet) {
      for (const [tag, weight] of Object.entries(option.tags)) {
        tagScores[tag] = (tagScores[tag] || 0) + weight;
      }
    }
  }

  // Score each destination
  const results: QuizResult[] = destinationGuides.map((dest) => {
    const destTags = DESTINATION_TAGS[dest.slug] || [];
    let score = 0;
    const matchReasons: string[] = [];

    for (const tag of destTags) {
      if (tagScores[tag]) {
        score += tagScores[tag];
        matchReasons.push(tag);
      }
    }

    return { destination: dest, score, matchPercent: 0, matchReasons };
  });

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Normalize top result to ~95% and scale others relative
  const maxScore = results[0]?.score || 1;
  for (const result of results) {
    result.matchPercent = Math.round((result.score / maxScore) * 95);
    // Deduplicate and humanize match reasons
    result.matchReasons = [...new Set(result.matchReasons)]
      .slice(0, 3)
      .map(humanizeTag);
  }

  return results.slice(0, 3);
}

function humanizeTag(tag: string): string {
  const map: Record<string, string> = {
    culture: "Rich culture",
    foodie: "Amazing food scene",
    urban: "Vibrant city life",
    beach: "Beautiful beaches",
    nature: "Stunning nature",
    adventure: "Great for adventure",
    romantic: "Romantic atmosphere",
    luxury: "Luxury experiences",
    budget: "Budget-friendly",
    relaxation: "Perfect for relaxation",
    nightlife: "Exciting nightlife",
    history: "Historical landmarks",
    scenic: "Breathtaking scenery",
    wellness: "Wellness retreats",
    solo: "Solo-travel friendly",
    family: "Family-friendly",
    mediterranean: "Mediterranean charm",
    tropical: "Tropical vibes",
    moderate: "Mid-range value",
  };
  return map[tag] || tag;
}
