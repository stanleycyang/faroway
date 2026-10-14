import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";

test.each(["http failure", "malformed list", "stalled request"])(
  "country search retries after %s",
  async (failure) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.resetModules();
    const { CountrySearch } =
      await import("../components/tools/world-map/CountrySearch");
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("document", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const first =
      failure === "stalled request"
        ? new Promise(() => {})
        : Promise.resolve({
            ok: failure !== "http failure",
            json: async () => ({ objects: {} }),
          });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          objects: {
            countries: {
              geometries: [
                { id: "840", properties: { name: "United States" } },
              ],
            },
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const pick = vi.fn();
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<CountrySearch onPick={pick} />);
      });
      await act(async () => {
        renderer.root.findByType("button").props.onClick();
      });
      if (failure === "stalled request") {
        expect(JSON.stringify(renderer.toJSON())).toContain(
          "Loading countries",
        );
        await act(async () => {
          vi.advanceTimersByTime(15_000);
        });
        expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
      }
      expect(JSON.stringify(renderer.toJSON())).toContain(
        "Country search couldn’t load",
      );
      await act(async () => {
        renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("Try again"))!
          .props.onClick();
      });
      expect(JSON.stringify(renderer.toJSON())).toContain("United States");
      expect(JSON.stringify(renderer.toJSON())).not.toContain("couldn’t load");
      await act(async () => {
        renderer.root.findByType("input").props.onKeyDown({ key: "Enter" });
      });
      expect(pick).toHaveBeenCalledWith("USA", "United States");
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  },
);
