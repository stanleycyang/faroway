import { isQaLoginEnabled, isTestLoginEnabled } from '../../lib/testLogin';
const auth = 'http://127.0.0.1:55421';
const api = 'http://localhost:3011';
it('requires development, opt-in and two local services', () => {
  expect(isTestLoginEnabled(true, 'true', auth, api)).toBe(true);
  expect(isTestLoginEnabled(false, 'true', auth, api)).toBe(false);
  expect(isTestLoginEnabled(true, undefined, auth, api)).toBe(false);
  for (const remote of [
    'https://faroway.ai',
    'https://omovikloadpvzijoaqus.supabase.co',
    'http://127.0.0.1.evil.invalid',
    'http://user:pass@localhost',
    'bad-url',
    undefined,
  ]) {
    expect(isTestLoginEnabled(true, 'true', remote, api)).toBe(false);
    expect(isTestLoginEnabled(true, 'true', auth, remote)).toBe(false);
  }
});

it('allows QA password login only for the exact isolated staging pair', () => {
  const auth = 'https://omovikloadpvzijoaqus.supabase.co';
  const api = 'https://faroway-git-verify-staging-readiness-20261018-testimonio.vercel.app';
  expect(isQaLoginEnabled('1', auth, api)).toBe(true);
  expect(isQaLoginEnabled(undefined, auth, api)).toBe(false);
  expect(isQaLoginEnabled('1', 'https://jcnephijkxgtprsutgsf.supabase.co', api)).toBe(false);
  expect(isQaLoginEnabled('1', auth, 'https://faroway.ai')).toBe(false);
  expect(isQaLoginEnabled('1', auth, `${api}.evil.invalid`)).toBe(false);
});
