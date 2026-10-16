import type { ReactNode } from "react";

// This parent boundary also catches missing links from the token layout's lookup.
export default function SharedLinksLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
