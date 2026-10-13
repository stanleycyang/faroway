import type { TripDay } from "@faroway/types";
import type {
  SearchProgress,
  StreamingSpecBlock,
} from "@/hooks/useTripGeneration";

export interface DraftStop {
  name: string;
  period: string;
  description?: string;
  pickedForYou?: string;
}
export interface DraftChapter {
  number: number;
  title: string;
  date: string;
  summary: string;
  stops: DraftStop[];
}
const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const positiveNumber = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;

/** Assemble a stable read-only dossier from actual stream results, never invented discoveries. */
export function draftChapters(
  days: TripDay[] | null | undefined,
  blocks: StreamingSpecBlock[] = [],
): DraftChapter[] {
  const chapters = new Map<number, DraftChapter>();
  let current: DraftChapter | undefined;
  for (const block of blocks) {
    const props = record(block?.props);
    if (block?.type === "ItineraryDay") {
      const number = positiveNumber(props.dayNumber);
      if (!number) {
        current = undefined;
        continue;
      }
      current = chapters.get(number) || {
        number,
        title: "",
        date: "",
        summary: "",
        stops: [],
      };
      current.title = text(props.title) || current.title;
      current.date = text(props.date) || current.date;
      current.summary = text(props.summary) || current.summary;
      chapters.set(number, current);
    } else if (
      current &&
      block?.type === "DayTimeline" &&
      Array.isArray(props.items)
    ) {
      for (const raw of props.items) {
        const item = record(raw);
        if (text(item.title))
          current.stops.push({
            name: text(item.title),
            period: text(item.time),
            description: text(item.description),
            pickedForYou: text(record(item.vibeMatch).reasoning),
          });
      }
    } else if (
      current &&
      (block?.type === "ActivityCard" || block?.type === "RestaurantCard") &&
      text(props.name)
    ) {
      current.stops.push({
        name: text(props.name),
        period: text(props.time),
        description: text(props.description),
      });
    }
  }
  for (const day of Array.isArray(days) ? days : []) {
    const number = positiveNumber(day?.dayNumber);
    if (!number) continue;
    const stops: DraftStop[] = [];
    for (const period of ["morning", "afternoon", "evening"] as const) {
      const slot = record(day[period]);
      const items = [
        ...(Array.isArray(slot.activities) ? slot.activities : []),
        ...(Array.isArray(slot.meals)
          ? slot.meals
          : slot.meal
            ? [slot.meal]
            : []),
      ];
      for (const raw of items) {
        const item = record(raw);
        if (text(item.name))
          stops.push({
            name: text(item.name),
            period,
            description: text(item.description),
            pickedForYou: text(record(item.vibeMatch).reasoning),
          });
      }
    }
    const prior = chapters.get(number);
    chapters.set(number, {
      number,
      title: text(day.title) || prior?.title || "",
      date: text(day.date) || prior?.date || "",
      summary: text(day.summary) || prior?.summary || "",
      stops: stops.length ? stops : prior?.stops || [],
    });
  }
  return [...chapters.values()]
    .sort((a, b) => a.number - b.number)
    .map((chapter) => ({
      ...chapter,
      stops: chapter.stops.filter(
        (stop, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.name === stop.name && candidate.period === stop.period,
          ) === index,
      ),
    }));
}

export function streamStepState(
  key: string,
  phase: string,
  searchProgress: SearchProgress | null,
): "done" | "active" | "waiting" | "interrupted" {
  if (searchProgress?.[key] === "done") return "done";
  if (searchProgress?.[key] === "failed" || searchProgress?.[key] === "error")
    return "interrupted";
  if (phase === "error" || phase === "complete") return "waiting";
  if (searchProgress?.[key] === "searching") return "active";
  if (
    !searchProgress &&
    ((key === "orchestrator" &&
      (phase === "connecting" || phase === "orchestrator")) ||
      (key === "aggregator" && phase === "composing"))
  )
    return "active";
  return "waiting";
}
