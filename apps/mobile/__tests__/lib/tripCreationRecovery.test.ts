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
