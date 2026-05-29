/**
 * Browser Supabase client (for Next.js client components)
 */
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

function getUnauthenticatedClient(): SupabaseClient {
  const subscription = { unsubscribe() {} };

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription } }),
      signOut: async () => ({ error: null }),
    },
  } as unknown as SupabaseClient;
}

export function createClient() {
  const config = getSupabasePublicConfig();

  if (!config) {
    return getUnauthenticatedClient();
  }

  return createBrowserClient(config.url, config.anonKey);
}
