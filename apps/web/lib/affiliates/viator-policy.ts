/**
 * Operational approval gates, not a certification of licence compliance.
 * Approval references identify a reviewed commercial record, never a secret.
 */
export function isViatorContentEnabled(): boolean {
  return (
    process.env.VIATOR_CONTENT_ENABLED === "true" &&
    !!process.env.VIATOR_CONTENT_APPROVAL_REF?.trim()
  );
}

export function isViatorExternalProcessingEnabled(): boolean {
  return (
    isViatorContentEnabled() &&
    process.env.VIATOR_EXTERNAL_PROCESSING_ENABLED === "true" &&
    !!process.env.VIATOR_EXTERNAL_PROCESSING_APPROVAL_REF?.trim()
  );
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function isViatorContent(value: unknown): boolean {
  const item = record(value);
  if (!item) return false;
  const booking = record(item.bookingInfo);
  const partner =
    item.affiliatePartner ?? item.affiliate_partner ?? booking?.affiliateId;
  if (partner === "viator" || item.source === "viator") return true;
  if (typeof item.id === "string" && item.id.startsWith("activity_v_"))
    return true;
  const link = item.affiliateUrl ?? item.affiliate_url ?? booking?.bookingUrl;
  if (typeof link !== "string") return false;
  try {
    const host = new URL(link).hostname.toLowerCase();
    return host === "viator.com" || host.endsWith(".viator.com");
  } catch {
    return false;
  }
}

export function viatorContentMetadata(value: unknown) {
  return isViatorContent(value)
    ? { viatorContentVersion: record(value)?.viatorContentVersion }
    : {};
}

export function canDisplayViatorContent(
  value: unknown,
  enabled = isViatorContentEnabled(),
): boolean {
  return (
    !isViatorContent(value) ||
    (enabled && record(value)?.viatorContentVersion === 1)
  );
}

export function canProcessViatorContent(value: unknown): boolean {
  return (
    !isViatorContent(value) ||
    (canDisplayViatorContent(value) && isViatorExternalProcessingEnabled())
  );
}

/**
 * Filter at read boundaries as well as generation. Never rewrite stored trips.
 * Legacy provider cards lack proof of unmodified text and remain hidden.
 * Opaque cached render specs have no reliable provenance and are not replayed.
 */
export function filterViatorDisplay<T>(value: T): T {
  function visit(input: unknown): { value: unknown; removed: boolean } {
    if (Array.isArray(input)) {
      const children = input.map(visit);
      return {
        value: children
          .filter((child) => child.value !== undefined)
          .map((child) => child.value),
        removed: children.some((child) => child.removed),
      };
    }
    const item = record(input);
    if (!item) return { value: input, removed: false };
    if (!canDisplayViatorContent(item)) {
      return { value: undefined, removed: true };
    }
    const output: Record<string, unknown> = {};
    let removed = false;
    for (const [key, child] of Object.entries(item)) {
      if (key === "json_render_spec" || key === "jsonRenderSpec") continue;
      const result = visit(child);
      if (result.value !== undefined) output[key] = result.value;
      removed ||= result.removed;
    }
    if (removed) {
      // Mixed legacy prose may have been generated from provider content.
      for (const key of ["summary", "overview"]) {
        if (key in output) output[key] = "";
      }
      for (const key of ["tips", "generalTips", "general_tips"]) {
        if (key in output) output[key] = [];
      }
      if ("dayNumber" in output && "title" in output) {
        output.title = `Day ${output.dayNumber}`;
      }
    }
    return { value: output, removed };
  }
  return visit(value).value as T;
}
