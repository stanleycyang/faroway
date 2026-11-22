/**
 * Mobile Supabase client (for Expo / React Native)
 * Uses SecureStore for native, localStorage for web.
 */
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
// QA uses its own public key variable so EAS preview's production configuration
// never becomes an accidental fallback. Expo inlines each EXPO_PUBLIC reference.
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_MOBILE_QA === "1"
    ? process.env.EXPO_PUBLIC_QA_SUPABASE_ANON_KEY || ""
    : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

const SECURE_STORE_CHUNK_BYTES = 1800;
const CHUNK_MANIFEST_PREFIX = '{"__faroway_chunked_v1":true,';

function utf8CharBytes(char: string): number {
  const cp = char.codePointAt(0) ?? 0;
  if (cp <= 0x7f) return 1;
  if (cp <= 0x7ff) return 2;
  if (cp <= 0xffff) return 3;
  return 4;
}

function splitUtf8Chunks(
  value: string,
  maxBytes = SECURE_STORE_CHUNK_BYTES,
): string[] {
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of value) {
    const bytes = utf8CharBytes(ch);
    if (currentBytes + bytes > maxBytes && current.length > 0) {
      chunks.push(current);
      current = ch;
      currentBytes = bytes;
    } else {
      current += ch;
      currentBytes += bytes;
    }
  }
  if (current.length > 0 || chunks.length === 0) {
    chunks.push(current);
  }
  return chunks;
}

function parseChunkCount(raw: string | null): number | null {
  if (!raw || !raw.startsWith(CHUNK_MANIFEST_PREFIX)) return null;
  try {
    const parsed = JSON.parse(raw) as {
      __faroway_chunked_v1?: unknown;
      count?: unknown;
    };
    if (
      parsed.__faroway_chunked_v1 === true &&
      typeof parsed.count === "number" &&
      Number.isInteger(parsed.count) &&
      parsed.count > 0 &&
      parsed.count <= 64
    ) {
      return parsed.count;
    }
  } catch {
    // Not a valid manifest; fall back to returning raw value.
  }
  return null;
}

function chunkKey(key: string, index: number): string {
  return `${key}.chunk.${index}`;
}

export interface SecureStoreLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export function createChunkedSecureStoreAdapter(
  store: SecureStoreLike = SecureStore,
) {
  const deleteChunkRange = async (key: string, start: number, end: number) => {
    for (let i = start; i < end; i++) {
      await store.deleteItemAsync(chunkKey(key, i)).catch(() => {});
    }
  };

  return {
    getItem: async (key: string): Promise<string | null> => {
      if (Platform.OS === "web") {
        return localStorage.getItem(key);
      }
      const raw = await store.getItemAsync(key);
      if (raw === null) return null;
      const count = parseChunkCount(raw);
      if (count === null) return raw;
      const parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const chunk = await store.getItemAsync(chunkKey(key, i));
        if (chunk === null) return null;
        parts.push(chunk);
      }
      return parts.join("");
    },
    setItem: async (key: string, value: string): Promise<void> => {
      if (Platform.OS === "web") {
        localStorage.setItem(key, value);
        return;
      }
      const existingRaw = await store.getItemAsync(key).catch(() => null);
      const previousCount = parseChunkCount(existingRaw) ?? 0;
      const chunks = splitUtf8Chunks(value, SECURE_STORE_CHUNK_BYTES);

      if (chunks.length === 1 && parseChunkCount(chunks[0]) === null) {
        await store.setItemAsync(key, chunks[0]);
        if (previousCount > 0) {
          await deleteChunkRange(key, 0, previousCount);
        }
        return;
      }

      // Write all new chunks before flipping the manifest so interrupted writes
      // never point at missing chunks.
      for (let i = 0; i < chunks.length; i++) {
        await store.setItemAsync(chunkKey(key, i), chunks[i]);
      }
      await store.setItemAsync(
        key,
        JSON.stringify({ __faroway_chunked_v1: true, count: chunks.length }),
      );
      if (previousCount > chunks.length) {
        await deleteChunkRange(key, chunks.length, previousCount);
      }
    },
    removeItem: async (key: string): Promise<void> => {
      if (Platform.OS === "web") {
        localStorage.removeItem(key);
        return;
      }
      const existingRaw = await store.getItemAsync(key).catch(() => null);
      const count = parseChunkCount(existingRaw) ?? 0;
      await store.deleteItemAsync(key);
      if (count > 0) {
        await deleteChunkRange(key, 0, count);
      }
    },
  };
}

export const ExpoSecureStoreAdapter = createChunkedSecureStoreAdapter();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});

// Keep retained native sessions refreshed when the app returns to foreground.
const APP_STATE_SUB_KEY = "__farowaySupabaseAppStateSub";
type GlobalWithAppStateSub = typeof globalThis & {
  [APP_STATE_SUB_KEY]?: { remove?: () => void };
};
if (Platform.OS !== "web" && typeof AppState?.addEventListener === "function") {
  const globalStore = globalThis as GlobalWithAppStateSub;
  globalStore[APP_STATE_SUB_KEY]?.remove?.();
  globalStore[APP_STATE_SUB_KEY] = AppState.addEventListener(
    "change",
    (state) => {
      if (state === "active") {
        void supabase.auth.startAutoRefresh();
      } else {
        void supabase.auth.stopAutoRefresh();
      }
    },
  );
}

/**
 * Helper to get auth headers for API requests.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return {
    "Content-Type": "application/json",
    ...(session?.access_token && {
      Authorization: `Bearer ${session.access_token}`,
    }),
  };
}
