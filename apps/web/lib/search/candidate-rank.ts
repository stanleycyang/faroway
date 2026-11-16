import type { ActivityResult } from "@faroway/types";

/** A supplier product with a real https handoff. Catalog-only and planning prompts are not bookable. */
export function isFittingBookableActivity(
  activity: Pick<
    ActivityResult,
    "affiliatePartner" | "affiliateUrl" | "supplierCatalogOnly" | "planningIdea"
  >,
): boolean {
  return Boolean(
    activity.affiliatePartner &&
    activity.affiliateUrl?.startsWith("https://") &&
    activity.supplierCatalogOnly !== true &&
    activity.planningIdea !== true,
  );
}

/**
 * Order inventory for prompts and shortlists.
 * Interest match stays first. A fitting supplier product wins only a tie,
 * or replaces a non-bookable item within 15 vibe points when the shortlist is full.
 * That is not an affiliate quota: a poor product match still stays out.
 */
export function rankActivityInventory(
  activities: ActivityResult[],
  limit?: number,
): ActivityResult[] {
  const ranked = activities
    .filter((activity) => activity.planningIdea !== true)
    .sort(
      (a, b) =>
        b.vibeScore - a.vibeScore ||
        Number(isFittingBookableActivity(b)) -
          Number(isFittingBookableActivity(a)) ||
        a.id.localeCompare(b.id),
    );
  if (limit === undefined || ranked.length <= limit) return ranked;
  const kept = ranked.slice(0, limit);
  const ids = new Set(kept.map((item) => item.id));
  const floor = kept[kept.length - 1]?.vibeScore ?? 0;
  for (const candidate of ranked) {
    if (ids.has(candidate.id) || !isFittingBookableActivity(candidate))
      continue;
    if (candidate.vibeScore < floor - 15) continue;
    const replace = [...kept]
      .reverse()
      .find(
        (item) =>
          !isFittingBookableActivity(item) &&
          item.vibeScore <= candidate.vibeScore + 15,
      );
    if (!replace) continue;
    kept[kept.indexOf(replace)] = candidate;
    ids.add(candidate.id);
  }
  return kept.sort(
    (a, b) =>
      b.vibeScore - a.vibeScore ||
      Number(isFittingBookableActivity(b)) -
        Number(isFittingBookableActivity(a)) ||
      a.id.localeCompare(b.id),
  );
}

/** Small beam bonus. Geography and highlight coverage still dominate. */
export const BOOKABLE_FIT_BONUS = 0.5;
