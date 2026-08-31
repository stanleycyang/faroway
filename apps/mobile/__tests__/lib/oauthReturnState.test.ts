import {
  resolveWebOAuthRedirectUrl,
  savePendingOAuthTripDraft,
  takePendingOAuthTripDraft,
} from '../../lib/oauthReturnState';
import type { TripInput } from '../../stores/tripStore';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

const draft: TripInput = {
  destination: 'Lisbon',
  country: 'Portugal',
  startDate: '2026-10-10',
  endDate: '2026-10-15',
  travelers: 2,
  travelerType: 'couple',
  vibes: ['foodie'],
};

describe('mobile web OAuth trip draft handoff', () => {
  it('returns to the intended in-app route and rejects external redirects', () => {
    expect(
      resolveWebOAuthRedirectUrl('https://faroway.test', '/create', '/create/generating')
    ).toBe('https://faroway.test/create/generating');
    expect(
      resolveWebOAuthRedirectUrl('https://faroway.test', '/create', 'https://evil.test/takeover')
    ).toBe('https://faroway.test/create');
  });

  it('restores the prepared trip once after the OAuth navigation', () => {
    const storage = createStorage();
    savePendingOAuthTripDraft(storage, draft, 1_000);

    expect(takePendingOAuthTripDraft(storage, 2_000)).toEqual(draft);
    expect(takePendingOAuthTripDraft(storage, 2_000)).toBeNull();
  });

  it('drops expired handoff data', () => {
    const storage = createStorage();
    savePendingOAuthTripDraft(storage, draft, 1_000);

    expect(takePendingOAuthTripDraft(storage, 7_202_000)).toBeNull();
  });
});
