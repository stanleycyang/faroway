/** Explicit, loopback-only developer login. Never creates or trusts a fake session. */
export function isTestLoginEnabled(
  isDev: boolean,
  flag: string | undefined,
  authUrl: string | undefined,
  apiUrl: string | undefined
): boolean {
  const local = (value: string | undefined) => {
    try {
      const url = new URL(value || '');
      return (
        url.protocol === 'http:' &&
        ['127.0.0.1', 'localhost', '10.0.2.2', '[::1]'].includes(url.hostname) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  };
  return isDev && flag === 'true' && local(authUrl) && local(apiUrl);
}

export function testLoginEnabled(): boolean {
  return isTestLoginEnabled(
    typeof __DEV__ !== 'undefined' && __DEV__,
    process.env.EXPO_PUBLIC_TEST_LOGIN,
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_API_URL
  );
}
