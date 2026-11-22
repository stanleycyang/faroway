/**
 * Rate limiter — uses an atomic Supabase RPC in production and an in-memory
 * fallback for local development and tests.
 *
 * Uses Web Crypto (crypto.subtle) so it works in both Node.js and Edge runtimes.
 * Identifiers are HMAC-hashed before storage so IP addresses and user IDs are
 * not persisted in plaintext.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RATE_LIMIT_SALT = process.env.IP_HASH_SALT;
const useSupabase = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY && RATE_LIMIT_SALT);

// ── In-memory fallback ────────────────────────────────────────────────────────

const MAX_MEMORY_ENTRIES = 10_000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
let lastCleanupAt = 0;

function pruneExpiredMemoryEntries(now: number): void {
  if (
    now - lastCleanupAt < CLEANUP_INTERVAL_MS &&
    rateLimitMap.size < MAX_MEMORY_ENTRIES
  ) {
    return;
  }
  lastCleanupAt = now;
  for (const [key, value] of rateLimitMap) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
  if (rateLimitMap.size >= MAX_MEMORY_ENTRIES) {
    const oldestKey = rateLimitMap.keys().next().value;
    if (oldestKey !== undefined) rateLimitMap.delete(oldestKey);
  }
}

function checkRateLimitMemory(
  identifier: string,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  pruneExpiredMemoryEntries(now);
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }

  entry.count++;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  return {
    allowed: entry.count <= config.maxRequests,
    remaining,
    resetIn: entry.resetTime - now,
  };
}

// ── Supabase backend ──────────────────────────────────────────────────────────

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(message),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function checkRateLimitSupabase(
  identifier: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const key = await hmacSha256Hex(RATE_LIMIT_SALT!, identifier);

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/consume_rate_limit`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          apikey: SUPABASE_SERVICE_KEY!,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_key: key,
          p_max_requests: config.maxRequests,
          p_window_ms: config.windowMs,
        }),
        signal: AbortSignal.timeout(2_000),
      },
    );

    if (!response.ok) {
      throw new Error(`Rate-limit backend returned ${response.status}`);
    }

    const rows = (await response.json()) as Array<{
      allowed: boolean;
      remaining: number;
      reset_in_ms: number;
    }>;
    const result = rows[0];

    if (!result) {
      throw new Error("Rate-limit backend returned no result");
    }

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetIn: result.reset_in_ms,
    };
  } catch (error) {
    console.error("[Rate Limit] Distributed backend unavailable:", error);
    if (config.failClosed) {
      return { allowed: false, remaining: 0, resetIn: config.windowMs };
    }
    return checkRateLimitMemory(identifier, config);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  failClosed?: boolean;
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 60, windowMs: 60_000 },
): { allowed: boolean; remaining: number; resetIn: number } {
  return checkRateLimitMemory(identifier, config);
}

/**
 * Async version — required for production-sensitive routes.
 */
export async function checkRateLimitAsync(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 60, windowMs: 60_000 },
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  if (useSupabase) {
    return checkRateLimitSupabase(identifier, config);
  }
  if (process.env.NODE_ENV === "production" && config.failClosed) {
    console.error(
      "[Rate Limit] Missing Supabase service credentials or IP_HASH_SALT",
    );
    return { allowed: false, remaining: 0, resetIn: config.windowMs };
  }
  return checkRateLimitMemory(identifier, config);
}

function rightmostHeaderIp(value: string | null): string | null {
  if (!value) return null;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1]! : null;
}

/**
 * Get client IP from trusted proxy headers.
 * Prefers Vercel's edge header (rightmost hop) and x-real-ip, falling back to
 * the rightmost x-forwarded-for hop so client-prepended spoofed values are ignored.
 */
export function getClientIp(request: Request): string {
  return (
    rightmostHeaderIp(request.headers.get("x-vercel-forwarded-for")) ||
    request.headers.get("x-real-ip")?.trim() ||
    rightmostHeaderIp(request.headers.get("x-forwarded-for")) ||
    "unknown"
  );
}
