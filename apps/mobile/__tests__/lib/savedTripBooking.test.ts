const mockAlert = jest.fn();
jest.mock('react-native', () => ({ Alert: { alert: mockAlert } }));
jest.mock('../../constants/api', () => ({ API_BASE_URL: 'https://staging.faroway.ai' }));
import { reviewSavedTripBooking, savedTripReviewUrl } from '../../lib/savedTripBooking';

const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => jest.clearAllMocks());

it('builds only the configured saved trip URL and rejects missing or injected identities', () => {
  expect(savedTripReviewUrl(id)).toBe(`https://staging.faroway.ai/trips/${id}`);
  for (const invalid of [
    undefined,
    '../escape',
    'https://viator.com/product',
    `${id}?token=secret`,
  ]) {
    expect(savedTripReviewUrl(invalid)).toBeNull();
  }
});

it('requires consent and never opens a preview URL', () => {
  const open = jest.fn().mockResolvedValue(undefined);
  reviewSavedTripBooking(undefined, open);
  expect(open).not.toHaveBeenCalled();
  expect(mockAlert.mock.calls[0][0]).toBe('Booking preview');
  reviewSavedTripBooking(id, open);
  expect(open).not.toHaveBeenCalled();
  mockAlert.mock.calls[1][2][1].onPress();
  expect(open).toHaveBeenCalledWith(`https://staging.faroway.ai/trips/${id}`);
});

it('keeps failed navigation recoverable without falling back to a provider', async () => {
  const open = jest.fn().mockRejectedValue(new Error('cancelled'));
  reviewSavedTripBooking(id, open);
  mockAlert.mock.calls[0][2][1].onPress();
  await Promise.resolve();
  expect(open).toHaveBeenCalledTimes(1);
  expect(mockAlert).toHaveBeenLastCalledWith(
    'Couldn’t open your trip',
    expect.stringContaining('still saved')
  );
});
