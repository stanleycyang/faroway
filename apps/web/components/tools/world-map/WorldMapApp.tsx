"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useActiveProfile,
  useWorldMapStore,
} from "@/lib/tools/world-map/store";
import { computeStats } from "@/lib/tools/world-map/stats";
import {
  CONTINENT_BY_ALPHA3,
  type Continent,
} from "@/lib/tools/world-map/continents";
import {
  MILESTONES,
  nextMilestoneCrossed,
  type Milestone,
} from "@/lib/tools/world-map/milestones";
import { Logo } from "@/components/Logo";
import { WorldMap, type CountryClickIntent } from "./WorldMap";
import { StatsHeader } from "./StatsHeader";
import { Legend } from "./Legend";
import { CountryDetailDrawer } from "./CountryDetailDrawer";
import { ExportMenu } from "./ExportMenu";
import { ImportDialog } from "./ImportDialog";
import { ShareLinkDialog } from "./ShareLinkDialog";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { BackupBanner } from "./BackupBanner";
import { CountrySearch } from "./CountrySearch";
import { MilestoneToast } from "./MilestoneToast";

const MILESTONES_SEEN_KEY = "wm:milestones-seen";

function readSeenMilestones(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(MILESTONES_SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(Number) : []);
  } catch {
    return new Set();
  }
}

function writeSeenMilestones(seen: Set<number>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      MILESTONES_SEEN_KEY,
      JSON.stringify(Array.from(seen)),
    );
  } catch {
    // Quota exceeded or similar — non-critical.
  }
}

