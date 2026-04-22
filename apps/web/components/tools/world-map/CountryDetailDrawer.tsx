"use client";

import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { useWorldMapStore } from "@/lib/tools/world-map/store";
import { flagEmoji } from "@/lib/tools/world-map/iso";
import { CONTINENT_BY_ALPHA3 } from "@/lib/tools/world-map/continents";
import { STATUS_ORDER } from "@/lib/tools/world-map/status";
import type { CountryVisit } from "@/lib/tools/world-map/types";
import { StatusSelector } from "./StatusSelector";
import { PhotoUpload } from "./PhotoUpload";

interface Props {
  iso: string | null;
  name: string | null;
  onClose: () => void;
}

export function CountryDetailDrawer({ iso, name, onClose }: Props) {
  const open = Boolean(iso);
  const visit = useWorldMapStore((s) => {
    if (!iso) return undefined;
    const profile = s.profiles.find((p) => p.id === s.activeProfileId);
    return profile?.visits[iso];
  });
  const upsertVisit = useWorldMapStore((s) => s.upsertVisit);
  const deleteVisit = useWorldMapStore((s) => s.deleteVisit);

  const [draft, setDraft] = useState<CountryVisit | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [trackedIso, setTrackedIso] = useState<string | null>(null);

  // Sync draft when iso changes — done during render (React recommended pattern).
  if (trackedIso !== iso) {
    setTrackedIso(iso);
    if (iso) {
      setDraft(
        visit ?? {
          iso,
          status: "visited",
          visitCount: 1,
        },
      );
    } else {
      setDraft(null);
    }
    setConfirmDelete(false);
  }

  // Keyboard: close on escape, number keys set status.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (["1", "2", "3", "4", "5"].includes(e.key)) {
        const target = document.activeElement as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        const status = STATUS_ORDER[Number(e.key) - 1];
        if (!status) return;
        setDraft((d) => (d ? { ...d, status } : d));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !iso || !draft) return null;

  function save() {
    if (!draft || !iso) return;
    upsertVisit(iso, {
      status: draft.status,
      firstVisit: draft.firstVisit || undefined,
      lastVisit: draft.lastVisit || undefined,
      visitCount: draft.visitCount || undefined,
      pinnedCity: draft.pinnedCity || undefined,
      notes: draft.notes || undefined,
      rating: draft.rating,
      photoDataUrl: draft.photoDataUrl,
    });
    onClose();
  }

  function remove() {
    if (!iso) return;
    deleteVisit(iso);
    onClose();
  }

  const continent = CONTINENT_BY_ALPHA3[iso];

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal
        aria-labelledby="country-drawer-title"
        className="fixed z-50 bg-white shadow-2xl overflow-hidden flex flex-col inset-x-0 bottom-0 top-auto rounded-t-2xl max-h-[92vh] md:top-0 md:bottom-0 md:right-0 md:left-auto md:w-[440px] md:max-h-screen md:rounded-none md:rounded-l-2xl animate-slide-up md:animate-slide-in-right"
      >
        {/* Drag handle on mobile */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-3xl leading-none" aria-hidden>
                {flagEmoji(iso)}
              </span>
              <h3
                id="country-drawer-title"
                className="text-xl font-bold text-slate-900 font-serif truncate"
              >
                {name || iso}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                {iso}
              </span>
              {continent ? <span>· {continent}</span> : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2 block">
              Status
            </label>
            <StatusSelector
              value={draft.status}
              onChange={(s) => setDraft({ ...draft, status: s })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block">
                First visit
              </label>
              <input
                type="date"
                value={draft.firstVisit || ""}
                onChange={(e) =>
                  setDraft({ ...draft, firstVisit: e.target.value })
                }
                className="w-full rounded-lg ring-1 ring-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block">
                Last visit
              </label>
              <input
                type="date"
                value={draft.lastVisit || ""}
                onChange={(e) =>
                  setDraft({ ...draft, lastVisit: e.target.value })
                }
                className="w-full rounded-lg ring-1 ring-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block">
                Times visited
              </label>
              <input
                type="number"
                min="0"
                value={draft.visitCount ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    visitCount: e.target.value
                      ? Math.max(0, Number(e.target.value))
                      : undefined,
                  })
                }
                className="w-full rounded-lg ring-1 ring-slate-200 px-3 py-2 text-sm tabular-nums focus:ring-2 focus:ring-primary/40 focus:outline-none"
                placeholder="1"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block">
                Rating
              </label>
              <div className="flex items-center gap-1 h-[38px]">
                {[1, 2, 3, 4, 5].map((r) => {
                  const active = (draft.rating ?? 0) >= r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          rating:
                            draft.rating === r
                              ? undefined
                              : (r as 1 | 2 | 3 | 4 | 5),
                        })
                      }
                      className={`text-xl leading-none transition-all ${
                        active
                          ? "text-amber-400 scale-110"
                          : "text-slate-300 hover:text-slate-400"
                      }`}
                      aria-label={`Rate ${r} out of 5`}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block">
              Memorable city
            </label>
            <input
              type="text"
              value={draft.pinnedCity || ""}
              onChange={(e) =>
                setDraft({ ...draft, pinnedCity: e.target.value })
              }
              placeholder="e.g. Kyoto"
              className="w-full rounded-lg ring-1 ring-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block">
              Notes
            </label>
            <textarea
              value={draft.notes || ""}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={4}
              placeholder="What did you love? What would you do differently?"
              className="w-full rounded-lg ring-1 ring-slate-200 px-3 py-2 text-sm leading-relaxed focus:ring-2 focus:ring-primary/40 focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block">
              Cover photo
            </label>
            <PhotoUpload
              value={draft.photoDataUrl}
              onChange={(url) => setDraft({ ...draft, photoDataUrl: url })}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3.5 flex items-center justify-between gap-3 bg-slate-50/60">
          {visit ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={remove}
                  className="text-sm font-semibold text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )
          ) : (
            <span className="text-xs text-slate-400">
              Press 1-5 to set status
            </span>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="text-sm font-semibold text-white bg-gradient-to-r from-primary to-amber-500 hover:shadow-lg hover:shadow-primary/25 px-5 py-2 rounded-lg transition-all"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
