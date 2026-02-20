/**
 * Construct a full public URL for an image stored in Supabase Storage.
 * Pure string builder — no Supabase client dependency.
 */
export function getImageUrl(path: string): string {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    '';
  return `${supabaseUrl}/storage/v1/object/public/images/${path}`;
}
