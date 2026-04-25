"use client";

import { useState, useSyncExternalStore } from "react";
import { AlertTriangle, X } from "lucide-react";
import {
  useActiveProfile,
  useWorldMapStore,
} from "@/lib/tools/world-map/store";
import { downloadBackupJson } from "@/lib/tools/world-map/backup";

const DISMISS_KEY = "wm:backup-banner-dismissed";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MIN_VISITS = 5;

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
function getDismissSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DISMISS_KEY);
}

// Banner visibility reduces to this non-pure time comparison — isolated here
// so the component body stays free of Date.now calls during render.
function isStillFresh(
  lastBackupAt: string | undefined,
  persistedDismiss: string | null,
): boolean {
  const now = Date.now();
  if (persistedDismiss) {
    const when = Number(persistedDismiss);
    if (now - when < THIRTY_DAYS_MS) return true;
  }
  if (lastBackupAt) {
    const last = new Date(lastBackupAt).getTime();
    if (now - last < THIRTY_DAYS_MS) return true;
  }
  return false;
}

export function BackupBanner() {
  const profile = useActiveProfile();
  const settings = useWorldMapStore((s) => s.settings);
  const [locallyDismissed, setLocallyDismissed] = useState(false);
  const persistedDismiss = useSyncExternalStore(
    subscribe,
    getDismissSnapshot,
    () => null,
  );

  const visits = profile ? Object.keys(profile.visits).length : 0;
  const dismissed =
    locallyDismissed ||
    visits < MIN_VISITS ||
    isStillFresh(settings.lastBackupAt, persistedDismiss);

  if (dismissed) return null;

  return (
    <div className="border border-ink/15 bg-paper px-4 py-3 flex items-start gap-3">
      <div className="w-8 h-8 border border-ink/15 text-clay flex items-center justify-center flex-shrink-0">
        <AlertTriangle className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
          Reminder
        </div>
        <div className="font-editorial text-base font-bold text-ink mt-0.5">
          Back up your atlas
        </div>
        <div className="text-[12px] text-slate-600 mt-0.5 leading-relaxed">
          Your pins live in this browser. Export a JSON file so you don&apos;t
          lose them if you clear browser data or switch devices.
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => downloadBackupJson()}
          className="text-[11px] font-bold uppercase tracking-[0.18em] bg-ink hover:bg-slate-700 text-paper px-3 py-2 transition-colors"
        >
          Back up
        </button>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
            setLocallyDismissed(true);
          }}
          aria-label="Dismiss"
          className="w-7 h-7 text-slate-500 hover:bg-ink/5 flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
