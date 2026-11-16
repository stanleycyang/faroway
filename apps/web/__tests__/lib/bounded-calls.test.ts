import { afterEach, describe, expect, it, vi } from "vitest";
import { allBounded } from "@/lib/search/runtime";

afterEach(() => {
  vi.useRealTimers();
});

describe("allBounded", () => {
  it("overlaps independent calls and finishes faster than running them in series", async () => {
    const spans: Array<{ start: number; end: number }> = [];
    const started = Date.now();
    const tasks = [0, 1].map((index) => ({
      label: `call-${index}`,
      timeoutMs: 1000,
      run: async () => {
        const start = Date.now() - started;
        await new Promise((resolve) => setTimeout(resolve, 40));
        const end = Date.now() - started;
        spans[index] = { start, end };
        return index;
      },
    }));
    const settled = await allBounded(tasks, { concurrency: 2 });
    expect(settled.map((item) => item.status)).toEqual([
      "fulfilled",
      "fulfilled",
    ]);
    expect(spans[0].start).toBeLessThan(spans[1].end);
    expect(spans[1].start).toBeLessThan(spans[0].end);
    const elapsed = Math.max(spans[0].end, spans[1].end);
    const serial =
      spans[0].end - spans[0].start + (spans[1].end - spans[1].start);
    expect(elapsed).toBeLessThan(serial);
  });

  it("does not start a second call until the first finishes when concurrency is 1", async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const running = allBounded(
      [
        {
          label: "first",
          timeoutMs: 1000,
          run: async () => {
            order.push("first-start");
            await gate;
            order.push("first-end");
            return 1;
          },
        },
        {
          label: "second",
          timeoutMs: 1000,
          run: async () => {
            order.push("second-start");
            return 2;
          },
        },
      ],
      { concurrency: 1 },
    );
    await vi.waitFor(() => {
      expect(order).toEqual(["first-start"]);
    });
    release();
    await running;
    expect(order).toEqual(["first-start", "first-end", "second-start"]);
  });

  it("times out a call once and does not start it again", async () => {
    let calls = 0;
    const [settled] = await allBounded(
      [
        {
          label: "slow supplier",
          timeoutMs: 20,
          run: (signal) => {
            calls += 1;
            return new Promise((_resolve, reject) => {
              signal.addEventListener("abort", () => {
                reject(new Error("aborted"));
              });
            });
          },
        },
      ],
      { concurrency: 1 },
    );
    expect(calls).toBe(1);
    expect(settled.status).toBe("rejected");
    if (settled.status === "rejected") {
      expect(String(settled.reason)).toMatch(/timed out after 20ms/);
    }
  });

  it("cancels a queued call without invoking it when the parent aborts", async () => {
    const parent = new AbortController();
    let secondCalls = 0;
    const running = allBounded(
      [
        {
          label: "in flight",
          timeoutMs: 1000,
          run: (signal) =>
            new Promise((_resolve, reject) => {
              signal.addEventListener("abort", () => {
                reject(
                  new DOMException("The operation was aborted.", "AbortError"),
                );
              });
            }),
        },
        {
          label: "queued",
          timeoutMs: 1000,
          run: async () => {
            secondCalls += 1;
            return 2;
          },
        },
      ],
      { concurrency: 1, signal: parent.signal },
    );
    parent.abort();
    const settled = await running;
    expect(secondCalls).toBe(0);
    expect(settled.every((item) => item.status === "rejected")).toBe(true);
  });
});
