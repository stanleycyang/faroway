import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canDisplayViatorContent,
  canProcessViatorContent,
  filterViatorDisplay,
  isViatorContentEnabled,
  isViatorExternalProcessingEnabled,
} from "@/lib/affiliates/viator-policy";

const provider = {
  id: "activity_v_123P1",
  affiliatePartner: "viator",
  name: "Provider-owned title",
  description: "Provider-owned description",
  viatorContentVersion: 1,
};
const independent = { id: "local-1", name: "Independent walking plan" };

function approveContent() {
  vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
  vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "commercial-review-123");
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Viator commercial approval gates", () => {
  it("requires explicit enablement and a non-secret approval reference", () => {
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "");
    vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "");
    expect(isViatorContentEnabled()).toBe(false);
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
    expect(isViatorContentEnabled()).toBe(false);
    vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "   ");
    expect(isViatorContentEnabled()).toBe(false);
    approveContent();
    expect(isViatorContentEnabled()).toBe(true);
  });

  it("does not permit external processing with content approval alone", () => {
    approveContent();
    vi.stubEnv("VIATOR_EXTERNAL_PROCESSING_ENABLED", "");
    vi.stubEnv("VIATOR_EXTERNAL_PROCESSING_APPROVAL_REF", "");
    expect(canProcessViatorContent(provider)).toBe(false);
    expect(canProcessViatorContent(independent)).toBe(true);
    vi.stubEnv("VIATOR_EXTERNAL_PROCESSING_ENABLED", "true");
    expect(isViatorExternalProcessingEnabled()).toBe(false);
    vi.stubEnv("VIATOR_EXTERNAL_PROCESSING_APPROVAL_REF", "AI-review-123");
    expect(canProcessViatorContent(provider)).toBe(true);
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "false");
    expect(isViatorExternalProcessingEnabled()).toBe(false);
  });

  it("hides legacy cards even after approval and keeps new text unchanged", () => {
    approveContent();
    const legacy = { ...provider, viatorContentVersion: undefined };
    expect(canDisplayViatorContent(legacy)).toBe(false);
    expect(filterViatorDisplay([legacy, provider])).toEqual([provider]);
    expect(provider.description).toBe("Provider-owned description");
  });

  it("filters saved plans without mutating them or removing independent picks", () => {
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "false");
    const saved = {
      overview: "Prose derived from provider results",
      days: [
        {
          dayNumber: 1,
          title: "A provider-derived day",
          summary: "Provider-derived summary",
          morning: { activities: [provider, independent] },
        },
      ],
      json_render_spec: [{ props: { name: provider.name } }],
    };
    const result = filterViatorDisplay(saved);
    expect(result.days[0].morning.activities).toEqual([independent]);
    expect(result.days[0].title).toBe("Day 1");
    expect(result.days[0].summary).toBe("");
    expect(result.overview).toBe("");
    expect(result).not.toHaveProperty("json_render_spec");
    expect(saved.days[0].morning.activities).toHaveLength(2);
  });

  it("recognizes legacy booking and tracking provenance", () => {
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "false");
    const values = [
      { id: "old", bookingInfo: { affiliateId: "viator" } },
      { id: "old", affiliate_partner: "viator" },
      { id: "old", affiliateUrl: "https://www.viator.com/tours/test" },
    ];
    expect(filterViatorDisplay(values)).toEqual([]);
  });

  it("blocks every Viator API entry point with credentials but no approval", async () => {
    vi.resetModules();
    vi.stubEnv("VIATOR_API_KEY", "test-only-placeholder");
    vi.stubEnv("VIATOR_PARTNER_ID", "P123");
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "false");
    const fetch = vi.spyOn(globalThis, "fetch");
    const api = await import("@/lib/affiliates/viator");
    expect(api.isViatorConfigured()).toBe(false);
    expect(await api.searchViatorProducts({ destination: "Paris" })).toEqual(
      [],
    );
    expect(await api.getViatorProduct("123P1")).toBeNull();
    expect(
      await api.checkViatorAvailability("123P1", "2099-01-01", "2099-01-02"),
    ).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("preserves provider description when normalizing an approved response", async () => {
    vi.resetModules();
    approveContent();
    vi.stubEnv("VIATOR_API_KEY", "test-only-placeholder");
    vi.stubEnv("VIATOR_PARTNER_ID", "P123");
    const description = "Full provider text. ".repeat(30);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ productCode: "123P1", description })),
    );
    const { getViatorProduct } = await import("@/lib/affiliates/viator");
    const product = await getViatorProduct("123P1");
    expect(product?.description).toBe(description);
    expect(product?.shortDescription).toBe("");
  });

  it("does not send provider names to external enrichment without approval", async () => {
    vi.resetModules();
    approveContent();
    vi.stubEnv("VIATOR_EXTERNAL_PROCESSING_ENABLED", "false");
    vi.stubEnv("TRIPADVISOR_API_KEY", "test-only-placeholder");
    const fetch = vi.spyOn(globalThis, "fetch");
    const { enrichWithTripAdvisor } =
      await import("@/lib/affiliates/tripadvisor");
    const item = { ...provider, location: { name: "Paris" } };
    expect(await enrichWithTripAdvisor([item], "attractions")).toEqual([
      item,
    ]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
