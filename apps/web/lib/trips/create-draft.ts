export const CREATE_DRAFT_STORAGE_KEY = "faroway:create-draft";
export const CREATE_RESUME_STORAGE_KEY = "faroway:create-resume";

export interface CreateDraftPlace {
  name: string;
  lat: number;
  lng: number;
  placeId: string;
  isRecommended: boolean;
}

export interface CreateDraft {
  destination?: CreateDraftPlace | null;
  startDate?: string | null;
  endDate?: string | null;
  travelers?: number;
  travelerType?: string;
  vibes?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseCreateDraft(raw: string): CreateDraft | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const draft: CreateDraft = {};

    if (isRecord(parsed.destination)) {
      const name =
        typeof parsed.destination.name === "string"
          ? parsed.destination.name.trim()
          : "";
      if (name) {
        draft.destination = {
          name,
          lat:
            typeof parsed.destination.lat === "number"
              ? parsed.destination.lat
              : 0,
          lng:
            typeof parsed.destination.lng === "number"
              ? parsed.destination.lng
              : 0,
          placeId:
            typeof parsed.destination.placeId === "string"
              ? parsed.destination.placeId
              : "",
          isRecommended: parsed.destination.isRecommended === true,
        };
      }
    }

    if (typeof parsed.startDate === "string" && isDateOnly(parsed.startDate)) {
      draft.startDate = parsed.startDate;
    }
    if (typeof parsed.endDate === "string" && isDateOnly(parsed.endDate)) {
      draft.endDate = parsed.endDate;
    }
    if (
      typeof parsed.travelers === "number" &&
      Number.isFinite(parsed.travelers)
    ) {
      draft.travelers = Math.max(1, Math.min(10, Math.round(parsed.travelers)));
    }
    if (typeof parsed.travelerType === "string" && parsed.travelerType.trim()) {
      draft.travelerType = parsed.travelerType.trim();
    }
    if (Array.isArray(parsed.vibes)) {
      draft.vibes = parsed.vibes
        .filter((vibe): vibe is string => typeof vibe === "string")
        .map((vibe) => vibe.trim())
        .filter(Boolean)
        .slice(0, 5);
    }

    return draft;
  } catch {
    return null;
  }
}

export function isCreateDraftReady(
  draft: CreateDraft | null | undefined,
): boolean {
  return Boolean(
    draft?.destination?.name && draft.startDate && draft.endDate,
  );
}

export function mergeCreateDrafts(
  ...drafts: Array<CreateDraft | null | undefined>
): CreateDraft {
  const merged: CreateDraft = {};
  for (const draft of drafts) {
    if (!draft) continue;
    if (draft.destination) merged.destination = draft.destination;
    if (draft.startDate) merged.startDate = draft.startDate;
    if (draft.endDate) merged.endDate = draft.endDate;
    if (typeof draft.travelers === "number") merged.travelers = draft.travelers;
    if (draft.travelerType) merged.travelerType = draft.travelerType;
    if (draft.vibes) merged.vibes = draft.vibes;
  }
  return merged;
}

export function createDraftToQuery(draft: CreateDraft): URLSearchParams {
  const params = new URLSearchParams();
  if (draft.destination?.name) {
    params.set("destination", draft.destination.name);
    params.set("lat", String(draft.destination.lat));
    params.set("lng", String(draft.destination.lng));
    if (draft.destination.placeId) {
      params.set("placeId", draft.destination.placeId);
    }
    if (draft.destination.isRecommended) {
      params.set("recommended", "1");
    }
  }
  if (draft.startDate) params.set("startDate", draft.startDate);
  if (draft.endDate) params.set("endDate", draft.endDate);
  if (typeof draft.travelers === "number") {
    params.set("travelers", String(draft.travelers));
  }
  if (draft.travelerType) params.set("travelerType", draft.travelerType);
  if (draft.vibes && draft.vibes.length > 0) {
    params.set("vibes", draft.vibes.join(","));
  }
  return params;
}

export function createDraftFromQuery(
  params: Pick<URLSearchParams, "get">,
): CreateDraft {
  const destinationName = params.get("destination")?.trim() || "";
  const lat = Number(params.get("lat") || "0");
  const lng = Number(params.get("lng") || "0");
  const travelersRaw = Number(params.get("travelers") || "");
  const vibesRaw = params.get("vibes") || "";

  return {
    destination: destinationName
      ? {
          name: destinationName,
          lat: Number.isFinite(lat) ? lat : 0,
          lng: Number.isFinite(lng) ? lng : 0,
          placeId: params.get("placeId") || "",
          isRecommended: params.get("recommended") === "1",
        }
      : null,
    startDate:
      params.get("startDate") && isDateOnly(params.get("startDate")!)
        ? params.get("startDate")
        : null,
    endDate:
      params.get("endDate") && isDateOnly(params.get("endDate")!)
        ? params.get("endDate")
        : null,
    travelers:
      Number.isFinite(travelersRaw) && travelersRaw > 0
        ? Math.max(1, Math.min(10, Math.round(travelersRaw)))
        : undefined,
    travelerType: params.get("travelerType")?.trim() || undefined,
    vibes: vibesRaw
      ? vibesRaw
          .split(",")
          .map((vibe) => vibe.trim())
          .filter(Boolean)
          .slice(0, 5)
      : undefined,
  };
}

export function buildCreateResumePath(draft: CreateDraft): string {
  const params = createDraftToQuery(draft);
  params.set("resume", "1");
  const query = params.toString();
  return query ? `/create?${query}` : "/create?resume=1";
}

export function loadCreateDraft(
  storage: Pick<Storage, "getItem"> | null | undefined = globalThis.sessionStorage,
): CreateDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CREATE_DRAFT_STORAGE_KEY);
    return raw ? parseCreateDraft(raw) : null;
  } catch {
    return null;
  }
}

export function saveCreateDraft(
  draft: CreateDraft,
  storage: Pick<Storage, "setItem"> | null | undefined = globalThis.sessionStorage,
): void {
  if (!storage) return;
  try {
    storage.setItem(CREATE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Private mode / quota — query-string backup still works.
  }
}

export function markCreateResume(
  storage: Pick<Storage, "setItem"> | null | undefined = globalThis.sessionStorage,
): void {
  if (!storage) return;
  try {
    storage.setItem(CREATE_RESUME_STORAGE_KEY, "1");
  } catch {
    // Ignore.
  }
}

export function consumeCreateResume(
  storage:
    | (Pick<Storage, "getItem" | "removeItem"> & Partial<Pick<Storage, "setItem">>)
    | null
    | undefined = globalThis.sessionStorage,
): boolean {
  if (!storage) return false;
  try {
    const value = storage.getItem(CREATE_RESUME_STORAGE_KEY) === "1";
    storage.removeItem(CREATE_RESUME_STORAGE_KEY);
    return value;
  } catch {
    return false;
  }
}
