import type { AgenticTrace } from "./agentic-eval";

/** Manually adjudicated exact branch/address cases, never model-authored truth. */
export interface VenueAddressEvidence {
  id: string;
  destination: string;
  aliases: string[];
  sourceUrl: string;
  observedAt: string;
  sourceAddress: string;
  supportedAddresses: string[];
  contradictedAddresses: string[];
}
const normalize = (value: string) =>
  value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/** Exact reviewed matches only. Unknown spellings/branches must not inherit evidence. */
export function evaluateVenueAddresses(
  trace: AgenticTrace,
  evidence: VenueAddressEvidence[],
  asOf: string,
  scope: "selected_meals" | "dining_inventory" = "selected_meals",
) {
  const timestamp = Date.parse(asOf + "T00:00:00Z");
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== asOf
  )
    throw new Error("Invalid evidence review date");
  const output = trace.steps.find((s) => s.step === "aggregator")?.output as
    | {
        days?: Array<{
          date: string;
          morning?: Slot;
          afternoon?: Slot;
          evening?: Slot;
        }>;
      }
    | undefined;
  type Slot = { meal?: { name: string; location?: { address?: string } } };
  const candidates =
    scope === "selected_meals"
      ? (output?.days ?? []).flatMap((day) =>
          (["morning", "afternoon", "evening"] as const).flatMap((slot) => {
            const meal = day[slot]?.meal;
            return meal
              ? [
                  {
                    date: day.date as string | null,
                    slot: slot as string,
                    meal,
                  },
                ]
              : [];
          }),
        )
      : (
          (trace.steps.find((s) => s.step === "dining")?.output ??
            []) as NonNullable<Slot["meal"]>[]
        ).map((meal) => ({ date: null, slot: "inventory", meal }));
  const results = [];
  for (const { date, slot, meal } of candidates) {
    const matches = evidence.filter(
      (f) =>
        normalize(f.destination) === normalize(trace.brief.destination) &&
        f.aliases.some((a) => normalize(a) === normalize(meal.name)),
    );
    const fact = matches.length === 1 ? matches[0] : undefined;
    let status: "supported_address" | "contradicted_address" | "unresolved" =
      "unresolved";
    let reason =
      matches.length > 1 ? "ambiguous_evidence" : "no_reviewed_branch";
    if (fact) {
      const observed = Date.parse(fact.observedAt + "T00:00:00Z");
      const ageDays = (timestamp - observed) / 86400000;
      const address = normalize(meal.location?.address ?? "");
      const validDate =
        Number.isFinite(observed) &&
        new Date(observed).toISOString().slice(0, 10) === fact.observedAt;
      if (!validDate || ageDays < 0 || ageDays > 90)
        reason = "stale_or_invalid_evidence";
      else if (
        !/^https:\/\//.test(fact.sourceUrl) ||
        !fact.sourceAddress.trim()
      )
        reason = "incomplete_evidence";
      else {
        const supported =
          address !== "" &&
          fact.supportedAddresses.some((a) => normalize(a) === address);
        const contradicted =
          address !== "" &&
          fact.contradictedAddresses.some((a) => normalize(a) === address);
        if (supported && contradicted) reason = "conflicting_evidence";
        else if (contradicted) {
          status = "contradicted_address";
          reason = "reviewed_address_conflict";
        } else if (supported) {
          status = "supported_address";
          reason = "reviewed_address_match";
        } else reason = "address_not_adjudicated";
      }
    }
    results.push({
      date,
      slot,
      name: meal.name,
      address: meal.location?.address ?? "",
      status,
      reason,
      evidenceId: fact?.id ?? null,
      sourceUrl: fact?.sourceUrl ?? null,
      observedAt: fact?.observedAt ?? null,
    });
  }
  return {
    scope,
    evaluatedCount: results.length,
    results,
    supported: results.filter((r) => r.status === "supported_address").length,
    contradicted: results.filter((r) => r.status === "contradicted_address")
      .length,
    unresolved: results.filter((r) => r.status === "unresolved").length,
    futureAvailabilityVerified: false as const,
    routeFeasibilityVerified: false as const,
    mealServiceVerified: false as const,
    coverage: `${scope === "selected_meals" ? "Selected meal" : "Full dining inventory"} addresses only; exact manually reviewed aliases. Unresolved addresses are not passes. This does not verify future hours, menus, dietary needs, accessibility or route times.`,
  };
}
