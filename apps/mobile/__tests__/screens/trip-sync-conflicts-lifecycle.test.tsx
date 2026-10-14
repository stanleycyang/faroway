import React from 'react';
import { act, create } from 'react-test-renderer';
const mockPending = jest.fn();
let mockSyncListener: () => void = () => {};
let mockOwner = 'account-a';
let mockRevision = 0;
let mockReduceMotion = false;
jest.mock('../../hooks/useReduceMotion', () => ({
  useReduceMotion: () => mockReduceMotion,
}));
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  Alert: { alert: jest.fn() },
  Linking: { openURL: jest.fn() },
}));
jest.mock('../../lib/supabase', () => ({ API_BASE_URL: 'https://fixture.test' }));
jest.mock('../../constants/api', () => ({ API_TIMEOUT: 25000 }));
jest.mock('../../stores/userStore', () => ({
  useUserStore: (select: (s: unknown) => unknown) =>
    select({ user: { id: mockOwner }, accountRevision: mockRevision }),
}));
jest.mock('../../lib/tripAccountScope', () => ({
  captureTripAccount: () => {
    const ownerId = mockOwner;
    const revision = mockRevision;
    const isCurrent = () => ownerId === mockOwner && revision === mockRevision;
    return {
      ownerId,
      isCurrent,
      assertCurrent: () => {
        if (!isCurrent()) throw new Error('Account changed');
      },
      headers: async () => ({ Authorization: `Bearer ${ownerId}` }),
    };
  },
}));
jest.mock('../../lib/offline', () => ({
  offlineStorage: { getPendingMutations: () => mockPending() },
  syncService: {
    subscribe: (listener: () => void) => {
      mockSyncListener = listener;
      return () => {};
    },
    resolveBlockedMutation: jest.fn(),
    sync: jest.fn(),
  },
}));
import { TripSyncConflicts } from '../../components/ui/TripSyncConflicts';

it.each(['unmount', 'account change', 'wrong trip', 'success'])(
  'comparison handles %s',
  async (scenario) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mockOwner = 'account-a';
    mockRevision = 0;
    mockPending.mockResolvedValue([
      {
        id: 'edit-a',
        ownerId: 'account-a',
        tripId: 'trip-a',
        type: 'update',
        data: { destination: 'Paris' },
        blockedReason: 'Review needed',
      },
    ]);
    let release!: (r: unknown) => void;
    const fetchMock = jest.fn(
      () =>
        new Promise((yes) => {
          release = yes;
        })
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<TripSyncConflicts />);
      });
      await act(async () => {
        renderer.root
          .findByProps({ accessibilityLabel: 'Review 1 unsynced change' })
          .props.onPress();
      });
      const load = renderer.root.findByProps({ accessibilityLabel: 'Load latest trip to compare' })
        .props.onPress;
      await act(async () => {
        load();
        load();
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      if (scenario === 'unmount')
        await act(async () => {
          renderer.unmount();
        });
      if (scenario === 'account change')
        await act(async () => {
          mockOwner = 'account-b';
          mockRevision++;
          mockPending.mockResolvedValue([]);
          renderer.update(<TripSyncConflicts />);
        });
      const body = jest.fn(async () => ({
        trip: {
          id: scenario === 'wrong trip' ? 'trip-other' : 'trip-a',
          user_id: 'account-a',
          updated_at: '2026-10-13T00:00:00Z',
          destination: 'Rome',
        },
      }));
      await act(async () => {
        release({ ok: true, json: body });
      });
      if (scenario === 'unmount' || scenario === 'account change')
        expect(body).not.toHaveBeenCalled();
      else if (scenario === 'wrong trip')
        expect(JSON.stringify(renderer.toJSON())).toContain('could not be verified');
      else expect(JSON.stringify(renderer.toJSON())).toContain('Rome');
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
      globalThis.fetch = originalFetch;
    }
  }
);

