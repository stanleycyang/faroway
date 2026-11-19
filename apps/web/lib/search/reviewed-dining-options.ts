import type { DiningResult, SearchPlan, SuggestedDay } from "./types";
import { findDiningCoverageGaps } from "./dining-coverage";
import { mealBoundaryAnchors } from "./meal-boundaries";

export interface ReviewedDiningOption {
  id: string;
  destination: string;
  anchorNames: string[];
  mealType: string;
  name: string;
  address: string;
  supportedSummary: string;
  unresolvedSummary: string;
  sources: string[];
  observedAt: string;
  reviewAfter: string;
}
const normalize = (value: string) =>
  value.normalize("NFKC").toLowerCase().trim();
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
function sourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Staging review notes only. Published leads never replace meals or certify routes. */
export function appendReviewedDiningOptions(
  plan: Pick<SearchPlan, "destination">,
  input: SuggestedDay[],
  dining: DiningResult[],
  options: readonly ReviewedDiningOption[],
  asOf = new Date().toISOString().slice(0, 10),
): SuggestedDay[] {
  if (!validDate(asOf)) throw new Error("Valid source review date required");
  const days = structuredClone(input);
  for (const gap of findDiningCoverageGaps(days, dining)) {
    if (gap.reason === "separated_visit_anchors") continue;
    const day = days.find((item) => item.dayNumber === gap.dayNumber);
    if (!day) continue;
    const anchors = mealBoundaryAnchors(day, gap.slot);
    if (!anchors.length) continue;
    const option = options.find(
      (item) =>
        normalize(item.destination) === normalize(plan.destination) &&
        item.mealType === gap.mealType &&
        item.name.trim() &&
        item.address.trim() &&
        item.supportedSummary.trim() &&
        item.unresolvedSummary.trim() &&
        validDate(item.observedAt) &&
        validDate(item.reviewAfter) &&
        item.observedAt <= asOf &&
        asOf <= item.reviewAfter &&
        item.sources.length > 0 &&
        item.sources.every(sourceUrl) &&
        anchors.every((anchor) =>
          item.anchorNames.some(
            (name) => normalize(name) === normalize(anchor.name),
          ),
        ) &&
        normalize(day[gap.slot].meal?.name ?? "") !== normalize(item.name),
    );
    if (!option) continue;
    const note = `${gap.mealType[0].toUpperCase()}${gap.mealType.slice(1)} alternative to review: ${option.name}. ${option.supportedSummary} ${option.unresolvedSummary} This is an option to check, not a scheduled meal. Sources reviewed ${option.observedAt}: ${option.sources.join("; ")}`;
    if (!day.tips.includes(note)) day.tips.push(note);
  }
  return days;
}
