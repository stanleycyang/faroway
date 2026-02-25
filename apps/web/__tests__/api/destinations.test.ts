import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Chainable Supabase mock builder
// ---------------------------------------------------------------------------

function createQueryChain(getResult: () => any) {
  const chain: any = {};
  const methods = [
    'select', 'eq', 'or', 'is', 'insert', 'update', 'delete',
    'upsert', 'match', 'limit', 'order', 'single', 'rpc',
  ];
  methods.forEach((m) => {
    chain[m] = vi.fn(() => chain);
  });
  Object.defineProperty(chain, 'data', {
    get: () => getResult()?.data,
    configurable: true,
    enumerable: true,
  });
  Object.defineProperty(chain, 'error', {
    get: () => getResult()?.error,
    configurable: true,
    enumerable: true,
  });
  return chain;
}

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------

let destinationsResult: { data: any; error: any };
let tripCountsResult: { data: any; error: any };
let searchCountsResult: { data: any; error: any };
let newsletterResult: { data: any; error: any };

// Separate chains so each `from()` / `rpc()` call resolves its own data
let destinationsChain: ReturnType<typeof createQueryChain>;
let rpcChain: ReturnType<typeof createQueryChain>;
let newsletterChain: ReturnType<typeof createQueryChain>;

let rpcCallCount: number;

function resetMockState() {
  destinationsResult = { data: [], error: null };
  tripCountsResult = { data: [], error: null };
  searchCountsResult = { data: [], error: null };
  newsletterResult = { data: null, error: null };
  rpcCallCount = 0;

  destinationsChain = createQueryChain(() => destinationsResult);
  newsletterChain = createQueryChain(() => newsletterResult);

  // rpc chain alternates between trip and search counts on successive calls
  rpcChain = createQueryChain(() => {
    rpcCallCount++;
    return rpcCallCount === 1 ? tripCountsResult : searchCountsResult;
  });
}

resetMockState();

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'newsletter_subscribers') return newsletterChain;
    return destinationsChain;
  }),
  rpc: vi.fn((_name: string, _params?: any) => {
    rpcCallCount++;
    if (rpcCallCount === 1) {
      return { data: tripCountsResult.data, error: tripCountsResult.error };
    }
    return { data: searchCountsResult.data, error: searchCountsResult.error };
  }),
};

// ---------------------------------------------------------------------------
// Module mocks — MUST be declared before importing route handlers
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/server', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 59, resetIn: 60000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('@faroway/constants', () => ({
  popularDestinations: [
    {
      id: 'tokyo',
      name: 'Tokyo',
      country: 'Japan',
      description: 'Capital of Japan',
      image: '/tokyo.jpg',
      tags: ['city', 'culture'],
      currency: 'JPY',
      language: 'Japanese',
      bestTime: 'Spring',
    },
    {
      id: 'bali',
      name: 'Bali',
      country: 'Indonesia',
      description: 'Island paradise',
      image: '/bali.jpg',
      tags: ['beach', 'nature'],
      currency: 'IDR',
      language: 'Indonesian',
      bestTime: 'Summer',
    },
  ],
}));

vi.mock('@/lib/destinations', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    getCurrentSeason: vi.fn(() => ({ season: 'summer', month: 7 })),
  };
});

// ---------------------------------------------------------------------------
// Import route handlers (after mocks are registered)
// ---------------------------------------------------------------------------

import { GET as getPopular } from '@/app/api/destinations/popular/route';
import { GET as getTrending } from '@/app/api/destinations/trending/route';
import { POST as subscribeNewsletter } from '@/app/api/blog/newsletter/route';

import { checkRateLimit } from '@/lib/security/rate-limit';
import { getCurrentSeason, getSeasonBoost } from '@/lib/destinations';

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeDbDestination(overrides: Record<string, any> = {}) {
  return {
    id: 'dest-tokyo',
    slug: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    name_normalized: 'tokyo',
    aliases: [],
    description: 'Capital of Japan',
    image: '/tokyo.jpg',
    tags: ['city', 'culture'],
    seasons: { peak: [3, 4, 5], good: [6, 7], off: [12, 1, 2] },
    currency: 'JPY',
    language: 'Japanese',
    best_time: 'Spring',
    base_popularity_score: 50,
    ...overrides,
  };
}

function makeRequest(path: string, init?: RequestInit) {
  return new NextRequest(new URL(`http://localhost:3000${path}`), init as any);
}

// ---------------------------------------------------------------------------
// POPULAR DESTINATIONS
// ---------------------------------------------------------------------------

