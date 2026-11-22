import AsyncStorage from '@react-native-async-storage/async-storage';
import { BUDGET_LABELS, normalizeBudgetTier, normalizeVibeList } from '@faroway/constants';
import type { TravelerRequirements } from '@faroway/types';
import type { TripInput } from './tripTypes';
import { travelerRequirementsSchema } from './travelerRequirements';

export type TravelerPace = 'relaxed' | 'balanced' | 'packed';

export interface TravelerMemoryDefaults {
  homeAirport?: string;
  defaultBudget?: 'budget' | 'moderate' | 'luxury';
  defaultPace?: TravelerPace;
  defaultTravelerType?: 'solo' | 'couple' | 'family' | 'friends' | 'business';
  defaultVibes: string[];
  requirements: TravelerRequirements;
  avoidEarlyStarts: boolean;
  updatedAt: string;
}

const STORAGE_PREFIX = '@faroway/traveler_memory:v1:';
const VALID_PACES = new Set(['relaxed', 'balanced', 'packed']);
const VALID_TYPES = new Set(['solo', 'couple', 'family', 'friends', 'business']);

export const EMPTY_REQUIREMENTS: TravelerRequirements = {
  allergies: [],
  dietaryPreferences: [],
  accessibility: [],
  mobilityNotes: '',
};

export function travelerMemoryKey(userId?: string | null): string {
  const scope = userId && userId.trim() ? userId.trim() : 'guest';
  return `${STORAGE_PREFIX}${scope}`;
}

function normalizeRequirements(value: unknown): TravelerRequirements {
  const parsed = travelerRequirementsSchema.safeParse(value);
  if (parsed.success) {
    return {
      allergies: [...parsed.data.allergies],
      dietaryPreferences: [...parsed.data.dietaryPreferences],
      accessibility: [...parsed.data.accessibility],
      mobilityNotes: parsed.data.mobilityNotes,
    };
  }
  return {
    allergies: [],
    dietaryPreferences: [],
    accessibility: [],
    mobilityNotes: '',
  };
}

export function normalizeTravelerMemory(value: unknown): TravelerMemoryDefaults | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  const homeAirport =
    typeof raw.homeAirport === 'string' && raw.homeAirport.trim()
      ? raw.homeAirport.trim().toUpperCase().slice(0, 10)
      : undefined;

  const defaultBudget = normalizeBudgetTier(raw.defaultBudget);

  const defaultPace =
    typeof raw.defaultPace === 'string' && VALID_PACES.has(raw.defaultPace)
      ? (raw.defaultPace as TravelerPace)
      : undefined;

  const defaultTravelerType =
    typeof raw.defaultTravelerType === 'string' && VALID_TYPES.has(raw.defaultTravelerType)
      ? (raw.defaultTravelerType as TravelerMemoryDefaults['defaultTravelerType'])
      : undefined;

  const defaultVibes = Array.isArray(raw.defaultVibes)
    ? normalizeVibeList(
        raw.defaultVibes.filter((v): v is string => typeof v === 'string'),
        5
      )
    : [];

  const requirements = normalizeRequirements(raw.requirements);
  const avoidEarlyStarts = raw.avoidEarlyStarts === true;
  const updatedAt =
    typeof raw.updatedAt === 'string' && raw.updatedAt.trim()
      ? raw.updatedAt
      : new Date().toISOString();

  const normalized: TravelerMemoryDefaults = {
    homeAirport,
    defaultBudget,
    defaultPace,
    defaultTravelerType,
    defaultVibes,
    requirements,
    avoidEarlyStarts,
    updatedAt,
  };

  return hasTravelerMemoryContent(normalized) ? normalized : null;
}

