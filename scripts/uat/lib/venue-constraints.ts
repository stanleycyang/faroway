import type { AgenticTrace } from "./agentic-eval";

export interface VenueConstraint {
  id: string;
  destination: string;
  aliases: string[];
  sourceUrl: string;
  observedAt: string;
  closedWeekdays?: number[];
  temporarilyClosed?: boolean;
}
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Frozen, independently sourced facts. A past closure does not prove future closure. */
export function evaluateVenueConstraints(
  trace: AgenticTrace,
  facts: VenueConstraint[],
) {
  const matches: Array<{
    venueId: string;
    date: string;
    finding: string;
    sourceUrl: string;
    observedAt: string;
  }> = [];
  const output = trace.steps.find((step) => step.step === "aggregator")
    ?.output as
    | {
        days?: Array<{
          date: string;
          [key: string]: unknown;
        }>;
      }
    | undefined;
  for (const day of output?.days ?? []) {
    for (const slot of ["morning", "afternoon", "evening"]) {
      const items =
        (day[slot] as { activities?: Array<{ name: string }> } | undefined)
          ?.activities ?? [];
      for (const item of items) {
        for (const fact of facts) {
          if (
            !normalize(trace.brief.destination).includes(
              normalize(fact.destination),
            ) ||
            !fact.aliases.some((alias) =>
              normalize(item.name).includes(normalize(alias)),
            )
          )
            continue;
          const weekday = new Date(day.date + "T12:00:00Z").getUTCDay();
          if (fact.closedWeekdays?.includes(weekday))
            matches.push({
              venueId: fact.id,
              date: day.date,
              finding: "scheduled_on_reported_closed_weekday",
              sourceUrl: fact.sourceUrl,
              observedAt: fact.observedAt,
            });
          if (fact.temporarilyClosed)
            matches.push({
              venueId: fact.id,
              date: day.date,
              finding: "reopening_confirmation_required",
              sourceUrl: fact.sourceUrl,
              observedAt: fact.observedAt,
            });
        }
      }
    }
  }
  return {
    findings: matches,
    coverage:
      "Only listed venue constraints are checked; no finding does not establish availability.",
  };
}
