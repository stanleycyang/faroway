const requiredEnv = ['EXPO_PUBLIC_API_URL', 'E2E_SEED_TOKEN'];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[e2e:fixtures:seed] Missing required env: ${key}`);
    process.exit(1);
  }
}

const endpoint = `${process.env.EXPO_PUBLIC_API_URL}/api/e2e/seed`;

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.E2E_SEED_TOKEN}`,
  },
  body: JSON.stringify({
    profile: process.env.E2E_PROFILE || 'default',
    requiredTripIds: ['e2e-demo'],
  }),
});

if (!response.ok) {
  const text = await response.text();
  console.error('[e2e:fixtures:seed] Seed failed:', text);
  process.exit(1);
}

console.log('[e2e:fixtures:seed] Seed complete');
