jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: {} },
}));

jest.mock('../../constants/api', () => ({
  API_BASE_URL: 'https://fixture.test',
  API_TIMEOUT: 5000,
}));

jest.mock('../../lib/supabase', () => ({
  __esModule: true,
  getAuthHeaders: jest.fn(async () => ({ Authorization: 'Bearer test-token' })),
}));

import {
  parseDreamTripPrompt,
  parseDreamTripPromptLocal,
  suggestDestinations,
  suggestDestinationsLocal,
} from '../../lib/promptParser';

describe('promptParser', () => {
  const fixedNow = new Date(2026, 4, 1, 10, 0, 0); // May 1, 2026

  it('parses destination, dates, travelers, comfort tier, vibes, and dietary/access notes locally', () => {
    const result = parseDreamTripPromptLocal(
      '5 days in Kyoto in October for our anniversary, luxury foodie & temples, vegetarian with peanut allergy, relaxed mornings and step-free access',
      fixedNow
    );

    expect(result.destination).toBe('Kyoto');
    expect(result.country).toBe('Japan');
    expect(result.days).toBe(5);
    expect(result.startDate).toBe('2026-10-10');
    expect(result.endDate).toBe('2026-10-14');
    expect(result.travelers).toBe(2);
    expect(result.travelerType).toBe('couple');
    expect(result.budget).toBe('luxury');
    expect(result.vibes).toEqual(expect.arrayContaining(['foodie', 'culture', 'romantic']));
    expect(result.vibes.length).toBeLessThanOrEqual(5);
    expect(result.requirements?.dietaryPreferences).toContain('Vegetarian');
    expect(result.requirements?.allergies).toContain('Peanut');
    expect(result.requirements?.accessibility).toContain('step_free_entrance');
    expect(result.requirements?.mobilityNotes).toContain('relaxed mornings');
    expect(result.source).toBe('local');
  });

  it('handles explicit month-day date ranges and family counts', () => {
    const result = parseDreamTripPromptLocal(
      'May 10-15 in Barcelona, family of 4, budget-friendly beach trip, allergic to shellfish',
      fixedNow
    );

    expect(result.destination).toBe('Barcelona');
    expect(result.country).toBe('Spain');
    expect(result.startDate).toBe('2026-05-10');
    expect(result.endDate).toBe('2026-05-15');
    expect(result.days).toBe(6);
    expect(result.travelers).toBe(4);
    expect(result.travelerType).toBe('family');
    expect(result.budget).toBe('budget');
    expect(result.requirements?.allergies).toContain('Shellfish');
  });

  it('resolves aliases like NYC and solo travelers cleanly', () => {
    const result = parseDreamTripPromptLocal(
      'Solo long weekend in NYC for museums and jazz bars',
      fixedNow
    );

    expect(result.destination).toBe('New York');
    expect(result.country).toBe('USA');
    expect(result.travelers).toBe(1);
    expect(result.travelerType).toBe('solo');
    expect(result.days).toBe(3);
    expect(result.vibes).toEqual(expect.arrayContaining(['culture', 'nightlife']));
  });

  it('returns an empty summary for blank prompts', () => {
    const result = parseDreamTripPromptLocal('   ', fixedNow);
    expect(result.destination).toBeUndefined();
    expect(result.vibes).toEqual([]);
    expect(result.summary).toEqual([]);
  });

  it('merges valid backend API responses and falls back to local parser on network failure', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        parsed: {
          destination: 'Lisbon',
          country: 'Portugal',
          startDate: '2026-09-12',
          endDate: '2026-09-16',
          travelers: 2,
          travelerType: 'couple',
          budget: 'moderate',
          vibes: ['foodie', 'culture', 'invalid_vibe_should_be_dropped'],
        },
      }),
    })) as unknown as typeof fetch;

    const apiResult = await parseDreamTripPrompt('4 days in Lisbon', { now: fixedNow });
    expect(apiResult.source).toBe('api');
    expect(apiResult.destination).toBe('Lisbon');
    expect(apiResult.vibes).toEqual(['foodie', 'culture']);

    global.fetch = jest.fn(async () => {
      throw new Error('Network offline');
    }) as unknown as typeof fetch;

    const fallback = await parseDreamTripPrompt('4 days in Tokyo, foodie', { now: fixedNow });
    expect(fallback.source).toBe('local');
    expect(fallback.destination).toBe('Tokyo');
    expect(fallback.vibes).toContain('foodie');
  });

  it('returns 3 tailored destination suggestions locally and falls back cleanly on API error', async () => {
    const warmBeach = suggestDestinationsLocal({
      query: 'Warm tropical beach wellness escape in January on a budget',
      month: 'January',
      budget: 'budget',
    });

    expect(warmBeach).toHaveLength(3);
    expect(warmBeach.every((s) => s.destination && s.country && s.whyItFits && s.seasonNote)).toBe(
      true
    );
    expect(
      warmBeach.some((s) => ['Phuket', 'Bali', 'Bangkok', 'Cancun'].includes(s.destination))
    ).toBe(true);

    global.fetch = jest.fn(async () => ({ ok: false, status: 503 })) as unknown as typeof fetch;
    const fallback = await suggestDestinations({ query: 'Alpine hiking mountains in July' });
    expect(fallback).toHaveLength(3);
    expect(
      fallback.some((s) =>
        ['Interlaken', 'Chamonix', 'Reykjavik', 'Queenstown'].includes(s.destination)
      )
    ).toBe(true);
  });
});
