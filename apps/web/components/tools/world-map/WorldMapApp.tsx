"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActiveProfile, useWorldMapStore } from "@/lib/tools/world-map/store";
import { computeStats } from "@/lib/tools/world-map/stats";
import { CONTINENT_BY_ALPHA3, type Continent } from "@/lib/tools/world-map/continents";
import { STATUS_ORDER } from "@/lib/tools/world-map/status";
import { Logo } from "@/components/Logo";
import { FirstRunModal } from "./FirstRunModal";
import { WorldMap } from "./WorldMap";
import { StatsHeader } from "./StatsHeader";
import { Legend } from "./Legend";
import { CountryDetailDrawer } from "./CountryDetailDrawer";
import { ExportMenu } from "./ExportMenu";
import { ImportDialog } from "./ImportDialog";
import { ShareLinkDialog } from "./ShareLinkDialog";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { QuickPinToggle } from "./QuickPinToggle";
import { BackupBanner } from "./BackupBanner";
import { CountrySearch } from "./CountrySearch";

export function WorldMapApp() {
  const hasHydrated = useWorldMapStore((s) => s.hasHydrated);
  const profiles = useWorldMapStore((s) => s.profiles);
  const createProfile = useWorldMapStore((s) => s.createProfile);
  const cycleStatus = useWorldMapStore((s) => s.cycleStatus);
  const settings = useWorldMapStore((s) => s.settings);
  const setShowLegend = useWorldMapStore((s) => s.setShowLegend);

  const profile = useActiveProfile();

  const [selected, setSelected] = useState<{ iso: string; name: string } | null>(
    null,
  );
  const [importOpen, setImportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState<
    false | { initiallyCopied: boolean }
  >(false);
  const [highlightContinent, setHighlightContinent] =
    useState<Continent | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<HTMLDivElement>(null);

  const visits = useMemo(() => profile?.visits ?? {}, [profile?.visits]);
  const stats = useMemo(() => computeStats(visits), [visits]);

  const getContinent = useCallback(
    (iso: string) => CONTINENT_BY_ALPHA3[iso],
    [],
  );

  const handleCountryClick = useCallback(
    (iso: string, name: string) => {
      if (settings.quickPin) {
        cycleStatus(iso);
        return;
      }
      setSelected({ iso, name });
    },
    [settings.quickPin, cycleStatus],
  );

  // Keyboard shortcut: L toggles legend, ESC closes overlays.
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

  // Show onboarding if hydrated and no profiles.
  const showOnboarding = hasHydrated && profiles.length === 0;

  if (!hasHydrated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading your map…</div>
      </div>
    );
  }

  return (
    <>
      {showOnboarding && (
        <FirstRunModal
          onSubmit={(name, emoji) => createProfile(name, emoji)}
        />
      )}

      {profile && (
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
              <CountrySearch
                onPick={(iso, name) => setSelected({ iso, name })}
              />
              <QuickPinToggle />
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

          <BackupBanner onBackup={() => setImportOpen(false)} />

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

            {/* Legend below map (always in snapshot for context) */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Legend
                counts={stats.byStatus as unknown as Record<string, number>}
              />
              <p className="text-xs text-slate-400 font-medium">
                Tap a country to pin ·{" "}
                <span className="font-mono bg-slate-100 text-slate-500 px-1 rounded">
                  /
                </span>{" "}
                to search ·{" "}
                <span className="font-mono bg-slate-100 text-slate-500 px-1 rounded">
                  1–5
                </span>{" "}
                to set status
              </p>
            </div>
          </div>

          {/* Empty state hint */}
          {Object.keys(visits).length === 0 && (
            <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-amber-50 to-white ring-1 ring-primary/20 p-5 md:p-6">
              <div className="flex items-start gap-4">
                <div className="text-3xl">👆</div>
                <div>
                  <div className="font-bold text-slate-900 mb-1">
                    Start with your first pin
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mb-2">
                    Click any country on the map to mark it as visited. Add
                    dates, notes, and a cover photo — or toggle{" "}
                    <span className="font-semibold text-primary">
                      Quick pin
                    </span>{" "}
                    to rapid-fire pin dozens of countries at once.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {STATUS_ORDER.slice(0, 4).map((s) => (
                      <span
                        key={s}
                        className="text-xs text-slate-600 bg-white ring-1 ring-slate-200 rounded-full px-2.5 py-1 font-semibold capitalize"
                      >
                        {s.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
    </>
  );
}
