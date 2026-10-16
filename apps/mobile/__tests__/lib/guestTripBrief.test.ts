import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  discardReviewedGuestBrief,
  clearGuestTripBrief,
  readGuestTripBrief,
  saveGuestTripBrief,
} from '../../lib/guestTripBrief';
import type { TripInput } from '../../stores/tripStore';
const draft: TripInput = {
  destination: 'Tokyo',
  startDate: '2026-11-01',
  endDate: '2026-11-04',
  travelers: 2,
  travelerType: 'couple',
  vibes: ['culture'],
};
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});
test('restores validated dates and choices after memory loss', async () => {
  await saveGuestTripBrief(draft, () => true, 1000);
  expect(await readGuestTripBrief(2000)).toEqual(draft);
});
test.each([0, 24 * 60 * 60 * 1000 + 1001])(
  'does not restore future/expired records at %i',
  async (now) => {
    await saveGuestTripBrief(draft, () => true, 1000);
    expect(await readGuestTripBrief(now)).toBeNull();
  }
);
test('queued write skips a changed account and clear wins over older writes', async () => {
  const save = saveGuestTripBrief(draft, () => false, 1000);
  await save;
  expect(await readGuestTripBrief(2000)).toBeNull();
  await Promise.all([saveGuestTripBrief(draft, () => true, 1000), clearGuestTripBrief()]);
  expect(await readGuestTripBrief(2000)).toBeNull();
});
test('malformed storage is retained and reported for deliberate recovery', async () => {
  await AsyncStorage.setItem('faroway:guest-trip-brief:v1', '{broken');
  await expect(readGuestTripBrief()).rejects.toThrow();
  expect(await AsyncStorage.getItem('faroway:guest-trip-brief:v1')).toBe('{broken');
});
test('snapshot strips unrelated credentials before writing', async () => {
  await saveGuestTripBrief(
    { ...draft, accessToken: 'synthetic-token' } as TripInput,
    () => true,
    1000
  );
  expect(await AsyncStorage.getItem('faroway:guest-trip-brief:v1')).not.toContain('accessToken');
});

test('deliberate discard cannot erase a changed record', async () => {
  await AsyncStorage.setItem('faroway:guest-trip-brief:v1', '{old');
  await saveGuestTripBrief(draft, () => true, 1000);
  await expect(discardReviewedGuestBrief('{old', () => true)).rejects.toThrow('changed');
  expect(await readGuestTripBrief(2000)).toEqual(draft);
});
test('deliberate discard refuses a changed actor and clears only the reviewed corruption', async () => {
  await AsyncStorage.setItem('faroway:guest-trip-brief:v1', '{bad');
  expect(await discardReviewedGuestBrief('{bad', () => false)).toBe(false);
  expect(await AsyncStorage.getItem('faroway:guest-trip-brief:v1')).toBe('{bad');
  expect(await discardReviewedGuestBrief('{bad', () => true)).toBe(true);
  expect(await readGuestTripBrief(2000)).toBeNull();
});
