import {
  VALID_ACCESSIBILITY,
  VALID_BUDGETS,
  VALID_DIETARY,
  VALID_VIBES,
  type AccessibilityOptionId,
  type BudgetTier,
  type DietaryOption,
  type PacingPreference,
  type VibeId,
} from "./prompt-parser";

export type TravelerPace = PacingPreference;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TravelerMemory {
  homeAirport: string;
  defaultBudget: BudgetTier | null;
  defaultPace: TravelerPace | null;
  defaultVibes: VibeId[];
  dietaryPreferences: DietaryOption[];
  allergies: string[];
  accessibility: AccessibilityOptionId[];
  mobilityNotes: string;
  avoidEarlyStarts: boolean;
  updatedAt: string | null;
}

export interface TripPreferenceSignal {
  budget?: BudgetTier;
  vibes?: string[];
  dietaryPreferences?: string[];
  accessibility?: AccessibilityOptionId[];
  avoidEarlyStarts?: boolean;
  recordedAt: string;
}

export interface LearnedPreferenceSuggestion {
  id: string;
  label: string;
  reason: string;
  patch: Partial<TravelerMemory>;
}

export interface CreatePlannerMergeState {
  budget: BudgetTier;
  selectedVibes: string[];
  dietaryPreferences: string[];
  allergiesText: string;
  accessibility: AccessibilityOptionId[];
  mobilityNotes: string;
}

export interface MergeTravelerMemoryGuards {
  hasDraft: boolean;
  urlHasBudget: boolean;
  urlHasVibes: boolean;
}

const MEMORY_KEY_PREFIX = "faroway:traveler-memory:";
const HISTORY_KEY_PREFIX = "faroway:traveler-history:";
const MAX_HISTORY_ITEMS = 12;

const VALID_PACES: readonly TravelerPace[] = ["relaxed", "balanced", "packed"];

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage !== "undefined" && localStorage !== null) {
      return localStorage;
    }
  } catch {
    // Storage access can throw in restricted browser modes.
  }
  return null;
}

function normalizeScope(userId?: string | null): string {
  const trimmed = typeof userId === "string" ? userId.trim() : "";
  return trimmed.length > 0 ? trimmed : "guest";
}

export function travelerMemoryStorageKey(userId?: string | null): string {
  return `${MEMORY_KEY_PREFIX}${normalizeScope(userId)}`;
}

export function travelerHistoryStorageKey(userId?: string | null): string {
  return `${HISTORY_KEY_PREFIX}${normalizeScope(userId)}`;
}

export function createEmptyTravelerMemory(): TravelerMemory {
  return {
    homeAirport: "",
    defaultBudget: null,
    defaultPace: null,
    defaultVibes: [],
    dietaryPreferences: [],
    allergies: [],
    accessibility: [],
    mobilityNotes: "",
    avoidEarlyStarts: false,
    updatedAt: null,
  };
}

