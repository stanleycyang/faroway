/** Shape validation only: discovered URLs are never trusted fetch targets or policies. */
export function auditHotelSourceDiscovery(
  value: unknown,
  expectedIds: string[],
) {
  const issues: string[] = [];
  const leads: { id: string; homepageUrl: string | null }[] = [];
  const record = value as Record<string, unknown> | null;
  if (
    !record ||
    typeof record !== "object" ||
    Array.isArray(record) ||
    Object.keys(record).some((key) => key !== "hotels") ||
    !Array.isArray(record.hotels)
  ) {
    issues.push("Expected only a hotels array");
  } else {
    const seen = new Set<string>();
    for (const item of record.hotels) {
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item) ||
        Object.keys(item).some((key) => !["id", "homepageUrl"].includes(key)) ||
        typeof item.id !== "string" ||
        !expectedIds.includes(item.id) ||
        seen.has(item.id)
      ) {
        issues.push("Unexpected, duplicate or malformed hotel identity/fields");
        continue;
      }
      seen.add(item.id);
      if (item.homepageUrl === null) {
        leads.push({ id: item.id, homepageUrl: null });
        continue;
      }
      try {
        if (typeof item.homepageUrl !== "string") throw new Error();
        const url = new URL(item.homepageUrl);
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.port ||
          url.search ||
          url.hash ||
          /\.(jpg|jpeg|png|gif|svg|webp|ico|pdf)$/i.test(url.pathname)
        )
          throw new Error();
        leads.push({ id: item.id, homepageUrl: item.homepageUrl });
      } catch {
        issues.push(`Invalid homepage lead for ${item.id}`);
      }
    }
    if (seen.size !== expectedIds.length)
      issues.push("Missing expected hotel identities");
  }
  return {
    shapeValid: issues.length === 0,
    issues,
    leads,
    requiresIndependentSourceReview: true as const,
    automaticFetchAllowed: false as const,
    policyVerified: false as const,
    qualityAccepted: false as const,
  };
}
