import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
const mockGetSession = jest.fn();
const mockSignOut = jest.fn();
const mockGoogleSignOut = jest.fn();
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signOut: (...args: unknown[]) => mockGoogleSignOut(...args),
  },
}));
let mockAuthChange: (event: AuthChangeEvent, session: Session | null) => void;
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      onAuthStateChange: (callback: typeof mockAuthChange) => {
        mockAuthChange = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
    },
  },
}));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('@sentry/react-native', () => ({ setUser: jest.fn() }));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('../../services/deletedAccountCleanup', () => ({ cleanupDeletedAccount: jest.fn() }));
jest.mock('../../services/accountDeletionService', () => ({
  deleteAccountWithRecovery: jest.fn(),
  finishAccountDeletionCleanup: jest.fn(),
}));
jest.mock('../../services/pushConsentService', () => ({
  devicePushConsent: { disable: jest.fn(async () => undefined) },
}));
const mockProfile = jest.fn();
const mockToken = jest.fn();
jest.mock('../../services/api', () => ({
  setAuthToken: (...args: unknown[]) => mockToken(...args),
  getUserProfile: (...args: unknown[]) => mockProfile(...args),
}));
interface StoredUser {
  id: string;
  name: string;
  email: string;
  preferences: { vibes: string[] };
}
const mockStore = {
  user: null as StoredUser | null,
  setUser: jest.fn((user: StoredUser | null) => {
    mockStore.user = user;
  }),
  logout: jest.fn(() => {
    mockStore.user = null;
  }),
};
jest.mock('../../stores/userStore', () => ({
  useUserStore: Object.assign(() => mockStore, { getState: () => mockStore }),
}));
const mockClearTrips = jest.fn();
jest.mock('../../stores/tripStore', () => ({
  useTripStore: Object.assign(
    (selector: (state: { clearAll: typeof mockClearTrips }) => unknown) =>
      selector({ clearAll: mockClearTrips }),
    { getState: () => ({ setDraftInput: jest.fn() }) }
  ),
}));
import { useAuth } from '../../hooks/useAuth';
let state: ReturnType<typeof useAuth>;
let renderer: ReactTestRenderer;
function Harness() {
  state = useAuth();
  return null;
}
function session(id: string): Session {
  return {
    user: {
      id,
      email: `${id}@example.invalid`,
      user_metadata: { full_name: id },
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2026-01-01T00:00:00Z',
    },
    access_token: `${id}-token`,
    refresh_token: `${id}-refresh`,
    expires_in: 3600,
    token_type: 'bearer',
  };
}
function profile(id: string) {
  return {
    data: { id, email: `${id}@example.invalid`, name: id, preferences: { vibes: ['cultural'] } },
  };
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
beforeEach(() => {
  jest.clearAllMocks();
  mockStore.user = null;
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockProfile.mockImplementation(async (token: string) => profile(token.replace('-token', '')));
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
it('cannot resurrect the previous account when its profile arrives after sign-out', async () => {
  let resolveOld: (value: ReturnType<typeof profile>) => void = () => undefined;
  mockProfile.mockReturnValue(
    new Promise((resolve) => {
      resolveOld = resolve;
    })
  );
  await act(async () => {
    renderer = create(<Harness />);
  });
  await act(async () => {
    mockAuthChange('SIGNED_IN', session('a'));
  });
  expect(state.loading).toBe(false);
  expect(state.initialized).toBe(true);
  await act(async () => {
    mockAuthChange('SIGNED_OUT', null);
  });
  await act(async () => {
    resolveOld(profile('a'));
  });
  expect(mockStore.user).toBeNull();
  expect(state.isAuthenticated).toBe(false);
  expect(state.initialized).toBe(true);
  expect(mockToken).toHaveBeenLastCalledWith(null);
});
it('keeps the latest account when profile responses arrive out of order', async () => {
  let resolveOld: (value: ReturnType<typeof profile>) => void = () => undefined;
  mockProfile.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveOld = resolve;
    })
  );
  await act(async () => {
    renderer = create(<Harness />);
  });
  await act(async () => {
    mockAuthChange('SIGNED_IN', session('a'));
  });
  await act(async () => {
    mockAuthChange('SIGNED_IN', session('b'));
  });
  await act(async () => {
    resolveOld(profile('a'));
  });
  expect(mockStore.user?.id).toBe('b');
  expect(state.user?.id).toBe('b');
  expect(mockToken).toHaveBeenLastCalledWith('b-token');
  expect(mockClearTrips).toHaveBeenCalled();
});
it('refreshes the token without replacing current profile choices with a background fetch', async () => {
  await act(async () => {
    renderer = create(<Harness />);
  });
  await act(async () => {
    mockAuthChange('SIGNED_IN', session('a'));
  });
  mockStore.user!.preferences = { vibes: ['food'] };
  await act(async () => {
    mockAuthChange('TOKEN_REFRESHED', { ...session('a'), access_token: 'refreshed-token' });
  });
  expect(mockProfile).toHaveBeenCalledTimes(1);
  expect(mockStore.user?.preferences.vibes).toEqual(['food']);
  expect(mockToken).toHaveBeenLastCalledWith('refreshed-token');
});

