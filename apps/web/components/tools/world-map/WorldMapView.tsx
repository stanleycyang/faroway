"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, MapPin } from "lucide-react";
import {
  decodeProfileFromUrl,
  type DecodedProfile,
} from "@/lib/tools/world-map/share";
import { computeStats } from "@/lib/tools/world-map/stats";
import {
  CONTINENT_BY_ALPHA3,
  type Continent,
} from "@/lib/tools/world-map/continents";
import {
  useActiveProfile,
  useWorldMapStore,
} from "@/lib/tools/world-map/store";
import { flagEmoji } from "@/lib/tools/world-map/iso";
import { STATUS_CONFIG } from "@/lib/tools/world-map/status";
import { nanoid } from "nanoid";
import { WorldMap } from "./WorldMap";
import { StatsHeader } from "./StatsHeader";
import { Legend } from "./Legend";

interface Props {
  encoded: string | null;
}

export function WorldMapView({ encoded }: Props) {
  const { decoded, error } = useMemo(() => {
    if (!encoded) {
      return {
        decoded: null as DecodedProfile | null,
        error: "No map data in this link." as string | null,
      };
    }
    const result = decodeProfileFromUrl(encoded);
    if (!result) {
      return {
        decoded: null,
        error: "This link is invalid or has been truncated." as string | null,
      };
    }
    return { decoded: result, error: null as string | null };
  }, [encoded]);

  const [importState, setImportState] = useState<"idle" | "imported">("idle");
  const [highlightContinent, setHighlightContinent] =
    useState<Continent | null>(null);

  const mergeProfile = useWorldMapStore((s) => s.mergeProfile);
  const createProfile = useWorldMapStore((s) => s.createProfile);
  const profiles = useWorldMapStore((s) => s.profiles);
  const hasHydrated = useWorldMapStore((s) => s.hasHydrated);
  const ownProfile = useActiveProfile();
  const ownStats = useMemo(
    () => computeStats(ownProfile?.visits ?? {}),
    [ownProfile?.visits],
  );

  const visits = useMemo(() => decoded?.visits ?? {}, [decoded?.visits]);
  const stats = useMemo(() => computeStats(visits), [visits]);
  const getContinent = useCallback(
    (iso: string) => CONTINENT_BY_ALPHA3[iso],
    [],
  );

  function handleImport() {
    if (!decoded) return;
    // Create an incoming Profile object for the store's merge logic.
    const incoming = {
      id: nanoid(),
      name: decoded.name,
      emoji: decoded.emoji,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      visits: decoded.visits,
    };
    if (profiles.length === 0) {
      // Bootstrap a profile named after the sharer — user can rename.
      createProfile(decoded.name, decoded.emoji);
    }
    mergeProfile(incoming, "merge");
    setImportState("imported");
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 pt-28 text-center">
        <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Couldn&apos;t read this map
        </h1>
        <p className="text-slate-500 mb-6">{error}</p>
        <Link
          href="/tools/world-map"
          className="inline-flex items-center gap-2 text-primary font-semibold hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Start your own map
        </Link>
      </div>
    );
  }

  if (!decoded) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Decoding map…</div>
      </div>
    );
  }

  const topCountries = Object.values(visits)
    .filter((v) => v.status === "lived" || v.status === "visited")
    .slice(0, 12);

  const compareLine =
    hasHydrated && ownProfile && ownStats.totalVisited < stats.totalVisited
      ? ownStats.totalVisited === 0
        ? "You haven't pinned any countries yet."
        : `You've pinned ${ownStats.totalVisited} so far — ${
            stats.totalVisited - ownStats.totalVisited
          } behind.`
      : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6 space-y-5">
      {/* Hero + challenge CTA */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-amber-50 to-white ring-1 ring-primary/20 p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 text-sm font-semibold uppercase tracking-wider text-slate-500">
              <span className="text-2xl leading-none">
                {decoded.emoji || "🌍"}
              </span>
              <span>{decoded.name}&apos;s World Map</span>
            </div>
            <h1 className="mt-2 text-3xl md:text-4xl font-bold text-slate-900 font-serif leading-tight">
              {stats.totalVisited}{" "}
              {stats.totalVisited === 1 ? "country" : "countries"} across{" "}
              {stats.continentsVisited}{" "}
              {stats.continentsVisited === 1 ? "continent" : "continents"}
            </h1>
            {compareLine && (
              <p className="mt-2 text-sm text-slate-600">{compareLine}</p>
            )}
          </div>
          <Link
            href="/tools/world-map"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-amber-500 text-white px-5 py-3 rounded-full text-sm font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
          >
            Think you&apos;ve traveled more? Make your map →
          </Link>
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <Link
            href="/tools/world-map"
            className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Start fresh
          </Link>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            onClick={handleImport}
            disabled={!hasHydrated || importState === "imported"}
            className="inline-flex items-center gap-1.5 hover:text-slate-900 disabled:opacity-60 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            {importState === "imported"
              ? "Saved to your map"
              : "Copy these pins into mine"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl ring-1 ring-slate-200/60 shadow-sm p-4 md:p-6 space-y-4">
        <StatsHeader
          profileName={decoded.name}
          profileEmoji={decoded.emoji}
          stats={stats}
          highlightContinent={highlightContinent}
          onHighlightContinent={setHighlightContinent}
          readOnly
        />

        <div className="relative w-full aspect-[2/1] md:aspect-[21/10]">
          <WorldMap
            visits={visits}
            theme="classic"
            readOnly
            highlightContinent={highlightContinent ?? undefined}
            getCountryContinent={getContinent}
          />
        </div>

        <Legend counts={stats.byStatus as unknown as Record<string, number>} />
      </div>

      {topCountries.length > 0 && (
        <div className="bg-white rounded-2xl ring-1 ring-slate-200/60 shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-bold text-slate-900 font-serif mb-3">
            Highlights
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {topCountries.map((v) => {
              const cfg = STATUS_CONFIG[v.status];
              return (
                <div
                  key={v.iso}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 ring-1 ring-slate-200/70"
                >
                  <span className="text-xl leading-none">
                    {flagEmoji(v.iso)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate flex items-center gap-1.5">
                      {v.iso}
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{ background: cfg.fill }}
                      />
                    </div>
                    {v.pinnedCity ? (
                      <div className="text-xs text-slate-500 truncate">
                        {v.pinnedCity}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">{cfg.label}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-center text-xs text-slate-400 py-2">
        This is a read-only share. Photos and notes are never included in share
        links.
      </div>
    </div>
  );
}
