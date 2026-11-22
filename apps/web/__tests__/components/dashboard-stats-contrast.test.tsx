import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children?: React.ReactNode;
  }) => React.createElement("a", props, children),
}));

import { TripStats } from "@/components/dashboard/TripStats";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { TripCard } from "@/components/dashboard/TripCard";

describe("Dashboard contrast & Lucide iconography", () => {
  test("TripStats renders Lucide SVG icons with WCAG AA text colors and zero OS emojis", () => {
    const html = renderToStaticMarkup(
      <TripStats
        totalTrips={4}
        upcomingTrips={2}
        inProgressTrips={1}
        pastTrips={1}
      />,
    );
    expect(html).toContain("<svg");
    expect(html).toContain("text-primary-700");
    expect(html).toContain("text-accent-700");
    expect(html).toContain("text-[#143D46]");
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(html).not.toContain('text-primary"');
    expect(html).not.toContain("text-green-600");
  });

  test("EmptyState and TripCard use WCAG AA accessible colors on light backgrounds", () => {
    const emptyHtml = renderToStaticMarkup(<EmptyState />);
    expect(emptyHtml).toContain("text-primary-800");
    expect(emptyHtml).not.toContain('text-primary"');
    expect(emptyHtml).not.toContain("text-gray-500");

    const cardHtml = renderToStaticMarkup(
      <TripCard
        trip={{
          id: "trip-1",
          destination: "Kyoto",
          start_date: "2099-05-01",
          end_date: "2099-05-05",
          travelers: 2,
          status: "completed",
        }}
        today="2099-04-01"
      />,
    );
    expect(cardHtml).toContain("text-emerald-800");
    expect(cardHtml).toContain("bg-emerald-100");
    expect(cardHtml).not.toContain("text-green-700");
    expect(cardHtml).not.toContain("text-gray-500");
  });
});