it('does not erase a newly signed-in account after old provider cleanup finishes', async () => {
  let finishProvider: () => void = () => undefined;
  mockGoogleSignOut.mockReturnValue(
    new Promise<void>((resolve) => {
      finishProvider = resolve;
    })
  );
  mockSignOut.mockImplementation(async () => {
    mockAuthChange('SIGNED_OUT', null);
    return { error: null };
  });
  await act(async () => {
    renderer = create(<Harness />);
  });
  await act(async () => {
    mockAuthChange('SIGNED_IN', session('a'));
  });
  let signingOut: Promise<void> = Promise.resolve();
  await act(async () => {
    signingOut = state.signOut();
  });
  expect(mockGoogleSignOut).toHaveBeenCalled();
  await act(async () => {
    mockAuthChange('SIGNED_IN', session('b'));
  });
  await act(async () => {
    finishProvider();
    await signingOut;
  });
  expect(mockStore.user?.id).toBe('b');
  expect(state.user?.id).toBe('b');
  expect(mockToken).toHaveBeenLastCalledWith('b-token');
});

it('settles a stalled startup session and ignores its late result', async () => {
  jest.useFakeTimers();
  const timer = jest.spyOn(globalThis, 'setTimeout');
  const clearTimer = jest.spyOn(globalThis, 'clearTimeout');
  try {
    let release!: (value: unknown) => void;
    mockGetSession.mockReturnValueOnce(
      new Promise<unknown>((resolve) => {
        release = resolve;
      })
    );
    await act(async () => {
      renderer = create(<Harness />);
    });
    expect(state.initialized).toBe(false);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20_001);
    });
    expect(state.initialized).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.isAuthenticated).toBe(false);
    await act(async () => {
      release({ data: { session: session('late') }, error: null });
    });
    expect(state.user).toBeNull();
    expect(mockStore.user).toBeNull();
    expect(mockProfile).not.toHaveBeenCalled();
    const deadline = timer.mock.calls.findIndex((call) => call[1] === 20_000);
    expect(deadline).toBeGreaterThanOrEqual(0);
    expect(clearTimer).toHaveBeenCalledWith(timer.mock.results[deadline].value);
  } finally {
    timer.mockRestore();
    clearTimer.mockRestore();
    jest.useRealTimers();
  }
});