describe('GET /api/destinations/popular', () => {
  beforeEach(() => {
    resetMockState();
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 59, resetIn: 60000 });
  });

  it('returns destinations sorted by popularity score', async () => {
    const tokyo = makeDbDestination({
      id: 'dest-tokyo',
      slug: 'tokyo',
      name: 'Tokyo',
      name_normalized: 'tokyo',
      base_popularity_score: 50,
    });
    const bali = makeDbDestination({
      id: 'dest-bali',
      slug: 'bali',
      name: 'Bali',
      country: 'Indonesia',
      name_normalized: 'bali',
      description: 'Island paradise',
      image: '/bali.jpg',
      tags: ['beach', 'nature'],
      seasons: { peak: [6, 7, 8], good: [5, 9], off: [12, 1, 2] },
      currency: 'IDR',
      language: 'Indonesian',
      best_time: 'Summer',
      base_popularity_score: 30,
    });

    destinationsResult = { data: [tokyo, bali], error: null };
    // Tokyo: trips=10, searches=5 => 10*3 + 5*1 + 50*0.5 = 60
    // Bali:  trips=20, searches=15 => 20*3 + 15*1 + 30*0.5 = 90
    tripCountsResult = {
      data: [
        { destination_normalized: 'tokyo', trip_count: 10 },
        { destination_normalized: 'bali', trip_count: 20 },
      ],
      error: null,
    };
    searchCountsResult = {
      data: [
        { destination_normalized: 'tokyo', search_count: 5 },
        { destination_normalized: 'bali', search_count: 15 },
      ],
      error: null,
    };

    const req = makeRequest('/api/destinations/popular?limit=10&offset=0');
    const res = await getPopular(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.destinations).toHaveLength(2);
    // Bali has higher score (90) so it comes first
    expect(body.destinations[0].slug).toBe('bali');
    expect(body.destinations[1].slug).toBe('tokyo');
    expect(body.destinations[0].score).toBeGreaterThan(body.destinations[1].score);
    expect(body.total).toBe(2);
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
  });

  it('falls back to hardcoded data when DB fails', async () => {
    destinationsResult = { data: null, error: { message: 'DB unavailable' } };

    const req = makeRequest('/api/destinations/popular?limit=10&offset=0');
    const res = await getPopular(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.destinations).toHaveLength(2);
    // Fallback uses popularDestinations from @faroway/constants
    expect(body.destinations[0].name).toBe('Tokyo');
    expect(body.destinations[1].name).toBe('Bali');
    expect(body.total).toBe(2);
  });

  it('respects limit and offset pagination', async () => {
    const tokyo = makeDbDestination({
      id: 'dest-tokyo',
      slug: 'tokyo',
      name: 'Tokyo',
      name_normalized: 'tokyo',
      base_popularity_score: 50,
    });
    const bali = makeDbDestination({
      id: 'dest-bali',
      slug: 'bali',
      name: 'Bali',
      name_normalized: 'bali',
      base_popularity_score: 30,
    });

    destinationsResult = { data: [tokyo, bali], error: null };
    tripCountsResult = { data: [], error: null };
    searchCountsResult = { data: [], error: null };

    // limit=1&offset=0 => only the top destination
    const req = makeRequest('/api/destinations/popular?limit=1&offset=0');
    const res = await getPopular(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.destinations).toHaveLength(1);
    // Tokyo has higher base_popularity_score so it ranks first (0*3 + 0*1 + 50*0.5 = 25 vs 15)
    expect(body.destinations[0].slug).toBe('tokyo');
    expect(body.total).toBe(2);
    expect(body.limit).toBe(1);
    expect(body.offset).toBe(0);

    // offset=1 => second destination
    resetMockState();
    destinationsResult = { data: [tokyo, bali], error: null };
    tripCountsResult = { data: [], error: null };
    searchCountsResult = { data: [], error: null };

    const req2 = makeRequest('/api/destinations/popular?limit=1&offset=1');
    const res2 = await getPopular(req2);
    const body2 = await res2.json();

    expect(body2.destinations).toHaveLength(1);
    expect(body2.destinations[0].slug).toBe('bali');
    expect(body2.offset).toBe(1);
  });

  it('returns 400 for invalid query params (limit=-1)', async () => {
    const req = makeRequest('/api/destinations/popular?limit=-1');
    const res = await getPopular(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid query parameters');
    expect(body.details).toBeDefined();
  });

  it('filters by tags when provided', async () => {
    const tokyo = makeDbDestination({
      id: 'dest-tokyo',
      slug: 'tokyo',
      name: 'Tokyo',
      name_normalized: 'tokyo',
      tags: ['city', 'culture'],
      base_popularity_score: 50,
    });
    const bali = makeDbDestination({
      id: 'dest-bali',
      slug: 'bali',
      name: 'Bali',
      name_normalized: 'bali',
      tags: ['beach', 'nature'],
      base_popularity_score: 30,
    });

    destinationsResult = { data: [tokyo, bali], error: null };
    tripCountsResult = { data: [], error: null };
    searchCountsResult = { data: [], error: null };

    const req = makeRequest('/api/destinations/popular?tags=beach');
    const res = await getPopular(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.destinations).toHaveLength(1);
    expect(body.destinations[0].slug).toBe('bali');
    expect(body.total).toBe(1);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetIn: 30000 });

    const req = makeRequest('/api/destinations/popular');
    const res = await getPopular(req);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe('Too many requests');
  });
});

