import type { DiningResult, SearchPlan } from "./types";
export interface ReviewedDiningClosure {
  id: string;
  destination: string;
  name: string;
  address: string;
  reportedClosedFrom: string;
  observedAt: string;
  sources: string[];
  sourceNote: string;
}
const normalize = (value: string) =>
  value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const validSource = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

/** Negative evidence only: withhold an exact reported-closed venue until reopening
 * is reviewed. This does not certify future closure or other venues as open.
 */
export function screenReportedDiningClosures(
  plan: Pick<SearchPlan, "destination" | "dates">,
  input: readonly DiningResult[],
  evidence: readonly ReviewedDiningClosure[],
  asOf = new Date().toISOString().slice(0, 10),
) {
  if (!validDate(asOf) || !validDate(plan.dates.start))
    throw new Error("Valid review and trip dates required");
  const withheld: Array<{
    id: string;
    name: string;
    evidenceId: string;
    sources: string[];
  }> = [];
  const candidates = input.filter((meal) => {
    const fact = evidence.find(
      (f) =>
        normalize(f.destination) === normalize(plan.destination) &&
        normalize(f.name) === normalize(meal.name) &&
        normalize(f.address) === normalize(meal.location.address) &&
        validDate(f.reportedClosedFrom) &&
        validDate(f.observedAt) &&
        f.observedAt <= asOf &&
        plan.dates.start >= f.reportedClosedFrom &&
        f.sources.length > 0 &&
        f.sources.every(validSource) &&
        f.sourceNote.trim(),
    );
    if (!fact) return true;
    withheld.push({
      id: meal.id,
      name: meal.name,
      evidenceId: fact.id,
      sources: [...fact.sources],
    });
    return false;
  });
  return { candidates, withheld };
}
