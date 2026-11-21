import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearTravelerMemory,
  extractMemoryFromDraft,
  hasTravelerMemoryContent,
  loadTravelerMemory,
  mergeTravelerMemoryIntoDraft,
  saveTravelerMemory,
  summarizeTravelerMemory,
} from '../../lib/travelerMemory';

describe('travelerMemory', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('scopes saved defaults by userId and supports transparent edit & clear', async () => {
    const savedA = await saveTravelerMemory('user-a', {
      homeAirport: 'sfo',
      defaultBudget: 'luxury',
      defaultVibes: ['foodie', 'cultural', 'not-a-real-vibe'],
      avoidEarlyStarts: true,
      requirements: {
        allergies: ['Peanuts'],
        dietaryPreferences: ['Vegetarian'],
        accessibility: ['step_free_entrance'],
        mobilityNotes: 'Midday rest',
      },
    });

    expect(savedA?.homeAirport).toBe('SFO');
    expect(savedA?.defaultVibes).toEqual(['foodie', 'culture']);
    expect(hasTravelerMemoryContent(savedA)).toBe(true);

    // User B does not see User A's defaults
    expect(await loadTravelerMemory('user-b')).toBeNull();

    // User A loads cleanly and summarizes transparently
    const loadedA = await loadTravelerMemory('user-a');
    expect(loadedA?.defaultBudget).toBe('luxury');
    expect(summarizeTravelerMemory(loadedA)).toEqual(
      expect.arrayContaining([
        'Home airport: SFO',
        'Budget: Luxury',
        'Relaxed mornings',
        'Allergies: Peanuts',
      ])
    );

    const cappedAirport = await saveTravelerMemory('user-d', { homeAirport: 'sfo-intl-123' });
    expect(cappedAirport?.homeAirport).toBe('SFO-INTL-1');

    // Clearing removes only User A's memory
    await clearTravelerMemory('user-a');
    expect(await loadTravelerMemory('user-a')).toBeNull();
  });

  it('handles corrupted AsyncStorage payloads safely without throwing', async () => {
    await AsyncStorage.setItem('@faroway/traveler_memory:v1:user-c', '{bad json');
    expect(await loadTravelerMemory('user-c')).toBeNull();
  });

  it('merges defaults into empty draft fields without clobbering explicit link params or existing choices', () => {
    const memory = {
      homeAirport: 'JFK',
      defaultBudget: 'moderate' as const,
      defaultTravelerType: 'solo' as const,
      defaultVibes: ['foodie', 'culture'],
      avoidEarlyStarts: true,
      requirements: {
        allergies: ['Shellfish'],
        dietaryPreferences: [],
        accessibility: [],
        mobilityNotes: '',
      },
      updatedAt: '2026-10-01T00:00:00.000Z',
    };

    const mergedFresh = mergeTravelerMemoryIntoDraft(
      {
        destination: '',
        startDate: '',
        endDate: '',
        travelers: 2,
        travelerType: 'couple',
        vibes: [],
      },
      memory
    );
    expect(mergedFresh.originAirport).toBe('JFK');
    expect(mergedFresh.budget).toBe('moderate');
    expect(mergedFresh.travelerType).toBe('solo');
    expect(mergedFresh.vibes).toEqual(['foodie', 'culture']);
    expect(mergedFresh.requirements?.allergies).toEqual(['Shellfish']);
    expect(mergedFresh.requirements?.mobilityNotes).toContain('relaxed mornings');

    // Existing explicit draft choices and URL fields must never be clobbered
    const mergedExplicit = mergeTravelerMemoryIntoDraft(
      {
        destination: 'Paris',
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        travelers: 4,
        travelerType: 'family',
        budget: 'luxury',
        vibes: ['adventure'],
      },
      memory,
      new Set(['vibes', 'travelerType'])
    );
    expect(mergedExplicit.budget).toBeUndefined();
    expect(mergedExplicit.travelerType).toBeUndefined();
    expect(mergedExplicit.vibes).toBeUndefined();
    expect(mergedExplicit.originAirport).toBe('JFK');
  });

  it('extracts saveable memory from a create draft', () => {
    const extracted = extractMemoryFromDraft({
      destination: 'Kyoto',
      startDate: '2026-10-10',
      endDate: '2026-10-14',
      travelers: 2,
      travelerType: 'couple',
      budget: 'moderate',
      originAirport: 'LAX',
      vibes: ['foodie', 'culture'],
      requirements: {
        allergies: [],
        dietaryPreferences: ['Vegan'],
        accessibility: [],
        mobilityNotes: 'Prefer relaxed mornings',
      },
    });

    expect(extracted.homeAirport).toBe('LAX');
    expect(extracted.defaultBudget).toBe('moderate');
    expect(extracted.avoidEarlyStarts).toBe(true);
    expect(extracted.requirements?.dietaryPreferences).toEqual(['Vegan']);
  });
});
