jest.mock('../../lib/planningConsent', () => ({
  withPlanningConsent: jest.fn(),
}));

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
  applyLocalTripRemix,
  buildAppleMapsDayRouteUrl,
  buildGoogleMapsDayRouteUrl,
  buildStopDirectionsUrl,
  computeBookingReadiness,
  detectUpNextStop,
  explainMobileStop,
  formatTaxiDriverCard,
  runTripCopilotAction,
  shiftDaySchedule,
  summarizeDayRoute,
} from '../../lib/tripCompanion';
import { mergeAgentDiscoveries } from '../../hooks/useStreamingItinerary';
import type { Activity, TripDay } from '../../lib/itineraryTypes';
import type { Trip } from '../../lib/tripTypes';

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'act-1',
  time: 'morning',
  scheduleSlot: 'morning',
  title: 'Senso-ji Temple',
  description: 'Historic Buddhist temple and garden walk in Asakusa',
  location: 'Asakusa',
  venueAddress: '2-3-1 Asakusa, Taito City, Tokyo 111-0032',
  duration: '2 hours',
  type: 'attraction',
  rating: 4.7,
  ...overrides,
});

const makeTrip = (overrides: Partial<Trip> = {}): Trip => ({
  id: 'trip-1',
  destination: 'Tokyo',
  country: 'Japan',
  startDate: '2026-10-10',
  endDate: '2026-10-12',
  travelers: 2,
  travelerType: 'couple',
  vibes: ['culture', 'foodie'],
  days: [
    {
      dayNumber: 1,
      date: '2026-10-10',
      theme: 'Asakusa & Ueno',
      activities: [
        makeActivity({
          id: 'a1',
          title: 'Senso-ji Temple',
          scheduleSlot: 'morning',
          time: 'morning',
        }),
        makeActivity({
          id: 'a2',
          title: 'Asakusa Ramen Bar',
          description: 'Classic shoyu ramen lunch spot',
          type: 'restaurant',
          scheduleSlot: 'afternoon',
          time: 'lunch',
          rating: 4.6,
          bookingUrl: 'https://example.test/book',
        }),
        makeActivity({
          id: 'a3',
          title: 'Ueno Park & National Museum',
          description: 'Museum and park stroll in the afternoon',
          location: 'Ueno',
          venueAddress: undefined,
          scheduleSlot: 'afternoon',
          time: 'afternoon',
          rating: 4.5,
        }),
      ],
    },
  ],
  coverImage: 'https://example.test/tokyo.jpg',
  createdAt: '2026-09-01T00:00:00.000Z',
  status: 'planned',
  ...overrides,
});

