import { diningSourceReviewEnabled } from "../search/dining-source-review-gate";

// Shared by the active planning agents and the native disclosure endpoint.
// Changing recipients, routing or data categories requires a new version.
export const PLANNING_MODEL = "google/gemini-3-flash";
export const PLANNING_PROVIDER_OPTIONS = {
  gateway: { only: ["google", "vertex"] },
};
export const PLANNING_DISCLOSURE = {
  version: "planning-google-v1",
  title: "Share trip details with AI?",
  message:
    "To plan this trip, Faroway sends your destination, dates, traveler details, budget, interests and preferences to Vercel AI Gateway and Google (Gemini). This can include dietary or accessibility needs and other personal details you put in your trip brief. Generated planning context is also processed to build the itinerary.\n\nChoose Share and plan to allow this request. Declining keeps your saved trips available. AI suggestions can be wrong; check details before booking.",
  model: PLANNING_MODEL,
};

export function currentPlanningDisclosure(
  env: Record<string, string | undefined> = process.env,
) {
  if (!diningSourceReviewEnabled(env)) return PLANNING_DISCLOSURE;
  return {
    ...PLANNING_DISCLOSURE,
    version: "planning-google-parallel-v1",
    message: PLANNING_DISCLOSURE.message.replace(
      "\n\nChoose Share and plan",
      "\n\nThis staging version also sends your destination, a general area and a meal type to Parallel through Vercel AI Gateway to look up public restaurant pages. Retrieved pages are processed by Google to suggest dining options. These options still need checking.\n\nChoose Share and plan",
    ),
  };
}

export function isStalePlanningDisclosure(headers: Headers): boolean {
  const version = headers.get("x-faroway-ai-disclosure");
  return version !== currentPlanningDisclosure().version;
}
