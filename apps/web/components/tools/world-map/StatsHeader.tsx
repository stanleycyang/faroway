"use client";

import type { Stats } from "@/lib/tools/world-map/stats";

interface StatsHeaderProps {
  profileName: string;
  profileEmoji?: string;
  stats: Stats;
  readOnly?: boolean;
}

export function StatsHeader({
  profileName,
  profileEmoji,
  stats,
  readOnly,
}: StatsHeaderProps) {
  const percent = Math.round((stats.totalVisited / stats.totalCountries) * 100);

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          <span className="text-base leading-none">{profileEmoji || "🌍"}</span>
          <span>
            {readOnly ? `${profileName}'s Map` : `${profileName}'s World`}
          </span>
        </div>
        <h2 className="mt-2 text-5xl md:text-6xl font-bold text-slate-900 font-serif leading-none tabular-nums">
          {stats.totalVisited}
          <span className="text-slate-300 text-3xl md:text-4xl font-medium ml-2">
            / {stats.totalCountries}
          </span>
        </h2>
        <p className="mt-1.5 text-sm font-semibold text-slate-500 tracking-wide">
          {stats.totalVisited === 1 ? "country" : "countries"} ·{" "}
          <span className="text-red-600">{percent}%</span> of the world
        </p>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-3xl md:text-4xl font-bold text-slate-900 tabular-nums">
          {stats.continentsVisited}
        </div>
        <div className="text-xs font-semibold text-slate-500">
          / {stats.continentsTotal} continents
        </div>
      </div>
    </div>
  );
}
