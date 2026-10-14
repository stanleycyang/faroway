import { beforeEach, expect, it, vi } from "vitest";
const session = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession: session } }),
}));
import { requestPlanningConsent } from "@/lib/ai/planning-consent-client";
const confirm = vi.fn();
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { confirm });
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("fetch", fetchMock);
  session.mockResolvedValue({
    data: { session: { user: { id: "a" }, access_token: "a-token" } },
  });
  confirm.mockReturnValue(true);
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      version: "planning-google-v1",
      message: "Vercel AI Gateway and Google",
    }),
  });
});
it("binds affirmative web consent to fresh same-account headers", async () => {
  const headers = await requestPlanningConsent();
  expect(await headers()).toMatchObject({
    Authorization: "Bearer a-token",
    "X-Faroway-AI-Disclosure": "planning-google-v1",
  });
  expect(confirm).toHaveBeenCalledWith(
    expect.stringContaining("Vercel AI Gateway and Google"),
  );
});
it("does not authorize planning on decline or unavailable disclosure", async () => {
  confirm.mockReturnValue(false);
  await expect(requestPlanningConsent()).rejects.toThrow("declined");
  confirm.mockClear();
  fetchMock.mockResolvedValue({ ok: false });
  await expect(requestPlanningConsent()).rejects.toThrow("unavailable");
  expect(confirm).not.toHaveBeenCalled();
});
it("rejects a switched account, logout or offline state before each subsequent write", async () => {
  const headers = await requestPlanningConsent();
  session.mockResolvedValue({ data: { session: { user: { id: "b" } } } });
  await expect(headers()).rejects.toThrow("account changed");
  session.mockResolvedValue({ data: { session: null } });
  await expect(headers()).rejects.toThrow("account changed");
  session.mockResolvedValue({ data: { session: { user: { id: "a" } } } });
  vi.stubGlobal("navigator", { onLine: false });
  await expect(headers()).rejects.toThrow("offline");
});
it("does not reuse consent on retry or restoration", async () => {
  await requestPlanningConsent();
  await requestPlanningConsent();
  expect(confirm).toHaveBeenCalledTimes(2);
});

it("rejects missing disclosure without presenting consent", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => null });
  await expect(requestPlanningConsent()).rejects.toThrow("verified");
  expect(confirm).not.toHaveBeenCalled();
});

it("rejects a different initial session before disclosure or planning", async () => {
  await expect(requestPlanningConsent("different-owner")).rejects.toThrow(
    "account changed",
  );
  expect(fetchMock).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
});
it("settles a stalled session read without fetching disclosure", async () => {
  vi.useFakeTimers();
  try {
    session.mockReturnValue(new Promise(() => {}));
    const work = requestPlanningConsent("a");
    const failure = expect(work).rejects.toThrow("took too long");
    await vi.advanceTimersByTimeAsync(20_000);
    await failure;
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
