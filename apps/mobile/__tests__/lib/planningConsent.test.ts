const mockAlert = jest.fn();
const mockSession = jest.fn();
const mockSubscribe = jest.fn();
const mockNetwork = jest.fn();
jest.mock('react-native', () => ({ Alert: { alert: mockAlert } }));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: mockNetwork },
}));
jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: mockSession, onAuthStateChange: mockSubscribe } },
}));
jest.mock('../../constants/api', () => ({ API_BASE_URL: 'https://staging.example' }));
import { withPlanningConsent } from '../../lib/planningConsent';
import {
  createAndStartTrip,
  regenerateTrip,
  recoverUnstartedTrip,
  GenerationNotStartedError,
} from '../../services/planningService';
import { startSearch } from '../../services/searchService';

const fetchMock = jest.fn();
const unsubscribe = jest.fn();
let changed: (event: string, session: unknown) => void;
const session = (id = 'account-a') => ({ user: { id }, access_token: `${id}-token` });
const disclosure = {
  version: 'planning-google-v1',
  title: 'Share trip details with AI?',
  message: 'Vercel AI Gateway and Google (Gemini)',
};
const input = {
  destination: 'Paris',
  startDate: '2099-06-01',
  endDate: '2099-06-02',
  travelers: 2,
  vibes: [],
};
const id = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock;
  mockSession.mockResolvedValue({ data: { session: session() }, error: null });
  mockSubscribe.mockImplementation((fn) => {
    changed = fn;
    return { data: { subscription: { unsubscribe } } };
  });
  mockNetwork.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () =>
      url.endsWith('/disclosure')
        ? disclosure
        : url.endsWith('/api/trips')
          ? { trip: { id } }
          : { status: 'started', searchId: 'search-1' },
  }));
  mockAlert.mockImplementation((_title, _message, buttons) => buttons[1].onPress());
});

const posts = () => fetchMock.mock.calls.filter(([, options]) => options.method === 'POST');
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

it.each(['create', 'regenerate', 'search'])(
  'decline prevents %s dispatch and any queued retry',
  async (kind) => {
    mockAlert.mockImplementation((_title, _message, buttons) => buttons[0].onPress());
    const work =
      kind === 'create'
        ? createAndStartTrip(input, jest.fn())
        : kind === 'regenerate'
          ? regenerateTrip(id)
          : startSearch(input, 'other-account-token');
    await expect(work).rejects.toThrow('declined');
    expect(posts()).toHaveLength(0);
    expect(unsubscribe).toHaveBeenCalled();
  }
);

it('discloses recipients before creating and generating, with current session and version bound to each POST', async () => {
  const receipt = jest.fn();
  await expect(createAndStartTrip(input, receipt)).resolves.toBe(id);
  expect(mockAlert).toHaveBeenCalledWith(
    disclosure.title,
    disclosure.message,
    expect.any(Array),
    expect.any(Object)
  );
  expect(receipt).toHaveBeenCalledWith(id);
  expect(posts().map(([url]) => url)).toEqual([
    'https://staging.example/api/trips',
    `https://staging.example/api/trips/${id}/generate`,
  ]);
  for (const [, options] of posts())
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer account-a-token',
      'X-Faroway-AI-Disclosure': disclosure.version,
    });
});

it('requires fresh consent after failure, retry and session restoration', async () => {
  const work = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('done');
  await expect(withPlanningConsent(work)).rejects.toThrow('offline');
  await expect(withPlanningConsent(work)).resolves.toBe('done');
  // Same account/session after restoration never inherits a persisted grant.
  mockSession.mockResolvedValue({ data: { session: session() } });
  await withPlanningConsent(work);
  expect(mockAlert).toHaveBeenCalledTimes(3);
});

it.each(['SIGNED_OUT', 'SIGNED_IN'])(
  'cancels pending consent on %s, including a late tap',
  async (event) => {
    mockAlert.mockImplementation(() => {});
    const dispatch = jest.fn();
    const work = withPlanningConsent(dispatch);
    const rejected = expect(work).rejects.toThrow('cancelled');
    await flush();
    changed(event, event === 'SIGNED_OUT' ? null : session('account-b'));
    mockAlert.mock.calls[0][2][1].onPress();
    await rejected;
    expect(dispatch).not.toHaveBeenCalled();
  }
);

