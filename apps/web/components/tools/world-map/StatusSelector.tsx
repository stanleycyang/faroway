"use client";

import { STATUS_CONFIG, STATUS_ORDER } from "@/lib/tools/world-map/status";
import type { Status } from "@/lib/tools/world-map/types";

interface Props {
  value: Status | null;
  onChange: (s: Status) => void;
}

export function StatusSelector({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {STATUS_ORDER.map((s) => {
        const cfg = STATUS_CONFIG[s];
        const isActive = value === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`group relative flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              isActive
                ? "text-white shadow-md scale-[1.02]"
                : "text-slate-700 bg-slate-50 hover:bg-slate-100 ring-1 ring-slate-200/60"
            }`}
            style={
              isActive
                ? {
                    background: cfg.fill,
                    boxShadow: `0 4px 12px ${cfg.fill}40`,
                  }
                : undefined
            }
            title={cfg.description}
          >
            <span className="text-lg leading-none">{cfg.emoji}</span>
            <span className="text-[11px] leading-none">{cfg.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
