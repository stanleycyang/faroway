jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {},
  },
}));

import { PRODUCTION_API_URL, resolveApiBaseUrl } from '../../constants/api';

describe('API configuration', () => {
  it('uses an explicit API URL when provided', () => {
    expect(
      resolveApiBaseUrl({
        isDev: true,
        envUrl: 'https://staging.faroway.ai',
        hostUri: '192.168.1.10:8081',
      })
    ).toBe('https://staging.faroway.ai');
  });

  it('derives a LAN backend URL from the Expo host in development', () => {
    expect(
      resolveApiBaseUrl({
        isDev: true,
        hostUri: '192.168.1.10:8081',
      })
    ).toBe('http://192.168.1.10:3000');
  });

  it('keeps localhost fallback limited to development', () => {
    expect(resolveApiBaseUrl({ isDev: true })).toBe('http://localhost:3000');
    expect(resolveApiBaseUrl({ isDev: false })).toBe(PRODUCTION_API_URL);
  });
});
