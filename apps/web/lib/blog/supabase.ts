import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Lightweight singleton Supabase client for public blog reads.
 * Uses the anon key — blog_posts has RLS: "Public can read published posts".
 */
export function getBlogSupabase(): SupabaseClient | null {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.warn(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — blog database client is unavailable",
      );
      return null;
    }
    client = createClient(url, key);
  }
  return client;
}
