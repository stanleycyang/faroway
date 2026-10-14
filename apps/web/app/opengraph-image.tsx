import { createSocialImage } from "@/lib/social-image";

export const runtime = "nodejs";
export const alt = "Faroway — A journey, shaped around you.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return createSocialImage();
}
