import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) =>
    React.createElement("img", props),
}));

import { DreamTripPromptBar } from "@/components/create/DreamTripPromptBar";
import {
  createEmptyTravelerMemory,
  sanitizeTravelerMemory,
} from "@/lib/trips/traveler-memory";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DreamTripPromptBar @faroway/constants parity", () => {
  test("renders canonical Budget, Moderate, Luxury labels and bridges culture <-> cultural in Traveler Memory", async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;

    const onSaveMemory = vi.fn();
    const memory = {
      ...createEmptyTravelerMemory(),
      defaultBudget: "moderate" as const,
      defaultVibes: ["cultural" as const],
    };

    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <DreamTripPromptBar
            isAuthenticated={false}
            travelerMemory={memory}
            memoryAppliedFields={[]}
            learnedSuggestions={[]}
            appliedSummary={null}
            canUndo={false}
            onApplyParsedPrompt={vi.fn()}
            onApplySuggestion={vi.fn()}
            onUndo={vi.fn()}
            onSaveMemory={onSaveMemory}
            onSaveCurrentAsMemory={vi.fn()}
            onClearMemory={vi.fn()}
            onAcceptLearnedSuggestion={vi.fn()}
            onDismissLearnedSuggestion={vi.fn()}
          />,
        );
      });

      // Open "Help me decide" to verify budget tier options use Moderate instead of Comfort
      const decideBtn = renderer.root
        .findAllByType("button")
        .find((b) =>
          b.children.some(
            (c) => typeof c === "string" && c.includes("Help me decide"),
          ),
        )!;
      await act(async () => {
        decideBtn.props.onClick();
      });

      const budgetSelect = renderer.root.findByProps({ id: "decide-budget" });
      const optionTexts = budgetSelect
        .findAllByType("option")
        .map((opt) => opt.children.join(""));
      expect(optionTexts).toEqual([
        "Any budget tier",
        "Budget",
        "Moderate",
        "Luxury",
      ]);

      // Open Traveler Memory editor to verify Culture label & save bridge
      const editDefaultsBtn = renderer.root
        .findAllByType("button")
        .find((b) =>
          b.children.some(
            (c) => typeof c === "string" && c.includes("Edit defaults"),
          ),
        )!;
      await act(async () => {
        editDefaultsBtn.props.onClick();
      });

      const cultureBtn = renderer.root
        .findAllByType("button")
        .find((b) => b.children.includes("Culture"))!;
      expect(cultureBtn.props["aria-pressed"]).toBe(true);

      const foodieBtn = renderer.root
        .findAllByType("button")
        .find((b) => b.children.includes("Foodie"))!;
      await act(async () => {
        foodieBtn.props.onClick();
      });

      const saveBtn = renderer.root
        .findAllByType("button")
        .find((b) => b.children.includes("Save defaults"))!;
      await act(async () => {
        saveBtn.props.onClick();
      });

      expect(onSaveMemory).toHaveBeenCalledTimes(1);
      const savedPatch = onSaveMemory.mock.calls[0][0];
      expect(savedPatch.defaultVibes).toEqual(["cultural", "foodie"]);
      expect(sanitizeTravelerMemory(savedPatch).defaultVibes).toEqual([
        "cultural",
        "foodie",
      ]);
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
    }
  });
});
