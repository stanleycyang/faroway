import { z } from "zod";
import { usageFromModelError } from "@/lib/ai/planning-step";
import { isOperationTimeoutError } from "@/lib/search/runtime";

/**
 * Gemini counts reasoning tokens against maxOutputTokens. With the default
 * high thinking level, an 8,000-token cap can be spent before the itinerary
 * JSON closes. generateObject then throws
 * "No object generated: could not parse the response."
 * Repair accepts a closed object when every day is already present. Otherwise
 * one retry lowers thinking so the answer fits, and raises the cap when the
 * first response was cut off.
 */
export const AGGREGATOR_RETRY_OUTPUT_CEILING = 32000;

export const SuggestedDaySchema = z.object({
  dayNumber: z.number(),
  date: z.string(),
  title: z.string(),
  summary: z.string(),
  hotelId: z.string().optional(),
  morning: z.object({
    activityIds: z.array(z.string()),
    mealId: z.string().nullable().optional(),
  }),
  afternoon: z.object({
    activityIds: z.array(z.string()),
    mealId: z.string().nullable().optional(),
  }),
  evening: z.object({
    activityIds: z.array(z.string()),
    mealId: z.string().nullable().optional(),
  }),
  transportId: z.string().optional(),
  estimatedCost: z.number().optional(),
  currency: z.string().optional(),
  tips: z.array(z.string()),
});

export const ItinerarySchema = z.object({
  days: z.array(SuggestedDaySchema),
  topHotelId: z.string(),
});

export interface AggregatorModelDay {
  dayNumber: number;
  date: string;
  title: string;
  summary: string;
  hotelId?: string;
  morning: { activityIds: string[]; mealId?: string | null };
  afternoon: { activityIds: string[]; mealId?: string | null };
  evening: { activityIds: string[]; mealId?: string | null };
  transportId?: string;
  estimatedCost?: number;
  currency?: string;
  tips: string[];
}

export interface AggregatorModelItinerary {
  days: AggregatorModelDay[];
  topHotelId?: string;
}

export const AGGREGATOR_RETRY_NOTE =
  "\nThe previous response was cut off or was not valid JSON. Return one complete JSON object and no markdown. Include every day in the trip. Keep each summary under 240 characters and at most three short tips per day.";

export function isAggregatorParseFailure(error: unknown): boolean {
  if (isOperationTimeoutError(error)) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("No object generated") ||
    message.includes("could not parse the response") ||
    message.includes("did not match schema")
  );
}

export function aggregatorErrorText(error: unknown): string | undefined {
  const own = textOf(error);
  if (own) return own;
  if (!error || typeof error !== "object") return undefined;
  return textOf((error as { cause?: unknown }).cause);
}

export function aggregatorFinishReason(error: unknown): string | undefined {
  const finish = fieldOf(error, "finishReason");
  return typeof finish === "string" && finish.trim() ? finish : undefined;
}

export function aggregatorResponseTruncated(
  error: unknown,
  maxOutputTokens?: number,
): boolean {
  if (!isAggregatorParseFailure(error)) return false;
  const finish = aggregatorFinishReason(error)?.toLowerCase();
  if (finish === "length" || finish === "max_tokens") return true;
  const output = usageFromModelError(error)?.outputTokens;
  if (
    maxOutputTokens != null &&
    output != null &&
    output >= maxOutputTokens - 64
  ) {
    return true;
  }
  const text = aggregatorErrorText(error);
  return Boolean(text && !jsonTextClosed(text));
}

export function aggregatorRetryMaxOutputTokens(
  requested: number | undefined,
  dayCount: number,
): number | undefined {
  if (requested == null) return undefined;
  const days = Number.isInteger(dayCount) && dayCount > 0 ? dayCount : 1;
  const answerFloor = Math.max(4000, days * 800 + 2000);
  return Math.min(
    AGGREGATOR_RETRY_OUTPUT_CEILING,
    Math.max(requested * 2, answerFloor),
  );
}

export function lowThinkingProviderOptions(
  base: unknown,
): Record<string, unknown> {
  const record = asRecord(base) ?? {};
  const apply = (provider: string) => {
    const current = asRecord(record[provider]) ?? {};
    const thinking = asRecord(current.thinkingConfig) ?? {};
    return {
      ...current,
      thinkingConfig: { ...thinking, thinkingLevel: "low" },
    };
  };
  return {
    ...record,
    google: apply("google"),
    vertex: apply("vertex"),
  };
}

