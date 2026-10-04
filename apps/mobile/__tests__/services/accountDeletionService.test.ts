const getItem = jest.fn();
const setItem = jest.fn();
const remove = jest.fn();
const apple = jest.fn();
const session = jest.fn();
jest.mock('expo-secure-store', () => ({
  getItemAsync: getItem,
  setItemAsync: setItem,
  deleteItemAsync: remove,
}));
jest.mock('expo-crypto', () => ({ getRandomBytesAsync: async () => new Uint8Array(32).fill(7) }));
jest.mock('expo-apple-authentication', () => ({ signInAsync: apple }));
jest.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: session } } }));
jest.mock('../../constants/api', () => ({ API_BASE_URL: 'https://staging.example' }));
import {
  deleteAccountWithRecovery,
  finishAccountDeletionCleanup,
  reconcileCompletedAccountDeletion,
} from '../../services/accountDeletionService';
const fetchMock = jest.fn();
const response = (status: number, data: object) => ({
  ok: status < 400,
  status,
  json: async () => data,
});
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock;
  getItem.mockResolvedValue(null);
  setItem.mockResolvedValue(undefined);
  remove.mockResolvedValue(undefined);
  session.mockResolvedValue({
    data: { session: { user: { id: 'a' }, access_token: 'a-session' } },
  });
  apple.mockResolvedValue({ authorizationCode: 'fresh-code' });
  fetchMock.mockResolvedValue(response(200, { deleted: true }));
});
it('persists only opaque recovery proof before dispatch and requests Apple confirmation only when required', async () => {
  fetchMock
    .mockResolvedValueOnce(response(200, { deleted: false }))
    .mockResolvedValueOnce(response(428, { code: 'apple_reauthentication_required' }))
    .mockResolvedValueOnce(response(200, { deleted: true }));
  expect(await deleteAccountWithRecovery('a')).toEqual({ data: { deleted: true } });
  expect(apple).toHaveBeenCalledTimes(1);
  expect(setItem.mock.calls[0][1]).not.toContain('fresh-code');
  expect(setItem.mock.calls[0][1]).not.toContain('a-session');
  const deletes = fetchMock.mock.calls.filter(([, options]) => options.method === 'DELETE');
  expect(JSON.parse(deletes[1][1].body).appleAuthorizationCode).toBe('fresh-code');
  expect(deletes[1][1].headers.Authorization).toBe('Bearer a-session');
});
it('recovers a lost final response without an Apple prompt or another DELETE', async () => {
  getItem.mockResolvedValue(JSON.stringify({ userId: 'a', recoveryToken: 'a'.repeat(64) }));
  session.mockResolvedValue({ data: { session: null } });
  expect(await deleteAccountWithRecovery('a')).toEqual({ data: { deleted: true } });
  expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(apple).not.toHaveBeenCalled();
});
it('does not transfer a deletion proof or request to another account', async () => {
  getItem.mockResolvedValue(JSON.stringify({ userId: 'a', recoveryToken: 'a'.repeat(64) }));
  expect((await deleteAccountWithRecovery('b')).error).toContain('Another account');
  expect(fetchMock).not.toHaveBeenCalled();
});
it('rechecks the account after Apple confirmation', async () => {
  fetchMock
    .mockResolvedValueOnce(response(200, { deleted: false }))
    .mockResolvedValueOnce(response(428, {}));
  apple.mockImplementationOnce(async () => {
    session.mockResolvedValue({ data: { session: { user: { id: 'b' } } } });
    return { authorizationCode: 'fresh-code' };
  });
  expect((await deleteAccountWithRecovery('a')).error).toContain('same account');
  expect(fetchMock.mock.calls.filter(([, options]) => options.method === 'DELETE')).toHaveLength(1);
});
it('keeps the recovery proof on missing configuration, cancellation and offline errors', async () => {
  fetchMock.mockResolvedValueOnce(response(503, { error: 'Not configured' }));
  expect((await deleteAccountWithRecovery('a')).error).toBe('Not configured');
  expect(apple).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  fetchMock.mockRejectedValueOnce(new Error('offline'));
  expect((await deleteAccountWithRecovery('a')).error).toBe('offline');
  expect(remove).not.toHaveBeenCalled();
});

it('cancels only an unstarted revocation after the user dismisses Apple confirmation', async () => {
  fetchMock
    .mockResolvedValueOnce(response(200, { deleted: false }))
    .mockResolvedValueOnce(response(428, {}))
    .mockResolvedValueOnce(response(200, { cancelled: true }));
  apple.mockRejectedValueOnce({ code: 'ERR_REQUEST_CANCELED' });
  expect((await deleteAccountWithRecovery('a')).error).toContain('Deletion cancelled');
  expect(fetchMock.mock.calls[2][1].method).toBe('PATCH');
  expect(remove).toHaveBeenCalled();
});
it('restores only a confirmed completion, cleaning the original push owner without dispatching deletion', async () => {
  getItem.mockResolvedValue(JSON.stringify({ userId: 'a', recoveryToken: 'a'.repeat(64) }));
  const cleanup = jest.fn().mockResolvedValue(undefined);
  await reconcileCompletedAccountDeletion(cleanup);
  expect(cleanup).toHaveBeenCalledWith('a');
  expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  expect(apple).not.toHaveBeenCalled();
});
it('never clears an uncertain deletion proof during restoration', async () => {
  getItem.mockResolvedValue(JSON.stringify({ userId: 'a', recoveryToken: 'a'.repeat(64) }));
  fetchMock.mockResolvedValueOnce(response(503, {}));
  const cleanup = jest.fn();
  await reconcileCompletedAccountDeletion(cleanup);
  expect(cleanup).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
});

it('retains proof after confirmed deletion until durable local cleanup finishes', async () => {
  const raw = JSON.stringify({ userId: 'a', recoveryToken: 'a'.repeat(64) });
  getItem.mockResolvedValue(raw);
  await deleteAccountWithRecovery('a');
  expect(remove).not.toHaveBeenCalled();
  const cleanup = jest
    .fn()
    .mockRejectedValueOnce(new Error('storage failed'))
    .mockResolvedValue(undefined);
  await expect(finishAccountDeletionCleanup('a', cleanup)).rejects.toThrow('storage failed');
  expect(remove).not.toHaveBeenCalled();
  // App restarts: status-only reconciliation repeats cleanup, then clears proof.
  await reconcileCompletedAccountDeletion(cleanup);
  expect(cleanup).toHaveBeenCalledTimes(2);
  expect(remove).toHaveBeenCalledTimes(1);
});
it('keeps proof when restoration cleanup fails at any boundary', async () => {
  getItem.mockResolvedValue(JSON.stringify({ userId: 'a', recoveryToken: 'a'.repeat(64) }));
  for (const boundary of ['push', 'trips', 'signout']) {
    await reconcileCompletedAccountDeletion(async () => {
      throw new Error(boundary);
    });
    expect(remove).not.toHaveBeenCalled();
  }
});
it('does not remove a replacement recovery proof after asynchronous cleanup', async () => {
  getItem
    .mockResolvedValueOnce(JSON.stringify({ userId: 'a', recoveryToken: 'a'.repeat(64) }))
    .mockResolvedValueOnce(JSON.stringify({ userId: 'b', recoveryToken: 'b'.repeat(64) }));
  await finishAccountDeletionCleanup('a', async () => {});
  expect(remove).not.toHaveBeenCalled();
});