it('checks account again after approval even if no auth event arrived', async () => {
  mockAlert.mockImplementation((_title, _message, buttons) => {
    mockSession.mockResolvedValue({ data: { session: session('account-b') } });
    buttons[1].onPress();
  });
  await expect(regenerateTrip(id)).rejects.toThrow('account changed');
  expect(posts()).toHaveLength(0);
});

it('rejects unauthenticated restoration before requesting disclosure', async () => {
  mockSession.mockResolvedValue({ data: { session: null } });
  await expect(regenerateTrip(id)).rejects.toThrow('Sign in');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mockAlert).not.toHaveBeenCalled();
});

it.each(['before', 'after'])(
  'does not queue AI work when connectivity is lost %s consent',
  async (when) => {
    if (when === 'before') mockNetwork.mockResolvedValue({ isConnected: false });
    else
      mockAlert.mockImplementation((_title, _message, buttons) => {
        mockNetwork.mockResolvedValue({ isConnected: false });
        buttons[1].onPress();
      });
    await expect(regenerateTrip(id)).rejects.toThrow('offline');
    expect(posts()).toHaveLength(0);
  }
);

it('retains the created trip receipt but prevents a cross-account generation after creation', async () => {
  const receipt = jest.fn(() => {
    changed('SIGNED_IN', session('account-b'));
  });
  await expect(createAndStartTrip(input, receipt)).rejects.toThrow('cancelled');
  expect(receipt).toHaveBeenCalledWith(id);
  expect(posts()).toHaveLength(1);
});

it('cancels on screen unmount and ignores late consent', async () => {
  mockAlert.mockImplementation(() => {});
  const controller = new AbortController();
  const work = createAndStartTrip(input, jest.fn(), controller.signal);
  const rejected = expect(work).rejects.toThrow('cancelled');
  await flush();
  controller.abort();
  mockAlert.mock.calls[0][2][1].onPress();
  await rejected;
  expect(posts()).toHaveLength(0);
});

it('fails closed when the disclosure endpoint is missing, without a cached substitute', async () => {
  fetchMock.mockResolvedValue({ ok: false });
  await expect(regenerateTrip(id)).rejects.toThrow('unavailable');
  expect(mockAlert).not.toHaveBeenCalled();
  expect(posts()).toHaveLength(0);
});

it('recovers create success followed by a definite disclosure 409 through fresh consent, without creating another trip', async () => {
  let rejectGeneration = true;
  fetchMock.mockImplementation(async (url: string, options: RequestInit) => ({
    ok: !(url.endsWith('/generate') && rejectGeneration),
    status: url.endsWith('/generate') && rejectGeneration ? 409 : 200,
    json: async () =>
      url.endsWith('/disclosure')
        ? disclosure
        : url.endsWith('/api/trips')
          ? { trip: { id } }
          : url.endsWith('/generate') && rejectGeneration
            ? { code: 'ai_consent_required', generationStarted: false }
            : options.method === 'POST'
              ? { status: 'started' }
              : { trip: { id, status: 'draft', search_id: null } },
  }));
  const receipt = jest.fn();
  await expect(createAndStartTrip(input, receipt)).rejects.toBeInstanceOf(
    GenerationNotStartedError
  );
  expect(receipt).toHaveBeenCalledWith(id);
  rejectGeneration = false;
  await recoverUnstartedTrip(id);
  expect(mockAlert).toHaveBeenCalledTimes(2);
  expect(posts().filter(([url]) => url.endsWith('/api/trips'))).toHaveLength(1);
  expect(posts().filter(([url]) => url.endsWith('/generate'))).toHaveLength(2);
});
it('only reconnects when recovery discovers an existing or ambiguous planning attempt', async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ trip: { id, status: 'generating', search_id: 'existing' } }),
  });
  await recoverUnstartedTrip(id);
  expect(posts()).toHaveLength(0);
  expect(mockAlert).not.toHaveBeenCalled();
});
