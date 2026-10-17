import { selectTripDetail } from '../../lib/tripSummary';
import type { Trip } from '../../stores/tripStore';

const detail: Trip = {
  id: 'trip-a',
  destination: 'Tokyo',
  country: 'Japan',
  startDate: '2026-11-01',
  endDate: '2026-11-04',
  travelers: 2,
  travelerType: 'couple',
  vibes: [],
  days: [{ dayNumber: 1, date: '2026-11-01', theme: 'Saved day', activities: [] }],
  coverImage: '/fixture.jpg',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-13T00:00:00.000Z',
  status: 'planned',
};

it('uses the newer list revision instead of stale current detail', () => {
  const summary = {
    ...detail,
    destination: 'Kyoto',
    days: [],
    updatedAt: '2026-10-14T00:00:00.000Z',
  };
  expect(selectTripDetail(detail.id, [summary], detail)).toBe(summary);
});

it('keeps full detail when the list has the same revision', () => {
  expect(selectTripDetail(detail.id, [{ ...detail, days: [] }], detail)).toBe(detail);
});

it('keeps newer manually refreshed detail instead of an older list', () => {
  const summary = { ...detail, days: [], updatedAt: '2026-10-12T00:00:00.000Z' };
  expect(selectTripDetail(detail.id, [summary], detail)).toBe(detail);
});

it('compares revision timestamps as instants rather than strings', () => {
  const summary = { ...detail, days: [], updatedAt: '2026-10-12T23:00:00.000-02:00' };
  expect(selectTripDetail(detail.id, [summary], detail)).toBe(summary);
});

it('uses a known list revision when cached detail has no valid revision', () => {
  expect(selectTripDetail(detail.id, [detail], { ...detail, updatedAt: undefined })).toBe(detail);
  expect(selectTripDetail(detail.id, [detail], { ...detail, updatedAt: 'invalid' })).toBe(detail);
});

it('keeps detail if the list revision is missing or invalid', () => {
  expect(selectTripDetail(detail.id, [{ ...detail, updatedAt: undefined }], detail)).toBe(detail);
  expect(selectTripDetail(detail.id, [{ ...detail, updatedAt: 'invalid' }], detail)).toBe(detail);
});

it('only selects data for the requested trip', () => {
  expect(selectTripDetail(detail.id, [detail], { ...detail, id: 'other-trip' })).toBe(detail);
  expect(selectTripDetail('missing-trip', [detail], detail)).toBe(undefined);
  expect(selectTripDetail(undefined, [detail], detail)).toBe(undefined);
  expect(selectTripDetail(detail.id, [], detail)).toBe(detail);
  expect(selectTripDetail(detail.id, [detail], null)).toBe(detail);
});

it.each([
  ['2026-10-17T00:00:00.123455Z', '2026-10-17T00:00:00.123456Z'],
  ['2026-10-17T00:00:00.123455+00:00', '2026-10-17T05:30:00.123456+05:30'],
  ['2026-10-17T00:00:00.123455Z', '2026-10-16T20:00:00.123456-0400'],
  ['2026-10-17T00:00:00.123Z', '2026-10-17T00:00:00.123001Z'],
  ['1969-12-31T23:59:59.123455Z', '1969-12-31T23:59:59.123456Z'],
  ['2026-10-17T00:00:00.123456001Z', '2026-10-17T00:00:00.123456002Z'],
])('preserves fractional precision between %s and %s', (older, newer) => {
  const olderDetail = { ...detail, updatedAt: older };
  const newerSummary = { ...detail, days: [], updatedAt: newer };
  expect(selectTripDetail(detail.id, [newerSummary], olderDetail)).toBe(newerSummary);
  expect(selectTripDetail(detail.id, [olderDetail], newerSummary)).toBe(newerSummary);
});

it.each([
  ['2026-10-17T00:00:00.123Z', '2026-10-17T02:00:00.123000+02:00'],
  ['2026-10-17T00:00:00.123456Z', '2026-10-16T20:00:00.123456000-04:00'],
  ['2026-10-17T00:00:00Z', '2026-10-17T00:00:00.000000Z'],
])('retains full detail for equivalent padded instants %s and %s', (left, right) => {
  const full = { ...detail, updatedAt: left };
  expect(selectTripDetail(detail.id, [{ ...detail, days: [], updatedAt: right }], full)).toBe(full);
});
