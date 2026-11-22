jest.mock('react-native-url-polyfill/auto', () => ({}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() },
  })),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { addEventListener: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

import { createChunkedSecureStoreAdapter, type SecureStoreLike } from '@faroway/supabase/mobile';

function createInMemorySecureStore(maxBytes = 2048) {
  const map = new Map<string, string>();
  const store: SecureStoreLike = {
    async getItemAsync(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    async setItemAsync(key: string, value: string) {
      if (Buffer.byteLength(value, 'utf8') > maxBytes) {
        throw new Error(`Value exceeds ${maxBytes}-byte SecureStore limit for key ${key}`);
      }
      map.set(key, value);
    },
    async deleteItemAsync(key: string) {
      map.delete(key);
    },
  };
  return { store, map };
}

describe('createChunkedSecureStoreAdapter', () => {
  it('stores and reads small values directly without chunking', async () => {
    const { store, map } = createInMemorySecureStore();
    const adapter = createChunkedSecureStoreAdapter(store);

    await adapter.setItem('sb-auth-token', '{"access_token":"short"}');
    expect(map.size).toBe(1);
    expect(await adapter.getItem('sb-auth-token')).toBe('{"access_token":"short"}');
  });

  it('transparently chunks multi-kilobyte UTF-8 sessions under the 2048-byte iOS/Android limit', async () => {
    const { store, map } = createInMemorySecureStore(2048);
    const adapter = createChunkedSecureStoreAdapter(store);

    // Build a >4KB payload including multi-byte UTF-8 characters (emoji + CJK)
    const largeSession = JSON.stringify({
      access_token: 'eyJ' + 'a'.repeat(2400),
      refresh_token: 'ref_' + '東京✈️'.repeat(250),
      user: { id: 'user-1', name: 'José 旅人' },
    });
    expect(Buffer.byteLength(largeSession, 'utf8')).toBeGreaterThan(4000);

    await adapter.setItem('sb-auth-token', largeSession);
    // Every stored entry respects the 2048-byte limit
    for (const value of map.values()) {
      expect(Buffer.byteLength(value, 'utf8')).toBeLessThanOrEqual(2048);
    }
    expect(await adapter.getItem('sb-auth-token')).toBe(largeSession);
  });

  it('cleans up stale trailing chunks when overwriting with a smaller value or removing', async () => {
    const { store, map } = createInMemorySecureStore(2048);
    const adapter = createChunkedSecureStoreAdapter(store);

    await adapter.setItem('sb-auth-token', 'x'.repeat(5500));
    const initialKeyCount = map.size;
    expect(initialKeyCount).toBeGreaterThanOrEqual(4);

    // Shrink to a small unchunked payload — old chunk keys must be deleted
    await adapter.setItem('sb-auth-token', 'small-session');
    expect(map.size).toBe(1);
    expect(await adapter.getItem('sb-auth-token')).toBe('small-session');

    // Grow again, then removeItem — all chunks and manifest must be deleted
    await adapter.setItem('sb-auth-token', 'y'.repeat(4200));
    expect(map.size).toBeGreaterThanOrEqual(3);
    await adapter.removeItem('sb-auth-token');
    expect(map.size).toBe(0);
    expect(await adapter.getItem('sb-auth-token')).toBeNull();
  });

  it('remains backwards-compatible with pre-existing unchunked values', async () => {
    const { store, map } = createInMemorySecureStore(2048);
    map.set('sb-legacy-token', '{"access_token":"legacy"}');
    const adapter = createChunkedSecureStoreAdapter(store);

    expect(await adapter.getItem('sb-legacy-token')).toBe('{"access_token":"legacy"}');
  });
});
