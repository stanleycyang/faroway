jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '11111111-1111-4111-8111-111111111111'),
}));
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  pendingTripCreation,
  finishTripCreation,
  discardTripCreation,
  savedTripCreationDraft,
} from '../../lib/tripCreationRecovery';
beforeEach(async () => {
  await AsyncStorage.clear();
});
it('persists one request identity across concurrent calls and screen restart', async () => {
  const values = await Promise.all([
    pendingTripCreation('a', '{}'),
    pendingTripCreation('a', '{}'),
  ]);
  expect(values[0].requestId).toBe(values[1].requestId);
  expect(await pendingTripCreation('a', '{}')).toEqual(values[0]);
});
it('keeps a lost response identity until a confirmed finish or deliberate new trip', async () => {
  const saved = await pendingTripCreation('a', '{}');
  await expect(pendingTripCreation('a', '{"destination":"Tokyo"}')).rejects.toThrow('unfinished');
  await finishTripCreation('a', 'another-request');
  expect(await pendingTripCreation('a', '{}')).toEqual(saved);
  await discardTripCreation('a');
  await expect(pendingTripCreation('a', '{"destination":"Tokyo"}')).resolves.toMatchObject({
    body: '{"destination":"Tokyo"}',
  });
});
it('isolates accounts and refuses to overwrite corrupt recovery data', async () => {
  await pendingTripCreation('a', '{}');
  await expect(pendingTripCreation('b', '{"destination":"Tokyo"}')).resolves.toBeDefined();
  await AsyncStorage.setItem('faroway:pending-create:c', 'broken');
  await expect(pendingTripCreation('c', '{}')).rejects.toThrow();
  expect(await AsyncStorage.getItem('faroway:pending-create:c')).toBe('broken');
});

it('restores the original planner choices without changing the pending identity', async () => {
  const body = JSON.stringify({
    destination: 'Tokyo',
    start_date: '2099-06-01',
    end_date: '2099-06-04',
    travelers: 2,
    budget: 'moderate',
    preferences: { travelerType: 'couple', originCity: 'Paris', vibes: ['food'] },
  });
  const receipt = await pendingTripCreation('a', body);
  expect(await savedTripCreationDraft('a')).toMatchObject({
    destination: 'Tokyo',
    startDate: '2099-06-01',
    endDate: '2099-06-04',
    travelers: 2,
    budget: 'moderate',
    travelerType: 'couple',
    originCity: 'Paris',
    vibes: ['food'],
  });
  expect(await pendingTripCreation('a', body)).toEqual(receipt);
  expect(await savedTripCreationDraft('b')).toBeNull();
});

it.each([
  { start_date: '2099-02-30' },
  { end_date: '2099-05-01' },
  { travelers: 1.5 },
  { budget: 'invalid' },
  { preferences: { travelerType: 'invalid' } },
  { preferences: { vibes: ['x'.repeat(51)] } },
])('malformed saved choices stay untouched for explicit recovery: %j', async (invalid) => {
  const body = JSON.stringify({
    destination: 'Tokyo',
    start_date: '2099-06-01',
    end_date: '2099-06-04',
    travelers: 2,
    preferences: { travelerType: 'couple', vibes: ['food'] },
    ...invalid,
  });
  await pendingTripCreation('a', body);
  const before = await AsyncStorage.getItem('faroway:pending-create:a');
  await expect(savedTripCreationDraft('a')).rejects.toThrow();
  expect(await AsyncStorage.getItem('faroway:pending-create:a')).toBe(before);
});
it('a malformed request identity is not offered for restoration or erased', async () => {
  const raw = JSON.stringify({ version: 1, requestId: 'wrong', body: '{}' });
  await AsyncStorage.setItem('faroway:pending-create:a', raw);
  await expect(savedTripCreationDraft('a')).rejects.toThrow('could not be read');
  expect(await AsyncStorage.getItem('faroway:pending-create:a')).toBe(raw);
});

import {
  readTripCreationReceipt,
  discardReviewedTripCreation,
} from '../../lib/tripCreationRecovery';
it('stale reviewed discard preserves a replacement receipt', async () => {
  await pendingTripCreation('a', '{}');
  const reviewed = await readTripCreationReceipt('a');
  const replacement = JSON.stringify({
    version: 1,
    requestId: '22222222-2222-4222-8222-222222222222',
    body: '{"destination":"Paris"}',
  });
  await AsyncStorage.setItem('faroway:pending-create:a', replacement);
  await expect(discardReviewedTripCreation('a', reviewed)).rejects.toThrow('pending trip changed');
  expect(await AsyncStorage.getItem('faroway:pending-create:a')).toBe(replacement);
});
it('reviewed discard removes only the matching receipt and accepts unchanged empty storage', async () => {
  await pendingTripCreation('a', '{}');
  await discardReviewedTripCreation('a', await readTripCreationReceipt('a'));
  expect(await readTripCreationReceipt('a')).toBeNull();
  await expect(discardReviewedTripCreation('a', null)).resolves.toBeUndefined();
});
