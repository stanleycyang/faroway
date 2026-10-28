import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ getSupabase: vi.fn() }));
vi.mock("@/lib/trips/apply-generation-update", () => ({
  applyGenerationUpdate: vi.fn(),
}));
import { localGenerationScenario } from "@/lib/testing/local-generation";
describe("local generation guard", () => {
  it("requires an explicit scenario, development and local database", () => {
    const env = {
      NODE_ENV: "development",
      FAROWAY_TEST_GENERATION: "success",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55421",
    } as NodeJS.ProcessEnv;
    expect(localGenerationScenario(env)).toBe("success");
    expect(localGenerationScenario({ NODE_ENV: "production" })).toBeNull();
    for (const change of [
      { NODE_ENV: "production" },
      { VERCEL: "1" },
      { NEXT_PUBLIC_SUPABASE_URL: "https://omovikloadpvzijoaqus.supabase.co" },
      { NEXT_PUBLIC_SUPABASE_URL: "http://localhost.evil.invalid" },
      { NEXT_PUBLIC_SUPABASE_URL: "http://user:pass@localhost" },
      { FAROWAY_TEST_GENERATION: "unknown" },
    ])
      expect(() => localGenerationScenario({ ...env, ...change })).toThrow();
  });
});

import { getSupabase } from "@/lib/supabase/server";
import { applyGenerationUpdate } from "@/lib/trips/apply-generation-update";
import { completeLocalGeneration } from "@/lib/testing/local-generation";
import { afterEach } from "vitest";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
const input = {
  tripId: "trip",
  searchId: "search",
  userId: "owner",
  destination: "QA Harbor",
  startDate: "2099-06-01",
  endDate: "2099-06-03",
};
function local(mode: string) {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("FAROWAY_TEST_GENERATION", mode);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55421");
}
it("timeout never dispatches or releases the uncertain claim", async () => {
  local("timeout");
  await completeLocalGeneration(input, "timeout");
  expect(applyGenerationUpdate).not.toHaveBeenCalled();
});
it("terminal failure is saved through the generation fence", async () => {
  local("failure");
  const eq = vi.fn().mockReturnThis();
  eq.mockReturnValueOnce({ eq }).mockResolvedValueOnce({ error: null });
  const update = vi.fn(() => ({ eq }));
  vi.mocked(getSupabase).mockReturnValue({ from: () => ({ update }) } as never);
  vi.mocked(applyGenerationUpdate).mockResolvedValue(true);
  await completeLocalGeneration(input, "failure");
  expect(applyGenerationUpdate).toHaveBeenCalledWith(
    "trip",
    "search",
    "failed",
    { message: "Synthetic planning failure" },
  );
});
it("a superseded fixture cannot mark a search completed", async () => {
  local("success");
  const from = vi.fn();
  vi.mocked(getSupabase).mockReturnValue({ from } as never);
  vi.mocked(applyGenerationUpdate).mockResolvedValue(false);
  await expect(completeLocalGeneration(input, "success")).rejects.toThrow(
    "superseded",
  );
  expect(from).not.toHaveBeenCalled();
});
