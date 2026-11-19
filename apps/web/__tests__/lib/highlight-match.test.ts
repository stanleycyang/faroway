import { expect, it } from "vitest";
import { matchesSuggestedHighlight } from "@/lib/search/highlight-match";
it.each([
  ["Perlan - Wonders of Iceland Nature Museum", "Perlan Museum", false],
  ["Golden Circle & Glacier Tour", "Golden Circle", true],
  ["Musée d’Orsay Private Guided Tour", "Musee d Orsay", true],
  ["Artistic Museum Tour", "Art Museum", false],
  ["National Gallery", "National Museum", false],
  ["Edo-Tokyo Open Air Architectural Museum", "Edo-Tokyo Museum", false],
  ["Museum Perlan", "Perlan Museum", false],
  ["Perlan Museum", "", false],
  ["Perlan Museum", "!!!", false],
])("lexically matches %s against %s", (name, highlight, expected) => {
  expect(matchesSuggestedHighlight(name, highlight)).toBe(expected);
});
