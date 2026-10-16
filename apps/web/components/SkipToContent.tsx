"use client";

import { usePathname } from "next/navigation";

export function SkipToContent() {
  const pathname = usePathname();
  return (
    <a
      href={pathname === "/" ? "#home-main-content" : "#main-content"}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-primary focus:rounded-lg focus:shadow-lg"
      onClick={(event) => {
        const content =
          document.querySelector<HTMLElement>("main") ??
          document.getElementById("main-content");
        if (!content) return;
        event.preventDefault();
        if (!content.hasAttribute("tabindex")) content.tabIndex = -1;
        content.focus();
      }}
    >
      Skip to main content
    </a>
  );
}
