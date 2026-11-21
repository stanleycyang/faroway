import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";

const navMocks = vi.hoisted(() => ({
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({
  permanentRedirect: (url: string) => navMocks.permanentRedirect(url),
}));

vi.mock("@/hooks/useModalFocusTrap", () => ({
  useModalFocusTrap: vi.fn(),
}));

import NewTripPage from "../app/(app)/trips/new/page";
import { DatePicker } from "../components/trips/DatePicker";
import { PlanningConsentDialog } from "../components/trips/PlanningConsentDialog";

test("trips/new preserves query string on permanentRedirect", async () => {
  navMocks.permanentRedirect.mockClear();
  await expect(
    NewTripPage({
      searchParams: Promise.resolve({
        destination: "maldives",
        budget: "luxury",
        vibes: ["foodie", "wellness"],
      }),
    }),
  ).rejects.toThrow(
    "REDIRECT:/create?destination=maldives&budget=luxury&vibes=foodie&vibes=wellness",
  );

  await expect(
    NewTripPage({ searchParams: Promise.resolve({}) }),
  ).rejects.toThrow("REDIRECT:/create");
});

test("DatePicker exposes Start/End date aria-labels, defaultMonth, and max=30", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("window", {
    matchMedia: () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  vi.stubGlobal("document", {
    body: { style: { overflow: "" } },
  });
  let renderer!: ReturnType<typeof create>;
  const start = new Date(2099, 6, 10);
  const end = new Date(2099, 6, 15);
  try {
    await act(async () => {
      renderer = create(
        <DatePicker
          startDate={start}
          endDate={end}
          onStartDateChange={vi.fn()}
          onEndDateChange={vi.fn()}
        />,
      );
    });
    const startButton = renderer.root.findByProps({
      "aria-label": "Start date, Jul 10, 2099",
    });
    expect(
      renderer.root.findByProps({ "aria-label": "End date, Jul 15, 2099" }),
    ).toBeTruthy();

    await act(async () => {
      startButton.props.onClick({ currentTarget: { focus: vi.fn() } });
    });

    // DayPicker receives max={30} and defaultMonth={start}
    const dayPicker = renderer.root.find(
      (node) => node.props && node.props.mode === "range",
    );
    expect(dayPicker.props.max).toBe(30);
    expect(dayPicker.props.defaultMonth).toEqual(start);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
  }
});

test("PlanningConsentDialog focuses Not now initially and focuses fallback when trigger is disabled on close", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  class FakeHTMLElement {}
  vi.stubGlobal("HTMLElement", FakeHTMLElement);
  const triggerEl = Object.assign(new FakeHTMLElement(), {
    isConnected: true,
    disabled: true,
    getAttribute: () => null,
    closest: () => null,
    focus: vi.fn(),
  }) as unknown as HTMLElement;
  const fallbackEl = Object.assign(new FakeHTMLElement(), {
    isConnected: true,
    disabled: false,
    getAttribute: () => null,
    closest: () => null,
    focus: vi.fn(),
  }) as unknown as HTMLElement;

  vi.stubGlobal("document", {
    activeElement: triggerEl,
    body: { style: { overflow: "" } },
    querySelectorAll: () => [],
    querySelector: () => null,
  });
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });

  const cancelFocus = vi.fn();
  const confirmFocus = vi.fn();
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(
        <PlanningConsentDialog
          open={true}
          message="Share details?"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          fallbackFocusRef={{ current: fallbackEl }}
        />,
        {
          createNodeMock: (el) => {
            if (el.type === "button") {
              const props = el.props as { children?: unknown };
              const text = JSON.stringify(props.children);
              if (text.includes("Not now")) {
                return { focus: cancelFocus };
              }
              if (text.includes("Share")) {
                return { focus: confirmFocus };
              }
            }
            return { focus: vi.fn(), querySelectorAll: () => [] };
          },
        },
      );
    });
    expect(cancelFocus).toHaveBeenCalledTimes(1);
    expect(confirmFocus).not.toHaveBeenCalled();

    await act(async () => {
      renderer.update(
        <PlanningConsentDialog
          open={false}
          message="Share details?"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
          fallbackFocusRef={{ current: fallbackEl }}
        />,
      );
    });
    expect(triggerEl.focus).not.toHaveBeenCalled();
    expect(fallbackEl.focus).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    vi.unstubAllGlobals();
  }
});
