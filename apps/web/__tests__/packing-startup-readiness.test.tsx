import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) => <a {...props} />,
}));
import { PackingListClient } from "@/components/tools/packing/PackingListClient";

test("packing choices cannot be lost before their handlers hydrate", () => {
  const html = renderToStaticMarkup(<PackingListClient />);
  const picker = html.match(/<select\b[^>]*>/)?.[0];
  expect(picker).toContain('id="packing-destination"');
  expect(picker).toContain('disabled=""');
  const actions = html.match(/<button\b[^>]*>/g) ?? [];
  expect(actions.length).toBeGreaterThan(1);
  expect(actions.every((action) => action.includes('disabled=""'))).toBe(true);
});
