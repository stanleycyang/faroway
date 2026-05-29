# Faroway Credential Setup Runbook

Last updated: May 28, 2026

This runbook lists required production credentials and where to configure them. Do not commit credential values, service-account files, private keys, or reviewer login credentials to this repository.

## Local Development

Use local `.env.local` files only:

- Root: `.env.local`
- Web/API: `apps/web/.env.local`
- Mobile: `apps/mobile/.env.local`

Start from the examples:

```bash
cp .env.example .env.local
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local
```

Validate without printing raw values:

```bash
bun run env:check
bun run release:check:mobile
```

## Web and API Production

Configure these in Vercel project environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_BASE_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `NEXT_PUBLIC_APP_VERSION`

AI provider keys are optional but required for live itinerary generation beyond fallback/test behavior:

- `AI_GATEWAY_API_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_AI_API_KEY`

Travel and enrichment providers are optional. Missing provider credentials must degrade gracefully:

- `GOOGLE_PLACES_API_KEY`
- `VIATOR_API_KEY`
- `VIATOR_PARTNER_ID`
- `BOOKING_COM_TOKEN`
- `BOOKING_COM_AFFILIATE_ID`
- `BOOKING_COM_USERNAME`
- `BOOKING_COM_PASSWORD`
- `AMADEUS_CLIENT_ID`
- `AMADEUS_CLIENT_SECRET`
- `DUFFEL_API_TOKEN`
- `TRIPADVISOR_API_KEY`
- `GETYOURGUIDE_API_KEY`
- `GETYOURGUIDE_PARTNER_ID`
- `TAVILY_API_KEY`

## Mobile Production

Configure public mobile values in EAS environment variables or `eas.json` only when they are safe to expose:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`
- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EAS_PROJECT_ID`

Do not put Apple IDs, App Store Connect IDs, team IDs, service-account files, private keys, API tokens, or passwords in `eas.json`.

## OAuth Setup

### Google Sign-In

1. Create web and iOS OAuth clients in Google Cloud Console.
2. Add the web client ID/secret to Supabase Auth provider settings.
3. Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
4. Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
5. Set `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` to the reversed iOS client ID scheme.
6. Confirm the iOS URL scheme appears in `bunx expo config --type prebuild --json`.

### Apple Sign-In

1. Register the app bundle `ai.faroway.app`.
2. Configure Sign in with Apple in Apple Developer and Supabase Auth.
3. Keep Apple private key material in Supabase or the credential manager, not in this repo.
4. Verify Apple sign-in on an iOS simulator where supported and on a physical device before store submission.

## Push Notifications

Push cannot be fully verified on the simulator.

1. Configure APNs and FCM credentials through EAS credentials.
2. Build a production or preview binary.
3. Install it on physical iOS and Android devices.
4. Enable itinerary-ready alerts in the app.
5. Confirm `push_tokens` receives an Expo push token.
6. Generate a trip and verify foreground, background, and cold-start tap behavior.
7. Check Expo push tickets/receipts for delivery errors.

## Credential Rotation Before Launch

Rotate credentials immediately if there is any suspicion of prior exposure:

1. Supabase service role key.
2. Supabase anon key.
3. Google Cloud service-account keys.
4. OAuth client secrets.
5. Sentry auth token.
6. Travel provider API keys.

After rotation:

1. Update Vercel/EAS/Supabase dashboards.
2. Redeploy web/API.
3. Rebuild mobile if public Expo values changed.
4. Run the full launch verification checklist.