import { Alert } from 'react-native';
import { syncService } from '../../lib/offline';
it.each(['dismissed', 'account change', 'confirmed'])(
  'discard confirmation is scoped when %s',
  async (scenario) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    mockOwner = 'account-a';
    mockRevision = 0;
    const mutation = {
      id: 'edit-a',
      ownerId: 'account-a',
      tripId: 'trip-a',
      type: 'update',
      data: { destination: 'Paris' },
      blockedReason: 'Review needed',
    };
    mockPending.mockResolvedValue([mutation]);
    jest.mocked(syncService.resolveBlockedMutation).mockResolvedValue(undefined);
    jest
      .mocked(syncService.sync)
      .mockResolvedValue({ success: true, synced: 0, failed: 0, errors: [] });
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<TripSyncConflicts />);
      });
      await act(async () => {
        renderer.root
          .findByProps({ accessibilityLabel: 'Review 1 unsynced change' })
          .props.onPress();
      });
      await act(async () => {
        renderer.root
          .findByProps({ accessibilityLabel: 'Keep latest and discard these local edits' })
          .props.onPress();
      });
      const confirm = jest.mocked(Alert.alert).mock.calls[0][2]![1].onPress!;
      if (scenario === 'dismissed')
        await act(async () => {
          renderer.root
            .findByProps({ accessibilityLabel: 'Keep my edits for later' })
            .props.onPress();
        });
      if (scenario === 'account change')
        await act(async () => {
          mockOwner = 'account-b';
          mockRevision++;
          mockPending.mockResolvedValue([]);
          renderer.update(<TripSyncConflicts />);
        });
      await act(async () => {
        confirm();
        confirm();
      });
      if (scenario === 'confirmed') {
        expect(syncService.resolveBlockedMutation).toHaveBeenCalledTimes(1);
        expect(syncService.resolveBlockedMutation).toHaveBeenCalledWith(mutation, undefined);
      } else expect(syncService.resolveBlockedMutation).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
    }
  }
);

it('an older refresh cannot replace newer pending edits', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockOwner = 'account-a';
  mockRevision = 0;
  let release!: (r: unknown) => void;
  mockPending.mockReset().mockImplementationOnce(
    () =>
      new Promise((yes) => {
        release = yes;
      })
  );
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<TripSyncConflicts />);
    });
    mockPending.mockResolvedValue([
      { id: 'new-edit', ownerId: 'account-a', blockedReason: 'New review' },
    ]);
    await act(async () => {
      mockSyncListener();
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('Review 1 unsynced change');
    await act(async () => {
      release([]);
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('Review 1 unsynced change');
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
  }
});

it.each(['resolution failure', 'sync rejection', 'sync unsuccessful'])(
  'review reports %s honestly',
  async (scenario) => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    jest.clearAllMocks();
    mockOwner = 'account-a';
    mockRevision = 0;
    mockPending.mockReset().mockResolvedValue([
      {
        id: 'edit-a',
        ownerId: 'account-a',
        tripId: 'trip-a',
        type: 'update',
        data: { destination: 'Paris' },
        blockedReason: 'Review needed',
      },
    ]);
    jest
      .mocked(syncService.resolveBlockedMutation)
      .mockReset()
      .mockImplementation(async () => {
        if (scenario === 'resolution failure')
          throw new Error('Your edits are kept. Retry review.');
        mockPending.mockResolvedValue([]);
      });
    jest
      .mocked(syncService.sync)
      .mockReset()
      .mockImplementation(async () => {
        if (scenario === 'sync rejection') throw new Error('Offline');
        return {
          success: false,
          synced: 0,
          failed: 1,
          errors: [{ mutationId: 'edit-b', error: 'Offline' }],
        };
      });
    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(<TripSyncConflicts />);
      });
      await act(async () => {
        renderer.root
          .findByProps({ accessibilityLabel: 'Review 1 unsynced change' })
          .props.onPress();
      });
      await act(async () => {
        renderer.root
          .findByProps({ accessibilityLabel: 'Keep latest and discard these local edits' })
          .props.onPress();
      });
      await act(async () => {
        jest.mocked(Alert.alert).mock.calls[0][2]![1].onPress!();
      });
      expect(JSON.stringify(renderer.toJSON())).toContain(
        scenario === 'resolution failure'
          ? 'Your edits are kept. Retry review.'
          : 'Your review was saved. Remaining edits couldn’t sync'
      );
      if (scenario === 'resolution failure') expect(syncService.sync).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        renderer?.unmount();
      });
    }
  }
);

