import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import type { TripInput } from '../../stores/tripStore';
import { GuestBriefReadError } from '../../lib/guestTripBrief';
import { useGuestTripBrief } from '../../hooks/useGuestTripBrief';
const mockAuth = { initialized: true, loading: false, user: null as null | { id: string } };
const mockAccount = { user: null as null | { id: string }, accountRevision: 0 };
const mockDraft = {
  destination: '',
  startDate: '',
  endDate: '',
  travelers: 2,
  travelerType: 'couple',
  vibes: [] as string[],
};
let mockState = { draftInput: { ...mockDraft }, setDraftInput: (_input: object) => {} };
const mockListeners = new Set<(next: typeof mockState, previous: typeof mockState) => void>();
const mockRead = jest.fn();
const mockSave = jest.fn();
const mockClear = jest.fn();
const mockDiscard = jest.fn();
jest.mock('../../components/AuthProvider', () => ({ useAuthContext: () => mockAuth }));
jest.mock('../../stores/userStore', () => ({
  useUserStore: Object.assign(
    (select: (state: typeof mockAccount) => unknown) => select(mockAccount),
    { getState: () => mockAccount }
  ),
}));
jest.mock('../../stores/tripStore', () => ({
  useTripStore: {
    getState: () => mockState,
    subscribe: (listener: (next: typeof mockState, previous: typeof mockState) => void) => {
      mockListeners.add(listener);
      return () => mockListeners.delete(listener);
    },
  },
}));
jest.mock('../../lib/guestTripBrief', () => ({
  GuestBriefReadError: jest.requireActual('../../lib/guestTripBrief').GuestBriefReadError,
  discardReviewedGuestBrief: (...args: unknown[]) => mockDiscard(...args),
  readGuestTripBrief: (...args: unknown[]) => mockRead(...args),
  saveGuestTripBrief: (...args: unknown[]) => mockSave(...args),
  clearGuestTripBrief: () => mockClear(),
}));
let result: ReturnType<typeof useGuestTripBrief>;
function Probe({ incoming }: { incoming?: Partial<TripInput> }) {
  result = useGuestTripBrief(incoming);
  return null;
}
let renderer: ReactTestRenderer;
const saved = {
  ...mockDraft,
  destination: 'Tokyo',
  startDate: '2026-11-01',
  endDate: '2026-11-04',
};
beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
  Object.assign(mockAuth, { initialized: true, loading: false, user: null });
  Object.assign(mockAccount, { user: null, accountRevision: 0 });
  mockState = {
    draftInput: { ...mockDraft },
    setDraftInput: (input) => {
      const previous = mockState;
      mockState = { ...mockState, draftInput: { ...mockState.draftInput, ...input } };
      for (const listener of mockListeners) listener(mockState, previous);
    },
  };
  mockSave.mockResolvedValue(undefined);
  mockClear.mockResolvedValue(undefined);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});
test.each(['restore', 'edited', 'account', 'exit'])(
  'delayed restore honors %s boundary',
  async (mode) => {
    let release!: (value: typeof saved) => void;
    mockRead.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    await act(async () => {
      renderer = create(<Probe />);
    });
    if (mode === 'edited')
      await act(async () => {
        mockState.setDraftInput({ destination: 'Paris' });
      });
    if (mode === 'account')
      Object.assign(mockAccount, { user: { id: 'other' }, accountRevision: 1 });
    if (mode === 'exit') await act(async () => renderer.unmount());
    await act(async () => {
      release(saved);
    });
    expect(mockState.draftInput.destination).toBe(
      mode === 'restore' ? 'Tokyo' : mode === 'edited' ? 'Paris' : ''
    );
    if (mode === 'account' || mode === 'exit') expect(mockSave).not.toHaveBeenCalled();
    if (mode === 'edited') expect(mockSave.mock.calls[0][0].destination).toBe('Paris');
  }
);
test('failed persistence keeps current choices and explains session-only recovery', async () => {
  mockRead.mockResolvedValue(null);
  mockSave.mockRejectedValue(new Error('Storage denied'));
  await act(async () => {
    renderer = create(<Probe />);
  });
  await act(async () => mockState.setDraftInput({ destination: 'Paris' }));
  expect(mockState.draftInput.destination).toBe('Paris');
  expect(result.message).toContain('kept for this session');
});
test('unreadable storage stays untouched while fresh edits remain usable', async () => {
  mockRead.mockRejectedValue(new Error('Unreadable'));
  await act(async () => {
    renderer = create(<Probe />);
  });
  await act(async () => mockState.setDraftInput({ destination: 'Paris' }));
  expect(mockSave).not.toHaveBeenCalled();
  expect(mockClear).not.toHaveBeenCalled();
  expect(result.message).toContain('couldn’t be restored');
});

