import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  streamText: vi.fn(),
}));

vi.mock("ai", () => ({
  generateObject: mocks.generateObject,
  generateText: mocks.generateText,
  streamText: mocks.streamText,
  gateway: (model: string) => ({ model }),
  createGateway: () => (model: string) => ({ model }),
}));

describe("AI client runtime bounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("ITINERARY_AI_AGENT_TIMEOUT_MS", "1234");
  });

  it("bounds complete itinerary generation with timeout and no retries", async () => {
    mocks.generateObject.mockResolvedValueOnce({
      usage: { totalTokens: 100 },
      object: {
        destination: "Tokyo",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        overview: "A concise Tokyo trip.",
        totalEstimatedCost: { amount: 1200, currency: "USD" },
        days: [],
        packingList: [],
        generalTips: [],
      },
    });

    const { generateItinerary } = await import("@/lib/ai/client");
    await generateItinerary({
      destination: "Tokyo",
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      budget: "moderate",
      vibes: ["foodie"],
      travelers: { adults: 2, children: 0 },
    });

    expect(mocks.generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 1234,
        abortSignal: expect.any(AbortSignal),
        maxRetries: 0,
      }),
    );
  });

  it("bounds streaming itinerary generation with timeout and no retries", async () => {
    mocks.streamText.mockReturnValueOnce({
      toTextStreamResponse: vi.fn(),
    });

    const { streamItinerary } = await import("@/lib/ai/client");
    await streamItinerary({
      destination: "Tokyo",
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      budget: "moderate",
      vibes: ["foodie"],
      travelers: { adults: 2, children: 0 },
    });

    expect(mocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 1234,
        maxRetries: 0,
      }),
    );
  });

  it("bounds simple text generation with timeout and no retries", async () => {
    mocks.generateText.mockResolvedValueOnce({
      text: "ok",
      usage: { totalTokens: 10 },
    });

    const { generateText_AI } = await import("@/lib/ai/client");
    await generateText_AI("hello");

    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 1234,
        maxRetries: 0,
      }),
    );
  });
});