export function WorldMapApp() {
  const hasHydrated = useWorldMapStore((s) => s.hasHydrated);
  const profiles = useWorldMapStore((s) => s.profiles);
  const createProfile = useWorldMapStore((s) => s.createProfile);
  const toggleVisited = useWorldMapStore((s) => s.toggleVisited);
  const settings = useWorldMapStore((s) => s.settings);
  const setShowLegend = useWorldMapStore((s) => s.setShowLegend);

  const profile = useActiveProfile();

  const [selected, setSelected] = useState<{
    iso: string;
    name: string;
  } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState<
    false | { initiallyCopied: boolean }
  >(false);
  const [highlightContinent, setHighlightContinent] =
    useState<Continent | null>(null);
  const [milestone, setMilestone] = useState<Milestone | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number | null>(null);

  const visits = useMemo(() => profile?.visits ?? {}, [profile?.visits]);
  const stats = useMemo(() => computeStats(visits), [visits]);

  const getContinent = useCallback(
    (iso: string) => CONTINENT_BY_ALPHA3[iso],
    [],
  );

  // Auto-create a default profile the first time the store hydrates with
  // zero profiles. Replaces the old FirstRunModal — users can rename via
  // the profile switcher any time.
  useEffect(() => {
    if (hasHydrated && profiles.length === 0) {
      createProfile("Traveler", "🌍");
    }
  }, [hasHydrated, profiles.length, createProfile]);

  const handleCountryClick = useCallback(
    (iso: string, name: string, intent: CountryClickIntent) => {
      if (intent === "edit") {
        setSelected({ iso, name });
      } else {
        toggleVisited(iso);
      }
    },
    [toggleVisited],
  );

  // Milestone detection: fire a toast when crossing 5/10/25/50/100, once each.
  useEffect(() => {
    if (!hasHydrated) return;
    const total = stats.totalVisited;
    const prev = prevCountRef.current;
    prevCountRef.current = total;
    if (prev === null) return; // first render — just record baseline

    const crossed = nextMilestoneCrossed(prev, total);
    if (!crossed) return;

    const seen = readSeenMilestones();
    if (seen.has(crossed)) return;
    seen.add(crossed);
    writeSeenMilestones(seen);
    setMilestone(crossed);
  }, [hasHydrated, stats.totalVisited]);

  // Auto-dismiss the toast after 10s.
  useEffect(() => {
    if (!milestone) return;
    const t = setTimeout(() => setMilestone(null), 10_000);
    return () => clearTimeout(t);
  }, [milestone]);

  // Seed `seen` with milestones already met the first time we hydrate, so a
  // returning user with 42 countries doesn't get bombarded with toasts.
  useEffect(() => {
    if (!hasHydrated) return;
    const total = stats.totalVisited;
    const seen = readSeenMilestones();
    let dirty = false;
    for (const m of MILESTONES) {
      if (total >= m && !seen.has(m)) {
        seen.add(m);
        dirty = true;
      }
    }
    if (dirty) writeSeenMilestones(seen);
    // Only run once at hydrate — this effect isn't meant to react to later
    // visit changes (that's handled by the crossing effect above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);

  // Keyboard shortcut: L toggles legend.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "l" || e.key === "L") {
        setShowLegend(!settings.showLegend);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settings.showLegend, setShowLegend]);

  if (!hasHydrated || !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading your map…</div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6 space-y-5">
        {/* Top action bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="hidden md:inline-block text-xs text-slate-400 font-semibold uppercase tracking-wider border-l border-slate-200 pl-3">
              World Map
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CountrySearch onPick={(iso, name) => setSelected({ iso, name })} />
            <ProfileSwitcher />
            <ExportMenu
              mapRef={snapshotRef}
              onOpenImport={() => setImportOpen(true)}
              onOpenShare={(copied) =>
                setShareOpen({ initiallyCopied: copied })
              }
            />
          </div>
        </div>

        <BackupBanner />

        {/* Snapshot target — stats + map combined (for PNG export). */}
        <div
          ref={snapshotRef}
          className="bg-white rounded-2xl ring-1 ring-slate-200/60 shadow-sm p-4 md:p-6 space-y-4"
        >
          <StatsHeader
            profileName={profile.name}
            profileEmoji={profile.emoji}
            stats={stats}
            highlightContinent={highlightContinent}
            onHighlightContinent={setHighlightContinent}
          />

          <div
            ref={mapRef}
            className="relative w-full aspect-[2/1] md:aspect-[21/10]"
          >
            <WorldMap
              visits={visits}
              theme={settings.theme}
              onCountryClick={handleCountryClick}
              highlightContinent={highlightContinent ?? undefined}
              getCountryContinent={getContinent}
            />
          </div>

          {/* Legend + watermark below map (always in snapshot for context) */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Legend
              counts={stats.byStatus as unknown as Record<string, number>}
            />
            <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-slate-400">
              faroway.ai · world map
            </div>
          </div>
        </div>

        {/* In-editor shortcut hint — intentionally outside the snapshot so
            it doesn't end up in exported PNGs. */}
        <p className="text-xs text-slate-400 font-medium text-center">
          Click to pin · right-click for details ·{" "}
          <span className="font-mono bg-slate-100 text-slate-500 px-1 rounded">
            /
          </span>{" "}
          to search
        </p>

        {/* Empty state hint */}
        {Object.keys(visits).length === 0 && (
          <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-amber-50 to-white ring-1 ring-primary/20 p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="text-3xl">👆</div>
              <div>
                <div className="font-bold text-slate-900 mb-1">
                  Click any country to pin it
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  That&apos;s it — one click and it&apos;s saved to your map.
                  Right-click (or long-press on mobile) for dates, notes, a
                  cover photo, or other statuses like wishlist.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <CountryDetailDrawer
        iso={selected?.iso ?? null}
        name={selected?.name ?? null}
        onClose={() => setSelected(null)}
      />

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <ShareLinkDialog
        open={Boolean(shareOpen)}
        initiallyCopied={shareOpen ? shareOpen.initiallyCopied : false}
        onClose={() => setShareOpen(false)}
      />

      {milestone && (
        <MilestoneToast
          milestone={milestone}
          onShare={() => {
            setMilestone(null);
            setShareOpen({ initiallyCopied: false });
          }}
          onDismiss={() => setMilestone(null)}
        />
      )}
    </>
  );
}
