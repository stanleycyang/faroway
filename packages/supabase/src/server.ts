/**
 * Server Supabase clients (for Next.js server components / API routes)
 */
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

function getUnauthenticatedClient(): SupabaseClient {
  return {
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: new Error('Supabase environment variables not configured'),
      }),
    },
  } as unknown as SupabaseClient;
}

/**
 * Create a Supabase client for browser-authenticated requests (uses cookies).
 * Use this for routes that need user authentication.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const config = getSupabasePublicConfig();

  if (!config) {
    throw new Error('Supabase public environment variables not configured');
  }

  return createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}

let serviceClient: SupabaseClient | null = null;

/**
 * Get a Supabase client with service role (admin) access.
 * Lazily initialized to avoid build-time errors.
 */
export function getSupabase(): SupabaseClient {
  if (!serviceClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }

    serviceClient = createSupabaseClient(url, key);
  }

  return serviceClient;
}

/**
 * Create a Supabase client from an incoming request.
 * Supports Bearer token auth (mobile) and falls back to cookie auth (web).
 */
export async function createClientFromRequest(request: { headers: { get(name: string): string | null } }) {
  const authHeader = request.headers.get('Authorization');
  const config = getSupabasePublicConfig();

  if (!config) {
    return getUnauthenticatedClient();
  }

  // If Bearer token is present (mobile app), create client with that token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return createSupabaseClient(
      config.url,
      config.anonKey,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );
  }

  // Otherwise fall back to cookie-based auth (web browser)
  return createClient();
}
