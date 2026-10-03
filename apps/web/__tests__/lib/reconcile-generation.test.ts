import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  status: vi.fn(),
  apply: vi.fn(),
  update: vi.fn(),
  search: {
    id: "search-1",
    user_id: "owner",
    status: "pending",
    workflow_run_id: "run-1" as string | null,
    error_message:
      "Workflow startup could not be confirmed. Check progress before retrying.",
  },
}));
vi.mock("@/lib/workflow/runtime", () => ({
  getWorkflowRunStatus: mock.status,
}));
vi.mock("@/lib/trips/apply-generation-update", () => ({
  applyGenerationUpdate: mock.apply,
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({
    from: () => {
      const filters: Record<string, unknown> = {};
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => {
          filters[key] = value;
          return chain;
        },
        single: async () => ({
          data: filters.user_id === mock.search.user_id ? mock.search : null,
          error: null,
        }),
        update: mock.update.mockImplementation(() => chain),
        error: null,
      };
      return chain;
    },
  }),
}));
import { reconcileGeneration } from "@/lib/trips/reconcile-generation";
describe("workflow startup reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.search.status = "pending";
    mock.search.workflow_run_id = "run-1";
    mock.status.mockResolvedValue("running");
    mock.apply.mockResolvedValue(true);
  });
  it("retains an uncertain claim without a run ID", async () => {
    mock.search.workflow_run_id = null;
    expect(await reconcileGeneration("trip-1", "owner", "search-1")).toEqual({
      state: "unconfirmed",
    });
    expect(mock.status).not.toHaveBeenCalled();
    expect(mock.apply).not.toHaveBeenCalled();
  });
  it("never releases a claim on 404/network failure", async () => {
    mock.status.mockRejectedValue(new Error("run not visible yet"));
    expect(await reconcileGeneration("trip-1", "owner", "search-1")).toEqual({
      state: "unconfirmed",
    });
    expect(mock.apply).not.toHaveBeenCalled();
  });
  it("recognizes a running workflow without dispatching or changing the trip", async () => {
    expect(await reconcileGeneration("trip-1", "owner", "search-1")).toEqual({
      state: "running",
    });
    expect(mock.apply).not.toHaveBeenCalled();
  });
  it.each(["failed", "cancelled"])(
    "allows user retry only after confirmed terminal %s",
    async (status) => {
      mock.status.mockResolvedValue(status);
      expect(await reconcileGeneration("trip-1", "owner", "search-1")).toEqual({
        state: "retry_available",
      });
      expect(mock.apply).toHaveBeenCalledWith(
        "trip-1",
        "search-1",
        "failed",
        expect.any(Object),
      );
    },
  );
  it("recovers a failed final bridge even if the search was marked completed first", async () => {
    mock.search.status = "completed";
    mock.status.mockResolvedValue("failed");
    expect(
      (await reconcileGeneration("trip-1", "owner", "search-1")).state,
    ).toBe("retry_available");
    expect(mock.apply).toHaveBeenCalledWith(
      "trip-1",
      "search-1",
      "failed",
      expect.any(Object),
    );
  });
  it("does not release an attempt if a newer attempt won the database fence", async () => {
    mock.status.mockResolvedValue("failed");
    mock.apply.mockResolvedValue(false);
    expect(await reconcileGeneration("trip-1", "owner", "search-1")).toEqual({
      state: "settled",
    });
  });
  it("requires owned search data before reading workflow status", async () => {
    expect(
      await reconcileGeneration("trip-1", "other-user", "search-1"),
    ).toEqual({ state: "unconfirmed" });
    expect(mock.status).not.toHaveBeenCalled();
  });
  it("reconciles a completed error-returning workflow but not unexplained completion", async () => {
    mock.status.mockResolvedValue("completed");
    expect(
      (await reconcileGeneration("trip-1", "owner", "search-1")).state,
    ).toBe("unconfirmed");
    mock.search.status = "error";
    expect(
      (await reconcileGeneration("trip-1", "owner", "search-1")).state,
    ).toBe("retry_available");
  });
});
