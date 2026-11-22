"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  CloudRain,
  RefreshCw,
  Clock,
  Coffee,
  Undo2,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import type { GeneratedItinerary } from "@faroway/types";
import type {
  CopilotAction,
  CopilotDiffEntry,
  CopilotResult,
  CopilotSlot,
} from "@/lib/trips/copilot";

export interface CopilotQuickTrigger {
  type: "swap_stop" | "relax_day" | "rain_backup";
  dayNumber: number;
  stopName?: string;
  nonce: number;
}

export interface TripCopilotBarProps {
  id?: string;
  tripId: string;
  destination: string;
  itinerary: GeneratedItinerary;
  activeDayNumber: number;
  expectedUpdatedAt?: string;
  expectedPlanRevision?: string | null;
  isShared?: boolean;
  disabled?: boolean;
  pendingAction?: CopilotQuickTrigger | null;
  onBusyChange?: (busy: boolean) => void;
  onItineraryUpdated: (
    updatedItinerary: GeneratedItinerary,
    updatedAt?: string,
    planRevision?: string | null,
  ) => void;
  onSyncRequested?: () => void;
}

interface CopilotResponsePayload extends Omit<
  CopilotResult,
  "previousItinerarySnapshot"
> {
  updatedAt?: string;
  planRevision?: string | null;
  undoRevisionId?: string | null;
  error?: string;
}