it('a stalled comparison times out and unlocks review actions', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockOwner = 'account-a';
  mockRevision = 0;
  mockPending.mockReset().mockResolvedValue([
    {
      id: 'edit-a',
      ownerId: 'account-a',
      tripId: 'trip-a',
      type: 'update',
      data: { destination: 'Paris' },
      blockedReason: 'Review needed',
    },
  ]);
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
  fetchMock.mockImplementation(() => new Promise(() => {}));
  globalThis.fetch = fetchMock as typeof fetch;
  jest.useFakeTimers();
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<TripSyncConflicts />);
    });
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'Review 1 unsynced change' }).props.onPress();
    });
    await act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: 'Load latest trip to compare' })
        .props.onPress();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(25_000);
    });
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).toContain('request timed out');
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Keep my edits for later' }).props.disabled
    ).toBe(false);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    jest.useRealTimers();
    globalThis.fetch = originalFetch;
  }
});

it('reapplies once against the exact reviewed revision and refreshes pending edits', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  jest.clearAllMocks();
  mockOwner = 'account-a';
  mockRevision = 0;
  const mutation = {
    id: 'edit-a',
    ownerId: 'account-a',
    tripId: 'trip-a',
    type: 'update',
    data: { destination: 'Paris' },
    blockedReason: 'Review needed',
  };
  mockPending.mockReset().mockResolvedValue([mutation]);
  jest
    .mocked(syncService.resolveBlockedMutation)
    .mockReset()
    .mockImplementation(async () => {
      mockPending.mockResolvedValue([]);
    });
  jest
    .mocked(syncService.sync)
    .mockReset()
    .mockResolvedValue({ success: true, synced: 0, failed: 0, errors: [] });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      trip: {
        id: 'trip-a',
        user_id: 'account-a',
        destination: 'Rome',
        updated_at: '2026-10-13T12:34:56Z',
        status: 'completed',
      },
    }),
  });
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<TripSyncConflicts />);
    });
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'Review 1 unsynced change' }).props.onPress();
    });
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Save my edits onto this version' }).props
        .disabled
    ).toBe(true);
    await act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: 'Load latest trip to compare' })
        .props.onPress();
    });
    expect(
      renderer.root.findByProps({ accessibilityLabel: 'Save my edits onto this version' }).props
        .disabled
    ).toBe(false);
    await act(async () => {
      renderer.root
        .findByProps({ accessibilityLabel: 'Save my edits onto this version' })
        .props.onPress();
    });
    const confirm = jest.mocked(Alert.alert).mock.calls[0][2]![1].onPress!;
    await act(async () => {
      confirm();
      confirm();
    });
    expect(syncService.resolveBlockedMutation).toHaveBeenCalledTimes(1);
    expect(syncService.resolveBlockedMutation).toHaveBeenCalledWith(
      mutation,
      '2026-10-13T12:34:56Z'
    );
    expect(syncService.sync).toHaveBeenCalledWith(true);
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Review 1 unsynced change');
    expect(renderer.root.findByType('Modal' as React.ElementType).props.visible).toBe(false);
  } finally {
    await act(async () => {
      renderer?.unmount();
    });
    globalThis.fetch = originalFetch;
  }
});

it.each([false, true])('conflict review honors reduced motion %s', async (reduced) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mockOwner = 'account-a';
  mockRevision = 0;
  mockReduceMotion = reduced;
  mockPending.mockResolvedValue([]);
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => {
      renderer = create(<TripSyncConflicts />);
    });
    expect(renderer.root.findByType('Modal' as React.ElementType).props.animationType).toBe(
      reduced ? 'none' : 'slide'
    );
  } finally {
    await act(async () => {
      renderer.unmount();
    });
    mockReduceMotion = false;
  }
});
