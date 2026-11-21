"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, RotateCcw, X } from "lucide-react";
import {
  useActiveProfile,
  useWorldMapStore,
} from "@/lib/tools/world-map/store";
import { downloadBackupJson } from "@/lib/tools/world-map/backup";
import { computeStats } from "@/lib/tools/world-map/stats";
import {
  MILESTONES,
  nextMilestoneCrossed,
  type Milestone,
} from "@/lib/tools/world-map/milestones";
import type { CountryVisit } from "@/lib/tools/world-map/types";
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

function hasVisitDetails(visit: CountryVisit | undefined): boolean {
  if (!visit) return false;
  return Boolean(
    visit.notes ||
    visit.photoDataUrl ||
    visit.rating ||
    visit.firstVisit ||
    visit.lastVisit ||
    visit.pinnedCity ||
    (visit.visitCount && visit.visitCount > 1),
  );
}

const UNDO_TOAST_MS = 6_000;

export function WorldMapApp() {
  const hasHydrated = useWorldMapStore((s) => s.hasHydrated);
  const profiles = useWorldMapStore((s) => s.profiles);
  const persistError = useWorldMapStore((s) => s.persistError);
  const clearPersistError = useWorldMapStore((s) => s.clearPersistError);
  const createProfile = useWorldMapStore((s) => s.createProfile);
  const toggleVisited = useWorldMapStore((s) => s.toggleVisited);
  const upsertVisit = useWorldMapStore((s) => s.upsertVisit);

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
  const [undoRemoval, setUndoRemoval] = useState<{
    profileId: string;
    name: string;
    visit: CountryVisit;
  } | null>(null);

  const prevCountRef = useRef<{ profileId: string; count: number } | null>(
    null,
  );

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
        const existing = profile?.visits[iso];
        toggleVisited(iso);
        if (profile && existing && hasVisitDetails(existing)) {
          setUndoRemoval({ profileId: profile.id, name, visit: existing });
        }
      }
    },
    [profile, toggleVisited],
  );

  const handleUndoRemoval = useCallback(() => {
    if (!undoRemoval) return;
    if (profile && profile.id === undoRemoval.profileId) {
      upsertVisit(undoRemoval.visit.iso, undoRemoval.visit);
    }
    setUndoRemoval(null);
  }, [profile, undoRemoval, upsertVisit]);

  useEffect(() => {
    if (!undoRemoval) return;
    const t = setTimeout(() => setUndoRemoval(null), UNDO_TOAST_MS);
    return () => clearTimeout(t);
  }, [undoRemoval]);

  // Clear pending undo toast if the user switches profiles so restoring never
  // writes into the wrong profile.
  const activeProfileId = profile?.id;
  useEffect(() => {
    setUndoRemoval((curr) =>
      curr && curr.profileId !== activeProfileId ? null : curr,
    );
  }, [activeProfileId]);

  const closeCountryDrawer = useCallback(() => {
    setSelected(null);
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          '[aria-label="Search countries (keyboard shortcut slash)"]',
        )
        ?.focus();
    });
  }, []);

  const restoreExportFocus = useCallback(() => {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>('[aria-label="Share and export"]')
        ?.focus();
    });
  }, []);

  const closeImportDialog = useCallback(() => {
    setImportOpen(false);
    restoreExportFocus();
  }, [restoreExportFocus]);

  const closeShareDialog = useCallback(() => {
    setShareOpen(false);
    restoreExportFocus();
  }, [restoreExportFocus]);

  // Milestone toast on crossing 5/10/25/50/100. Keyed by profile.id so
  // switching to a larger profile never fires a false milestone.
  useEffect(() => {
    if (!hasHydrated || !profile) return;
    const total = stats.totalVisited;
    const prev = prevCountRef.current;
    prevCountRef.current = { profileId: profile.id, count: total };
    if (prev === null || prev.profileId !== profile.id) return;
    const crossed = nextMilestoneCrossed(prev.count, total);
    if (!crossed) return;
    const seen = readSeenMilestones();
    if (seen.has(crossed)) return;
    seen.add(crossed);
    writeSeenMilestones(seen);
    setMilestone(crossed);
  }, [hasHydrated, profile, stats.totalVisited]);

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
            <h1 className="font-editorial text-2xl sm:text-3xl tracking-tight text-slate-900">
              World Map
            </h1>
            <span className="hidden md:inline-block text-[11px] text-slate-500 font-semibold uppercase tracking-[0.2em] border-l border-ink/15 pl-3">
              Travel Tracker
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

        {persistError && (
          <div
            role="alert"
            className="border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3 rounded-xl"
          >
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">
                Could not save to browser storage
              </div>
              <p className="text-sm text-red-700 mt-0.5 leading-relaxed">
                {persistError}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => downloadBackupJson()}
                className="text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Download backup
              </button>
              <button
                type="button"
                onClick={clearPersistError}
                aria-label="Dismiss storage warning"
                className="w-7 h-7 rounded-lg text-red-500 hover:bg-red-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <BackupBanner />

        {/* The map — full-width centerpiece */}
        <p className="sr-only">
          Interactive world map showing pinned countries. Use Search countries
          to add a country or open its details with a keyboard or screen reader.
        </p>
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
          key={selected.iso}
          iso={selected.iso}
          name={selected.name}
          onClose={closeCountryDrawer}
        />
      )}

      {importOpen && <ImportDialog open onClose={closeImportDialog} />}
      {shareOpen && (
        <ShareLinkDialog
          open
          initiallyCopied={shareOpen.initiallyCopied}
          onClose={closeShareDialog}
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

      {undoRemoval && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[55] w-[min(92vw,420px)] animate-slide-up"
        >
          <div className="bg-slate-900 text-white rounded-xl shadow-2xl ring-1 ring-white/10 px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-sm leading-snug truncate">
              Removed{" "}
              <strong className="font-semibold">{undoRemoval.name}</strong> and
              its details
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={handleUndoRemoval}
                className="inline-flex items-center gap-1.5 bg-white text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Undo
              </button>
              <button
                type="button"
                onClick={() => setUndoRemoval(null)}
                aria-label="Dismiss"
                className="w-7 h-7 rounded-lg text-white/70 hover:bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
