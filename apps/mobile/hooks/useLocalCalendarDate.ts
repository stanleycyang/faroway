import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { localCalendarDate } from '@faroway/constants';

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
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') update();
  });
  return () => {
    active = false;
    clearTimeout(timer);
    subscription.remove();
  };
}
const snapshot = () => localCalendarDate();

/** Travel-date filters follow the device calendar, including foreground and midnight. */
export function useLocalCalendarDate() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
