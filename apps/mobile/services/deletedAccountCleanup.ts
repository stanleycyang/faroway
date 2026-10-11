import { supabase } from '../lib/supabase';
import { offlineStorage } from '../lib/offline';
import { useUserStore } from '../stores/userStore';
import { useTripStore } from '../stores/tripStore';
import { devicePushConsent } from './pushConsentService';
import { discardTripCreation } from '../lib/tripCreationRecovery';
import { setAuthToken } from './api';

/** Idempotent local cleanup for a server-confirmed deletion. Failures preserve
 * the recovery proof; another signed-in account is never cleared. */
export async function cleanupDeletedAccount(userId: string) {
  await devicePushConsent.forgetDeletedAccount(userId);
  await discardTripCreation(userId);
  const current = await supabase.auth.getSession();
  if (current.error) throw new Error('Local account cleanup needs another attempt.');
  const profileId = useUserStore.getState().user?.id;
  if (
    (current.data.session && current.data.session.user.id !== userId) ||
    (profileId && profileId !== userId)
  )
    throw new Error('Sign out of your current account to finish the deleted account cleanup.');
  // Await durable deletion, rather than the store's fire-and-forget clearAll.
  await offlineStorage.clearAll(async () => {
    const queued = await supabase.auth.getSession();
    const queuedProfile = useUserStore.getState().user?.id;
    if (
      queued.error ||
      (queued.data.session && queued.data.session.user.id !== userId) ||
      (queuedProfile && queuedProfile !== userId)
    )
      throw new Error('Your account changed before storage cleanup. Please retry.');
  });
  const checked = await supabase.auth.getSession();
  const checkedProfile = useUserStore.getState().user?.id;
  if (
    checked.error ||
    (checked.data.session && checked.data.session.user.id !== userId) ||
    (checkedProfile && checkedProfile !== userId)
  )
    throw new Error('Your account changed during cleanup. Please retry.');
  if (checked.data.session) {
    const result = await supabase.auth.signOut({ scope: 'local' });
    if (result.error) throw new Error('Local sign-out needs another attempt.');
  }
  const after = useUserStore.getState().user?.id;
  if (after && after !== userId) throw new Error('Your account changed during cleanup.');
  setAuthToken(null);
  useUserStore.getState().logout();
  useTripStore.setState({
    trips: [],
    currentTrip: null,
    draftInput: useTripStore.getInitialState().draftInput,
    isGenerating: false,
    generationProgress: 0,
    isHydrated: false,
  });
}
