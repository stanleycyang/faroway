import type { DiningResult, SearchPlan, SuggestedDay } from "./types";

/** Curated branch binding. Extracted source text alone cannot create this record. */
export interface ReviewedDiningAddress {
  id: string;
  destination: string;
  aliases: string[];
  previousAddresses: string[];
  publishedAddress: string;
  sourceUrl: string;
  sourceSha256: string;
  observedAt: string;
  reviewAfter: string;
  branchReview: string;
}
const normalize = (value: string) =>
  value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const matchesBranch = (
  plan: Pick<SearchPlan, "destination">,
  meal: DiningResult,
  fact: ReviewedDiningAddress,
) =>
  normalize(plan.destination) === normalize(fact.destination) &&
  fact.aliases.some((name) => normalize(name) === normalize(meal.name));
function reviewed(fact: ReviewedDiningAddress, asOf: string) {
  try {
    const url = new URL(fact.sourceUrl);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      /^[a-f0-9]{64}$/.test(fact.sourceSha256) &&
      Boolean(fact.branchReview.trim()) &&
      Boolean(fact.publishedAddress.trim()) &&
      validDate(fact.observedAt) &&
      validDate(fact.reviewAfter) &&
      fact.observedAt <= asOf &&
      asOf <= fact.reviewAfter
    );
  } catch {
    return false;
  }
}

/** Staging-generated inventory only. Never reuse coordinates after changing an address. */
export function reconcileGeneratedDiningAddresses(
  plan: Pick<SearchPlan, "destination">,
  input: readonly DiningResult[],
  evidence: readonly ReviewedDiningAddress[],
  asOf = new Date().toISOString().slice(0, 10),
) {
  if (!validDate(asOf)) throw new Error("Valid source review date required");
  const candidates: DiningResult[] = [];
  const applied: Array<{
    id: string;
    name: string;
    evidenceId: string;
    previousAddress: string;
    address: string;
  }> = [];
  const withheld: Array<{ id: string; name: string; reason: string }> = [];
  for (const meal of input) {
    const matches = evidence.filter(
      (fact) =>
        matchesBranch(plan, meal, fact) &&
        fact.previousAddresses.some(
          (address) => normalize(address) === normalize(meal.location.address),
        ),
    );
    if (!matches.length) {
      candidates.push(structuredClone(meal));
      continue;
    }
    if (matches.length !== 1 || !reviewed(matches[0], asOf)) {
      withheld.push({
        id: meal.id,
        name: meal.name,
        reason:
          matches.length !== 1
            ? "ambiguous_address_binding"
            : "address_source_review_required",
      });
      continue;
    }
    const fact = matches[0];
    const note = `Address source: ${fact.sourceUrl} (reviewed ${fact.observedAt}). Coordinates and routes need confirmation.`;
    candidates.push({
      ...structuredClone(meal),
      description: [meal.description, note].filter(Boolean).join("\n\n"),
      location: { name: meal.name, address: fact.publishedAddress },
    });
    applied.push({
      id: meal.id,
      name: meal.name,
      evidenceId: fact.id,
      previousAddress: meal.location.address,
      address: fact.publishedAddress,
    });
  }
  return { candidates, applied, withheld };
}

/** Source notes are attached to selected meals, not promoted into route verification. */
export function appendReviewedAddressNotes(
  plan: Pick<SearchPlan, "destination">,
  input: SuggestedDay[],
  evidence: readonly ReviewedDiningAddress[],
  asOf = new Date().toISOString().slice(0, 10),
) {
  if (!validDate(asOf)) throw new Error("Valid source review date required");
  const days = structuredClone(input);
  for (const day of days)
    for (const slot of ["morning", "afternoon", "evening"] as const) {
      const meal = day[slot].meal;
      if (!meal) continue;
      const matches = evidence.filter(
        (fact) =>
          matchesBranch(plan, meal, fact) &&
          reviewed(fact, asOf) &&
          normalize(fact.publishedAddress) === normalize(meal.location.address),
      );
      if (matches.length !== 1) continue;
      const fact = matches[0];
      const note = `Published address: ${meal.name} — ${fact.publishedAddress}. Source reviewed ${fact.observedAt}: ${fact.sourceUrl}. Confirm the location and route; opening hours and future availability remain unverified.`;
      if (!day.tips.includes(note)) day.tips.push(note);
    }
  return days;
}