export function sanitizeTravelerMemory(raw: unknown): TravelerMemory {
  const empty = createEmptyTravelerMemory();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;
  const obj = raw as Record<string, unknown>;

  const homeAirport =
    typeof obj.homeAirport === "string"
      ? obj.homeAirport.trim().slice(0, 60)
      : "";

  const defaultBudget =
    typeof obj.defaultBudget === "string" &&
    (VALID_BUDGETS as readonly string[]).includes(obj.defaultBudget)
      ? (obj.defaultBudget as BudgetTier)
      : null;

  const defaultPace =
    typeof obj.defaultPace === "string" &&
    (VALID_PACES as readonly string[]).includes(obj.defaultPace)
      ? (obj.defaultPace as TravelerPace)
      : null;

  const defaultVibes = Array.isArray(obj.defaultVibes)
    ? [
        ...new Set(
          obj.defaultVibes.filter(
            (v): v is VibeId =>
              typeof v === "string" &&
              (VALID_VIBES as readonly string[]).includes(v),
          ),
        ),
      ].slice(0, 5)
    : [];

  const dietaryPreferences = Array.isArray(obj.dietaryPreferences)
    ? [
        ...new Set(
          obj.dietaryPreferences.filter(
            (d): d is DietaryOption =>
              typeof d === "string" &&
              (VALID_DIETARY as readonly string[]).includes(d),
          ),
        ),
      ]
    : [];

  const allergies = Array.isArray(obj.allergies)
    ? [
        ...new Set(
          obj.allergies
            .filter((a): a is string => typeof a === "string")
            .map((a) => a.trim().slice(0, 100))
            .filter(Boolean),
        ),
      ].slice(0, 20)
    : [];

  const accessibility = Array.isArray(obj.accessibility)
    ? [
        ...new Set(
          obj.accessibility.filter(
            (a): a is AccessibilityOptionId =>
              typeof a === "string" &&
              (VALID_ACCESSIBILITY as readonly string[]).includes(a),
          ),
        ),
      ].slice(0, 4)
    : [];

  const mobilityNotes =
    typeof obj.mobilityNotes === "string"
      ? obj.mobilityNotes.trim().slice(0, 500)
      : "";

  const avoidEarlyStarts = obj.avoidEarlyStarts === true;

  const updatedAt =
    typeof obj.updatedAt === "string" && obj.updatedAt.trim().length > 0
      ? obj.updatedAt
      : null;

  return {
    homeAirport,
    defaultBudget,
    defaultPace,
    defaultVibes,
    dietaryPreferences,
    allergies,
    accessibility,
    mobilityNotes,
    avoidEarlyStarts,
    updatedAt,
  };
}

export function hasTravelerMemoryValues(memory: TravelerMemory): boolean {
  return (
    memory.homeAirport.length > 0 ||
    memory.defaultBudget !== null ||
    memory.defaultPace !== null ||
    memory.defaultVibes.length > 0 ||
    memory.dietaryPreferences.length > 0 ||
    memory.allergies.length > 0 ||
    memory.accessibility.length > 0 ||
    memory.mobilityNotes.length > 0 ||
    memory.avoidEarlyStarts
  );
}

export function readTravelerMemory(
  userId?: string | null,
  storage: StorageLike | null = getDefaultStorage(),
): TravelerMemory {
  if (!storage) return createEmptyTravelerMemory();
  try {
    const raw = storage.getItem(travelerMemoryStorageKey(userId));
    if (!raw) return createEmptyTravelerMemory();
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeTravelerMemory(parsed);
  } catch {
    return createEmptyTravelerMemory();
  }
}

export function saveTravelerMemory(
  userId: string | null | undefined,
  update: Partial<TravelerMemory>,
  storage: StorageLike | null = getDefaultStorage(),
): TravelerMemory {
  const existing = readTravelerMemory(userId, storage);
  const next = sanitizeTravelerMemory({
    ...existing,
    ...update,
    updatedAt: new Date().toISOString(),
  });
  if (storage) {
    try {
      storage.setItem(travelerMemoryStorageKey(userId), JSON.stringify(next));
    } catch {
      // Storage quota or private browsing; return sanitized object cleanly.
    }
  }
  return next;
}

export function clearTravelerMemory(
  userId?: string | null,
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(travelerMemoryStorageKey(userId));
  } catch {
    // Ignore storage unavailability.
  }
}

