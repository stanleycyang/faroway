"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  useActiveProfile,
  useWorldMapStore,
} from "@/lib/tools/world-map/store";
import { computeStats } from "@/lib/tools/world-map/stats";
import {
  MILESTONES,
  nextMilestoneCrossed,
  type Milestone,
} from "@/lib/tools/world-map/milestones";
import { Logo } from "@/components/Logo";
import { WorldMap, type CountryClickIntent } from "./WorldMap";
import { StatsHeader } from "./StatsHeader";
import { FieldNotes } from "./FieldNotes";
import { ExportMenu } from "./ExportMenu";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { BackupBanner } from "./BackupBanner";
import { CountrySearch } from "./CountrySearch";
import { MilestoneToast } from "./MilestoneToast";

const CountryDetailDrawer = dynamic(
  () =>
    import("./CountryDetailDrawer").then(
      (module) => module.CountryDetailDrawer,
    ),
  { ssr: false },
);
const ImportDialog = dynamic(
  () => import("./ImportDialog").then((module) => module.ImportDialog),
  { ssr: false },
);
const ShareLinkDialog = dynamic(
  () => import("./ShareLinkDialog").then((module) => module.ShareLinkDialog),
  { ssr: false },
);

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
    /* non-critical */
  }
}

export function WorldMapApp() {
  const hasHydrated = useWorldMapStore((s) => s.hasHydrated);
  const profiles = useWorldMapStore((s) => s.profiles);
  const createProfile = useWorldMapStore((s) => s.createProfile);
  const toggleVisited = useWorldMapStore((s) => s.toggleVisited);

  const profile = useActiveProfile();

  const [selected, setSelected] = useState<{
    iso: string;
    name: string;
  } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState<
    false | { initiallyCopied: boolean }
  >(false);
  const [milestone, setMilestone] = useState<Milestone | null>(null);

  const prevCountRef = useRef<number | null>(null);

  const visits = useMemo(() => profile?.visits ?? {}, [profile?.visits]);
  const stats = useMemo(() => computeStats(visits), [visits]);

  // 1-indexed plate number for the active profile. Each new profile gets its
  // own "Plate II" / "Plate III" label so a household sharing one device
  // (Stanley + wife on the same browser) feels like a multi-plate atlas.
  const plateNumber = useMemo(() => {
    if (!profile) return 1;
    const idx = profiles.findIndex((p) => p.id === profile.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [profiles, profile]);

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

  // Milestone toast on crossing 5/10/25/50/100.
  useEffect(() => {
    if (!hasHydrated) return;
    const total = stats.totalVisited;
    const prev = prevCountRef.current;
    prevCountRef.current = total;
    if (prev === null) return;
    const crossed = nextMilestoneCrossed(prev, total);
    if (!crossed) return;
    const seen = readSeenMilestones();
    if (seen.has(crossed)) return;
    seen.add(crossed);
    writeSeenMilestones(seen);
    setMilestone(crossed);
  }, [hasHydrated, stats.totalVisited]);

  useEffect(() => {
    if (!milestone) return;
    const t = setTimeout(() => setMilestone(null), 10_000);
    return () => clearTimeout(t);
  }, [milestone]);

  // Seed already-met milestones on first hydrate so returning users don't
  // get spammed with toasts they've already seen.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);

  if (!hasHydrated || !profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading your map…</div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10 space-y-8 lg:space-y-12">
        {/* Editorial top bar — quiet, no competing chrome rule */}
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="hidden md:inline-block text-[11px] text-slate-500 font-bold uppercase tracking-[0.24em] border-l border-ink/15 pl-3">
              World Map
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CountrySearch onPick={(iso, name) => setSelected({ iso, name })} />
            <ProfileSwitcher />
            <ExportMenu
              onOpenImport={() => setImportOpen(true)}
              onOpenShare={(copied) =>
                setShareOpen({ initiallyCopied: copied })
              }
            />
          </div>
        </header>

        <BackupBanner />

        {/* The map — full-width centerpiece */}
        <div className="relative w-full aspect-[2/1] md:aspect-[21/10] animate-fade-in">
          <WorldMap visits={visits} onCountryClick={handleCountryClick} />
        </div>

        {/* Editor hint — tiny, sits below the map */}
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
          Click any country to pin · right-click for details ·{" "}
          <span className="font-mono normal-case tracking-normal text-[12px] text-slate-500">
            /
          </span>{" "}
          to search
        </p>

        {/* Hero (left) + Field Notes (right). Asymmetric only at xl. */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 xl:gap-14">
          <div className="xl:col-span-4">
            <StatsHeader
              profileName={profile.name}
              profileEmoji={profile.emoji}
              stats={stats}
              plateNumber={plateNumber}
            />
          </div>
          <div className="xl:col-span-8">
            <FieldNotes visits={visits} />
          </div>
        </div>

        {Object.keys(visits).length === 0 && (
          <div className="border-t border-b border-ink/15 py-6 text-center">
            <p className="font-editorial text-2xl italic text-slate-600">
              Click any country on the map above to start your atlas.
            </p>
          </div>
        )}

        {/* Footer mark */}
        <div className="flex items-center justify-between pt-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-clay" />
            faroway.ai · world map
          </span>
          <span>Equal Earth Projection · Vol. I</span>
        </div>
      </div>

      {selected && (
        <CountryDetailDrawer
          iso={selected.iso}
          name={selected.name}
          onClose={() => setSelected(null)}
        />
      )}

      {importOpen && <ImportDialog open onClose={() => setImportOpen(false)} />}
      {shareOpen && (
        <ShareLinkDialog
          open
          initiallyCopied={shareOpen.initiallyCopied}
          onClose={() => setShareOpen(false)}
        />
      )}

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
