import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createBrowserClientMock = vi.fn(() => ({ kind: 'browser-client' }));
const createServerClientMock = vi.fn(() => ({ kind: 'server-client' }));
const createSupabaseClientMock = vi.fn(() => ({ kind: 'supabase-client' }));
const cookiesMock = vi.fn(async () => ({
  getAll: () => [{ name: 'sb-token', value: 'cookie-val' }],
  set: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: createBrowserClientMock,
  createServerClient: createServerClientMock,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createSupabaseClientMock,
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

describe('@faroway/supabase', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('browser client (./client)', () => {
    it('returns an unauthenticated fallback client when public env vars are missing', async () => {
      const { createClient } = await import('../src/client');
      const client = createClient();

      expect(createBrowserClientMock).not.toHaveBeenCalled();
      expect(await client.auth.getSession()).toEqual({
        data: { session: null },
        error: null,
      });
      expect(await client.auth.getUser()).toEqual({
        data: { user: null },
        error: null,
      });
      expect(await client.auth.signOut()).toEqual({ error: null });
      const { data } = client.auth.onAuthStateChange(() => {});
      expect(() => data.subscription.unsubscribe()).not.toThrow();
    });

    it('creates a configured browser client when public env vars are set', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

      const { createClient } = await import('../src/client');
      const client = createClient();

      expect(createBrowserClientMock).toHaveBeenCalledWith(
        'https://example.supabase.co',
        'anon-key'
      );
      expect(client).toEqual({ kind: 'browser-client' });
    });
  });

  describe('server client (./server)', () => {
    it('throws from createClient when public env vars are missing', async () => {
      const { createClient } = await import('../src/server');
      await expect(createClient()).rejects.toThrow(
        'Supabase public environment variables not configured'
      );
    });

    it('creates a cookie-backed server client when configured', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

      const { createClient } = await import('../src/server');
      const client = await createClient();

      expect(cookiesMock).toHaveBeenCalledOnce();
      expect(createServerClientMock).toHaveBeenCalledWith(
        'https://example.supabase.co',
        'anon-key',
        expect.objectContaining({
          cookies: expect.objectContaining({
            getAll: expect.any(Function),
            setAll: expect.any(Function),
          }),
        })
      );
      expect(client).toEqual({ kind: 'server-client' });
    });

    it('throws from getSupabase when service role env vars are missing', async () => {
      const { getSupabase } = await import('../src/server');
      expect(() => getSupabase()).toThrow(
        'Supabase environment variables not configured'
      );
    });

    it('lazily caches the service role client', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

      const { getSupabase } = await import('../src/server');
      const first = getSupabase();
      const second = getSupabase();

      expect(first).toBe(second);
      expect(createSupabaseClientMock).toHaveBeenCalledTimes(1);
      expect(createSupabaseClientMock).toHaveBeenCalledWith(
        'https://example.supabase.co',
        'service-role-key'
      );
    });

    it('returns an unauthenticated client from createClientFromRequest when env vars are missing', async () => {
      const { createClientFromRequest } = await import('../src/server');
      const client = await createClientFromRequest({
        headers: { get: () => null },
      });

      const result = await client.auth.getUser();
      expect(result.data.user).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
    });

    it('creates a Bearer-token client for mobile requests', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

      const { createClientFromRequest } = await import('../src/server');
      const client = await createClientFromRequest({
        headers: {
          get: (name) => (name === 'Authorization' ? 'Bearer mobile-jwt' : null),
        },
      });

      expect(createSupabaseClientMock).toHaveBeenCalledWith(
        'https://example.supabase.co',
        'anon-key',
        {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: 'Bearer mobile-jwt' } },
        }
      );
      expect(client).toEqual({ kind: 'supabase-client' });
    });

    it('falls back to cookie-based server client when Authorization header is absent', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

      const { createClientFromRequest } = await import('../src/server');
      const client = await createClientFromRequest({
        headers: { get: () => null },
      });

      expect(createServerClientMock).toHaveBeenCalledOnce();
      expect(client).toEqual({ kind: 'server-client' });
    });
  });
});
