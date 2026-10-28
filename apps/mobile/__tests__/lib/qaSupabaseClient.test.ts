const mockCreateClient = jest.fn((_url: string, _key: string, _options: unknown) => ({}));
jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }));
jest.mock('expo-secure-store', () => ({}));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
  mockCreateClient.mockClear();
  jest.resetModules();
});

it('selects the dedicated staging public key for QA even when preview has a production key', () => {
  process.env.EXPO_PUBLIC_MOBILE_QA = '1';
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://staging.example';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-production-key';
  process.env.EXPO_PUBLIC_QA_SUPABASE_ANON_KEY = 'synthetic-staging-key';
  require('../../../../packages/supabase/src/mobile');
  expect(mockCreateClient).toHaveBeenCalledWith(
    'https://staging.example',
    'synthetic-staging-key',
    expect.anything()
  );
});

it('does not use the production key when the QA key is missing', () => {
  process.env.EXPO_PUBLIC_MOBILE_QA = '1';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-production-key';
  delete process.env.EXPO_PUBLIC_QA_SUPABASE_ANON_KEY;
  require('../../../../packages/supabase/src/mobile');
  expect(mockCreateClient.mock.calls[0][1]).toBe('');
});

it('preserves ordinary mobile builds', () => {
  delete process.env.EXPO_PUBLIC_MOBILE_QA;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-production-key';
  process.env.EXPO_PUBLIC_QA_SUPABASE_ANON_KEY = 'synthetic-staging-key';
  require('../../../../packages/supabase/src/mobile');
  expect(mockCreateClient.mock.calls[0][1]).toBe('synthetic-production-key');
});
