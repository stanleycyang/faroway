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

/** QA uses ordinary password authentication against the isolated staging project. */
export function isQaLoginEnabled(
  flag: string | undefined,
  authUrl: string | undefined,
  apiUrl: string | undefined
): boolean {
  return (
    flag === '1' &&
    authUrl === 'https://omovikloadpvzijoaqus.supabase.co' &&
    apiUrl === 'https://faroway-git-verify-staging-readiness-20261018-testimonio.vercel.app'
  );
}

export function qaLoginEnabled(): boolean {
  return isQaLoginEnabled(
    process.env.EXPO_PUBLIC_MOBILE_QA,
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_API_URL
  );
}

export function emailLoginEnabled(): boolean {
  return testLoginEnabled() || qaLoginEnabled();
}
