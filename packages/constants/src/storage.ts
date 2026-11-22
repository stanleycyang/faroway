/**
 * Construct a full public URL for an image stored in Supabase Storage.
 * Pure string builder — no Supabase client dependency.
 */
export function getImageUrl(path: string): string {
  const env =
    typeof process !== "undefined" && process?.env ? process.env : undefined;
  const supabaseUrl =
    env?.NEXT_PUBLIC_SUPABASE_URL || env?.EXPO_PUBLIC_SUPABASE_URL || "";
  return `${supabaseUrl}/storage/v1/object/public/images/${path}`;
}
