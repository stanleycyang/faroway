import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  profile: {
    id: "profile-a",
    name: "My map",
    createdAt: "",
    updatedAt: "",
    visits: {},
  },
}));
vi.mock("@/lib/tools/world-map/store", () => ({
  useActiveProfile: () => fixture.profile,
}));
vi.mock("@/lib/tools/world-map/backup", () => ({
  downloadBackupJson: vi.fn(),
}));
vi.mock("@/lib/tools/world-map/share", () => ({
  encodeProfileToUrl: () => "fixture",
  buildShareUrl: () => "https://example.test/map",
}));
import { ExportMenu } from "../components/tools/world-map/ExportMenu";

test.each([
  "duplicate clicks",
  "timeout",
  "unmount",
  "profile change",
  "download success",
])("export handles %s", async (scenario) => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  fixture.profile.id = "profile-a";
  vi.useFakeTimers();
  let release!: (response: unknown) => void;
  const fetchMock = vi.fn<
    (url: string, options: { signal: AbortSignal }) => Promise<unknown>
  >(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const click = vi.fn();
  const anchor = { click, remove: vi.fn(), href: "", download: "" };
  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    createElement: vi.fn(() => anchor),
    body: { appendChild: vi.fn() },
  });
  const createUrl = vi.fn(() => "blob:fixture");
  const revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: revoke });
  const clipboard = vi.fn(async () => {});
  vi.stubGlobal("navigator", { clipboard: { writeText: clipboard } });
  const share = vi.fn();
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <ExportMenu onOpenImport={vi.fn()} onOpenShare={share} />,
      );
    });
    await act(async () => {
      renderer.root.findByType("button").props.onClick();
    });
    const find = (label: string) =>
      renderer.root
        .findAllByType("button")
        .find(
          (button) =>
            button.findAll((node) => node.children.includes(label)).length > 0,
        )!;
    const landscape = find("Landscape").props.onClick;
    const square = find("Square").props.onClick;
    const copy = find("Copy share link").props.onClick;
    await act(async () => {
      void landscape();
      if (scenario === "duplicate clicks") {
        void landscape();
        void square();
        void copy();
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(clipboard).not.toHaveBeenCalled();
    expect(
      renderer.root
        .findAllByType("button")
        .slice(1)
        .every((b) => b.props.disabled),
    ).toBe(true);
    if (scenario === "timeout") {
      await act(async () => {
        vi.advanceTimersByTime(15_000);
      });
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
      expect(JSON.stringify(renderer.toJSON())).toContain(
        "Your poster couldn’t download",
      );
      await act(async () => {
        void find("Square").props.onClick();
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } else {
      if (scenario === "unmount")
        await act(async () => {
          renderer.unmount();
        });
      if (scenario === "profile change")
        await act(async () => {
          fixture.profile.id = "profile-b";
          renderer.update(
            <ExportMenu onOpenImport={vi.fn()} onOpenShare={share} />,
          );
        });
      const body = vi.fn(async () => new Blob(["fixture"]));
      await act(async () => {
        release({ ok: true, blob: body });
      });
      if (["unmount", "profile change"].includes(scenario)) {
        expect(body).not.toHaveBeenCalled();
        expect(click).not.toHaveBeenCalled();
      } else {
        expect(click).toHaveBeenCalledTimes(1);
        expect(anchor.download).toMatch(
          /^world-map-landscape-\d{4}-\d{2}-\d{2}\.png$/,
        );
        expect(revoke).toHaveBeenCalledWith("blob:fixture");
      }
    }
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

test.each([
  "success",
  "permission denied",
  "timeout",
  "unmount",
  "profile change",
])("share copy handles %s", async (scenario) => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  fixture.profile.id = "profile-a";
  vi.useFakeTimers();
  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  let release!: () => void;
  let reject!: (reason: Error) => void;
  const clipboard = vi.fn(
    () =>
      new Promise<void>((yes, no) => {
        release = yes;
        reject = no;
      }),
  );
  vi.stubGlobal("navigator", { clipboard: { writeText: clipboard } });
  const share = vi.fn();
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <ExportMenu onOpenImport={vi.fn()} onOpenShare={share} />,
      );
    });
    await act(async () => {
      renderer.root.findByType("button").props.onClick();
    });
    const copy = renderer.root
      .findAllByType("button")
      .find(
        (button) =>
          button.findAll((node) => node.children.includes("Copy share link"))
            .length > 0,
      )!.props.onClick;
    await act(async () => {
      void copy();
      void copy();
    });
    expect(clipboard).toHaveBeenCalledTimes(1);
    expect(clipboard).toHaveBeenCalledWith("https://example.test/map");
    if (scenario === "unmount")
      await act(async () => {
        renderer.unmount();
      });
    if (scenario === "profile change")
      await act(async () => {
        fixture.profile.id = "profile-b";
        renderer.update(
          <ExportMenu onOpenImport={vi.fn()} onOpenShare={share} />,
        );
      });
    await act(async () => {
      if (scenario === "timeout") vi.advanceTimersByTime(15_000);
      else if (scenario === "permission denied")
        reject(new Error("NotAllowedError"));
      else release();
    });
    if (scenario === "unmount" || scenario === "profile change")
      expect(share).not.toHaveBeenCalled();
    else {
      expect(share).toHaveBeenCalledExactlyOnceWith(scenario === "success");
      if (scenario === "timeout") {
        await act(async () => {
          release();
        });
        expect(share).toHaveBeenCalledTimes(1);
      }
      await act(async () => {
        renderer.root.findByType("button").props.onClick();
      });
      expect(
        renderer.root
          .findAllByType("button")
          .slice(1)
          .every((button) => !button.props.disabled),
      ).toBe(true);
    }
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
