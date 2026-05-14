// Auth token managed via Supabase SecureStore - this is an in-memory cache only.
// Do NOT persist this token to AsyncStorage or other insecure storage.
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export async function getApiHeaders(
  headers: Record<string, string> = {},
  tokenOverride?: string
): Promise<Record<string, string>> {
  const token = tokenOverride ?? authToken;

  return {
    'Content-Type': 'application/json',
    ...headers,
    ...(token && {
      Authorization: `Bearer ${token}`,
    }),
  };
}
