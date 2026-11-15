import { buildViatorHandoffUrl } from "../../../apps/web/lib/affiliates/viator-link";

export interface VendorExpectation {
  partner: "viator";
  minimumExperiences: number;
  /** Use the configured partner ID when available; never infer it from the result. */
  partnerId?: string;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function httpsImage(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Saved-plan contract only: provider requests, photo decoding and paid attribution
 * still need independent live evidence. Inventory that never reaches a day doesn't count. */
export function evaluateVendorExperiences(
  days: unknown[],
  expected: VendorExpectation,
) {
  const failures: string[] = [];
  const accepted = new Set<string>();
  const acceptedPaths = new Set<string>();
  if (
    !Number.isInteger(expected.minimumExperiences) ||
    expected.minimumExperiences < 1
  ) {
    return { failures: ["invalid vendor experience requirement"], count: 0 };
  }
  for (const day of days) {
    for (const period of ["morning", "afternoon", "evening"]) {
      const activities = record(record(day)?.[period])?.activities;
      if (!Array.isArray(activities)) continue;
      for (const value of activities) {
        const activity = record(value);
        if (!activity || activity.planningIdea === true) continue;
        const booking = record(activity.bookingInfo);
        const partner = activity.affiliatePartner ?? booking?.affiliateId;
        if (partner !== expected.partner) continue;
        const id = activity.id;
        if (typeof id !== "string" || !/^activity_v_[A-Za-z0-9]+$/.test(id)) {
          failures.push("Viator experience is missing its supplier product ID");
          continue;
        }
        const url = activity.affiliateUrl ?? booking?.bookingUrl;
        if (
          typeof url !== "string" ||
          !buildViatorHandoffUrl(url, "qa-verification", expected.partnerId)
        ) {
          failures.push(`${id} has no valid attributed Viator handoff`);
          continue;
        }
        if (
          !Array.isArray(activity.images) ||
          !activity.images.some(httpsImage)
        ) {
          failures.push(`${id} has no supplied HTTPS photo`);
          continue;
        }
        if (typeof activity.name !== "string" || !activity.name.trim()) {
          failures.push(`${id} has no experience name`);
          continue;
        }
        // Tracking parameters or a second saved ID must not turn one product
        // into multiple experiences. Viator's www and apex hosts are equivalent.
        const productPath = new URL(url).pathname.replace(/\/+$/, "");
        if (accepted.has(id) || acceptedPaths.has(productPath)) continue;
        accepted.add(id);
        acceptedPaths.add(productPath);
      }
    }
  }
  if (accepted.size < expected.minimumExperiences) {
    failures.push(
      `expected at least ${expected.minimumExperiences} distinct ${expected.partner} experiences with photos and attributed links, found ${accepted.size}`,
    );
  }
  return { failures, count: accepted.size };
}
