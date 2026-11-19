import React from "react";
import { ExternalLink } from "lucide-react";
import { readVenueSource } from "@faroway/types";

export function VenueSourceNote({ value }: { value: unknown }) {
  const source = readVenueSource(value);
  if (!source) return null;
  return (
    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-8 items-center gap-1 font-medium text-slate-900 underline underline-offset-2"
      >
        View source · {new URL(source.url).hostname}
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      <p>
        Retrieved {source.retrievedOn}. Confirm opening hours and availability
        for your dates.
      </p>
    </div>
  );
}