describe('tripCompanion', () => {
  it('detects active-day Up Next stop and applies schedule shifts cleanly', () => {
    const trip = makeTrip();
    const duringTripMorning = new Date(2026, 9, 10, 9, 15, 0); // Oct 10, 2026 9:15 AM
    const upNext = detectUpNextStop(trip, duringTripMorning, 0);

    expect(upNext.isActiveTrip).toBe(true);
    expect(upNext.dayNumber).toBe(1);
    expect(upNext.nextStop?.title).toBe('Senso-ji Temple');
    expect(upNext.followingStop?.title).toBe('Asakusa Ramen Bar');

    // Shifting +60m updates scheduled labels without mutating the original day
    const shifted = shiftDaySchedule(trip.days[0], 60);
    expect(shifted.offsetMinutes).toBe(60);
    expect(shifted.labelsByActivityId['a1']).toBe('10:30 AM');
    expect(shifted.bannerText).toContain('+60 min');
    expect(trip.days[0].activities[0].time).toBe('morning');

    // Non-active date returns isActiveTrip: false
    const beforeTrip = new Date(2026, 8, 1, 10, 0, 0);
    expect(detectUpNextStop(trip, beforeTrip).isActiveTrip).toBe(false);
  });

  it('formats high-contrast taxi driver cards with localized phrase and honest address precision', () => {
    const withAddress = formatTaxiDriverCard(makeActivity(), 'Tokyo', 'Japan');
    expect(withAddress.driverPhrase).toContain('ここまでお願いします');
    expect(withAddress.hasExactAddress).toBe(true);
    expect(withAddress.addressLine).toContain('2-3-1 Asakusa');

    const areaOnly = formatTaxiDriverCard(
      makeActivity({ venueAddress: undefined, location: 'Shibuya' }),
      'Tokyo',
      'Japan'
    );
    expect(areaOnly.hasExactAddress).toBe(false);
    expect(areaOnly.addressLine).toBe('Shibuya');
    expect(areaOnly.englishSubtitle).toContain('Area name shown');
  });

  it('builds safely encoded multi-stop Google & Apple Maps URLs and skips planning ideas', () => {
    const day = makeTrip().days[0];
    const googleUrl = buildGoogleMapsDayRouteUrl(day, 'Tokyo', 'Japan');
    const appleUrl = buildAppleMapsDayRouteUrl(day, 'Tokyo', 'Japan');

    expect(googleUrl).toContain('https://www.google.com/maps/dir/?api=1');
    expect(googleUrl).toContain('travelmode=walking');
    expect(googleUrl).toContain('waypoints=');
    expect(appleUrl).toContain('https://maps.apple.com/?saddr=');
    expect(appleUrl).toContain('+to:');

    expect(buildStopDirectionsUrl(day.activities[0], 'Tokyo', 'Japan', 'ios')).toContain(
      'https://maps.apple.com/'
    );
    expect(buildStopDirectionsUrl(day.activities[0], 'Tokyo', 'Japan', 'android')).toContain(
      'https://www.google.com/maps/dir/'
    );

    const summary = summarizeDayRoute(day);
    expect(summary.stopCount).toBe(3);
    expect(summary.label).toContain('Asakusa');

    // Empty days return null safely
    const emptyDay: TripDay = { dayNumber: 1, date: '2026-10-10', theme: 'Empty', activities: [] };
    expect(buildGoogleMapsDayRouteUrl(emptyDay, 'Tokyo')).toBeNull();
    expect(buildAppleMapsDayRouteUrl(emptyDay, 'Tokyo')).toBeNull();
  });

  it('generates strictly factual stop rationale badges and never fabricates allergy/access guarantees', () => {
    const stop = makeActivity({ rating: 4.8 });
    const badges = explainMobileStop(stop, {
      vibes: ['culture', 'foodie'],
      requirements: {
        allergies: ['Peanuts'],
        dietaryPreferences: ['Vegan'],
        accessibility: ['step_free_entrance'],
        mobilityNotes: '',
      },
    });

    expect(badges).toEqual(['Matches your Culture vibe', 'Highly rated (4.8★)']);
    expect(badges.join(' ').toLowerCase()).not.toContain('allerg');
    expect(badges.join(' ').toLowerCase()).not.toContain('wheelchair');
    expect(badges.join(' ').toLowerCase()).not.toContain('verified');

    const planningIdeaBadges = explainMobileStop(makeActivity({ planningIdea: true }), {
      vibes: ['culture'],
    });
    expect(planningIdeaBadges).toEqual(['Planning idea — verify venue']);
  });

  it('computes Booking Readiness urgency windows and flags timed-entry stops without fake confirmations', () => {
    const trip = makeTrip({ startDate: '2026-10-10', endDate: '2026-10-12' });
    const tenDaysBefore = new Date(2026, 9, 1, 9, 0, 0); // 9 days before Oct 10
    const readiness = computeBookingReadiness(trip, tenDaysBefore);

    expect(readiness.urgency).toBe('now');
    expect(readiness.daysUntilTrip).toBe(9);
    expect(readiness.flaggedStops.length).toBeGreaterThanOrEqual(2);
    expect(readiness.detail).toContain('not verified');
  });

  it('supports grounded local relax_day & shift_day without ever inventing venues for offline swap/rain', () => {
    const trip = makeTrip();

    const relaxed = applyLocalTripRemix(trip.days, { action: 'relax_day', dayNumber: 1 });
    expect(relaxed.applied).toBe(true);
    expect(relaxed.updatedDays?.[0].activities).toHaveLength(2);
    expect(relaxed.diff[0].action).toBe('removed');
    expect(relaxed.previousDays?.[0].activities).toHaveLength(3);

    const shifted = applyLocalTripRemix(trip.days, { action: 'shift_day', dayNumber: 1 });
    expect(shifted.applied).toBe(true);
    expect(shifted.diff[0].action).toBe('moved');

    // Offline swap_stop & rain_backup refuse to fabricate ungrounded venues
    const offlineSwap = applyLocalTripRemix(trip.days, { action: 'swap_stop', dayNumber: 1 });
    expect(offlineSwap.applied).toBe(false);
    expect(offlineSwap.notice).toBeTruthy();

    const offlineRain = applyLocalTripRemix(trip.days, { action: 'rain_backup', dayNumber: 1 });
    expect(offlineRain.applied).toBe(false);
    expect(offlineRain.summary).toContain('outdoor stop');
  });

  it('calls /api/trips/:id/copilot with auth header and transforms returned days', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        applied: true,
        summary: 'Swapped Ueno Park for Tokyo National Museum.',
        diff: [
          {
            dayNumber: 1,
            slot: 'afternoon',
            before: 'Ueno Park',
            after: 'Tokyo National Museum',
            action: 'swapped',
          },
        ],
        updatedItinerary: {
          days: [
            {
              dayNumber: 1,
              date: '2026-10-10',
              title: 'Asakusa & Museums',
              morning: {
                activities: [{ id: 'a1', name: 'Senso-ji Temple', description: 'Temple' }],
                meals: [],
              },
              afternoon: {
                activities: [
                  { id: 'a4', name: 'Tokyo National Museum', description: 'Indoor museum' },
                ],
                meals: [],
              },
            },
          ],
        },
        previousItinerarySnapshot: { days: [] },
      }),
    })) as unknown as typeof fetch;

    const trip = makeTrip();
    const res = await runTripCopilotAction({
      tripId: 'trip-1',
      days: trip.days,
      action: 'rain_backup',
      dayNumber: 1,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://fixture.test/api/trips/trip-1/copilot',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    );
    expect(res.applied).toBe(true);
    expect(res.source).toBe('api');
    expect(res.updatedDays?.[0].activities.map((a) => a.title)).toContain('Tokyo National Museum');

    // Verify shift_day sends slot: 'morning' so the backend clears morning instead of pulling stops into morning
    await runTripCopilotAction({
      tripId: 'trip-1',
      days: trip.days,
      action: 'shift_day',
      dayNumber: 1,
    });
    const lastCall = jest.mocked(global.fetch).mock.calls.at(-1);
    expect(JSON.parse(String(lastCall?.[1]?.body))).toMatchObject({
      action: 'shift_day',
      dayNumber: 1,
      slot: 'morning',
    });
  });

  it('deduplicates and bounds streaming agent discoveries to 12 items', () => {
    const initial = Array.from({ length: 14 }, (_, idx) => ({
      id: `item-${idx}`,
      agent: 'activities' as const,
      headline: `Discovery ${idx}`,
      timestamp: idx,
    }));

    const merged = mergeAgentDiscoveries([], initial);
    expect(merged).toHaveLength(12);
    expect(merged[0].id).toBe('item-2');

    const deduped = mergeAgentDiscoveries(merged, {
      id: 'item-13',
      agent: 'activities',
      headline: 'Updated Discovery 13',
      timestamp: 99,
    });
    expect(deduped).toHaveLength(12);
    expect(deduped[deduped.length - 1].headline).toBe('Updated Discovery 13');
  });
});