it('opens the signed-in app while profile enrichment is still pending', async () => {
  let release!: (value: ReturnType<typeof profile>) => void;
  mockGetSession.mockResolvedValue({ data: { session: session('a') }, error: null });
  mockProfile.mockReturnValueOnce(
    new Promise<ReturnType<typeof profile>>((resolve) => {
      release = resolve;
    })
  );
  await act(async () => {
    renderer = create(<Harness />);
  });
  expect(state.initialized).toBe(true);
  expect(state.loading).toBe(false);
  expect(state.isAuthenticated).toBe(true);
  expect(mockStore.user?.id).toBe('a');
  await act(async () => {
    release(profile('a'));
  });
  expect(mockStore.user?.preferences.vibes).toEqual(['cultural']);
});

it('keeps profile edits made while an older enrichment request is pending', async () => {
  let release!: (value: ReturnType<typeof profile>) => void;
  mockGetSession.mockResolvedValue({ data: { session: session('a') }, error: null });
  mockProfile.mockReturnValueOnce(
    new Promise<ReturnType<typeof profile>>((resolve) => {
      release = resolve;
    })
  );
  await act(async () => {
    renderer = create(<Harness />);
  });
  const edited = { ...mockStore.user!, name: 'Updated name', preferences: { vibes: ['food'] } };
  mockStore.setUser(edited);
  await act(async () => {
    release(profile('a'));
  });
  expect(mockStore.user).toBe(edited);
  expect(state.isAuthenticated).toBe(true);
});

it('lets profile enrichment finish across a same-account token refresh', async () => {
  let release!: (value: ReturnType<typeof profile>) => void;
  mockGetSession.mockResolvedValue({ data: { session: session('a') }, error: null });
  mockProfile.mockReturnValueOnce(
    new Promise<ReturnType<typeof profile>>((resolve) => {
      release = resolve;
    })
  );
  await act(async () => {
    renderer = create(<Harness />);
  });
  await act(async () => {
    mockAuthChange('TOKEN_REFRESHED', { ...session('a'), access_token: 'fresh-token' });
  });
  await act(async () => {
    release(profile('a'));
  });
  expect(mockStore.user?.preferences.vibes).toEqual(['cultural']);
  expect(mockToken).toHaveBeenLastCalledWith('fresh-token');
  expect(mockProfile).toHaveBeenCalledTimes(1);
});

it('does not clear a replacement session after deletion cleanup for the old account settles', async () => {
  const deletion = jest.requireMock('../../services/accountDeletionService');
  deletion.deleteAccountWithRecovery.mockResolvedValue({ data: { deleted: true } });
  let release!: () => void;
  deletion.finishAccountDeletionCleanup.mockReturnValue(
    new Promise<void>((resolve) => {
      release = resolve;
    })
  );
  await act(async () => {
    renderer = create(<Harness />);
  });
  await act(async () => {
    mockAuthChange('SIGNED_IN', session('a'));
  });
  let deleting!: Promise<void>;
  await act(async () => {
    deleting = state.deleteAccount();
  });
  await act(async () => {
    mockAuthChange('SIGNED_IN', session('b'));
  });
  await act(async () => {
    release();
    await deleting;
  });
  expect(state.user?.id).toBe('b');
  expect(mockStore.user?.id).toBe('b');
  expect(mockToken).toHaveBeenLastCalledWith('b-token');
});

it('completed deletion settles signed-out state when cleanup emits the normal auth event', async () => {
  const deletion = jest.requireMock('../../services/accountDeletionService');
  deletion.deleteAccountWithRecovery.mockResolvedValue({ data: { deleted: true } });
  deletion.finishAccountDeletionCleanup.mockImplementation(async () => {
    mockAuthChange('SIGNED_OUT', null);
  });
  await act(async () => {
    renderer = create(<Harness />);
  });
  await act(async () => {
    mockAuthChange('SIGNED_IN', session('a'));
  });
  await act(async () => {
    await state.deleteAccount();
  });
  expect(state.user).toBeNull();
  expect(state.session).toBeNull();
  expect(state.loading).toBe(false);
  expect(state.initialized).toBe(true);
  expect(mockStore.user).toBeNull();
});
