import { travelerAvailability } from "./traveler-availability";
import type { PublishedEvent } from "../../../../scripts/uat/lib/published-events";
import type { ActivityResult, SearchPlan, SuggestedDay } from "./types";
export interface ReviewedEventOption {
  id: string;
  destination: string;
  triggerNames: string[];
  sourceSha256: string;
  reviewAfter: string;
  event: PublishedEvent;
}
const normalize = (value: string) =>
  value.normalize("NFKC").trim().toLowerCase();
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
function validSource(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
/** Reviewed leads only: exact dates and trigger names; no automatic visit insertion. */
export function appendReviewedEventOptions(
  plan: Pick<SearchPlan, "destination" | "mobilityNeeds" | "requirements">,
  input: SuggestedDay[],
  deferred: ActivityResult[],
  options: readonly ReviewedEventOption[],
  asOf = new Date().toISOString().slice(0, 10),
): SuggestedDay[] {
  if (!validDate(asOf)) throw new Error("Valid event review date required");
  const days = structuredClone(input);
  const availability = travelerAvailability(plan, days.length);
  for (const [dayIndex, day] of days.entries()) {
    const matches = options
      .filter((option) => {
        const event = option.event;
        const observed = event.observedAt.slice(0, 10);
        const window = availability.windows[dayIndex];
        const [hour, minute] = event.localTime.split(":").map(Number);
        const startMinute = hour * 60 + minute;
        return (
          normalize(option.destination) === normalize(plan.destination) &&
          option.triggerNames.some((name) =>
            deferred.some(
              (activity) => normalize(activity.name) === normalize(name),
            ),
          ) &&
          /^[a-f0-9]{64}$/.test(option.sourceSha256) &&
          validDate(observed) &&
          Number.isFinite(Date.parse(event.observedAt)) &&
          observed <= asOf &&
          validDate(option.reviewAfter) &&
          asOf <= option.reviewAfter &&
          validDate(event.localDate) &&
          day.date === event.localDate &&
          day.date >= asOf &&
          (!window ||
            (startMinute >= window.earliestMinute &&
              startMinute < window.latestMinute)) &&
          /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.localTime) &&
          event.startDate.startsWith(
            `${event.localDate}T${event.localTime}:`,
          ) &&
          /(?:Z|[+-]\d{2}:\d{2})$/.test(event.startDate) &&
          Number.isFinite(Date.parse(event.startDate)) &&
          ["scheduled", "unspecified"].includes(event.status) &&
          event.name.trim() &&
          event.venueName?.trim() &&
          validSource(event.sourceUrl)
        );
      })
      .slice(0, 3);
    for (const { event } of matches) {
      const note = `Published event to review (not scheduled): ${event.name} — ${event.localDate}, ${event.localTime} local at ${event.venueName}. End time, duration and ticket availability remain unverified. Confirm the organizer's current details before replacing a visit. Source reviewed ${event.observedAt.slice(0, 10)}: ${event.sourceUrl}`;
      if (!day.tips.includes(note)) day.tips.push(note);
    }
  }
  return days;
}
