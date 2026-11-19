import React from "react";
import { timingPresentation, type DayTimingProposal } from "@faroway/types";

export function ProposedTiming({
  proposal,
  names,
}: {
  proposal: DayTimingProposal;
  names: Record<string, string>;
}) {
  const view = timingPresentation(proposal, names);
  return (
    <section
      aria-label={view.heading}
      className="mb-7 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <h3 className="text-lg font-semibold text-slate-900">{view.heading}</h3>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-slate-600">
        {view.description}
      </p>
      {view.rows.length > 0 && (
        <ol className="mt-4 divide-y divide-slate-100">
          {view.rows.map((row) => (
            <li
              key={row.id}
              className={`grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-3 px-2 py-3 text-sm ${row.kind === "rest" ? "rounded-lg bg-emerald-50 text-emerald-900" : "text-slate-700"}`}
            >
              <span className="tabular-nums leading-6">{row.time}</span>
              <span
                className={`min-w-0 break-words leading-6 ${row.kind === "rest" ? "font-semibold" : ""}`}
              >
                {row.label}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 max-w-prose text-xs leading-relaxed text-slate-600">
        {view.assumptions}
      </p>
    </section>
  );
}
