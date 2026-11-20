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

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

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
