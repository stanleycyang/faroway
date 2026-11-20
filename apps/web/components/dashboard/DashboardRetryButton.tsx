"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

export function DashboardRetryButton({ href }: { href: string }) {
  const [retrying, setRetrying] = useState(false);

  return (
    <a
      href={href}
      onClick={(event) => {
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        if (retrying) return;
        setRetrying(true);
        window.location.assign(href);
      }}
      aria-disabled={retrying}
      className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
    >
      <RefreshCw
        className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      {retrying ? "Retrying…" : "Try again"}
    </a>
  );
}
