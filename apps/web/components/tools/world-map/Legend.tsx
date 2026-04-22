"use client";

import { STATUS_CONFIG, STATUS_ORDER } from "@/lib/tools/world-map/status";

interface LegendProps {
  counts?: Record<string, number>;
  className?: string;
}

export function Legend({ counts, className = "" }: LegendProps) {
  return (
    <div
      className={`bg-white/90 backdrop-blur rounded-xl shadow-lg ring-1 ring-slate-200/60 px-3 py-2.5 ${className}`}
    >
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {STATUS_ORDER.map((s) => {
          const cfg = STATUS_CONFIG[s];
          const count = counts?.[s] ?? 0;
          return (
            <div
              key={s}
              className="flex items-center gap-2 text-xs font-medium"
            >
              <span
                className={`inline-block w-3 h-3 rounded-sm ${
                  cfg.dashed ? "ring-1 ring-dashed" : ""
                }`}
                style={{
                  background: cfg.fill,
                  border: cfg.dashed ? `1.5px dashed ${cfg.stroke}` : undefined,
                }}
              />
              <span className="text-slate-700">{cfg.label}</span>
              {counts ? (
                <span className="text-slate-400 tabular-nums">{count}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
