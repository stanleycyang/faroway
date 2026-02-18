/**
 * Validate redirect URLs to prevent open redirect attacks.
 * Only allows relative paths starting with '/'.
 */
export function validateRedirectUrl(url: string | null, fallback = '/dashboard'): string {
  if (!url) return fallback;

  // Must be a relative path
  if (!url.startsWith('/')) return fallback;

  // Block protocol-relative URLs (//evil.com)
  if (url.startsWith('//')) return fallback;

  // Block URLs with backslashes (some browsers interpret \\ as //)
  if (url.includes('\\')) return fallback;

  // Block URLs that could be interpreted as absolute
  if (url.includes(':')) return fallback;

  return url;
}
