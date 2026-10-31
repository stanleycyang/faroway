import type { AgenticTrace } from "./agentic-eval";

export interface VenueConstraint {
  id: string;
  destination: string;
  aliases: string[];
  sourceUrl: string;
  observedAt: string;
  closedWeekdays?: number[];
  closedDates?: string[];
  /** Closure of the matched venue/location, not necessarily the institution. */
  closedFrom?: string;
  temporarilyClosed?: boolean;
  /** Published seasonal service window; presence within it does not establish availability. */
  reportedOperatingMonths?: number[];
}
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Match reviewed constraints for one candidate/date; absence is not availability. */
export function venueConstraintsForDate(
  destination: string,
  name: string,
  date: string,
  facts: VenueConstraint[],
) {
  for (const fact of facts) {
    if (
      fact.reportedOperatingMonths &&
      (!fact.reportedOperatingMonths.length ||
        fact.reportedOperatingMonths.some(
          (month) => !Number.isInteger(month) || month < 1 || month > 12,
        ))
    )
      throw new Error("Invalid operating-month evidence");
  }
  const matches: Array<{
    venueId: string;
    date: string;
    finding: string;
    sourceUrl: string;
    observedAt: string;
  }> = [];
  for (const fact of facts) {
    if (
      !normalize(destination).includes(normalize(fact.destination)) ||
      !fact.aliases.some((alias) => normalize(name).includes(normalize(alias)))
    )
      continue;
    const weekday = new Date(date + "T12:00:00Z").getUTCDay();
    if (
      fact.closedDates?.includes(date) ||
      (fact.closedFrom && date >= fact.closedFrom)
    )
      matches.push({
        venueId: fact.id,
        date: date,
        finding: "scheduled_on_reported_closed_date",
        sourceUrl: fact.sourceUrl,
        observedAt: fact.observedAt,
      });
    if (fact.closedWeekdays?.includes(weekday))
      matches.push({
        venueId: fact.id,
        date: date,
        finding: "scheduled_on_reported_closed_weekday",
        sourceUrl: fact.sourceUrl,
        observedAt: fact.observedAt,
      });
    if (
      fact.reportedOperatingMonths &&
      !fact.reportedOperatingMonths.includes(
        new Date(date + "T12:00:00Z").getUTCMonth() + 1,
      )
    )
      matches.push({
        venueId: fact.id,
        date: date,
        finding: "outside_reported_operating_season",
        sourceUrl: fact.sourceUrl,
        observedAt: fact.observedAt,
      });
    if (fact.temporarilyClosed)
      matches.push({
        venueId: fact.id,
        date: date,
        finding: "reopening_confirmation_required",
        sourceUrl: fact.sourceUrl,
        observedAt: fact.observedAt,
      });
  }
  return matches;
}

/** Frozen, independently sourced facts. A past closure does not prove future closure. */
export function evaluateVenueConstraints(
  trace: AgenticTrace,
  facts: VenueConstraint[],
) {
  const matches: ReturnType<typeof venueConstraintsForDate> = [];
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
      for (const item of items)
        matches.push(
          ...venueConstraintsForDate(
            trace.brief.destination,
            item.name,
            day.date,
            facts,
          ),
        );
    }
  }
  return {
    findings: matches,
    coverage:
      "Only listed venue constraints are checked; no finding does not establish availability.",
  };
}
