const forget = jest.fn();
const session = jest.fn();
const signOut = jest.fn();
const clear = jest.fn();
const logout = jest.fn();
const setTrips = jest.fn();
let profile: { id: string } | null;
jest.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: session, signOut } } }));
jest.mock('../../lib/offline', () => ({ offlineStorage: { clearAll: clear } }));
jest.mock('../../services/pushConsentService', () => ({
  devicePushConsent: { forgetDeletedAccount: forget },
}));
jest.mock('../../stores/userStore', () => ({
  useUserStore: { getState: () => ({ user: profile, logout }) },
}));
jest.mock('../../stores/tripStore', () => ({
  useTripStore: { setState: setTrips, getInitialState: () => ({ draftInput: {} }) },
}));
jest.mock('../../services/api', () => ({ setAuthToken: jest.fn() }));
import { cleanupDeletedAccount } from '../../services/deletedAccountCleanup';
beforeEach(() => {
  jest.resetAllMocks();
  profile = { id: 'a' };
  session.mockResolvedValue({ data: { session: { user: { id: 'a' } } } });
  signOut.mockResolvedValue({ error: null });
});
it.each(['push', 'trips', 'signout'])(
  'propagates %s failure so recovery proof can survive',
  async (boundary) => {
    if (boundary === 'push') forget.mockRejectedValueOnce(new Error('push'));
    if (boundary === 'trips') clear.mockRejectedValueOnce(new Error('trips'));
    if (boundary === 'signout') signOut.mockResolvedValueOnce({ error: new Error('signout') });
    await expect(cleanupDeletedAccount('a')).rejects.toThrow();
    expect(setTrips).not.toHaveBeenCalled();
    await cleanupDeletedAccount('a');
    expect(setTrips).toHaveBeenCalledTimes(1);
  }
);
it('does not clear another signed-in account', async () => {
  profile = { id: 'b' };
  await expect(cleanupDeletedAccount('a')).rejects.toThrow('current account');
  expect(forget).toHaveBeenCalledWith('a');
  expect(clear).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
});
it('rechecks the session before sign-out after storage cleanup', async () => {
  clear.mockImplementationOnce(async () => {
    profile = { id: 'b' };
  });
  await expect(cleanupDeletedAccount('a')).rejects.toThrow('account changed');
  expect(signOut).not.toHaveBeenCalled();
  expect(logout).not.toHaveBeenCalled();
});
it('finishes idempotently with no session after a crash during sign-out', async () => {
  profile = null;
  session.mockResolvedValue({ data: { session: null } });
  await cleanupDeletedAccount('a');
  expect(clear).toHaveBeenCalledTimes(1);
  expect(signOut).not.toHaveBeenCalled();
  expect(logout).toHaveBeenCalledTimes(1);
  expect(setTrips).toHaveBeenCalledTimes(1);
});
