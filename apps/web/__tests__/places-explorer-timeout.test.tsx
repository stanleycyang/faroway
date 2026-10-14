import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";
import { PlacesExplorer } from "../components/places/PlacesExplorer";
test("stalled lookup unlocks at deadline and late body cannot replace its recovery state", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  let resolveResponse!: (r: Response) => void;
  const fetchMock = vi.fn().mockReturnValue(
    new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<PlacesExplorer initialPlaceId="city-a" />);
    });
    await act(async () => {
      renderer.root.findByType("button").props.onClick();
    });
    expect(JSON.stringify(renderer.toJSON())).toContain(
      "Looking up live places",
    );
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain("taking too long");
    expect(JSON.stringify(renderer.toJSON())).not.toContain(
      "Looking up live places",
    );
    await act(async () => {
      resolveResponse(
        new Response(
          JSON.stringify({ places: [], place: { name: "Late place" } }),
          { status: 200 },
        ),
      );
    });
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Late place");
    expect(JSON.stringify(renderer.toJSON())).toContain("Retry lookup");
  } finally {
    await act(async () => renderer?.unmount());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});

test.each([
  { places: "invalid" },
  { place: { placeId: "a", name: "Museum", attributions: {} } },
])(
  "malformed lookup recovers and retries to valid details: %j",
  async (payload) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("document", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => payload })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            place: { placeId: "a", name: "Confirmed Museum", attributions: [] },
          }),
        }),
    );
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<PlacesExplorer initialPlaceId="a" />);
      });
      await act(async () => {
        renderer.root.findByType("button").props.onClick();
      });
      expect(JSON.stringify(renderer.toJSON())).toContain(
        "Live place details are unavailable",
      );
      await act(async () => {
        renderer.root
          .findAllByType("button")
          .find((b) => b.children.includes("Retry lookup"))!
          .props.onClick();
      });
      expect(JSON.stringify(renderer.toJSON())).toContain("Confirmed Museum");
      expect(JSON.stringify(renderer.toJSON())).not.toContain(
        "Live place details are unavailable",
      );
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      vi.unstubAllGlobals();
    }
  },
);
