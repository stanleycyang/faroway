import { createHmac } from "node:crypto";

/**
 * Rate limiter — uses an atomic Supabase RPC in production and an in-memory
 * fallback for local development and tests.
 *
 * Identifiers are HMAC-hashed before storage so IP addresses and user IDs are
 * not persisted in plaintext.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RATE_LIMIT_SALT = process.env.IP_HASH_SALT;
const useSupabase = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY && RATE_LIMIT_SALT);

/** Shared key format for transactions that consume a limit inside their RPC. */
export function getRateLimitBucketKey(identifier: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt && process.env.NODE_ENV === "production") {
    throw new Error("IP_HASH_SALT is required for distributed rate limiting");
  }
  return createHmac("sha256", salt || "faroway-local-development")
    .update(identifier)
    .digest("hex");
}

// ── In-memory fallback ────────────────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Cleanup old entries every 5 minutes to prevent unbounded growth in long-lived processes.
const cleanupTimer = setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);
cleanupTimer.unref?.();

function checkRateLimitMemory(
  identifier: string,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
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

async function checkRateLimitSupabase(
  identifier: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const key = getRateLimitBucketKey(identifier);

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

/**
 * Get client IP from request headers.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