// ---------------------------------------------------------------------------
// TRENDING DESTINATIONS
// ---------------------------------------------------------------------------

describe('GET /api/destinations/trending', () => {
  beforeEach(() => {
    resetMockState();
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 59, resetIn: 60000 });
    vi.mocked(getCurrentSeason).mockReturnValue({ season: 'summer', month: 7 });
  });

  it('returns destinations sorted by trending score with season boost', async () => {
    const tokyo = makeDbDestination({
      id: 'dest-tokyo',
      slug: 'tokyo',
      name: 'Tokyo',
      name_normalized: 'tokyo',
      seasons: { peak: [3, 4, 5], good: [6, 7], off: [12, 1, 2] },
    });
    const bali = makeDbDestination({
      id: 'dest-bali',
      slug: 'bali',
      name: 'Bali',
      name_normalized: 'bali',
      tags: ['beach', 'nature'],
      seasons: { peak: [6, 7, 8], good: [5, 9], off: [12, 1, 2] },
    });

    destinationsResult = { data: [tokyo, bali], error: null };
    // Recent trips/searches
    tripCountsResult = {
      data: [
        { destination_normalized: 'tokyo', trip_count: 5 },
        { destination_normalized: 'bali', trip_count: 3 },
      ],
      error: null,
    };
    searchCountsResult = {
      data: [
        { destination_normalized: 'tokyo', search_count: 10 },
        { destination_normalized: 'bali', search_count: 8 },
      ],
      error: null,
    };

    // month=7: Tokyo seasons.good includes 7 => boost=10; Bali seasons.peak includes 7 => boost=20
    // Tokyo: 5*5 + 10*2 + 10 = 55
    // Bali:  3*5 + 8*2  + 20 = 51
    // Tokyo should rank first

    const req = makeRequest('/api/destinations/trending?limit=10&offset=0');
    const res = await getTrending(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.destinations).toHaveLength(2);
    expect(body.destinations[0].slug).toBe('tokyo');
    expect(body.destinations[1].slug).toBe('bali');
    expect(body.destinations[0].score).toBeGreaterThan(body.destinations[1].score);
    expect(body.total).toBe(2);
  });

  it('falls back to hardcoded data on error', async () => {
    destinationsResult = { data: null, error: { message: 'DB unavailable' } };

    const req = makeRequest('/api/destinations/trending?limit=10&offset=0');
    const res = await getTrending(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    // Trending fallback uses a rotated slice — with only 2 items in the mock,
    // slice(5) is empty so rotated = [...[], ...items] = original order
    expect(body.destinations.length).toBeGreaterThanOrEqual(1);
    expect(body.total).toBe(2);
  });

  it('respects pagination', async () => {
    const tokyo = makeDbDestination({
      id: 'dest-tokyo',
      slug: 'tokyo',
      name: 'Tokyo',
      name_normalized: 'tokyo',
      seasons: { peak: [3, 4, 5], good: [6, 7], off: [12, 1, 2] },
    });
    const bali = makeDbDestination({
      id: 'dest-bali',
      slug: 'bali',
      name: 'Bali',
      name_normalized: 'bali',
      tags: ['beach', 'nature'],
      seasons: { peak: [6, 7, 8], good: [5, 9], off: [12, 1, 2] },
    });

    destinationsResult = { data: [tokyo, bali], error: null };
    tripCountsResult = { data: [], error: null };
    searchCountsResult = { data: [], error: null };

    const req = makeRequest('/api/destinations/trending?limit=1&offset=0');
    const res = await getTrending(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.destinations).toHaveLength(1);
    expect(body.total).toBe(2);
    expect(body.limit).toBe(1);
    expect(body.offset).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// NEWSLETTER SUBSCRIPTION
// ---------------------------------------------------------------------------

describe('POST /api/blog/newsletter', () => {
  beforeEach(() => {
    resetMockState();
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 2, resetIn: 60000 });
  });

  it('successfully subscribes with valid email', async () => {
    newsletterResult = { data: null, error: null };

    const req = makeRequest('/api/blog/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await subscribeNewsletter(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_subscribers');
    expect(newsletterChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
        source: 'blog',
        status: 'active',
      }),
      { onConflict: 'email' },
    );
  });

  it('returns 400 for invalid email', async () => {
    const req = makeRequest('/api/blog/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });

    const res = await subscribeNewsletter(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 for missing email', async () => {
    const req = makeRequest('/api/blog/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await subscribeNewsletter(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, resetIn: 30000 });

    const req = makeRequest('/api/blog/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await subscribeNewsletter(req);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe('Too many requests');
  });

  it('returns 500 on database error', async () => {
    newsletterResult = { data: null, error: { message: 'DB write failed' } };

    const req = makeRequest('/api/blog/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await subscribeNewsletter(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to subscribe');
  });
});
