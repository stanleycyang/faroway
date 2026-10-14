import { createHash } from "node:crypto";
import type { PlanCommandInput } from "./plan-command";
export { PlanCommand, type PlanCommandInput } from "./plan-command";
import { canDisplayViatorContent } from "@/lib/affiliates/viator-policy";

export const periods = ["morning", "afternoon", "evening"] as const;
type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}
export function stampPlanItems(tripId: string, value: unknown): RecordValue[] {
  if (!Array.isArray(value) || value.length > 366)
    throw new Error("This plan cannot be edited yet.");
  const days = structuredClone(value) as RecordValue[];
  const seen = new Set<string>();
  days.forEach((day, dayIndex) => {
    for (const period of periods) {
      const block = record(day[period]);
      if (!Array.isArray(block.activities)) continue;
      block.activities = block.activities.map((value, index) => {
        const item = record(value);
        const id =
          typeof item.planItemId === "string" &&
          /^item_[a-f0-9]{32}$/.test(item.planItemId)
            ? item.planItemId
            : `item_${createHash("md5").update(`${tripId}:${dayIndex}:${period}:${index}`).digest("hex")}`;
        if (seen.has(id))
          throw new Error(
            "This plan has conflicting item identities. Refresh before editing.",
          );
        seen.add(id);
        return { ...item, planItemId: id };
      });
    }
  });
  return days;
}
export function planItems(days: RecordValue[], locked: string[]) {
  return days.flatMap((day, dayIndex) =>
    periods.flatMap((period) => {
      const activities = record(day[period]).activities;
      return Array.isArray(activities)
        ? activities.map((value, index) => {
            const item = record(value);
            return {
              item,
              id: String(item.planItemId),
              dayIndex,
              period,
              index,
              date: String(day.date ?? ""),
              name: String(item.name ?? "Activity"),
              locked: locked.includes(String(item.planItemId)),
            };
          })
        : [];
    }),
  );
}
export function editPlan(
  days: RecordValue[],
  locked: string[],
  command: PlanCommandInput,
) {
  const result = structuredClone(days);
  const items = planItems(result, locked);
  const selected = items.find((item) => item.id === command.itemId);
  if (!selected || !canDisplayViatorContent(selected.item))
    throw new Error("This activity is unavailable. Refresh your plan.");
  if (command.action === "lock")
    return { days: result, locked: [...new Set([...locked, selected.id])] };
  if (command.action === "unlock")
    return { days: result, locked: locked.filter((id) => id !== selected.id) };
  const other = items.find((item) => item.id === command.otherItemId);
  if (!other || !canDisplayViatorContent(other.item))
    throw new Error("The other activity is unavailable. Refresh your plan.");
  if (selected.locked || other.locked)
    throw new Error("Unlock these activities before swapping them.");
  const a = record(result[selected.dayIndex][selected.period])
    .activities as RecordValue[];
  const b = record(result[other.dayIndex][other.period])
    .activities as RecordValue[];
  // Keep identities and provider content intact. Schedule position is the plan's
  // slot; do not rewrite supplier content or claim availability on the new date.
  const first = { ...a[selected.index], timeOfDay: other.period };
  a[selected.index] = { ...b[other.index], timeOfDay: selected.period };
  b[other.index] = first;
  for (const index of new Set([selected.dayIndex, other.dayIndex])) {
    result[index].title = `Day ${index + 1}`;
    result[index].summary =
      "Schedule updated. Check travel times and opening hours.";
    result[index].tips = [];
    delete result[index].totalEstimatedCost;
  }
  return { days: result, locked };
}
