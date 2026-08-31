"use client";

import type { RefObject } from "react";
import { useWorldMapStore } from "@/lib/tools/world-map/store";
import { flagEmoji } from "@/lib/tools/world-map/iso";
import { VISITED_FILL } from "@/lib/tools/world-map/status";

interface Props {
  iso: string;
  name: string;
  x: number;
  y: number;
  tooltipRef?: RefObject<HTMLDivElement | null>;
}

export function MapTooltip({ iso, name, x, y, tooltipRef }: Props) {
  const visited = useWorldMapStore((s) => {
    const profile = s.profiles.find((p) => p.id === s.activeProfileId);
    return Boolean(profile?.visits[iso]);
  });

  return (
    <div
      ref={tooltipRef}
      className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+10px)] animate-fade-in"
      style={{ left: x, top: y }}
    >
      <div className="bg-ink text-paper px-3.5 py-2.5 backdrop-blur whitespace-nowrap shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{flagEmoji(iso)}</span>
          <span className="font-editorial text-base font-bold leading-tight">
            {name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-paper/60">
          {visited ? (
            <>
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: VISITED_FILL }}
              />
              Pinned
            </>
          ) : (
            <span>Click to pin · right-click for details</span>
          )}
        </div>
      </div>
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-ink"
      />
    </div>
  );
}
