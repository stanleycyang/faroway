"use client";

import { getAppStateSnapshot, useWorldMapStore } from "./store";

// Download the current AppState as a pretty-printed JSON file, then mark the
// backup as taken so the reminder banner dismisses itself.
export function downloadBackupJson() {
  const snapshot = getAppStateSnapshot();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `world-map-backup-${today}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  useWorldMapStore.getState().markBackupTaken();
}