export function itineraryFromModelText(
  text: string,
): AggregatorModelItinerary | null {
  const value = parseModelJson(text);
  const root = asRecord(value);
  if (!root) return null;
  const extracted = parseDaysField(root.days);
  if (!extracted.days) return null;
  const days = extracted.days.flatMap((day, index) => {
    const normalized = normalizeDay(day, index);
    return normalized ? [normalized] : [];
  });
  if (!days.length) return null;
  return {
    days,
    topHotelId: copyId(root.topHotelId) ?? extracted.topHotelId,
  };
}

/** Schema-valid JSON for a repaired response that already contains every day. */
export function repairAggregatorResponseText(
  text: string,
  dayCount: number,
): string | null {
  const itinerary = itineraryFromModelText(text);
  if (!itinerary || itinerary.days.length < dayCount) return null;
  const parsed = ItinerarySchema.safeParse({
    topHotelId: itinerary.topHotelId ?? "",
    days: itinerary.days.map(schemaDay),
  });
  return parsed.success ? JSON.stringify(parsed.data) : null;
}

function schemaDay(day: AggregatorModelDay) {
  return {
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.title,
    summary: day.summary,
    ...(day.hotelId ? { hotelId: day.hotelId } : {}),
    morning: slotSchema(day.morning),
    afternoon: slotSchema(day.afternoon),
    evening: slotSchema(day.evening),
    ...(day.transportId ? { transportId: day.transportId } : {}),
    ...(day.estimatedCost !== undefined
      ? { estimatedCost: day.estimatedCost }
      : {}),
    ...(day.currency ? { currency: day.currency } : {}),
    tips: day.tips,
  };
}

function slotSchema(slot: { activityIds: string[]; mealId?: string | null }) {
  return {
    activityIds: slot.activityIds,
    ...(slot.mealId !== undefined ? { mealId: slot.mealId } : {}),
  };
}

function parseModelJson(text: string): unknown {
  const json = repairJsonText(text);
  if (!json) return null;
  try {
    const value = JSON.parse(json) as unknown;
    if (typeof value !== "string") return value;
    const inner = repairJsonText(value);
    return inner ? (JSON.parse(inner) as unknown) : null;
  } catch {
    return null;
  }
}

function parseDaysField(days: unknown): {
  days: unknown[] | null;
  topHotelId?: string;
} {
  if (Array.isArray(days)) return { days };
  if (typeof days !== "string") return { days: null };
  const trimmed = days.trim();
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayEnd === -1) {
    const repaired = repairJsonText(trimmed.startsWith("[") ? trimmed : "");
    if (!repaired) return { days: null };
    try {
      const parsed = JSON.parse(repaired) as unknown;
      return { days: Array.isArray(parsed) ? parsed : null };
    } catch {
      return { days: null };
    }
  }
  const arrayText = trimmed.slice(0, arrayEnd + 1);
  const remaining = trimmed.slice(arrayEnd + 1);
  const parsed = parseModelJson(arrayText);
  const hotel = /"topHotelId"\s*:\s*"([^"]+)"/.exec(remaining);
  return {
    days: Array.isArray(parsed) ? parsed : null,
    topHotelId: hotel?.[1],
  };
}

