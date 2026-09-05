import { buildTripUpdatePayload } from '../../services/tripPayload';

describe('trip update wire contract', () => {
  it('preserves canonical dates/status and prefers canonical fields when aliases conflict', () => {
    expect(
      buildTripUpdatePayload({
        start_date: '2026-12-01',
        startDate: '2026-11-01',
        end_date: '2026-12-07',
        endDate: '2026-11-07',
        budget_tier: 'luxury',
        budget: 'moderate',
        status: 'draft',
      })
    ).toEqual({
      start_date: '2026-12-01',
      end_date: '2026-12-07',
      budget_tier: 'luxury',
      status: 'draft',
      preferences: { budget: 'luxury' },
    });
  });

  it('retains nested preferences while applying top-level mobile edits without mutating inputs', () => {
    const preferences = Object.freeze({ originAirport: 'LAX', travelerType: 'solo', custom: true });
    expect(
      buildTripUpdatePayload({ preferences, travelerType: 'couple', originCity: 'Chicago' })
    ).toEqual({
      preferences: {
        originAirport: 'LAX',
        travelerType: 'couple',
        originCity: 'Chicago',
        custom: true,
      },
    });
    expect(preferences.travelerType).toBe('solo');
  });

  it('does not invent omitted fields or drop explicit empty values', () => {
    expect(buildTripUpdatePayload({ destination: 'Tokyo', vibes: [], originCity: '' })).toEqual({
      destination: 'Tokyo',
      vibes: [],
      preferences: { originCity: '' },
    });
    expect(buildTripUpdatePayload({ startDate: '2026-12-01' })).toEqual({
      start_date: '2026-12-01',
    });
  });
});
