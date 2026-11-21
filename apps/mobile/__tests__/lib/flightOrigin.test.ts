import {
  buildDestinationStaticMapUrl,
  isValidIataAirportCode,
  normalizeOriginAirport,
  normalizeOriginCity,
  resolveFlightSearchPreferences,
} from '../../lib/flightOrigin';

describe('flightOrigin', () => {
  it('normalizes city and airport codes cleanly', () => {
    expect(normalizeOriginCity('  San Francisco  ')).toBe('San Francisco');
    expect(normalizeOriginCity('   ')).toBeUndefined();
    expect(normalizeOriginAirport('  sfo  ')).toBe('SFO');
    expect(normalizeOriginAirport('ab1234567890')).toBe('AB12345678');
    expect(isValidIataAirportCode('sfo')).toBe(true);
    expect(isValidIataAirportCode('SF')).toBe(false);
    expect(isValidIataAirportCode('SF1')).toBe(false);
  });

  it('builds validBriefComposition-compatible flightSearch payload when flightConsent is true', () => {
    expect(
      resolveFlightSearchPreferences({
        travelers: 3,
        originCity: 'San Francisco',
        originAirport: 'sfo',
        flightConsent: true,
      })
    ).toEqual({
      originCity: 'San Francisco',
      originAirport: 'SFO',
      adults: 3,
      children: 0,
      flightSearch: {
        consentVersion: 'flight-search-duffel-v1',
        childAges: [],
      },
    });
  });

  it('sends flightSearch: null when flightConsent is explicitly false', () => {
    expect(
      resolveFlightSearchPreferences({
        travelers: 2,
        originCity: 'New York',
        flightConsent: false,
      })
    ).toEqual({
      originCity: 'New York',
      flightSearch: null,
    });
  });

  it('builds a light warm-paper and ocean-teal static map URL without dark indigo', () => {
    expect(buildDestinationStaticMapUrl('Paris', 'France')).toBeNull();
    const url = buildDestinationStaticMapUrl('Paris', 'France', 'test-key');
    expect(url).toContain('markers=color:0xC03A31|');
    expect(url).toContain('color:0xFAF8F3');
    expect(url).toContain('color:0xCFE6E8');
    expect(url).toContain('color:0x143D46');
    expect(url).not.toContain('0x242f3e');
    expect(url).not.toContain('0x6366f1');
  });
});
