if (!process.env.EXPO_PUBLIC_API_URL || !process.env.E2E_SEED_TOKEN) {
  console.log('[e2e:fixtures:teardown] Skipping teardown (missing env)');
  process.exit(0);
}

const endpoint = `${process.env.EXPO_PUBLIC_API_URL}/api/e2e/teardown`;

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.E2E_SEED_TOKEN}`,
  },
  body: JSON.stringify({
    profile: process.env.E2E_PROFILE || 'default',
  }),
});

if (!response.ok) {
  const text = await response.text();
  console.error('[e2e:fixtures:teardown] Teardown failed:', text);
  process.exit(1);
}

console.log('[e2e:fixtures:teardown] Teardown complete');
