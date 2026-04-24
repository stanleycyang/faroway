export const MILESTONES = [5, 10, 25, 50, 100] as const;

export type Milestone = (typeof MILESTONES)[number];

// Returns the highest milestone crossed when the count moves from
// `prevCount` to `nextCount`, or null if none were crossed. "Crossed" means
// `prevCount < M <= nextCount`. We return the highest so jumping from 4 → 12
// (e.g. after a bulk import) still fires a single celebratory toast.
export function nextMilestoneCrossed(
  prevCount: number,
  nextCount: number,
): Milestone | null {
  if (nextCount <= prevCount) return null;
  let highest: Milestone | null = null;
  for (const m of MILESTONES) {
    if (m > prevCount && m <= nextCount) highest = m;
  }
  return highest;
}

export const MILESTONE_COPY: Record<Milestone, string> = {
  5: "Your map's starting to take shape.",
  10: "Double digits — nicely done.",
  25: "That's more than most people visit in a decade.",
  50: "Fifty countries. You're officially well-travelled.",
  100: "A hundred countries. Rare air.",
};
