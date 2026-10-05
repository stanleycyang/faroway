jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: {} } }));
import * as api from '../../constants/api';
import { savedTripReviewUrl } from '../../lib/savedTripUrl';

const id = '11111111-1111-4111-8111-111111111111';
afterEach(() => jest.restoreAllMocks());

it('uses the configured staging origin', () => {
  jest.replaceProperty(api, 'API_BASE_URL', 'https://staging.faroway.ai');
  expect(savedTripReviewUrl(id)).toBe(`https://staging.faroway.ai/trips/${id}`);
});

it('uses the existing production default when no override is configured', () => {
  jest.replaceProperty(api, 'API_BASE_URL', api.resolveApiBaseUrl({ isDev: false }));
  expect(savedTripReviewUrl(id)).toBe(`https://faroway.ai/trips/${id}`);
});

it.each([
  'http://staging.faroway.ai',
  'javascript:alert(1)',
  'file:///tmp/trip',
  '//staging.faroway.ai',
  'not a URL',
  'https://user:password@staging.faroway.ai',
  'https://user@staging.faroway.ai',
])('rejects unsafe configured origin %s without falling back to production', (origin) => {
  jest.replaceProperty(api, 'API_BASE_URL', origin);
  expect(savedTripReviewUrl(id)).toBeNull();
});

it('retains only the trusted origin, never configured paths, query credentials or fragments', () => {
  jest.replaceProperty(
    api,
    'API_BASE_URL',
    'https://staging.faroway.ai/api?token=fixture#fragment'
  );
  expect(savedTripReviewUrl(id)).toBe(`https://staging.faroway.ai/trips/${id}`);
});

it.each([
  undefined,
  '',
  'local-trip-1',
  '..',
  '../escape',
  'https://evil.example',
  `${id}?token=x`,
  `${id}/../../escape`,
])('rejects unsaved or injected trip identity %s', (tripId) => {
  jest.replaceProperty(api, 'API_BASE_URL', 'https://staging.faroway.ai');
  expect(savedTripReviewUrl(tripId)).toBeNull();
});
