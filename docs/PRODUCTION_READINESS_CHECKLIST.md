# Production Readiness Checklist

Use this before a launch candidate is promoted.

## Required Gates

- `bun run format:check`
- `bun run type-check`
- `bun run lint`
- `bun run test`
- `bun run build`
- `bun run release:check:mobile`
- `cd apps/web && bunx playwright test`

## Mobile Release

- Required env vars are set for release: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`.
- Native iOS simulator or device QA covers onboarding, auth, trip creation, itinerary generation/streaming, trips list, trip detail, profile/preferences, push notifications, and offline/restore behavior.
- User-facing copy matches the actual auth and save model.
- Buttons that submit network actions prevent duplicate submissions and show loading/error states.

## Backend and Data

- Protected routes derive user identity from the authenticated request, not client-provided IDs.
- Mutations are owner-scoped and covered by tests for unauthorized/not-found behavior.
- Request bodies validate input shape, calendar dates, date ranges, UUIDs, URLs, and enum fields server-side.
- Abuse-prone endpoints use the shared rate-limit utility, preferably the async KV-backed path.
- Safe error responses are returned to clients; sensitive details stay in server logs.

## Security and Observability

- No secrets, bearer tokens, push tokens, or raw credential values are logged or committed.
- Sentry is configured for web and mobile production environments.
- Production logging avoids console spam and uses structured, searchable context.
- Public client env vars are intentionally public; secret service-role keys remain server-only.

## Deployment

- Database migrations/RLS policy changes are reviewed before deploy.
- Production Supabase URL/anon key, image buckets, and required storage assets are verified.
- EAS project configuration and bundle IDs match the intended production app.
- Playwright browser dependencies are installed on the machine/CI runner used for release validation.