test('restoration preserves explicit incoming link choices', async () => {
  mockRead.mockResolvedValue(saved);
  await act(async () => {
    renderer = create(
      <Probe incoming={{ destination: 'Tokyo', vibes: ['foodie'], travelers: 3 }} />
    );
  });
  expect(mockState.draftInput).toMatchObject({
    destination: 'Tokyo',
    startDate: saved.startDate,
    vibes: ['foodie'],
    travelers: 3,
  });
});
test.each(['discarded', 'changed', 'account'])(
  'deliberate unreadable recovery honors %s',
  async (outcome) => {
    mockRead.mockRejectedValue(new GuestBriefReadError('{bad'));
    mockDiscard.mockResolvedValue(true);
    await act(async () => {
      renderer = create(<Probe />);
    });
    await act(async () => mockState.setDraftInput({ destination: 'Paris' }));
    expect(result.discardUnreadable).toBeTruthy();
    if (outcome === 'changed') mockDiscard.mockRejectedValue(new Error('Saved choices changed'));
    if (outcome === 'account')
      Object.assign(mockAccount, { user: { id: 'other' }, accountRevision: 1 });
    await act(async () => {
      await result.discardUnreadable!();
    });
    expect(mockState.draftInput.destination).toBe('Paris');
    if (outcome === 'discarded') {
      expect(mockSave).toHaveBeenCalled();
      expect(result.discardUnreadable).toBeNull();
    } else {
      expect(mockSave).not.toHaveBeenCalled();
      expect(result.discardUnreadable).toBeTruthy();
    }
    if (outcome === 'account') expect(mockDiscard).not.toHaveBeenCalled();
  }
);

test('resolved signed-in account clears guest recovery without restoring it', async () => {
  mockAuth.user = { id: 'owner' };
  mockAccount.user = { id: 'owner' };
  await act(async () => {
    renderer = create(<Probe />);
  });
  expect(mockClear).toHaveBeenCalledTimes(1);
  expect(mockRead).not.toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
});
test.each([
  { initialized: false, loading: false },
  { initialized: true, loading: true },
])('waits for resolved authentication: %j', async (state) => {
  Object.assign(mockAuth, state);
  await act(async () => {
    renderer = create(<Probe />);
  });
  expect(mockRead).not.toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
  expect(mockClear).not.toHaveBeenCalled();
});

test.each([
  { startDate: '2026-11-02' },
  { endDate: '2026-11-10' },
  { vibes: ['foodie'] },
  { travelers: 4 },
  { travelerType: 'family' },
  { originCity: 'London' },
  { originAirport: 'LHR' },
  { budget: 'luxury' },
])('reopening preserves newer in-memory choices: %j', async (changes) => {
  mockState.setDraftInput({ destination: 'Tokyo', ...changes });
  mockRead.mockResolvedValue(saved);
  await act(async () => {
    renderer = create(<Probe />);
  });
  expect(mockState.draftInput).toMatchObject(changes);
  expect(mockSave.mock.calls[0][0]).toMatchObject(changes);
});
