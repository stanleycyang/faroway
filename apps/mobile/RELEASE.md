# Mobile Release Requirements

This app uses `app.config.ts` as the single Expo config source. Do not add a
second `app.json`; it can drift from the release config.

## EAS Build

Required production environment variables or EAS environment values:

- `EXPO_PUBLIC_API_URL`: public web/API origin, for example `https://faroway.ai`.
- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key.
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`: Google Sign-In web client ID.
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`: Google Sign-In iOS OAuth client ID.
- `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`: reversed iOS client ID URL scheme,
  starting with `com.googleusercontent.apps.`.
- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`: optional Google Places and Static Maps key
  for destination autocomplete/map previews.

The public EAS project ID used by builds and push notifications is committed in
`app.config.ts`.

Run `bun run release:check:mobile` from the repo root, or
`bun run release:check` from `apps/mobile`, before creating a production build.
The local check reads the `production.env` values from `eas.json`, validates the
release-shaped EAS profile, and runs Expo Doctor. Verify any remote-only EAS
secrets in EAS before submitting.

From the repo root, the equivalent command is:

```bash
bun run release:check:mobile
```

## EAS Submit

The `eas.json` submit profile intentionally does not store Apple account
identifiers or Google service-account files. Configure these in EAS credentials
or provide them through the EAS CLI submit flow:

- App Store Connect app ID for bundle `ai.faroway.app`.
- Apple Team ID and Apple ID with App Manager access.
- Android service-account credentials for package `ai.faroway.app`.

## Store Links

Set these public values after the store listings exist:

- `EXPO_PUBLIC_APP_STORE_URL`
- `EXPO_PUBLIC_PLAY_STORE_URL`
- `NEXT_PUBLIC_APP_STORE_URL`
- `NEXT_PUBLIC_PLAY_STORE_URL`

The mobile build maps the `EXPO_PUBLIC_*` values into Expo's
`ios.appStoreUrl` and `android.playStoreUrl` fields for store-review fallback
links. Until real store URLs are present, mobile rating actions fall back to
support instead of pretending the website is a store listing. The website uses
the `NEXT_PUBLIC_*` values in download buttons. Until those values are present,
the website routes download buttons to support instead of a placeholder store
URL.

For isolated native test builds and device acceptance, follow [QA.md](../../docs/mobile/QA.md).

## Push Notification Validation

Faroway only asks users to opt in to itinerary-ready alerts. Before submission:

- Use the official Expo setup guide as the source of truth:
  https://docs.expo.dev/push-notifications/push-notifications-setup/
- Confirm the Expo project has iOS APNs and Android FCM credentials configured
  in EAS credentials.
- Install a production EAS build through TestFlight or Play internal testing on
  a physical device; Expo Go is not a valid push-notification test target.
- Sign in, enable **Notifications > Itinerary Ready Alerts**, and confirm the
  backend stores an Expo push token in `push_tokens`.
- Generate a trip and verify a `trip_generation_complete` push arrives in the
  foreground, background, and cold-start tap paths.
- Check Expo push tickets/receipts for delivery errors and deactivate invalid
  tokens before release.
