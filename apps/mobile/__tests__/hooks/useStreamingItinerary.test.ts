jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: {} },
}));

jest.mock('../../constants/api', () => ({
  API_BASE_URL: 'http://localhost:3000',
}));

import { parseSSEBuffer, parseStreamingJson } from '../../hooks/useStreamingItinerary';

describe('streaming itinerary SSE parsing', () => {
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
});
