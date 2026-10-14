jest.mock('../../lib/planningConsent', () => ({ withPlanningConsent: jest.fn() }));
jest.mock('../../constants/api', () => ({
  API_BASE_URL: 'http://localhost:3000',
  API_TIMEOUT: 5000,
}));
const mockSession = jest.fn();
const mockAccount = { user: { id: 'account-a' }, accountRevision: 0 };
jest.mock('../../stores/userStore', () => ({
  useUserStore: { getState: () => mockAccount },
}));
jest.mock('../../lib/supabase', () => ({ supabase: { auth: { getSession: mockSession } } }));
import { updateUserProfile, getVerifiedUserProfile, setAuthToken } from '../../services/api';
const mockFetch = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  mockAccount.accountRevision = 0;
  global.fetch = mockFetch;
  setAuthToken('different-account-token');
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'account-a', name: 'Ada' }) });
});

it('refuses HTTP dispatch after same-account reauthentication during session verification', async () => {
  let finish!: (value: object) => void;
  mockSession.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const saving = updateUserProfile({ display_name: 'Ada' }, 'account-a');
  await Promise.resolve();
  await Promise.resolve();
  mockAccount.accountRevision += 2;
  finish({ data: { session: { user: { id: 'account-a' }, access_token: 'old-session-token' } } });
  expect(await saving).toMatchObject({ code: 'AUTH_CHANGED' });
  expect(mockFetch).not.toHaveBeenCalled();
});

it('settles a stalled SDK verification without sending a profile write', async () => {
  jest.useFakeTimers();
  try {
    mockSession.mockReturnValue(new Promise(() => {}));
    let settled = false;
    const saving = updateUserProfile({ display_name: 'Ada' }, 'account-a');
    void saving.then(() => {
      settled = true;
    });
    await jest.advanceTimersByTimeAsync(20_000);
    expect(settled).toBe(true);
    expect(await saving).toMatchObject({ error: expect.stringContaining('profile edits') });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

it('does not reconcile an HTTP receipt from the prior session', async () => {
  mockSession.mockResolvedValue({
    data: { session: { user: { id: 'account-a' }, access_token: 'a-token' } },
  });
  let begin!: () => void;
  const started = new Promise<void>((resolve) => {
    begin = resolve;
  });
  let finish!: (value: object) => void;
  const response = new Promise((resolve) => {
    finish = resolve;
  });
  mockFetch.mockImplementation(() => {
    begin();
    return response;
  });
  const saving = updateUserProfile({ display_name: 'Ada' }, 'account-a');
  await started;
  mockAccount.accountRevision += 2;
  finish({ ok: true, json: async () => ({ id: 'account-a', name: 'Ada' }) });
  expect(await saving).toMatchObject({ code: 'AUTH_CHANGED' });
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('loads the saved profile with the verified session token', async () => {
  mockSession.mockResolvedValue({
    data: { session: { user: { id: 'account-a' }, access_token: 'a-token' } },
  });
  expect(await getVerifiedUserProfile('account-a')).toMatchObject({ data: { id: 'account-a' } });
  expect(mockFetch).toHaveBeenCalledWith(
    'http://localhost:3000/api/user/profile',
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer a-token' }),
    })
  );
  expect(mockFetch.mock.calls[0][1].body).toBeUndefined();
});

it.each(['read', 'write'])('rejects an unverified %s profile receipt', async (mode) => {
  mockSession.mockResolvedValue({
    data: { session: { user: { id: 'account-a' }, access_token: 'a-token' } },
  });
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'account-b' }) });
  expect(
    await (mode === 'read'
      ? getVerifiedUserProfile('account-a')
      : updateUserProfile({ display_name: 'Ada' }, 'account-a'))
  ).toMatchObject({ code: 'INVALID_RESPONSE' });
});
it('refuses to save a stale editor to the new account', async () => {
  mockSession.mockResolvedValue({
    data: { session: { user: { id: 'account-b' }, access_token: 'b-token' } },
  });
  expect(await updateUserProfile({ display_name: 'Ada' }, 'account-a')).toMatchObject({
    code: 'AUTH_CHANGED',
  });
  expect(mockFetch).not.toHaveBeenCalled();
});
it('uses the session matched to the edit owner instead of the mutable API token cache', async () => {
  mockSession.mockResolvedValue({
    data: { session: { user: { id: 'account-a' }, access_token: 'a-token' } },
  });
  expect(await updateUserProfile({ display_name: 'Ada' }, 'account-a')).toMatchObject({
    data: { id: 'account-a' },
  });
  expect(mockFetch).toHaveBeenCalledWith(
    'http://localhost:3000/api/user/profile',
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer a-token' }),
    })
  );
});
