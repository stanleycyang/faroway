"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/** Keep repeated page parameters subject to the server's strict validation. */
export function BlogPaginationNavigation() {
  const searchParams = useSearchParams();
  const repeatedPage = searchParams.getAll("page").length > 1;

  useEffect(() => {
    // Next's client cache can collapse repeated query keys to the last value,
    // reusing a valid listing without asking the server to validate the URL.
    // A document request returns the existing 404 and drops the cached content.
    if (repeatedPage) window.location.reload();
  }, [repeatedPage]);

  return null;
}
