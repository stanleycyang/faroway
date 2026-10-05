jest.mock('../../../lib/supabase', () => ({
  API_BASE_URL: 'https://fixture.invalid',
  getAuthHeaders: jest.fn(async () => ({ Authorization: 'fixture' })),
}));
jest.mock('../../../constants/api', () => ({ API_BASE_URL: 'https://staging.faroway.ai' }));
jest.mock('../../../lib/offline/network', () => ({ networkMonitor: { isOnline: () => true } }));
import { offlineStorage } from '../../../lib/offline/storage';
import { syncService } from '../../../lib/offline/sync';
import {
  conflictRows,
  supportsConflictReapply,
  tripWebUrl,
} from '../../../lib/offline/conflict-review';

const fetchMock = jest.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;
beforeEach(async () => {
  await syncService.clearAll();
  fetchMock.mockReset();
});
async function blocked() {
  const mutation = await offlineStorage.addPendingMutation({
    type: 'update',
    tripId: 'trip-1',
    data: { destination: 'Rome', expectedUpdatedAt: 'old' },
  });
  await offlineStorage.blockPendingMutation(mutation.id, 'Another device changed this trip.');
  return (await offlineStorage.getPendingMutations())[0];
}

it('compares only pending edits and omits internal revision values', async () => {
  const mutation = await blocked();
  expect(conflictRows(mutation, { destination: 'Paris' })).toEqual([
    { label: 'Destination', yours: 'Rome', latest: 'Paris' },
  ]);
  expect(supportsConflictReapply(mutation)).toBe(true);
  expect(supportsConflictReapply({ ...mutation, data: { status: 'draft' } })).toBe(false);
  expect(tripWebUrl('11111111-1111-4111-8111-111111111111')).toBe(
    'https://staging.faroway.ai/trips/11111111-1111-4111-8111-111111111111'
  );
  expect(tripWebUrl('trip-1')).toBeNull();
});
it('saves only after explicit review with the observed server revision', async () => {
  const mutation = await blocked();
  fetchMock.mockResolvedValue({ ok: true });
  await syncService.resolveBlockedMutation(mutation, 'reviewed-version');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
    destination: 'Rome',
    expectedUpdatedAt: 'reviewed-version',
  });
  expect(await offlineStorage.getPendingMutations()).toEqual([]);
});
it('preserves edits when the reviewed server version changes again', async () => {
  const mutation = await blocked();
  fetchMock.mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({ error: 'Trip changed again' }),
  });
  await expect(syncService.resolveBlockedMutation(mutation, 'reviewed-version')).rejects.toThrow(
    'Trip changed again'
  );
  expect(await offlineStorage.getPendingMutations()).toEqual([mutation]);
});
it('keeps pending edits when a save reply is interrupted', async () => {
  const mutation = await blocked();
  fetchMock.mockRejectedValue(new Error('Network interrupted'));
  await expect(syncService.resolveBlockedMutation(mutation, 'reviewed-version')).rejects.toThrow();
  expect(await offlineStorage.getPendingMutations()).toEqual([mutation]);
});
it('rejects an outdated local review without a network write', async () => {
  const mutation = await blocked();
  await offlineStorage.addPendingMutation({
    type: 'update',
    tripId: mutation.tripId,
    data: { destination: 'Lisbon' },
  });
  await expect(syncService.resolveBlockedMutation(mutation, 'reviewed-version')).rejects.toThrow(
    'local changes changed'
  );
  expect(fetchMock).not.toHaveBeenCalled();
  expect((await offlineStorage.getPendingMutations())[0].data?.destination).toBe('Lisbon');
});
it('discards only the selected edits and leaves the server untouched', async () => {
  const mutation = await blocked();
  await offlineStorage.addPendingMutation({
    type: 'update',
    tripId: 'trip-2',
    data: { destination: 'Kyoto' },
  });
  await syncService.resolveBlockedMutation(mutation);
  expect(fetchMock).not.toHaveBeenCalled();
  expect((await offlineStorage.getPendingMutations()).map((m) => m.tripId)).toEqual(['trip-2']);
});