export function TripCopilotBar({
  id,
  tripId,
  destination,
  itinerary,
  activeDayNumber,
  expectedUpdatedAt,
  expectedPlanRevision,
  isShared = false,
  disabled = false,
  pendingAction,
  onBusyChange,
  onItineraryUpdated,
  onSyncRequested,
}: TripCopilotBarProps) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CopilotResponsePayload | null>(
    null,
  );
  const [undoRevisionId, setUndoRevisionId] = useState<string | null>(null);

  const latestUpdatedAtRef = useRef<string | undefined>(expectedUpdatedAt);
  const latestPlanRevisionRef = useRef<string | null | undefined>(
    expectedPlanRevision,
  );
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const lastHandledNonce = useRef<number>(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    latestUpdatedAtRef.current = expectedUpdatedAt;
  }, [expectedUpdatedAt]);

  useEffect(() => {
    latestPlanRevisionRef.current = expectedPlanRevision;
  }, [expectedPlanRevision]);

  const executeCommand = useCallback(
    async (
      payload: {
        action?: CopilotAction;
        prompt?: string;
        dayNumber?: number;
        slot?: CopilotSlot;
        stopName?: string;
        undoRevisionId?: string;
      },
      label: string,
      clearPromptOnApply = false,
    ) => {
      if (disabled || inFlight.current || !mounted.current) return;
      inFlight.current = true;
      setBusy(true);
      onBusyChange?.(true);
      setActiveLabel(label);
      setError(null);

      try {
        const expectedRevision = latestUpdatedAtRef.current;
        const expectedPlanRev = latestPlanRevisionRef.current;
        const response = await fetch(`/api/trips/${tripId}/copilot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(20_000),
          body: JSON.stringify({
            ...payload,
            ...(expectedRevision
              ? { expectedUpdatedAt: expectedRevision }
              : {}),
            ...(expectedPlanRev !== undefined
              ? { expectedPlanRevision: expectedPlanRev }
              : {}),
          }),
        });

        const data = (await response
          .json()
          .catch(() => null)) as CopilotResponsePayload | null;

        if (!mounted.current) return;

        if (!response.ok || !data) {
          if (response.status === 409) {
            onSyncRequested?.();
          }
          setError(
            data?.error ||
              "We couldn't apply that tweak right now. Your itinerary is unchanged.",
          );
          return;
        }

        setLastResult(data);
        if (data.updatedAt) {
          latestUpdatedAtRef.current = data.updatedAt;
        }
        if (data.planRevision !== undefined) {
          latestPlanRevisionRef.current = data.planRevision;
        }

        if (data.applied) {
          if (clearPromptOnApply) {
            setPrompt("");
          }
          if (payload.action === "undo") {
            setUndoRevisionId(null);
          } else {
            setUndoRevisionId(data.undoRevisionId ?? null);
          }
          onItineraryUpdated(
            data.updatedItinerary,
            data.updatedAt,
            data.planRevision,
          );
        }
      } catch (err) {
        if (!mounted.current) return;
        setError(
          err instanceof Error && err.name === "TimeoutError"
            ? "That edit took too long. Your saved itinerary is unchanged."
            : "Network error while updating your itinerary. Please try again.",
        );
      } finally {
        inFlight.current = false;
        if (mounted.current) {
          setBusy(false);
          onBusyChange?.(false);
          setActiveLabel(null);
        }
      }
    },
    [disabled, tripId, onBusyChange, onItineraryUpdated, onSyncRequested],
  );

  // Allow Day cards or Companion Banner to trigger a co-pilot action cleanly
  useEffect(() => {
    if (!pendingAction || pendingAction.nonce <= lastHandledNonce.current) {
      return;
    }
    lastHandledNonce.current = pendingAction.nonce;
    const labelMap: Record<CopilotQuickTrigger["type"], string> = {
      relax_day: `Relaxing Day ${pendingAction.dayNumber}…`,
      rain_backup: `Finding indoor backups for Day ${pendingAction.dayNumber}…`,
      swap_stop: pendingAction.stopName
        ? `Swapping ${pendingAction.stopName}…`
        : `Swapping a stop on Day ${pendingAction.dayNumber}…`,
    };
    void executeCommand(
      {
        action: pendingAction.type,
        dayNumber: pendingAction.dayNumber,
        stopName: pendingAction.stopName,
      },
      labelMap[pendingAction.type],
    );
  }, [pendingAction, executeCommand]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || busy || disabled) return;
    const isUndoPrompt = /\b(undo|revert|roll\s*back|go\s+back)\b/i.test(
      trimmed,
    );
    if (isUndoPrompt) {
      void executeCommand(
        {
          action: "undo",
          ...(undoRevisionId ? { undoRevisionId } : {}),
        },
        "Undoing last change…",
        true,
      );
      return;
    }
    void executeCommand({ prompt: trimmed }, "Applying your tweak…", true);
  };

  const handleUndo = () => {
    if (!undoRevisionId || busy || disabled) return;
    void executeCommand(
      {
        action: "undo",
        undoRevisionId,
      },
      "Undoing last change…",
    );
  };

  const dayCount = itinerary.days?.length ?? 1;
  const safeActiveDay = Math.min(Math.max(1, activeDayNumber), dayCount);

  return (
    <section
      id={id}
      aria-label="Trip co-pilot remix bar"
      className="print-hidden mb-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Trip Co-Pilot</h3>
            <p className="text-xs text-slate-500">
              Adjust {destination} in one tap — verified local spots, always
              undoable.
            </p>
          </div>
        </div>
        {undoRevisionId && !busy && (
          <button
            type="button"
            onClick={handleUndo}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            Undo last edit
          </button>
        )}
      </div>
      {isShared && (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
          Your trip currently has an active public share link. Applying an edit
          turns off that link until you share the updated plan.
        </p>
      )}

      {/* 1-tap quick intent pills */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() =>
            void executeCommand(
              { action: "relax_day", dayNumber: safeActiveDay },
              `Relaxing Day ${safeActiveDay}…`,
            )
          }
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-primary/40 hover:bg-primary-50/60 hover:text-primary-800 transition-colors disabled:opacity-50"
        >
          <Coffee className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
          Make Day {safeActiveDay} more relaxed
        </button>

        <button
          type="button"
          disabled={disabled || busy}
          onClick={() =>
            void executeCommand(
              { action: "rain_backup", dayNumber: safeActiveDay },
              `Finding indoor backups for Day ${safeActiveDay}…`,
            )
          }
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900 transition-colors disabled:opacity-50"
        >
          <CloudRain className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
          Rainy-day indoor backup
        </button>

        <button
          type="button"
          disabled={disabled || busy}
          onClick={() =>
            void executeCommand(
              { action: "swap_stop", dayNumber: safeActiveDay },
              `Swapping a stop on Day ${safeActiveDay}…`,
            )
          }
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className="h-3.5 w-3.5 text-emerald-600"
            aria-hidden="true"
          />
          Swap a stop for something new
        </button>

        <button
          type="button"
          disabled={disabled || busy}
          onClick={() =>
            void executeCommand(
              {
                action: "shift_day",
                dayNumber: 1,
                slot: "morning",
                prompt: "Later start on Day 1, clear Day 1 morning",
              },
              "Clearing Day 1 morning…",
            )
          }
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-900 transition-colors disabled:opacity-50"
        >
          <Clock className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
          Later start on Day 1
        </button>
      </div>

      {/* Natural-language command bar */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label htmlFor={`copilot-input-${tripId}`} className="sr-only">
          Tell Faroway how to tweak this trip
        </label>
        <input
          id={`copilot-input-${tripId}`}
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={400}
          disabled={disabled || busy}
          placeholder="Tell Faroway how to tweak this trip… (e.g. Move museum to Day 2 afternoon)"
          className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary-700 focus:bg-white focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={disabled || busy || !prompt.trim()}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">Apply</span>
        </button>
      </form>

      {/* Active progress status */}
      {busy && activeLabel && (
        <p
          role="status"
          className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-700" />
          {activeLabel}
        </p>
      )}

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
            aria-hidden="true"
          />
          <p className="flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss co-pilot error"
            className="text-red-500 hover:text-red-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Before/After Diff Card */}
      {lastResult && !busy && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-3 rounded-xl border p-3.5 ${
            lastResult.applied
              ? "border-emerald-200 bg-emerald-50/70"
              : "border-amber-200 bg-amber-50/80"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              {lastResult.applied ? (
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                  aria-hidden="true"
                />
              ) : (
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                  aria-hidden="true"
                />
              )}
              <p className="text-sm font-semibold text-slate-900">
                {lastResult.summary}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {lastResult.applied && undoRevisionId && (
                <button
                  type="button"
                  onClick={handleUndo}
                  className="inline-flex min-h-8 items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-800 border border-slate-300 hover:bg-slate-50"
                >
                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Undo change
                </button>
              )}
              <button
                type="button"
                onClick={() => setLastResult(null)}
                aria-label="Dismiss diff summary"
                className="p-1 text-slate-600 hover:text-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {lastResult.diff.length > 0 && (
            <ul className="mt-2.5 space-y-1.5 border-t border-slate-200/70 pt-2.5">
              {lastResult.diff.map((entry, idx) => (
                <DiffRow
                  key={`${entry.dayNumber}-${entry.slot}-${idx}`}
                  entry={entry}
                />
              ))}
            </ul>
          )}

          {lastResult.notice && (
            <p className="mt-2 text-xs text-slate-600">{lastResult.notice}</p>
          )}
        </div>
      )}
    </section>
  );
}

function DiffRow({ entry }: { entry: CopilotDiffEntry }) {
  const badgeStyles: Record<CopilotDiffEntry["action"], string> = {
    swapped: "bg-sky-100 text-sky-900",
    removed: "bg-amber-100 text-amber-900",
    moved: "bg-indigo-100 text-indigo-900",
  };

  return (
    <li className="flex flex-wrap items-center gap-2 text-xs text-slate-800">
      <span
        className={`rounded-full px-2 py-0.5 font-semibold capitalize ${badgeStyles[entry.action]}`}
      >
        {entry.action}
      </span>
      <span className="font-medium text-slate-500">
        Day {entry.dayNumber} · {entry.slot}
      </span>
      {entry.before && (
        <span className="line-through text-slate-500">{entry.before}</span>
      )}
      {entry.before && entry.after && (
        <span className="text-slate-500" aria-hidden="true">
          →
        </span>
      )}
      {entry.after && (
        <span className="font-semibold text-emerald-900">{entry.after}</span>
      )}
    </li>
  );
}
