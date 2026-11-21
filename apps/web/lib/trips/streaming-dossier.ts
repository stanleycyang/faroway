import type {
  ActivityResult,
  DiningResult,
  HotelResult,
  SearchPlan,
  TransportResult,
  TripDay,
} from "@faroway/types";
import type {
  SearchProgress,
  StreamingSpecBlock,
} from "@/hooks/useTripGeneration";

export type AgentDiscoveryAgent =
  | "orchestrator"
  | "hotels"
  | "activities"
  | "dining"
  | "transport"
  | "enrichment"
  | "aggregator";

export interface AgentDiscovery {
  id: string;
  agent: AgentDiscoveryAgent;
  headline: string;
  detail?: string;
  badge?: string;
  timestamp: number;
}

export const MAX_AGENT_DISCOVERIES = 12;

const VALID_DISCOVERY_AGENTS = new Set<AgentDiscoveryAgent>([
  "orchestrator",
  "hotels",
  "activities",
  "dining",
  "transport",
  "enrichment",
  "aggregator",
]);

export interface DraftStop {
  name: string;
  period: string;
  description?: string;
  pickedForYou?: string;
  kind: "activity" | "dining" | "stay" | "stop";
  /** Present only when the stream included an https supplier URL. */
  supplierLink: boolean;
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
            kind: item.type === "restaurant" ? "dining" : "activity",
            supplierLink: text(item.bookingUrl).startsWith("https://"),
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
        kind: block.type === "RestaurantCard" ? "dining" : "activity",
        supplierLink:
          text(props.bookingUrl).startsWith("https://") ||
          text(props.reservationUrl).startsWith("https://"),
      });
    }
  }
  for (const day of Array.isArray(days) ? days : []) {
    const number = positiveNumber(day?.dayNumber);
    if (!number) continue;
    const stops: DraftStop[] = [];
    for (const period of ["morning", "afternoon", "evening"] as const) {
      const slot = record(day[period]);
      const meals = Array.isArray(slot.meals)
        ? slot.meals
        : slot.meal
          ? [slot.meal]
          : [];
      const items: Array<{ raw: unknown; kind: DraftStop["kind"] }> = [
        ...(Array.isArray(slot.activities) ? slot.activities : []).map(
          (raw) => ({ raw, kind: "activity" as const }),
        ),
        ...meals.map((raw) => ({ raw, kind: "dining" as const })),
      ];
      for (const entry of items) {
        const item = record(entry.raw);
        if (text(item.name))
          stops.push({
            name: text(item.name),
            period,
            description: text(item.description),
            pickedForYou: text(record(item.vibeMatch).reasoning),
            kind: entry.kind,
            supplierLink: text(
              record(item.bookingInfo).bookingUrl ||
                record(item.reservationInfo).url ||
                item.affiliateUrl,
            ).startsWith("https://"),
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

export function isDiscoveryAgent(value: unknown): value is AgentDiscoveryAgent {
  return (
    typeof value === "string" &&
    VALID_DISCOVERY_AGENTS.has(value as AgentDiscoveryAgent)
  );
}

/** Validate and normalize an untrusted discovery payload. */
export function normalizeAgentDiscovery(
  value: unknown,
  fallbackTimestamp = Date.now(),
): AgentDiscovery | null {
  const item = record(value);
  const id = text(item.id);
  const headline = text(item.headline);
  if (!id || !headline || !isDiscoveryAgent(item.agent)) return null;

  const detail = text(item.detail) || undefined;
  const badge = text(item.badge) || undefined;
  const timestamp =
    typeof item.timestamp === "number" && Number.isFinite(item.timestamp)
      ? item.timestamp
      : fallbackTimestamp;

  return {
    id,
    agent: item.agent,
    headline,
    ...(detail ? { detail } : {}),
    ...(badge ? { badge } : {}),
    timestamp,
  };
}

/**
 * Deduplicate discoveries by id and bound list length (keeping the most recent items).
 * When `preferExisting` is true, existing entries with the same id are kept instead of overwritten.
 */
export function mergeDiscoveries(
  existing: readonly AgentDiscovery[],
  incoming: readonly AgentDiscovery[],
  maxItems = MAX_AGENT_DISCOVERIES,
  options?: { preferExisting?: boolean },
): AgentDiscovery[] {
  const limit = Math.max(0, Math.floor(maxItems));
  if (limit === 0) return [];

  const preferExisting = options?.preferExisting === true;
  const ordered: AgentDiscovery[] = [];
  const indexById = new Map<string, number>();

  const pushOrUpdate = (raw: AgentDiscovery, isIncoming: boolean) => {
    const normalized = normalizeAgentDiscovery(raw, raw.timestamp);
    if (!normalized) return;
    const existingIndex = indexById.get(normalized.id);
    if (existingIndex !== undefined) {
      if (isIncoming && !preferExisting) {
        ordered[existingIndex] = normalized;
      }
      return;
    }
    indexById.set(normalized.id, ordered.length);
    ordered.push(normalized);
  };

  for (const item of existing) pushOrUpdate(item, false);
  for (const item of incoming) pushOrUpdate(item, true);

  return ordered.length > limit ? ordered.slice(-limit) : ordered;
}

function countDayStops(day: TripDay): number {
  let count = 0;
  for (const period of ["morning", "afternoon", "evening"] as const) {
    const slot = record(day[period]);
    if (Array.isArray(slot.activities)) count += slot.activities.length;
    if (Array.isArray(slot.meals)) count += slot.meals.length;
    else if (slot.meal) count += 1;
  }
  return count;
}

function topNeighborhood(
  items: ReadonlyArray<{ location?: { neighborhood?: string; name?: string } }>,
): string | undefined {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = text(item.location?.neighborhood);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

function uniqueStrings(
  values: readonly (string | undefined | null)[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const cleaned = text(raw);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

export interface DiscoveryExtractionInput {
  discoveries?: readonly unknown[] | null;
  searchProgress?: SearchProgress | null;
  topHotel?: HotelResult | null;
  activitiesCount?: number;
  diningCount?: number;
  transportCount?: number;
  days?: TripDay[] | null;
  now?: number;
}

/**
 * Extract and synthesize grounded discoveries from explicit discovery payloads
 * and/or legacy streaming fields. Never invents ungrounded claims.
 */
export function extractAgentDiscoveries(
  input: DiscoveryExtractionInput,
  maxItems = MAX_AGENT_DISCOVERIES,
): AgentDiscovery[] {
  const now = input.now ?? Date.now();
  const explicit: AgentDiscovery[] = [];
  if (Array.isArray(input.discoveries)) {
    for (const raw of input.discoveries) {
      const normalized = normalizeAgentDiscovery(raw, now);
      if (normalized) explicit.push(normalized);
    }
  }

  const synthesized: AgentDiscovery[] = [];
  const sp = input.searchProgress;

  if (sp?.orchestrator === "done") {
    synthesized.push({
      id: "orchestrator:plan",
      agent: "orchestrator",
      headline: "Trip brief mapped",
      detail: "Ready to scout stays, activities, dining, and flights",
      badge: "Brief",
      timestamp: now,
    });
  }

  const hotel = input.topHotel;
  const hotelName = text(hotel?.name);
  if (hotel && hotelName) {
    const location =
      text(hotel.location?.neighborhood) || text(hotel.location?.name);
    const rating =
      typeof hotel.userRating === "number" && hotel.userRating > 0
        ? `${hotel.userRating.toFixed(1)}★`
        : "";
    const detail = [location, rating].filter(Boolean).join(" · ") || undefined;
    synthesized.push({
      id: "hotels:top",
      agent: "hotels",
      headline: `Top stay found: ${hotelName}`,
      ...(detail ? { detail } : {}),
      badge: "Top stay",
      timestamp: now,
    });
  }

  if (
    typeof input.activitiesCount === "number" &&
    Number.isFinite(input.activitiesCount) &&
    input.activitiesCount > 0
  ) {
    const count = Math.floor(input.activitiesCount);
    synthesized.push({
      id: "activities:summary",
      agent: "activities",
      headline: `Found ${count} ${count === 1 ? "experience" : "experiences"}`,
      badge: "Activities",
      timestamp: now,
    });
  }

  if (
    typeof input.diningCount === "number" &&
    Number.isFinite(input.diningCount) &&
    input.diningCount > 0
  ) {
    const count = Math.floor(input.diningCount);
    synthesized.push({
      id: "dining:summary",
      agent: "dining",
      headline: `Found ${count} ${count === 1 ? "restaurant" : "restaurants"}`,
      badge: "Dining",
      timestamp: now,
    });
  }

  if (
    typeof input.transportCount === "number" &&
    Number.isFinite(input.transportCount) &&
    input.transportCount > 0
  ) {
    const count = Math.floor(input.transportCount);
    synthesized.push({
      id: "transport:summary",
      agent: "transport",
      headline: `Checked ${count} ${count === 1 ? "flight option" : "flight options"}`,
      badge: "Flights",
      timestamp: now,
    });
  }

  if (sp?.enrichment === "done") {
    synthesized.push({
      id: "enrichment:summary",
      agent: "enrichment",
      headline: "Local gems & neighborhood tips added",
      badge: "Local",
      timestamp: now,
    });
  }

  if (Array.isArray(input.days) && input.days.length > 0) {
    const dayOne =
      input.days.find((day) => day?.dayNumber === 1) ?? input.days[0];
    if (dayOne) {
      synthesized.push(buildDayOneDiscovery(dayOne, input.days.length, now));
    }
  }

  // Merge synthesized first, then let explicit richer discoveries overwrite matching IDs.
  return mergeDiscoveries(synthesized, explicit, maxItems);
}

// ─── Grounded Workflow Discovery Builders ───────────────────────────────────

export function buildOrchestratorDiscovery(
  plan: SearchPlan,
  now = Date.now(),
): AgentDiscovery {
  const dayCount = Math.max(1, (plan.dates?.nights ?? 0) + 1);
  const destination = text(plan.destination) || "your destination";
  const vibes = uniqueStrings(plan.vibeInterpretation?.vibes ?? []).slice(0, 3);
  const detail = vibes.length > 0 ? `Focus: ${vibes.join(", ")}` : undefined;
  return {
    id: "orchestrator:plan",
    agent: "orchestrator",
    headline: `Mapped ${dayCount}-day brief for ${destination}`,
    ...(detail ? { detail } : {}),
    badge: "Brief",
    timestamp: now,
  };
}

export function buildHotelsDiscovery(
  hotels: readonly HotelResult[],
  nights: number,
  now = Date.now(),
): AgentDiscovery | null {
  if (nights === 0 || hotels.length === 0) return null;
  const top = hotels[0];
  const topName = text(top?.name);
  if (!topName) return null;

  const location = text(top.location?.neighborhood) || text(top.location?.name);
  const rating =
    typeof top.userRating === "number" && top.userRating > 0
      ? `${top.userRating.toFixed(1)}★`
      : "";
  const detail = [location, rating].filter(Boolean).join(" · ") || undefined;

  return {
    id: "hotels:top",
    agent: "hotels",
    headline:
      hotels.length === 1
        ? `Top stay: ${topName}`
        : `Scouted ${hotels.length} stays — top pick: ${topName}`,
    ...(detail ? { detail } : {}),
    badge: "Stays",
    timestamp: now,
  };
}

export function buildActivitiesDiscovery(
  activities: readonly ActivityResult[],
  now = Date.now(),
): AgentDiscovery | null {
  if (activities.length === 0) return null;
  const topName = text(activities[0]?.name);
  const neighborhood = topNeighborhood(activities);
  const detailParts: string[] = [];
  if (topName) detailParts.push(`Includes ${topName}`);
  if (neighborhood) detailParts.push(`Notable area: ${neighborhood}`);

  return {
    id: "activities:summary",
    agent: "activities",
    headline: `Found ${activities.length} ${activities.length === 1 ? "experience" : "experiences"}`,
    ...(detailParts.length ? { detail: detailParts.join(" · ") } : {}),
    badge: "Activities",
    timestamp: now,
  };
}

export function buildDiningDiscoveries(
  dining: readonly DiningResult[],
  plan?: SearchPlan,
  now = Date.now(),
): AgentDiscovery[] {
  const discoveries: AgentDiscovery[] = [];

  if (dining.length > 0) {
    const top = dining[0];
    const topName = text(top?.name);
    const neighborhood = topNeighborhood(dining);
    const cuisine = text(top?.cuisineTypes?.[0]);
    const detailParts: string[] = [];
    if (topName) detailParts.push(`Includes ${topName}`);
    if (neighborhood) detailParts.push(neighborhood);
    else if (cuisine) detailParts.push(cuisine);

    discoveries.push({
      id: "dining:summary",
      agent: "dining",
      headline: `Found ${dining.length} ${dining.length === 1 ? "restaurant" : "restaurants"}`,
      ...(detailParts.length ? { detail: detailParts.join(" · ") } : {}),
      badge: "Dining",
      timestamp: now,
    });
  }

  const dietaryTerms = uniqueStrings([
    ...(plan?.diningCriteria?.dietaryNeeds ?? []),
    ...(plan?.requirements?.allergies ?? []),
    ...(plan?.requirements?.dietaryPreferences ?? []),
  ]);

  if (dietaryTerms.length > 0) {
    discoveries.push({
      id: "dining:safety",
      agent: "dining",
      headline: "Dietary & allergen preferences applied",
      detail: `Prioritizing ${dietaryTerms.slice(0, 3).join(", ")} — confirm directly with venues`,
      badge: "Safety filter",
      timestamp: now,
    });
  }

  return discoveries;
}

export function buildTransportDiscovery(
  transport: readonly TransportResult[],
  now = Date.now(),
): AgentDiscovery | null {
  if (transport.length === 0) return null;
  const first = transport[0];
  const from = text(first?.departure?.airport);
  const to = text(first?.arrival?.airport);
  const hasNonstop = transport.some((item) => item.stops === 0);
  const route = from && to ? `${from} → ${to}` : "";
  const detail =
    [route, hasNonstop ? "Nonstop available" : ""]
      .filter(Boolean)
      .join(" · ") || undefined;

  return {
    id: "transport:summary",
    agent: "transport",
    headline: `Checked ${transport.length} ${transport.length === 1 ? "flight option" : "flight options"}`,
    ...(detail ? { detail } : {}),
    badge: "Flights",
    timestamp: now,
  };
}

export function buildEnrichmentDiscovery(
  enrichment: {
    activities: readonly ActivityResult[];
    dining: readonly DiningResult[];
    notes: readonly string[];
  },
  now = Date.now(),
): AgentDiscovery | null {
  const gemCount = enrichment.activities.length + enrichment.dining.length;
  const noteCount = enrichment.notes.length;
  if (gemCount === 0 && noteCount === 0) return null;

  const firstGem =
    text(enrichment.activities[0]?.name) || text(enrichment.dining[0]?.name);
  const firstNote = text(enrichment.notes[0]);
  const detail = firstGem
    ? `Includes ${firstGem}`
    : firstNote
      ? firstNote.length > 90
        ? `${firstNote.slice(0, 87).trimEnd()}…`
        : firstNote
      : undefined;

  return {
    id: "enrichment:summary",
    agent: "enrichment",
    headline:
      gemCount > 0
        ? `Added ${gemCount} local ${gemCount === 1 ? "gem" : "gems"}`
        : `Added ${noteCount} local ${noteCount === 1 ? "note" : "notes"}`,
    ...(detail ? { detail } : {}),
    badge: "Local gems",
    timestamp: now,
  };
}

export function buildDayOneDiscovery(
  dayOne: TripDay,
  totalDays: number,
  now = Date.now(),
): AgentDiscovery {
  const title = text(dayOne.title);
  const stopCount = countDayStops(dayOne);
  const remaining = Math.max(0, totalDays - 1);
  const detailParts: string[] = [];
  if (stopCount > 0) {
    detailParts.push(
      `${stopCount} ${stopCount === 1 ? "stop" : "stops"} arranged`,
    );
  }
  if (remaining > 0) {
    detailParts.push(
      `finishing ${remaining} remaining ${remaining === 1 ? "day" : "days"}`,
    );
  }

  return {
    id: "aggregator:day-1",
    agent: "aggregator",
    headline: title ? `Day 1 ready: ${title}` : "Day 1 is ready to preview",
    ...(detailParts.length ? { detail: detailParts.join(" · ") } : {}),
    badge: "Day 1 ready",
    timestamp: now,
  };
}

export function buildAccessibilityDiscovery(
  plan: SearchPlan,
  now = Date.now(),
): AgentDiscovery | null {
  const needs = uniqueStrings([
    plan.mobilityNeeds,
    ...(plan.requirements?.accessibility ?? []),
    plan.requirements?.mobilityNotes,
  ]);
  if (needs.length === 0) return null;
  return {
    id: "aggregator:accessibility",
    agent: "aggregator",
    headline: "Accessibility & mobility reminders added",
    detail: `Noted ${needs.slice(0, 2).join(", ")} — verify directly with venues`,
    badge: "Accessibility",
    timestamp: now,
  };
}
