"use client";

import type { Stats } from "@/lib/tools/world-map/stats";
import type { Continent } from "@/lib/tools/world-map/continents";

interface StatsHeaderProps {
  profileName: string;
  profileEmoji?: string;
  stats: Stats;
  highlightContinent: Continent | null;
  onHighlightContinent: (c: Continent | null) => void;
  readOnly?: boolean;
}

export function StatsHeader({
  profileName,
  profileEmoji,
  stats,
  highlightContinent,
  onHighlightContinent,
  readOnly,
}: StatsHeaderProps) {
  const percent = Math.round((stats.totalVisited / stats.totalCountries) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2 font-serif">
            <span className="text-2xl">{profileEmoji || "🌍"}</span>
            <span>
              {readOnly ? `${profileName}'s Map` : `${profileName}'s World`}
            </span>
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            A living record of every border crossed.
          </p>
        </div>
        <div className="flex gap-4 items-baseline">
          <div>
            <div className="text-3xl md:text-4xl font-bold tabular-nums text-slate-900">
              {stats.totalVisited}
              <span className="text-slate-400 text-xl font-medium">
                {" "}
                / {stats.totalCountries}
              </span>
            </div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Countries · {percent}%
            </div>
          </div>
          <div className="h-10 w-px bg-slate-200" />
          <div>
            <div className="text-3xl md:text-4xl font-bold tabular-nums text-slate-900">
              {stats.continentsVisited}
              <span className="text-slate-400 text-xl font-medium">
                {" "}
                / {stats.continentsTotal}
              </span>
            </div>
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Continents
            </div>
          </div>
        </div>
      </div>

      {/* Continent bars */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {stats.byContinent.map((c) => {
          const isActive = highlightContinent === c.continent;
          return (
            <button
              key={c.continent}
              type="button"
              onClick={() =>
                onHighlightContinent(isActive ? null : c.continent)
              }
              className={`group text-left rounded-xl p-2.5 transition-all ${
                isActive
                  ? "bg-primary/10 ring-1 ring-primary/40"
                  : "bg-slate-50 hover:bg-slate-100 ring-1 ring-slate-200/60"
              }`}
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <span
                  className={`text-xs font-semibold truncate ${
                    isActive ? "text-primary-700" : "text-slate-700"
                  }`}
                >
                  {c.continent}
                </span>
                <span className="text-xs tabular-nums text-slate-500 flex-shrink-0 ml-1">
                  {c.visited}/{c.total}
                </span>
              </div>
              <div className="h-1.5 bg-white rounded-full overflow-hidden ring-1 ring-slate-200/40">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${c.percent}%`,
                    background:
                      "linear-gradient(90deg, #F97066 0%, #F59E0B 100%)",
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
