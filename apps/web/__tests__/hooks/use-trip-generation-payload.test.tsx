import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";
import { useTripGeneration } from "@/hooks/useTripGeneration";

test.each([
  { progress: "invalid" },
  { message: { text: "Unreadable" } },
  { progress: 200 },
])(
  "malformed progress %j cannot replace readable live feedback and later updates still work",
  async (malformed) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const listeners = new Map<string, (event: { data?: string }) => void>();
    const close = vi.fn();
    vi.stubGlobal(
      "EventSource",
      class {
        addEventListener(
          name: string,
          listener: (event: { data?: string }) => void,
        ) {
          listeners.set(name, listener);
        }
        close = close;
      },
    );
    let state!: ReturnType<typeof useTripGeneration>;
    function Probe() {
      const current = useTripGeneration({ tripId: "fixture-trip" });
      React.useEffect(() => {
        state = current;
      }, [current]);
      return null;
    }
    let renderer: ReturnType<typeof create> | undefined;
    try {
      await act(async () => {
        renderer = create(<Probe />);
      });
      await act(async () => {
        listeners.get("open")!({});
        listeners.get("progress")!({
          data: JSON.stringify({
            progress: 25,
            message: "Finding thoughtful stays",
          }),
        });
      });
      await act(async () => {
        listeners.get("progress")!({
          data: JSON.stringify(malformed),
        });
      });
      expect(state.progress).toBe(25);
      expect(state.message).toBe("Finding thoughtful stays");
      await act(async () => {
        listeners.get("progress")!({
          data: JSON.stringify({ progress: 50, message: "Shaping your days" }),
        });
      });
      expect(state.progress).toBe(50);
      expect(state.message).toBe("Shaping your days");
      expect(close).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      vi.unstubAllGlobals();
    }
  },
);

test("reconnecting a saved planning job does not duplicate replayed chapters", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const sources: Array<{
    listeners: Map<string, (event: { data?: string }) => void>;
  }> = [];
  vi.stubGlobal(
    "EventSource",
    class {
      listeners = new Map<string, (event: { data?: string }) => void>();
      constructor() {
        sources.push(this);
      }
      addEventListener(
        name: string,
        listener: (event: { data?: string }) => void,
      ) {
        this.listeners.set(name, listener);
      }
      close() {}
    },
  );
  let state!: ReturnType<typeof useTripGeneration>;
  function Probe() {
    const current = useTripGeneration({
      tripId: "fixture-trip",
      generationId: "saved-job",
    });
    React.useEffect(() => {
      state = current;
    }, [current]);
    return null;
  }
  let renderer: ReturnType<typeof create> | undefined;
  const payload = {
    chapter: "hotels",
    blocks: [{ type: "HotelCard", props: { name: "Saved stay" } }],
  };
  try {
    await act(async () => {
      renderer = create(<Probe />);
    });
    await act(async () => {
      sources[0].listeners.get("open")!({});
      sources[0].listeners.get("spec-block")!({
        data: JSON.stringify(payload),
      });
    });
    expect(state.specBlocks).toHaveLength(1);
    await act(async () => {
      sources[0].listeners.get("error")!({});
    });
    await act(async () => {
      state.reconnect();
    });
    await act(async () => {
      sources[1].listeners.get("open")!({});
      sources[1].listeners.get("spec-block")!({
        data: JSON.stringify(payload),
      });
    });
    expect(state.specBlocks).toHaveLength(1);
    const updated = {
      ...payload,
      blocks: [{ type: "HotelCard", props: { name: "Refined saved stay" } }],
    };
    await act(async () => {
      sources[1].listeners.get("spec-block")!({
        data: JSON.stringify(updated),
      });
    });
    expect(state.specBlocks).toEqual(updated.blocks);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
  }
});
