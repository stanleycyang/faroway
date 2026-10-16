import { supabase } from './supabase';
import { useUserStore } from '../stores/userStore';

export class TripAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TripAccessError';
  }
}

export class TripAccountChangedError extends TripAccessError {
  constructor() {
    super('Your account changed. Reopen your trips to continue.');
    this.name = 'TripAccountChangedError';
  }
}

export const TRIP_SESSION_DEADLINE_MS = 20_000;

/** Session refresh can also stall; settle the UI even if an SDK ignores cancellation. */
export async function readTripSession() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new TripAccessError(
                'Couldn’t verify your account in time. Your saved trips are kept. Check your connection and try again.'
              )
            ),
          TRIP_SESSION_DEADLINE_MS
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Capture before any await; logout and sign-in to the same account invalidate it too. */
export function captureTripAccount() {
  const { user, accountRevision } = useUserStore.getState();
  const ownerId = user?.id;
  const isCurrent = () => {
    const current = useUserStore.getState();
    return current.user?.id === ownerId && current.accountRevision === accountRevision;
  };
  const assertCurrent = () => {
    if (!isCurrent()) throw new TripAccountChangedError();
    if (!ownerId) throw new TripAccessError('Please sign in to view your trips');
  };
  return {
    ownerId,
    accountRevision,
    isCurrent,
    assertCurrent,
    async headers() {
      assertCurrent();
      const { data, error } = await readTripSession();
      assertCurrent();
      if (error)
        throw new TripAccessError(
          'Couldn’t verify your account. Check your connection and try again.'
        );
      if (!data.session) throw new TripAccessError('Please sign in to view your trips');
      if (data.session.user.id !== ownerId) throw new TripAccountChangedError();
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session.access_token}`,
      };
    },
  };
}
