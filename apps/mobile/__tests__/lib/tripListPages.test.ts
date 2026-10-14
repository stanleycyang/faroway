jest.mock('../../lib/tripAccountScope', () => ({
  TripAccessError: class extends Error {},
  TripAccountChangedError: class extends Error {},
}));
import { readOwnedTripPages } from '../../lib/tripListPages';
const row = (id: number) => ({ id: String(id), user_id: 'owner' });
const reply = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 503, json: async () => body }) as Response;
it('reads every page before returning the complete owner-bound list', async () => {
  const read = jest
    .fn()
    .mockResolvedValueOnce(
      reply({ trips: Array.from({ length: 100 }, (_, i) => row(i)), nextCursor: 'page-two' })
    )
    .mockResolvedValueOnce(reply({ trips: [row(100), row(101)], nextCursor: null }));
  expect(await readOwnedTripPages('owner', read, jest.fn())).toHaveLength(102);
  expect(read.mock.calls.map(([cursor]) => cursor)).toEqual([null, 'page-two']);
});
it('rejects later-page failures instead of returning a partial list', async () => {
  const read = jest
    .fn()
    .mockResolvedValueOnce(reply({ trips: [row(1)], nextCursor: 'next' }))
    .mockResolvedValueOnce(reply({}, false));
  await expect(readOwnedTripPages('owner', read, jest.fn())).rejects.toThrow(
    'Failed to fetch trips'
  );
});
it.each([
  { trips: [{ id: '2', user_id: 'other' }], nextCursor: null },
  { trips: [row(1)], nextCursor: null },
  { trips: [row(2)], nextCursor: 'next' },
  { trips: [], nextCursor: 'different' },
  { trips: [row(2)], nextCursor: 42 },
])('rejects wrong owners, repeated rows/cursors and malformed continuations', async (later) => {
  const read = jest
    .fn()
    .mockResolvedValueOnce(reply({ trips: [row(1)], nextCursor: 'next' }))
    .mockResolvedValueOnce(reply(later));
  await expect(readOwnedTripPages('owner', read, jest.fn())).rejects.toThrow();
});
it('stops pagination when the captured account changes', async () => {
  const assertCurrent = jest
    .fn()
    .mockImplementationOnce(() => {})
    .mockImplementationOnce(() => {
      throw Error('Account changed');
    });
  const read = jest.fn().mockResolvedValue(reply({ trips: [row(1)], nextCursor: 'next' }));
  await expect(readOwnedTripPages('owner', read, assertCurrent)).rejects.toThrow('Account changed');
  expect(read).toHaveBeenCalledTimes(1);
});
