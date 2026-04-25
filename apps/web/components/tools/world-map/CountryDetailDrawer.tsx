"use client";

import { useEffect, useState } from "react";
import { ChevronDown, MapPin, Trash2, X } from "lucide-react";
import { useWorldMapStore } from "@/lib/tools/world-map/store";
import { flagEmoji } from "@/lib/tools/world-map/iso";
import { CONTINENT_BY_ALPHA3 } from "@/lib/tools/world-map/continents";
import type { CountryVisit } from "@/lib/tools/world-map/types";
import { PhotoUpload } from "./PhotoUpload";

interface Props {
  iso: string | null;
  name: string | null;
  onClose: () => void;
}

const EMPTY_DRAFT = (iso: string): CountryVisit => ({
  iso,
  status: "visited",
});

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
  const [trackedIso, setTrackedIso] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  if (trackedIso !== iso) {
    setTrackedIso(iso);
    if (iso) {
      setDraft(visit ?? EMPTY_DRAFT(iso));
    } else {
      setDraft(null);
    }
    setMoreOpen(
      Boolean(
        visit?.firstVisit ||
        visit?.lastVisit ||
        visit?.visitCount ||
        visit?.rating ||
        visit?.pinnedCity ||
        visit?.notes ||
        visit?.photoDataUrl,
      ),
    );
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !iso || !draft) return null;

  const isPinned = Boolean(visit);

  function save() {
    if (!draft || !iso) return;
    upsertVisit(iso, {
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

  function pinAndClose() {
    if (!iso) return;
    upsertVisit(iso, {});
    onClose();
  }

  function unpin() {
    if (!iso) return;
    deleteVisit(iso);
    onClose();
  }

  const continent = CONTINENT_BY_ALPHA3[iso];

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal
        aria-labelledby="country-drawer-title"
        className="fixed z-50 bg-white shadow-2xl overflow-hidden flex flex-col inset-x-0 bottom-0 top-auto rounded-t-2xl max-h-[92vh] md:top-0 md:bottom-0 md:right-0 md:left-auto md:w-[440px] md:max-h-screen md:rounded-none md:rounded-l-2xl animate-slide-up md:animate-slide-in-right"
      >
        <div className="md:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        <div className="flex items-start justify-between px-5 pt-4 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="text-3xl leading-none" aria-hidden>
                {flagEmoji(iso)}
              </span>
              <h3
                id="country-drawer-title"
                className="text-2xl font-bold text-ink font-editorial truncate"
              >
                {name || iso}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                {iso}
              </span>
              {continent ? <span>· {continent}</span> : null}
              {isPinned ? (
                <span className="inline-flex items-center gap-1 text-red-600 font-semibold ml-1">
                  <MapPin className="w-3 h-3" /> Pinned
                </span>
              ) : null}
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

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {!isPinned && (
            <p className="text-sm text-slate-600 leading-relaxed">
              You haven&apos;t pinned {name || iso} yet. Pin it now, and
              optionally add when you went, who you were with, and a photo.
            </p>
          )}

          <div>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 py-2 transition-colors"
              aria-expanded={moreOpen}
            >
              <span>Optional details</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  moreOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {moreOpen && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First visit">
                    <input
                      type="date"
                      value={draft.firstVisit || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, firstVisit: e.target.value })
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Last visit">
                    <input
                      type="date"
                      value={draft.lastVisit || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, lastVisit: e.target.value })
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Times visited">
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
                      className={`${inputClass} tabular-nums`}
                      placeholder="1"
                    />
                  </Field>
                  <Field label="Rating">
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
                  </Field>
                </div>

                <Field label="Memorable city">
                  <input
                    type="text"
                    value={draft.pinnedCity || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, pinnedCity: e.target.value })
                    }
                    placeholder="e.g. Kyoto"
                    className={inputClass}
                  />
                </Field>

                <Field label="Notes">
                  <textarea
                    value={draft.notes || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, notes: e.target.value })
                    }
                    rows={4}
                    placeholder="What did you love? What would you do differently?"
                    className={`${inputClass} leading-relaxed resize-none`}
                  />
                </Field>

                <Field label="Cover photo">
                  <PhotoUpload
                    value={draft.photoDataUrl}
                    onChange={(url) =>
                      setDraft({ ...draft, photoDataUrl: url })
                    }
                  />
                </Field>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 px-5 py-3.5 flex items-center justify-between gap-3 bg-slate-50/60">
          {isPinned ? (
            <button
              type="button"
              onClick={unpin}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Remove pin
            </button>
          ) : (
            <span className="text-xs text-slate-400">
              {moreOpen ? "Save will pin and store details" : ""}
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
            {isPinned ? (
              <button
                type="button"
                onClick={save}
                className="text-sm font-semibold text-white bg-gradient-to-r from-primary to-amber-500 hover:shadow-lg hover:shadow-primary/25 px-5 py-2 rounded-lg transition-all"
              >
                Save details
              </button>
            ) : (
              <button
                type="button"
                onClick={moreOpen ? save : pinAndClose}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-gradient-to-r from-primary to-amber-500 hover:shadow-lg hover:shadow-primary/25 px-5 py-2 rounded-lg transition-all"
              >
                <MapPin className="w-4 h-4" /> Pin {name || iso}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const inputClass =
  "w-full rounded-lg ring-1 ring-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}
