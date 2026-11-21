import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";
vi.mock("@/components/places/PlacesExplorer", () => ({
  PlacesExplorer: () => null,
}));
import { PlacesAutocompleteInput } from "../components/create/PlacesAutocompleteInput";

test.each(["stale unavailable", "stale failure", "timeout", "malformed"])(
  "search recovers from %s",
  async (scenario) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.stubGlobal("document", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    let resolve!: (value: unknown) => void;
    let reject!: (reason: Error) => void;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((yes, no) => {
            resolve = yes;
            reject = no;
          }),
      )
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ predictions: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <PlacesAutocompleteInput onSelect={vi.fn()} localDestinations={[]} />,
        );
      });
      const change = async (value: string) => {
        await act(async () => {
          renderer.root
            .findByType("input")
            .props.onChange({ target: { value } });
        });
        await act(async () => {
          vi.advanceTimersByTime(300);
        });
      };
      await change("Paris");
      if (scenario.startsWith("stale")) {
        await act(async () => {
          renderer.root
            .findByType("input")
            .props.onChange({ target: { value: "Tokyo" } });
        });
        await act(async () => {
          if (scenario === "stale failure") reject(new Error("Offline"));
          else resolve({ status: 501 });
        });
        expect(JSON.stringify(renderer.toJSON())).toContain("Searching...");
        await act(async () => {
          vi.advanceTimersByTime(300);
        });
        await change("London");
        expect(fetchMock).toHaveBeenCalledTimes(3);
      } else if (scenario === "timeout") {
        await act(async () => {
          vi.advanceTimersByTime(15_000);
        });
        expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
        expect(JSON.stringify(renderer.toJSON())).not.toContain("Searching...");
        expect(JSON.stringify(renderer.toJSON())).toContain("Plan with");
      } else {
        await act(async () => {
          resolve({
            ok: true,
            status: 200,
            json: async () => ({ predictions: "invalid" }),
          });
        });
        expect(JSON.stringify(renderer.toJSON())).toContain("Plan with");
      }
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  },
);

test("local suggestions follow catalog changes without another keystroke", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 501 }));
  let renderer!: ReturnType<typeof create>;
  const select = vi.fn();
  try {
    await act(async () => {
      renderer = create(
        <PlacesAutocompleteInput
          onSelect={select}
          localDestinations={[{ name: "Paris", country: "France" }]}
        />,
      );
    });
    await act(async () => {
      renderer.root
        .findByType("input")
        .props.onChange({ target: { value: "France" } });
    });
    expect(JSON.stringify(renderer.toJSON())).toContain("Paris");
    await act(async () => {
      renderer.update(
        <PlacesAutocompleteInput
          onSelect={select}
          localDestinations={[{ name: "Lyon", country: "France" }]}
        />,
      );
    });
    expect(JSON.stringify(renderer.toJSON())).not.toContain("Paris");
    expect(JSON.stringify(renderer.toJSON())).toContain("Lyon");
    await act(async () => {
      renderer.root
        .findAllByProps({ role: "option" })
        .find(
          (option) =>
            option.findAll((node) => node.children.includes("Lyon")).length > 0,
        )!
        .props.onClick();
    });
    expect(select).toHaveBeenCalledWith({ name: "Lyon", source: "catalog" });
    expect(
      renderer.root
        .findAllByProps({ role: "option" })
        .every((option) => option.findAllByType("button").length === 0),
    ).toBe(true);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
  }
});

test("combobox closes on blur and prefers exact catalog match on Enter", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 501 }));
  let renderer!: ReturnType<typeof create>;
  const select = vi.fn();
  try {
    await act(async () => {
      renderer = create(
        <PlacesAutocompleteInput
          onSelect={select}
          localDestinations={[
            { name: "Paris", country: "France" },
            { name: "Parma", country: "Italy" },
          ]}
        />,
      );
    });
    const input = () => renderer.root.findByType("input");
    await act(async () => {
      input().props.onChange({ target: { value: "paris" } });
    });
    expect(renderer.root.findAllByProps({ role: "option" }).length).toBe(2);
    expect(
      renderer.root
        .findAllByProps({ role: "option" })
        .every((option) => option.findAllByType("button").length === 0),
    ).toBe(true);

    await act(async () => {
      input().props.onKeyDown({
        key: "Enter",
        preventDefault: vi.fn(),
      });
    });
    expect(select).toHaveBeenCalledWith({ name: "Paris", source: "catalog" });
    expect(renderer.root.findAllByProps({ role: "listbox" })).toHaveLength(0);

    await act(async () => {
      input().props.onChange({ target: { value: "par" } });
    });
    expect(renderer.root.findAllByProps({ role: "listbox" })).toHaveLength(1);
    await act(async () => {
      input().props.onBlur({ relatedTarget: null });
    });
    expect(renderer.root.findAllByProps({ role: "listbox" })).toHaveLength(0);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
  }
});