export function hasTravelerMemoryContent(
  memory: TravelerMemoryDefaults | null | undefined
): boolean {
  if (!memory) return false;
  return Boolean(
    memory.homeAirport ||
    memory.defaultBudget ||
    memory.defaultPace ||
    memory.defaultTravelerType ||
    memory.defaultVibes.length > 0 ||
    memory.avoidEarlyStarts ||
    memory.requirements.allergies.length > 0 ||
    memory.requirements.dietaryPreferences.length > 0 ||
    memory.requirements.accessibility.length > 0 ||
    memory.requirements.mobilityNotes.trim().length > 0
  );
}

export async function loadTravelerMemory(
  userId?: string | null
): Promise<TravelerMemoryDefaults | null> {
  try {
    const raw = await AsyncStorage.getItem(travelerMemoryKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalizeTravelerMemory(parsed);
  } catch {
    return null;
  }
}

export async function saveTravelerMemory(
  userId: string | null | undefined,
  patch: Partial<TravelerMemoryDefaults>
): Promise<TravelerMemoryDefaults | null> {
  const existing = await loadTravelerMemory(userId);
  const merged = normalizeTravelerMemory({
    homeAirport: 'homeAirport' in patch ? patch.homeAirport : existing?.homeAirport,
    defaultBudget: 'defaultBudget' in patch ? patch.defaultBudget : existing?.defaultBudget,
    defaultPace: 'defaultPace' in patch ? patch.defaultPace : existing?.defaultPace,
    defaultTravelerType:
      'defaultTravelerType' in patch ? patch.defaultTravelerType : existing?.defaultTravelerType,
    defaultVibes:
      'defaultVibes' in patch ? (patch.defaultVibes ?? []) : (existing?.defaultVibes ?? []),
    requirements:
      'requirements' in patch
        ? (patch.requirements ?? EMPTY_REQUIREMENTS)
        : (existing?.requirements ?? EMPTY_REQUIREMENTS),
    avoidEarlyStarts:
      'avoidEarlyStarts' in patch
        ? Boolean(patch.avoidEarlyStarts)
        : (existing?.avoidEarlyStarts ?? false),
    updatedAt: new Date().toISOString(),
  });

  const key = travelerMemoryKey(userId);
  if (!merged) {
    await AsyncStorage.removeItem(key);
    return null;
  }

  await AsyncStorage.setItem(key, JSON.stringify(merged));
  return merged;
}

export async function clearTravelerMemory(userId?: string | null): Promise<void> {
  await AsyncStorage.removeItem(travelerMemoryKey(userId));
}

export function summarizeTravelerMemory(memory: TravelerMemoryDefaults | null): string[] {
  if (!memory || !hasTravelerMemoryContent(memory)) return [];
  const items: string[] = [];

  if (memory.homeAirport) {
    items.push(`Home airport: ${memory.homeAirport}`);
  }
  if (memory.defaultBudget) {
    items.push(`Budget: ${BUDGET_LABELS[memory.defaultBudget]}`);
  }
  if (memory.defaultTravelerType) {
    items.push(
      `Usually: ${memory.defaultTravelerType.charAt(0).toUpperCase()}${memory.defaultTravelerType.slice(1)}`
    );
  }
  if (memory.defaultPace) {
    items.push(`Pace: ${memory.defaultPace}`);
  }
  if (memory.avoidEarlyStarts) {
    items.push('Relaxed mornings');
  }
  if (memory.defaultVibes.length > 0) {
    items.push(`Vibes: ${memory.defaultVibes.join(', ')}`);
  }
  if (memory.requirements.dietaryPreferences.length > 0) {
    items.push(`Dietary: ${memory.requirements.dietaryPreferences.join(', ')}`);
  }
  if (memory.requirements.allergies.length > 0) {
    items.push(`Allergies: ${memory.requirements.allergies.join(', ')}`);
  }
  if (memory.requirements.accessibility.length > 0) {
    items.push(`Access needs: ${memory.requirements.accessibility.length} selected`);
  }
  if (memory.requirements.mobilityNotes.trim()) {
    items.push(`Notes: ${memory.requirements.mobilityNotes.trim()}`);
  }

  return items;
}

/**
 * Compute draft updates from saved Traveler Memory without overwriting fields
 * already populated by explicit link params, restored drafts, or user edits.
 */
export function mergeTravelerMemoryIntoDraft(
  draft: Partial<TripInput> | null | undefined,
  memory: TravelerMemoryDefaults | null,
  explicitFields?: ReadonlySet<string>
): Partial<TripInput> {
  if (!memory || !hasTravelerMemoryContent(memory)) return {};
  const updates: Partial<TripInput> = {};
  const locked = explicitFields ?? new Set<string>();

  if (memory.homeAirport && !draft?.originAirport && !locked.has('originAirport')) {
    const normalizedAirport = memory.homeAirport.trim().toUpperCase().slice(0, 10);
    if (normalizedAirport) {
      updates.originAirport = normalizedAirport;
    }
  }

  if (memory.defaultBudget && !draft?.budget && !locked.has('budget')) {
    updates.budget = memory.defaultBudget;
  }

  if (
    memory.defaultTravelerType &&
    !locked.has('travelerType') &&
    (!draft?.travelerType || draft.travelerType === 'couple')
  ) {
    if (draft?.travelerType !== memory.defaultTravelerType) {
      updates.travelerType = memory.defaultTravelerType;
    }
  }

  if (
    memory.defaultVibes.length > 0 &&
    !locked.has('vibes') &&
    (!draft?.vibes || draft.vibes.length === 0)
  ) {
    updates.vibes = [...memory.defaultVibes];
  }

  const existingReq = draft?.requirements;
  const hasExistingReq = Boolean(
    existingReq &&
    (existingReq.allergies.length > 0 ||
      existingReq.dietaryPreferences.length > 0 ||
      existingReq.accessibility.length > 0 ||
      existingReq.mobilityNotes.trim().length > 0)
  );

  const memoryMobility = [
    memory.requirements.mobilityNotes.trim(),
    memory.avoidEarlyStarts && !/early/i.test(memory.requirements.mobilityNotes)
      ? 'Prefer relaxed mornings without early starts'
      : '',
  ]
    .filter(Boolean)
    .join('. ')
    .slice(0, 500);

  const hasMemoryReq = Boolean(
    memory.requirements.allergies.length > 0 ||
    memory.requirements.dietaryPreferences.length > 0 ||
    memory.requirements.accessibility.length > 0 ||
    memoryMobility.length > 0
  );

  if (hasMemoryReq && !hasExistingReq && !locked.has('requirements')) {
    updates.requirements = {
      allergies: [...memory.requirements.allergies],
      dietaryPreferences: [...memory.requirements.dietaryPreferences],
      accessibility: [...memory.requirements.accessibility],
      mobilityNotes: memoryMobility,
    };
  }

  return updates;
}

/**
 * Extract saveable Traveler Memory defaults from the current /create draft.
 */
export function extractMemoryFromDraft(
  draft: Partial<TripInput> | null | undefined
): Partial<TravelerMemoryDefaults> {
  if (!draft) return {};
  const validBudget =
    draft.budget === 'budget' || draft.budget === 'moderate' || draft.budget === 'luxury'
      ? draft.budget
      : undefined;
  const validType =
    draft.travelerType && VALID_TYPES.has(draft.travelerType)
      ? (draft.travelerType as TravelerMemoryDefaults['defaultTravelerType'])
      : undefined;

  return {
    homeAirport: draft.originAirport?.trim().slice(0, 10) || undefined,
    defaultBudget: validBudget,
    defaultTravelerType: validType,
    defaultVibes: Array.isArray(draft.vibes) ? draft.vibes.slice(0, 5) : [],
    requirements: draft.requirements
      ? normalizeRequirements(draft.requirements)
      : EMPTY_REQUIREMENTS,
    avoidEarlyStarts: Boolean(
      draft.requirements?.mobilityNotes &&
      /early|relaxed morning/i.test(draft.requirements.mobilityNotes)
    ),
  };
}
