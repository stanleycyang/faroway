import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, expect, test, vi } from "vitest";
import { Header } from "@/components/Header";

vi.mock("next/image", () => ({
  default: () => null,
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children?: React.ReactNode;
  }) => React.createElement("a", props, children),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

test("opening the menu locks body scroll and a desktop breakpoint clears it", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const body = { style: { overflow: "" } };
  const mediaListeners = new Set<(event: MediaQueryListEvent) => void>();
  vi.stubGlobal("document", {
    body,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal("window", {
    scrollY: 0,
    location: { href: "http://localhost/", origin: "http://localhost" },
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({
      matches: false,
      media: "(min-width: 1024px)",
      addEventListener: (
        _type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        mediaListeners.add(listener);
      },
      removeEventListener: (
        _type: string,
        listener: (event: MediaQueryListEvent) => void,
      ) => {
        mediaListeners.delete(listener);
      },
    }),
  });

  let renderer!: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(<Header />);
  });
  const toggle = renderer.root.findByProps({ "aria-controls": "mobile-nav" });
  await act(async () => {
    toggle.props.onClick();
  });
  expect(body.style.overflow).toBe("hidden");
  expect(renderer.root.findAllByProps({ id: "mobile-nav" })).toHaveLength(1);

  await act(async () => {
    for (const listener of mediaListeners) {
      listener({ matches: true } as MediaQueryListEvent);
    }
  });

  expect(body.style.overflow).toBe("");
  expect(renderer.root.findAllByProps({ id: "mobile-nav" })).toHaveLength(0);
  await act(async () => {
    renderer.unmount();
  });
});
