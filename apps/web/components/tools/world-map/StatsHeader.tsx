import type { Stats } from "@/lib/tools/world-map/stats";
import { toRoman, toWords } from "@/lib/tools/world-map/typography";

interface HeroProps {
  profileName: string;
  profileEmoji?: string;
  stats: Stats;
  /** 1-indexed plate number for this profile (renders as "Plate I", "Plate II", …). */
  plateNumber?: number;
  readOnly?: boolean;
}

// Editorial hero block: lives below the map, magazine-cover treatment.
// Hero numeral spells out as Playfair Italic ("Forty-Three") for 1-99 and
// drops back to a black serif numeral at 0 or 100+. Eyebrow shows
// "Plate {roman}" so each profile gets its own plate number.
export function StatsHeader({
  profileName,
  profileEmoji,
  stats,
  plateNumber = 1,
  readOnly,
}: HeroProps) {
  const percent = stats.totalCountries
    ? Math.round((stats.totalVisited / stats.totalCountries) * 100)
    : 0;
  const year = new Date().getFullYear();

  // 1-99 spell out in italic; 0 and 100+ stay numeric in heavy serif.
  const spelled = stats.totalVisited >= 1 && stats.totalVisited <= 99;
  const heroLabel = toWords(stats.totalVisited);

  return (
    <div className="flex flex-col">
      {/* eyebrow: name · plate · year */}
      <div className="flex items-baseline gap-3 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
        <span className="text-base leading-none not-italic">
          {profileEmoji || "🌍"}
        </span>
        <span className="truncate">
          {readOnly ? `${profileName}'s Atlas` : `${profileName}'s Atlas`}
        </span>
        <span className="text-slate-300">·</span>
        <span>Plate {toRoman(plateNumber) || "I"}</span>
        <span className="text-slate-300">·</span>
        <span>{year}</span>
      </div>

      {/* hairline divider */}
      <div className="mt-3 h-px w-12 bg-ink/20" />

      {/* hero numeral — Playfair Italic when spelled, Black when numeric */}
      <div className="mt-5 flex items-baseline gap-3 text-ink">
        {spelled ? (
          <h1
            className="font-editorial italic font-bold leading-[0.95] tracking-[-0.02em] text-[56px] sm:text-[72px] lg:text-[88px] text-balance"
            style={{ paddingBottom: "0.05em" }}
          >
            {heroLabel}
          </h1>
        ) : (
          <h1
            className="font-editorial font-black leading-[0.85] tracking-[-0.04em] text-[88px] sm:text-[120px] lg:text-[140px]"
            style={{ paddingBottom: "0.18em" }}
          >
            {heroLabel}
          </h1>
        )}
        <div className="font-sans font-semibold text-slate-400 text-2xl sm:text-3xl">
          / {stats.totalCountries}
        </div>
      </div>

      {/* tagline */}
      <div className="mt-2 flex items-center gap-2 text-base font-semibold text-slate-600">
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
