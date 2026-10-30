export const STAGING_PROJECT_REF = "omovikloadpvzijoaqus";
export const PRODUCTION_PROJECT_REF = "jcnephijkxgtprsutgsf";

const PROJECT_REF = /^[a-z]{20}$/;

export class StagingGuardError extends Error {
  readonly code: "production" | "unknown";

  constructor(code: "production" | "unknown", message: string) {
    super(message);
    this.name = "StagingGuardError";
    this.code = code;
  }
}

export interface StagingTargetInput {
  supabaseUrl?: string;
  projectRef?: string;
  anonKey?: string;
  apiUrl?: string;
  extra?: string[];
}

export function projectRefFromSupabaseUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const match = url.hostname.match(/^([a-z]{20})\.supabase\.co$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function projectRefFromAnonKey(key: string): string | null {
  const payload = key.split(".")[1];
  if (!payload || key.split(".").length !== 3) return null;
  try {
    const json = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { ref?: unknown };
    return typeof json.ref === "string" && PROJECT_REF.test(json.ref)
      ? json.ref
      : null;
  } catch {
    return null;
  }
}

export function assertStagingTarget(input: StagingTargetInput): {
  projectRef: typeof STAGING_PROJECT_REF;
  supabaseUrl?: string;
} {
  const fields = [
    input.supabaseUrl,
    input.projectRef,
    input.anonKey,
    input.apiUrl,
    ...(input.extra ?? []),
  ].filter((value): value is string => Boolean(value));
  const haystack = fields.join("\n").toLowerCase();
  if (haystack.includes(PRODUCTION_PROJECT_REF)) {
    throw new StagingGuardError(
      "production",
      `Refusing to run: target points at production project ${PRODUCTION_PROJECT_REF}`,
    );
  }
  const refs = new Set<string>();
  if (input.projectRef?.trim()) refs.add(input.projectRef.trim());
  if (input.supabaseUrl) {
    const ref = projectRefFromSupabaseUrl(input.supabaseUrl);
    if (!ref) {
      throw new StagingGuardError(
        "unknown",
        "Refusing to run: Supabase URL is not a recognized project host",
      );
    }
    refs.add(ref);
  }
  if (input.anonKey) {
    const ref = projectRefFromAnonKey(input.anonKey);
    if (!ref) {
      throw new StagingGuardError(
        "unknown",
        "Refusing to run: anon key is not a project JWT for a known host",
      );
    }
    refs.add(ref);
  }
  if (refs.size === 0) {
    throw new StagingGuardError(
      "unknown",
      "Refusing to run: no Supabase project ref was provided",
    );
  }
  if ([...refs].includes(PRODUCTION_PROJECT_REF)) {
    throw new StagingGuardError(
      "production",
      `Refusing to run: target points at production project ${PRODUCTION_PROJECT_REF}`,
    );
  }
  for (const ref of refs) {
    if (ref !== STAGING_PROJECT_REF) {
      throw new StagingGuardError(
        "unknown",
        `Refusing to run: project ${ref} is not staging (${STAGING_PROJECT_REF})`,
      );
    }
  }
  return {
    projectRef: STAGING_PROJECT_REF,
    supabaseUrl: input.supabaseUrl,
  };
}
