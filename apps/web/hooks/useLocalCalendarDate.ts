"use client";
import { useSyncExternalStore } from "react";
import { localCalendarDate } from "@faroway/constants";

function subscribe(listener: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  let active = true;
  const update = () => {
    if (!active) return;
    clearTimeout(timer);
    listener();
    if (!active) return;
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(now.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    timer = setTimeout(update, Math.max(1, midnight.getTime() - now.getTime()));
  };
  update();
  window.addEventListener("focus", update);
  document.addEventListener("visibilitychange", update);
  return () => {
    active = false;
    clearTimeout(timer);
    window.removeEventListener("focus", update);
    document.removeEventListener("visibilitychange", update);
  };
}
const snapshot = () => localCalendarDate();

/** Hydrate with the server's snapshot, then follow the traveler's local calendar. */
export function useLocalCalendarDate(serverDay: string) {
  return useSyncExternalStore(subscribe, snapshot, () => serverDay);
}