export function readTripPreferenceHistory(
  userId?: string | null,
  storage: StorageLike | null = getDefaultStorage(),
): TripPreferenceSignal[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(travelerHistoryStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is TripPreferenceSignal =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

export function recordTripPreferenceSignal(
  userId: string | null | undefined,
  signal: Omit<TripPreferenceSignal, "recordedAt"> & { recordedAt?: string },
  storage: StorageLike | null = getDefaultStorage(),
): TripPreferenceSignal[] {
  const existing = readTripPreferenceHistory(userId, storage);
  const entry: TripPreferenceSignal = {
    budget:
      signal.budget &&
      (VALID_BUDGETS as readonly string[]).includes(signal.budget)
        ? signal.budget
        : undefined,
    vibes: Array.isArray(signal.vibes)
      ? signal.vibes
          .filter((v) => (VALID_VIBES as readonly string[]).includes(v))
          .slice(0, 5)
      : [],
    dietaryPreferences: Array.isArray(signal.dietaryPreferences)
      ? signal.dietaryPreferences.filter((d) =>
          (VALID_DIETARY as readonly string[]).includes(d),
        )
      : [],
    accessibility: Array.isArray(signal.accessibility)
      ? signal.accessibility.filter((a) =>
          (VALID_ACCESSIBILITY as readonly string[]).includes(a),
        )
      : [],
    avoidEarlyStarts: signal.avoidEarlyStarts === true,
    recordedAt: signal.recordedAt ?? new Date().toISOString(),
  };
  const next = [entry, ...existing].slice(0, MAX_HISTORY_ITEMS);
  if (storage) {
    try {
      storage.setItem(travelerHistoryStorageKey(userId), JSON.stringify(next));
    } catch {
      // Optional local signal.
    }
  }
  return next;
}

export function clearTripPreferenceHistory(
  userId?: string | null,
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(travelerHistoryStorageKey(userId));
  } catch {
    // Ignore storage unavailability.
  }
}

const BUDGET_DISPLAY: Record<BudgetTier, string> = {
  budget: "Budget",
  moderate: "Comfort",
  luxury: "Luxury",
};

const VIBE_DISPLAY: Record<VibeId, string> = {
  adventure: "Adventure",
  relaxation: "Relaxation",
  cultural: "Cultural",
  foodie: "Foodie",
  nightlife: "Nightlife",
  romantic: "Romantic",
  nature: "Nature",
  shopping: "Shopping",
  wellness: "Wellness",
  photography: "Photography",
};

const ACCESSIBILITY_DISPLAY: Record<AccessibilityOptionId, string> = {
  step_free_entrance: "Step-free entrance",
  accessible_restroom: "Accessible restroom",
  accessible_seating: "Accessible seating",
  accessible_parking: "Accessible parking",
};

/**
 * Computes transparent "Learned from your trips" suggestions when preferences
 * repeat across at least 2 past trips and are not yet saved in Traveler Memory.
 */
export function computeLearnedSuggestions(
  history: TripPreferenceSignal[],
  currentMemory: TravelerMemory,
): LearnedPreferenceSuggestion[] {
  if (history.length < 2) return [];
  const total = history.length;
  const suggestions: LearnedPreferenceSuggestion[] = [];

  // 1. Repeated dietary preferences (>= 2 trips)
  const dietaryCounts = new Map<DietaryOption, number>();
  for (const trip of history) {
    for (const d of new Set(trip.dietaryPreferences ?? [])) {
      if ((VALID_DIETARY as readonly string[]).includes(d)) {
        dietaryCounts.set(
          d as DietaryOption,
          (dietaryCounts.get(d as DietaryOption) ?? 0) + 1,
        );
      }
    }
  }
  for (const [diet, count] of dietaryCounts) {
    if (count >= 2 && !currentMemory.dietaryPreferences.includes(diet)) {
      suggestions.push({
        id: `dietary:${diet}`,
        label: `Always include ${diet}`,
        reason: `Used in ${count} of your last ${total} trips`,
        patch: {
          dietaryPreferences: [...currentMemory.dietaryPreferences, diet],
        },
      });
    }
  }

  // 2. Repeated accessibility needs (>= 2 trips)
  const accessCounts = new Map<AccessibilityOptionId, number>();
  for (const trip of history) {
    for (const a of new Set(trip.accessibility ?? [])) {
      if ((VALID_ACCESSIBILITY as readonly string[]).includes(a)) {
        accessCounts.set(a, (accessCounts.get(a) ?? 0) + 1);
      }
    }
  }
  for (const [need, count] of accessCounts) {
    if (count >= 2 && !currentMemory.accessibility.includes(need)) {
      suggestions.push({
        id: `accessibility:${need}`,
        label: `Default to ${ACCESSIBILITY_DISPLAY[need]}`,
        reason: `Used in ${count} of your last ${total} trips`,
        patch: {
          accessibility: [...currentMemory.accessibility, need],
        },
      });
    }
  }

  // 3. Repeated budget tier (>= 2 trips and majority)
  if (!currentMemory.defaultBudget) {
    const budgetCounts = new Map<BudgetTier, number>();
    for (const trip of history) {
      if (trip.budget) {
        budgetCounts.set(trip.budget, (budgetCounts.get(trip.budget) ?? 0) + 1);
      }
    }
    const topBudget = [...budgetCounts.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];
    if (
      topBudget &&
      topBudget[1] >= 2 &&
      topBudget[1] >= Math.ceil(total / 2)
    ) {
      suggestions.push({
        id: `budget:${topBudget[0]}`,
        label: `Default to ${BUDGET_DISPLAY[topBudget[0]]} comfort`,
        reason: `Chosen in ${topBudget[1]} of your last ${total} trips`,
        patch: { defaultBudget: topBudget[0] },
      });
    }
  }

  // 4. Repeated vibes (>= 2 trips, not already saved)
  if (currentMemory.defaultVibes.length < 5) {
    const vibeCounts = new Map<VibeId, number>();
    for (const trip of history) {
      for (const v of new Set(trip.vibes ?? [])) {
        if ((VALID_VIBES as readonly string[]).includes(v)) {
          vibeCounts.set(v as VibeId, (vibeCounts.get(v as VibeId) ?? 0) + 1);
        }
      }
    }
    const sortedVibes = [...vibeCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [vibe, count] of sortedVibes) {
      if (count >= 2 && !currentMemory.defaultVibes.includes(vibe)) {
        suggestions.push({
          id: `vibe:${vibe}`,
          label: `Add ${VIBE_DISPLAY[vibe]} as a default vibe`,
          reason: `Picked in ${count} of your last ${total} trips`,
          patch: {
            defaultVibes: [...currentMemory.defaultVibes, vibe].slice(0, 5),
          },
        });
        break; // Keep suggestions gentle and uncluttered (top 1 vibe at a time)
      }
    }
  }

  // 5. Repeated avoid-early-starts preference
  const earlyAvoidCount = history.filter((t) => t.avoidEarlyStarts).length;
  if (earlyAvoidCount >= 2 && !currentMemory.avoidEarlyStarts) {
    suggestions.push({
      id: "avoidEarlyStarts",
      label: "Avoid early starts by default",
      reason: `Noted in ${earlyAvoidCount} of your last ${total} trips`,
      patch: { avoidEarlyStarts: true },
    });
  }

  return suggestions.slice(0, 3);
}

export function applyLearnedSuggestion(
  memory: TravelerMemory,
  suggestion: LearnedPreferenceSuggestion,
): TravelerMemory {
  return sanitizeTravelerMemory({
    ...memory,
    ...suggestion.patch,
    updatedAt: new Date().toISOString(),
  });
}

export function buildMemoryMobilitySummary(memory: TravelerMemory): string {
  const parts: string[] = [];
  if (memory.mobilityNotes.trim()) {
    parts.push(memory.mobilityNotes.trim());
  }
  if (
    memory.avoidEarlyStarts &&
    !/early\s+(?:starts?|mornings?)/i.test(memory.mobilityNotes)
  ) {
    parts.push("Avoid early starts");
  }
  if (
    memory.defaultPace === "relaxed" &&
    !/relaxed|unhurried|slow/i.test(memory.mobilityNotes)
  ) {
    parts.push("Relaxed pace");
  } else if (
    memory.defaultPace === "packed" &&
    !/packed|fast/i.test(memory.mobilityNotes)
  ) {
    parts.push("Packed pace");
  }
  return parts.join("; ").slice(0, 500);
}

/**
 * Merges saved Traveler Memory defaults into /create form state WITHOUT
 * clobbering restored drafts or explicit URL query parameters.
 */
export function mergeTravelerMemoryIntoCreateState(
  base: CreatePlannerMergeState,
  memory: TravelerMemory,
  guards: MergeTravelerMemoryGuards,
): { merged: CreatePlannerMergeState; appliedFields: string[] } {
  if (guards.hasDraft || !hasTravelerMemoryValues(memory)) {
    return { merged: base, appliedFields: [] };
  }

  const merged: CreatePlannerMergeState = {
    budget: base.budget,
    selectedVibes: [...base.selectedVibes],
    dietaryPreferences: [...base.dietaryPreferences],
    allergiesText: base.allergiesText,
    accessibility: [...base.accessibility],
    mobilityNotes: base.mobilityNotes,
  };
  const appliedFields: string[] = [];

  if (!guards.urlHasBudget && memory.defaultBudget) {
    merged.budget = memory.defaultBudget;
    appliedFields.push(`${BUDGET_DISPLAY[memory.defaultBudget]} comfort`);
  }

  if (
    !guards.urlHasVibes &&
    merged.selectedVibes.length === 0 &&
    memory.defaultVibes.length > 0
  ) {
    merged.selectedVibes = [...memory.defaultVibes].slice(0, 5);
    appliedFields.push(
      memory.defaultVibes.map((v) => VIBE_DISPLAY[v]).join(", "),
    );
  }

  if (
    merged.dietaryPreferences.length === 0 &&
    memory.dietaryPreferences.length > 0
  ) {
    merged.dietaryPreferences = [...memory.dietaryPreferences];
    appliedFields.push(memory.dietaryPreferences.join(", "));
  }

  if (!merged.allergiesText.trim() && memory.allergies.length > 0) {
    merged.allergiesText = memory.allergies.join(", ").slice(0, 500);
    appliedFields.push(`Allergies: ${memory.allergies.join(", ")}`);
  }

  if (merged.accessibility.length === 0 && memory.accessibility.length > 0) {
    merged.accessibility = [...memory.accessibility];
    appliedFields.push(
      `${memory.accessibility.length} accessibility ${memory.accessibility.length === 1 ? "default" : "defaults"}`,
    );
  }

  const memoryMobility = buildMemoryMobilitySummary(memory);
  if (!merged.mobilityNotes.trim() && memoryMobility) {
    merged.mobilityNotes = memoryMobility;
    appliedFields.push(
      memory.avoidEarlyStarts
        ? "Avoid early starts"
        : memory.defaultPace
          ? `${memory.defaultPace[0].toUpperCase()}${memory.defaultPace.slice(1)} pace`
          : "Mobility notes",
    );
  }

  return { merged, appliedFields };
}

export function summarizeTravelerMemory(memory: TravelerMemory): string[] {
  const chips: string[] = [];
  if (memory.homeAirport) chips.push(`Home: ${memory.homeAirport}`);
  if (memory.defaultBudget)
    chips.push(`${BUDGET_DISPLAY[memory.defaultBudget]} comfort`);
  if (memory.defaultPace)
    chips.push(
      `${memory.defaultPace[0].toUpperCase()}${memory.defaultPace.slice(1)} pace`,
    );
  if (memory.avoidEarlyStarts) chips.push("No early starts");
  if (memory.defaultVibes.length > 0) {
    chips.push(memory.defaultVibes.map((v) => VIBE_DISPLAY[v]).join(", "));
  }
  if (memory.dietaryPreferences.length > 0) {
    chips.push(memory.dietaryPreferences.join(", "));
  }
  if (memory.allergies.length > 0) {
    chips.push(`Allergies: ${memory.allergies.join(", ")}`);
  }
  if (memory.accessibility.length > 0) {
    chips.push(
      `${memory.accessibility.length} accessibility ${memory.accessibility.length === 1 ? "need" : "needs"}`,
    );
  }
  return chips;
}
