jest.mock('../../lib/planningConsent', () => ({
  withPlanningConsent: jest.fn(async (dispatch) =>
    dispatch({
      headers: async () => ({
        'Content-Type': 'application/json',
        Authorization: 'Bearer current-session',
      }),
      signal: new AbortController().signal,
    })
  ),
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: {} },
}));

jest.mock('../../constants/api', () => ({
  API_BASE_URL: 'http://localhost:3000',
}));

jest.mock('../../lib/supabase', () => ({
  __esModule: true,
  getAuthHeaders: jest.fn(async () => ({})),
}));

import {
  extractApiErrorMessage,
  getIncompleteStreamMessage,
  parseSSEBuffer,
  parseStreamingJson,
  pollGenerationStatus,
} from '../../hooks/useStreamingItinerary';

describe('streaming itinerary SSE parsing', () => {
  it('accepts tagged chapters without dropping their blocks at the native wire boundary', () => {
    const payload = {
      chapter: 'hotels',
      blocks: [{ type: 'HotelCard', props: { name: 'Saved stay' } }],
    };
    const packet = `event: spec-block\ndata: ${JSON.stringify(payload)}\n\n`;
    const { events, remaining } = parseSSEBuffer(packet);
    expect(remaining).toBe('');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('spec-block');
    expect(parseStreamingJson(events[0].data)).toEqual(payload);
  });

  it('parses complete SSE events and keeps an incomplete trailing event buffered', () => {
    const { events, remaining } = parseSSEBuffer(
      'event: spec-block\ndata: {"blocks":[{"type":"TripSummary"}]}\n\n' +
        'event: progress\ndata: {"progress":25}'
    );

    expect(events).toEqual([
      {
        type: 'spec-block',
        data: '{"blocks":[{"type":"TripSummary"}]}',
      },
    ]);
    expect(remaining).toBe('event: progress\ndata: {"progress":25}');
  });

  it('handles malformed partial JSON without throwing so later chunks can continue', () => {
    expect(parseStreamingJson('{"blocks":')).toBeNull();
    expect(parseStreamingJson('{"progress":50}')).toEqual({ progress: 50 });
  });

  it('extracts readable backend error messages from JSON responses', () => {
    expect(extractApiErrorMessage('{"error":"Unauthorized"}', 'Failed')).toBe('Unauthorized');
    expect(extractApiErrorMessage('{"message":"Trip not found"}', 'Failed')).toBe('Trip not found');
  });

  it('falls back for empty or HTML error bodies', () => {
    expect(extractApiErrorMessage('', 'Failed to create trip')).toBe('Failed to create trip');
    expect(extractApiErrorMessage('<html><body>500</body></html>', 'Failed to stream')).toBe(
      'Failed to stream'
    );
  });

  it('uses reconnectable copy when the stream closes before completion', () => {
    expect(
      getIncompleteStreamMessage('Still generating in background. Reconnect for updates.')
    ).toBe('Faroway is still planning in the background. Reconnect for updates.');
    expect(getIncompleteStreamMessage('Searching for the best hotels...')).toBe(
      'The connection closed before your itinerary was ready. Reconnect to continue planning.'
    );
  });
});

it('does not publish completion from a polling body after cancellation', async () => {
  let finish!: (value: unknown) => void;
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  })) as unknown as typeof fetch;
  const controller = new AbortController();
  const update = jest.fn();
  const work = pollGenerationStatus('saved-trip', controller.signal, update);
  const rejected = expect(work).rejects.toMatchObject({ name: 'AbortError' });
  for (let i = 0; i < 20; i++) await Promise.resolve();
  controller.abort();
  await rejected;
  finish({ status: 'completed' });
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(update).not.toHaveBeenCalled();
});
