import configure, {
  assertQaBuildEnvironment,
  QA_API_ORIGIN,
  QA_SUPABASE_PROJECT_REF,
} from '../../app.config';

const staging = {
  EXPO_PUBLIC_MOBILE_QA: '1',
  EXPO_PUBLIC_SUPABASE_URL: `https://${QA_SUPABASE_PROJECT_REF}.supabase.co`,
  EXPO_PUBLIC_API_URL: QA_API_ORIGIN,
  EXPO_PUBLIC_QA_SUPABASE_ANON_KEY: `fixture.${Buffer.from(JSON.stringify({ ref: QA_SUPABASE_PROJECT_REF, role: 'anon' })).toString('base64url')}.fixture`,
};

it('keeps store identifiers separate from the QA app', () => {
  const original = process.env;
  try {
    process.env = { ...original, ...staging, EAS_BUILD_PROFILE: 'qa', EXPO_PUBLIC_TEST_LOGIN: '' };
    const qa = configure({ config: {} } as Parameters<typeof configure>[0]);
    expect(qa.android?.package).toBe('ai.faroway.app.qa');
    expect(qa.ios?.bundleIdentifier).toBe('ai.faroway.app.qa');
    expect(qa.scheme).toBe('faroway-qa');
    process.env = {
      ...original,
      EAS_BUILD_PROFILE: 'production',
      EXPO_PUBLIC_MOBILE_QA: '',
      EXPO_PUBLIC_TEST_LOGIN: '',
    };
    const production = configure({ config: {} } as Parameters<typeof configure>[0]);
    expect(production.android?.package).toBe('ai.faroway.app');
    expect(production.ios?.bundleIdentifier).toBe('ai.faroway.app');
    expect(production.scheme).toBe('faroway');
  } finally {
    process.env = original;
  }
});

it('requires the isolated database and API for QA without changing ordinary builds', () => {
  expect(() => assertQaBuildEnvironment(staging)).not.toThrow();
  expect(() => assertQaBuildEnvironment({})).not.toThrow();
  expect(() => assertQaBuildEnvironment({ ...staging, EAS_BUILD_PROFILE: 'production' })).toThrow(
    'production store build'
  );
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
