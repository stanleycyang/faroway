let mockCurrent = true;
const mockShare = jest.fn();
const mockRevoke = jest.fn();
jest.mock('../../services/api', () => ({
  shareTrip: (...args: unknown[]) => mockShare(...args),
  revokeTripShare: (...args: unknown[]) => mockRevoke(...args),
}));
jest.mock('../../lib/tripAccountScope', () => ({
  captureTripAccount: () => ({
    headers: async () => ({ Authorization: 'Bearer fresh-account-a' }),
    assertCurrent: () => {
      if (!mockCurrent) throw new Error('Account changed');
    },
  }),
}));
import { shareOwnedTrip, revokeOwnedTripShare } from '../../lib/tripSharing';
beforeEach(() => {
  mockCurrent = true;
  jest.clearAllMocks();
});
it('pins fresh authentication and returns a verified public link', async () => {
  mockShare.mockResolvedValue({
    data: { shareUrl: 'https://example.test/s/token-a', shareToken: 'token-a' },
  });
  await expect(shareOwnedTrip('trip-a')).resolves.toBe('https://example.test/s/token-a');
  expect(mockShare).toHaveBeenCalledWith('trip-a', 'fresh-account-a');
});
it('rejects a mismatched public link', async () => {
  mockShare.mockResolvedValue({
    data: { shareUrl: 'https://example.test/s/other', shareToken: 'token-a' },
  });
  await expect(shareOwnedTrip('trip-a')).rejects.toThrow('could not be confirmed');
});
it('ignores a response after an account change', async () => {
  mockShare.mockImplementation(async () => {
    mockCurrent = false;
    return { data: { shareUrl: 'https://example.test/s/token-a', shareToken: 'token-a' } };
  });
  await expect(shareOwnedTrip('trip-a')).rejects.toThrow('Account changed');
});
it.each([true, false])('requires explicit revocation confirmation: %s', async (success) => {
  mockRevoke.mockResolvedValue({ data: { success } });
  if (success) await expect(revokeOwnedTripShare('trip-a')).resolves.toBeUndefined();
  else await expect(revokeOwnedTripShare('trip-a')).rejects.toThrow('could not be confirmed off');
  expect(mockRevoke).toHaveBeenCalledWith('trip-a', 'fresh-account-a');
});