function normalizeDay(
  value: unknown,
  index: number,
): AggregatorModelDay | null {
  const day = asRecord(value);
  if (!day) return null;
  const morning = asRecord(day.morning);
  const afternoon = asRecord(day.afternoon);
  const evening = asRecord(day.evening);
  const activities = Array.isArray(day.activities) ? day.activities : null;
  if (morning || afternoon || evening) {
    if (!morning || !afternoon || !evening) return null;
  } else if (!activities) {
    return null;
  }
  const dayNumber =
    typeof day.dayNumber === "number" && Number.isFinite(day.dayNumber)
      ? day.dayNumber
      : index + 1;
  const slots = activities
    ? {
        morning: {
          activityIds: idsForSlot(activities, "morning"),
          mealId: explicitMeal(day.breakfastId),
        },
        afternoon: {
          activityIds: idsForSlot(activities, "afternoon"),
          mealId: explicitMeal(day.lunchId),
        },
        evening: {
          activityIds: idsForSlot(activities, "evening"),
          mealId: explicitMeal(day.dinnerId),
        },
      }
    : {
        morning: {
          activityIds: idList(morning?.activityIds),
          mealId: mealFromSlot(morning),
        },
        afternoon: {
          activityIds: idList(afternoon?.activityIds),
          mealId: mealFromSlot(afternoon),
        },
        evening: {
          activityIds: idList(evening?.activityIds),
          mealId: mealFromSlot(evening),
        },
      };
  const estimatedCost =
    typeof day.estimatedCost === "number" && Number.isFinite(day.estimatedCost)
      ? day.estimatedCost
      : undefined;
  return {
    dayNumber,
    date: typeof day.date === "string" ? day.date : "",
    title:
      typeof day.title === "string" && day.title.trim()
        ? day.title
        : `Day ${dayNumber}`,
    summary: typeof day.summary === "string" ? day.summary : "",
    hotelId: copyId(day.hotelId),
    ...slots,
    transportId: copyId(day.transportId),
    estimatedCost,
    currency: copyId(day.currency),
    tips: Array.isArray(day.tips)
      ? day.tips.filter((tip): tip is string => typeof tip === "string")
      : typeof day.tips === "string" && day.tips
        ? [day.tips]
        : [],
  };
}

function explicitMeal(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return copyId(value) ?? null;
}

function mealFromSlot(
  slot: Record<string, unknown> | null,
): string | null | undefined {
  if (!slot || !("mealId" in slot)) return undefined;
  if (slot.mealId === null) return null;
  return copyId(slot.mealId);
}

function idsForSlot(activities: unknown[], slot: string): string[] {
  return activities.flatMap((item) => {
    const record = asRecord(item);
    if (!record || record.slot !== slot) return [];
    const id = copyId(record.id);
    return id ? [id] : [];
  });
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const id = copyId(item);
    return id ? [id] : [];
  });
}

function copyId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function repairJsonText(text: string): string | null {
  const candidate = extractJsonCandidate(text);
  if (!candidate) return null;
  if (canParse(candidate)) return candidate;
  const closed = closeJson(candidate);
  return closed && canParse(closed) ? closed : null;
}

function jsonTextClosed(text: string): boolean {
  const candidate = extractJsonCandidate(text);
  return Boolean(candidate && canParse(candidate));
}

function extractJsonCandidate(text: string): string | null {
  let source = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(source);
  if (fenced?.[1]) source = fenced[1].trim();
  else source = source.replace(/^```(?:json)?\s*/i, "").trim();
  const start = source.indexOf("{");
  const arrayStart = source.indexOf("[");
  const chosen =
    start === -1
      ? arrayStart
      : arrayStart === -1
        ? start
        : Math.min(start, arrayStart);
  if (chosen < 0) return null;
  return source.slice(chosen);
}

function canParse(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function closeJson(input: string): string | null {
  let out = "";
  let inString = false;
  let escape = false;
  const stack: Array<"{" | "["> = [];
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? "";
    if (inString) {
      out += char;
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }
    if (char === ",") {
      let next = index + 1;
      while (next < input.length && /\s/.test(input[next] ?? "")) next += 1;
      const following = input[next];
      if (
        following === undefined ||
        following === "}" ||
        following === "]" ||
        following === ","
      ) {
        continue;
      }
      out += char;
      continue;
    }
    if (char === "{") stack.push("{");
    else if (char === "[") stack.push("[");
    else if ((char === "}" || char === "]") && stack.length) stack.pop();
    out += char;
  }
  if (escape && out.endsWith("\\")) out = out.slice(0, -1);
  if (inString) out += '"';
  out = out.replace(/,\s*$/, "");
  if (stack.at(-1) === "{" && /,\s*"(?:[^"\\]|\\.)*"\s*$/.test(out)) {
    out = out.replace(/,\s*"(?:[^"\\]|\\.)*"\s*$/, "");
  }
  if (/:\s*$/.test(out)) out += "null";
  while (stack.length) {
    out = out.replace(/,\s*$/, "");
    out += stack.pop() === "{" ? "}" : "]";
  }
  return out;
}

function textOf(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const text = (value as { text?: unknown }).text;
  return typeof text === "string" && text.trim() ? text : undefined;
}

function fieldOf(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (record[key] != null) return record[key];
  const cause = record.cause;
  if (cause && typeof cause === "object")
    return (cause as Record<string, unknown>)[key];
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
