import { afterEach, expect, it, vi } from "vitest";
import { boundedStagingArgs } from "@/lib/ai/sdk";
afterEach(() => vi.unstubAllEnvs());
it("caps preview output and disables SDK retries for bounded acceptance", () => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("FAROWAY_STAGING_AI_MAX_OUTPUT_TOKENS", "8000");
  expect(
    boundedStagingArgs({
      prompt: "fixture",
      maxOutputTokens: 12000,
      maxRetries: 2,
    }),
  ).toEqual({
    prompt: "fixture",
    maxOutputTokens: 8000,
    maxRetries: 0,
  });
  expect(boundedStagingArgs({ maxOutputTokens: 1000 })).toEqual({
    maxOutputTokens: 1000,
    maxRetries: 0,
  });
});
it.each(["production", "development"])(
  "leaves %s settings unchanged",
  (environment) => {
    vi.stubEnv("VERCEL_ENV", environment);
    vi.stubEnv("FAROWAY_STAGING_AI_MAX_OUTPUT_TOKENS", "8000");
    const args = { maxRetries: 2 };
    expect(boundedStagingArgs(args)).toBe(args);
  },
);
it.each(["", "99", "8001", "NaN", "1.5"])(
  "ignores invalid preview cap %s",
  (cap) => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("FAROWAY_STAGING_AI_MAX_OUTPUT_TOKENS", cap);
    const args = {};
    expect(boundedStagingArgs(args)).toBe(args);
  },
);
