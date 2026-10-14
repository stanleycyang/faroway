import { useEffect, useRef, useState } from 'react';
import { useAuthContext } from '../components/AuthProvider';
import type { TripInput } from '../stores/tripStore';
import { useTripStore } from '../stores/tripStore';
import { useUserStore } from '../stores/userStore';
import {
  clearGuestTripBrief,
  readGuestTripBrief,
  saveGuestTripBrief,
  GuestBriefReadError,
  discardReviewedGuestBrief,
} from '../lib/guestTripBrief';

/** Subscribe before reading; a late restore never replaces choices entered meanwhile. */
export function useGuestTripBrief(incoming: Partial<TripInput> | null = null) {
  const incomingRef = useRef(incoming);
  incomingRef.current = incoming;
  const incomingKey = JSON.stringify(incoming);
  const { initialized, loading, user } = useAuthContext();
  const revision = useUserStore((state) => state.accountRevision);
  const [message, setMessage] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [discardUnreadable, setDiscardUnreadable] = useState<null | (() => Promise<void>)>(null);
  useEffect(() => {
    if (!initialized || loading) return;
    setMessage(null);
    setDiscardUnreadable(null);
    setRestored(false);
    if (user) {
      void clearGuestTripBrief().catch(() => {});
      return;
    }
    let active = true;
    let ready = false;
    let edited = false;
    let restoring = false;
    const current = () => {
      const account = useUserStore.getState();
      return !account.user && account.accountRevision === revision;
    };
    const persist = () => {
      const draft = useTripStore.getState().draftInput;
      if (!draft || !current()) return;
      void saveGuestTripBrief(draft, current).catch(() => {
        if (active && current())
          setMessage(
            'Your choices are kept for this session, but couldn’t be saved on this device.'
          );
      });
    };
    const unsubscribe = useTripStore.subscribe((next, previous) => {
      if (next.draftInput === previous.draftInput || restoring) return;
      edited = true;
      if (ready) persist();
    });
    void readGuestTripBrief()
      .then((saved) => {
        if (!active || !current()) return;
        const draft = useTripStore.getState().draftInput;
        const linked = incomingRef.current;
        const hasLocalChoices =
          (['startDate', 'endDate', 'originCity', 'originAirport', 'budget'] as const).some(
            (key) => !!draft?.[key] && linked?.[key] === undefined
          ) ||
          (!!draft?.vibes.length && linked?.vibes === undefined) ||
          (!!draft && draft.travelers !== 2 && linked?.travelers === undefined) ||
          (!!draft && draft.travelerType !== 'couple' && linked?.travelerType === undefined);
        if (
          saved &&
          !edited &&
          !hasLocalChoices &&
          (!draft?.destination || draft.destination === saved.destination)
        ) {
          restoring = true;
          useTripStore.getState().setDraftInput({ ...saved, ...incomingRef.current });
          restoring = false;
          setRestored(!!saved.destination);
          if (saved.destination || saved.startDate || saved.endDate)
            setMessage('Your unfinished trip choices were restored on this device.');
        }
        ready = true;
        persist();
      })
      .catch((error: unknown) => {
        if (active && current() && error instanceof GuestBriefReadError) {
          let discarding = false;
          setDiscardUnreadable(() => async () => {
            if (discarding || !active || !current()) return;
            discarding = true;
            try {
              if (
                !(await discardReviewedGuestBrief(error.storedRecord, current)) ||
                !active ||
                !current()
              )
                return;
              ready = true;
              setDiscardUnreadable(null);
              setMessage('Unreadable saved choices discarded. Your current edits are still here.');
              persist();
            } catch (cause) {
              if (active && current())
                setMessage(
                  cause instanceof Error
                    ? cause.message
                    : 'The saved choices could not be discarded. Try again.'
                );
            } finally {
              discarding = false;
            }
          });
        }
        if (active && current())
          setMessage(
            'Your unfinished choices couldn’t be restored. Current edits stay in this session.'
          );
        // Keep an unreadable record; do not silently overwrite it with defaults.
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [initialized, loading, user, revision, incomingKey]);
  return { message, restored, discardUnreadable };
}
