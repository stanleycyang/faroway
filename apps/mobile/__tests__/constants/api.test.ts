jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {},
  },
}));

import {
  PRODUCTION_API_URL,
  PRODUCTION_WEB_URL,
  resolveApiBaseUrl,
  resolveWebBaseUrl,
} from '../../constants/api';

describe('API configuration', () => {
  it('ships with the release API origin as the production fallback', () => {
    expect(PRODUCTION_API_URL).toBe('https://faroway.ai');
  });

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

  it('ships with www.faroway.ai as the canonical web origin and separates api.* origins', () => {
    expect(PRODUCTION_WEB_URL).toBe('https://www.faroway.ai');
    expect(
      resolveWebBaseUrl({
        envWebUrl: 'https://preview.faroway.ai',
        envApiUrl: 'https://api.faroway.ai',
      })
    ).toBe('https://preview.faroway.ai');
    expect(
      resolveWebBaseUrl({
        envApiUrl: 'https://api.faroway.ai',
      })
    ).toBe('https://www.faroway.ai');
    expect(
      resolveWebBaseUrl({
        envApiUrl: 'https://staging.faroway.ai/api',
      })
    ).toBe('https://staging.faroway.ai');
    expect(
      resolveWebBaseUrl({
        envApiUrl: 'http://localhost:3000',
      })
    ).toBe('https://www.faroway.ai');
    expect(
      resolveWebBaseUrl({
        envApiUrl: 'https://api-staging.faroway.ai',
      })
    ).toBe('https://www.faroway.ai');
    expect(
      resolveWebBaseUrl({
        envWebUrl: 'http://www.faroway.ai',
      })
    ).toBe('https://www.faroway.ai');
    expect(
      resolveWebBaseUrl({
        envWebUrl: 'https://user:pass@www.faroway.ai',
      })
    ).toBe('https://www.faroway.ai');
    expect(
      resolveWebBaseUrl({
        envWebUrl: 'https://api-staging.faroway.ai',
      })
    ).toBe('https://www.faroway.ai');
    expect(
      resolveWebBaseUrl({
        envWebUrl: 'not-a-url',
      })
    ).toBe('https://www.faroway.ai');
  });
});
