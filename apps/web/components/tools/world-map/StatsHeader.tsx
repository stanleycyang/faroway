"use client";

import type { Stats } from "@/lib/tools/world-map/stats";

interface HeroProps {
  profileName: string;
  profileEmoji?: string;
  stats: Stats;
  readOnly?: boolean;
}

// Editorial hero block: lives below the map, magazine-cover treatment.
// Massive Playfair numeral as the centerpiece, hairline-divided supporting
// stats, eyebrow with name and "Vol. I · {year}".
export function StatsHeader({
  profileName,
  profileEmoji,
  stats,
  readOnly,
}: HeroProps) {
  const percent = stats.totalCountries
    ? Math.round((stats.totalVisited / stats.totalCountries) * 100)
    : 0;
  const year = new Date().getFullYear();

  return (
    <div className="flex flex-col">
      {/* eyebrow: name + volume + year */}
      <div className="flex items-baseline gap-3 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
        <span className="text-base leading-none not-italic">
          {profileEmoji || "🌍"}
        </span>
        <span className="truncate">
          {readOnly ? `${profileName}'s Atlas` : `${profileName}'s Atlas`}
        </span>
        <span className="text-slate-300">·</span>
        <span>Vol. I · {year}</span>
      </div>

      {/* hairline divider */}
      <div className="mt-3 h-px w-12 bg-ink/20" />

      {/* hero numeral */}
      <div className="mt-5 flex items-baseline gap-3 text-ink">
        <div
          className="font-editorial font-black leading-[0.85] tracking-[-0.04em] text-[88px] sm:text-[120px] lg:text-[140px]"
          style={{ paddingBottom: "0.18em" }}
        >
          {stats.totalVisited}
        </div>
        <div className="font-sans font-semibold text-slate-400 text-2xl sm:text-3xl">
          / {stats.totalCountries}
        </div>
      </div>

      {/* tagline */}
      <div className="mt-1 flex items-center gap-2 text-base font-semibold text-slate-600">
        <span>{stats.totalVisited === 1 ? "country" : "countries"}</span>
        <span className="text-slate-300">·</span>
        <span>
          {stats.continentsVisited}/{stats.continentsTotal} continents
        </span>
      </div>

      {/* accent: percent of world in clay */}
      <div className="mt-3 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-clay">
        {percent}% of the world
      </div>
    </div>
  );
}
