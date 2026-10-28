import { assertQaBuildEnvironment, QA_API_ORIGIN, QA_SUPABASE_PROJECT_REF } from '../../app.config';

const staging = {
  EXPO_PUBLIC_MOBILE_QA: '1',
  EXPO_PUBLIC_SUPABASE_URL: `https://${QA_SUPABASE_PROJECT_REF}.supabase.co`,
  EXPO_PUBLIC_API_URL: QA_API_ORIGIN,
  EXPO_PUBLIC_QA_SUPABASE_ANON_KEY: `fixture.${Buffer.from(JSON.stringify({ ref: QA_SUPABASE_PROJECT_REF, role: 'anon' })).toString('base64url')}.fixture`,
};

it('requires the isolated database and API for QA without changing ordinary builds', () => {
  expect(() => assertQaBuildEnvironment(staging)).not.toThrow();
  expect(() => assertQaBuildEnvironment({})).not.toThrow();
  for (const EXPO_PUBLIC_SUPABASE_URL of [undefined, 'https://jcnephijkxgtprsutgsf.supabase.co']) {
    expect(() => assertQaBuildEnvironment({ ...staging, EXPO_PUBLIC_SUPABASE_URL })).toThrow(
      'isolated'
    );
  }
  for (const EXPO_PUBLIC_API_URL of [undefined, 'https://faroway.ai', 'http://localhost:3000']) {
    expect(() => assertQaBuildEnvironment({ ...staging, EXPO_PUBLIC_API_URL })).toThrow(
      'staging API'
    );
  }
  expect(() =>
    assertQaBuildEnvironment({ ...staging, EXPO_PUBLIC_QA_SUPABASE_ANON_KEY: '' })
  ).toThrow('public Supabase key');
  for (const payload of [
    { ref: 'production', role: 'anon' },
    { ref: QA_SUPABASE_PROJECT_REF, role: 'service_role' },
  ]) {
    const key = `fixture.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.fixture`;
    expect(() =>
      assertQaBuildEnvironment({ ...staging, EXPO_PUBLIC_QA_SUPABASE_ANON_KEY: key })
    ).toThrow('isolated staging project');
  }
});
