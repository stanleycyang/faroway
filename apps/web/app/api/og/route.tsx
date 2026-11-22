import { createSocialImage } from "@/lib/social-image";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/** Default share image with bounded optional headline and description. */
export async function GET(request: Request) {
  const rl = await checkRateLimitAsync(`og-default:${getClientIp(request)}`, {
    maxRequests: 60,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return new Response("Too many requests", {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil(rl.resetIn / 1000))),
      },
    });
  }
  const { searchParams } = new URL(request.url);
  const response = await createSocialImage(
    searchParams.get("title"),
    searchParams.get("desc"),
  );
  response.headers.set(
    "Cache-Control",
    "public, max-age=300, s-maxage=86400, stale-while-revalidate=31536000",
  );
  return response;
}
