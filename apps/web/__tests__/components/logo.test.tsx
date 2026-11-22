import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) =>
    React.createElement("img", props),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children?: React.ReactNode;
  }) => React.createElement("a", props, children),
}));

import { Logo } from "@/components/Logo";

describe("Logo", () => {
  test("renders Route-F icon with decorative alt, editorial Faroway wordmark, and Ocean Teal color on dark variant", () => {
    const html = renderToStaticMarkup(<Logo size="md" variant="dark" />);
    expect(html).toContain('src="/icon.png"');
    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("font-editorial");
    expect(html).toContain("text-[#143D46]");
    expect(html).toContain(">Faroway<");
    expect(html).not.toContain("faroway.");
    expect(html).toContain('href="/"');
    expect(html).toContain('aria-label="Faroway home"');
  });

  test("renders light ivory wordmark on dark surfaces and supports custom href, hideWordmarkOnMobile, asLink, and showTagline", () => {
    const lightHtml = renderToStaticMarkup(
      <Logo
        size="lg"
        variant="light"
        href="/dashboard"
        hideWordmarkOnMobile
        showTagline
      />,
    );
    expect(lightHtml).toContain("text-[#FFF5EE]");
    expect(lightHtml).toContain('href="/dashboard"');
    expect(lightHtml).toContain('aria-label="Faroway"');
    expect(lightHtml).toContain("hidden sm:flex");
    expect(lightHtml).toContain("AI Travel Planner");

    const staticHtml = renderToStaticMarkup(
      <Logo size="sm" asLink={false} showWordmark={false} />,
    );
    expect(staticHtml).not.toContain("<a ");
    expect(staticHtml).not.toContain(">Faroway<");
    expect(staticHtml).toContain('src="/icon.png"');
  });
});
