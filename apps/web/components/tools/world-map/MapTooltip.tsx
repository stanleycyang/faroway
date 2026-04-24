"use client";

import { useWorldMapStore } from "@/lib/tools/world-map/store";
import { flagEmoji } from "@/lib/tools/world-map/iso";
import { STATUS_CONFIG } from "@/lib/tools/world-map/status";

interface Props {
  iso: string;
  name: string;
  x: number;
  y: number;
}

export function MapTooltip({ iso, name, x, y }: Props) {
  const visit = useWorldMapStore((s) => {
    const profile = s.profiles.find((p) => p.id === s.activeProfileId);
    return profile?.visits[iso];
  });

  const cfg = visit ? STATUS_CONFIG[visit.status] : null;

  return (
    <div
      className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+10px)] animate-fade-in"
      style={{ left: x, top: y }}
    >
      <div className="bg-slate-900/95 text-white text-sm rounded-xl shadow-xl px-3 py-2 whitespace-nowrap backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{flagEmoji(iso)}</span>
          <span className="font-semibold">{name}</span>
        </div>
        {cfg ? (
          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-300">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: cfg.fill }}
            />
            {cfg.label}
            {visit?.pinnedCity ? (
              <span className="text-slate-400">· {visit.pinnedCity}</span>
            ) : null}
          </div>
        ) : (
          <div className="text-xs text-slate-400 mt-1">Unpinned</div>
        )}
        <div className="text-[10px] text-slate-400 mt-1.5 tracking-wide uppercase">
          Click to pin · right-click for details
        </div>
      </div>
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-slate-900/95"
      />
    </div>
  );
}
