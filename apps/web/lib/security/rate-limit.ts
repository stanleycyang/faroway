/**
 * Rate limiter — uses Vercel KV (Redis) when KV_REST_API_URL + KV_REST_API_TOKEN
 * are set, otherwise falls back to an in-memory Map.
 *
 * In-memory is fine for local dev but does NOT persist across Vercel serverless
 * invocations. For production, provision a Vercel KV store and set the two env vars.
 *
 * Setup: vercel storage add (type: KV) → env vars are auto-populated in Vercel dashboard.
 * Add KV_REST_API_URL and KV_REST_API_TOKEN to apps/web/.env.local for local testing.
 */

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const useKv = !!(KV_URL && KV_TOKEN);

// ── In-memory fallback ────────────────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Cleanup old entries every 5 minutes to prevent unbounded growth in long-lived processes.
setInterval(
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

// ── Vercel KV (Redis) backend ─────────────────────────────────────────────────

async function checkRateLimitKv(
  identifier: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const ttlSeconds = Math.ceil(config.windowMs / 1000);
  const key = `rl:${identifier}`;

  try {
    // Pipeline: INCR then EXPIRE (only sets TTL on the first call within the window)
    const res = await fetch(`${KV_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, ttlSeconds, "NX"],
      ]),
    });

    if (!res.ok) {
      // KV error — fail open (allow request) to avoid blocking legitimate users
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetIn: config.windowMs,
      };
    }

    const [incrResult] = (await res.json()) as [{ result: number }, unknown];
    const count = incrResult.result;
    const remaining = Math.max(0, config.maxRequests - count);

    return {
      allowed: count <= config.maxRequests,
      remaining,
      resetIn: config.windowMs, // approximate; exact TTL requires an extra GET
    };
  } catch {
    // Network failure — fail open
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetIn: config.windowMs,
    };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 60, windowMs: 60_000 },
): { allowed: boolean; remaining: number; resetIn: number } {
  if (useKv) {
    // KV path is async but callers currently expect sync. We return the
    // in-memory result for the synchronous contract and fire the KV check
    // asynchronously so it still increments the distributed counter.
    // For a fully async refactor, callers should await checkRateLimitAsync().
    checkRateLimitKv(identifier, config).catch(() => undefined);
  }
  return checkRateLimitMemory(identifier, config);
}

/**
 * Async version — use this in new code for correct distributed rate limiting.
 * Returns the KV-backed result when KV is configured, in-memory otherwise.
 */
export async function checkRateLimitAsync(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 60, windowMs: 60_000 },
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  if (useKv) {
    return checkRateLimitKv(identifier, config);
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
