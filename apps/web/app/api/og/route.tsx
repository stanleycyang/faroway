import { createSocialImage } from "@/lib/social-image";

export const runtime = "nodejs";

/** Default share image with bounded optional headline and description. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return createSocialImage(searchParams.get("title"), searchParams.get("desc"));
}
