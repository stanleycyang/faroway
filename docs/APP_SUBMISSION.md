# Faroway App Store Submission Checklist

Last updated: May 28, 2026

## Pre-Submission Requirements

### App Configuration

- [x] Bundle Identifier: `ai.faroway.app` (iOS)
- [x] Package Name: `ai.faroway.app` (Android)
- [x] Version: 1.0.0
- [x] Build Number: Managed by EAS remote app versioning
- [x] App Icons: Required assets present in `apps/mobile/assets`
- [x] Splash Screen: Configured in `apps/mobile/app.config.ts`
- [x] Orientation: Portrait only
- [x] Supported Devices: iPhone, iPad, Android phone, Android tablet
- [ ] EAS Project ID: Set `EAS_PROJECT_ID` in EAS/build environment
- [ ] Apple Developer Account: Connected through EAS credentials or submit flow
- [ ] Google Play Account: Service-account credentials configured through EAS credentials or submit flow

### Required Local Checks

Run from the repo root:

```bash
bun install
bun run type-check
bun run lint
bun run format:check
bun run test
bun run build
bun run release:check:mobile
```

Run from `apps/web`:

```bash
bunx playwright test
```

## iOS App Store Submission

### Developer Account Setup

- [ ] Apple Developer Program membership active
- [ ] App Store Connect app record created for `ai.faroway.app`
- [ ] App Store Connect app ID for `ai.faroway.app` recorded in the credential manager
- [ ] Apple Team ID recorded in the credential manager
- [ ] Bundle ID registered in Apple Developer Portal
- [ ] Provisioning profiles/certificates managed by EAS credentials

Do not commit Apple account identifiers, App Store Connect IDs, Apple Team IDs, or account emails to this repository.

### App Store Connect Configuration

- [ ] App Name: Faroway - AI Travel Planner
- [ ] Subtitle: Smart Itineraries in Seconds
- [ ] Category: Primary Travel, Secondary Lifestyle
- [ ] Keywords: See `docs/APP_STORE_COPY.md`
- [ ] Description: See `docs/APP_STORE_COPY.md`
- [ ] Promotional Text: See `docs/APP_STORE_COPY.md`
- [ ] Support URL: https://faroway.ai/support
- [ ] Marketing URL: https://faroway.ai
- [ ] Privacy Policy URL: https://faroway.ai/privacy

### Screenshots Required

All screenshots must be actual app captures, not mockups.

Recommended capture set:

1. Home/Explore screen with destinations
2. Trip creation destination step
3. Trip creation preferences step
4. AI itinerary generation progress
5. Completed itinerary day detail
6. Trips list
7. Profile/account screen
8. Shared itinerary/reporting handoff or a real loading/error state

### App Privacy

Disclose only data that is actually collected in the shipping build:

- Email address: account features
- User ID: account/session management
- Product interaction: only if analytics is enabled in production
- User content: shared itinerary links and reports
- Data deletion: available in the mobile Profile tab

Do not disclose platform location collection unless native location permission is added back and verified.

### Review Notes

Add reviewer notes after credentials and a reviewable build exist:

```text
Faroway uses AI to generate travel itineraries.

Suggested review path:
1. Open the app and continue with Apple or Google sign-in.
2. Create a trip for Tokyo, Paris, or Bali.
3. Select dates, travelers, and travel vibes.
4. Generate the itinerary and review the day-by-day plan.
5. Open Trips to confirm the itinerary is saved.
6. Open Profile to review account deletion, Terms, and Privacy links.

Shared itinerary links can be reported through the "Report this itinerary" link on a shared itinerary page.
```

Provide temporary reviewer credentials only through App Store Connect if OAuth review requires them. Do not commit reviewer credentials to this repository.

### Build & Submit

```bash
cd apps/mobile
bunx eas login
bunx eas build --platform ios --profile production
bunx eas submit --platform ios --latest
```

## Google Play Store Submission

### Developer Account Setup

- [ ] Google Play Developer account active
- [ ] App created in Google Play Console for `ai.faroway.app`
- [ ] Android service-account credentials configured through EAS credentials or local submit flow

### Store Listing

- [ ] App Name: Faroway - AI Travel Planner
- [ ] Short Description: See `docs/APP_STORE_COPY.md`
- [ ] Full Description: See `docs/APP_STORE_COPY.md`
- [ ] Category: Travel & Local
- [ ] Tags: Travel, Planner, Itinerary, Vacation

### Graphics Assets Required

| Asset                  | Dimensions   | Format     |
| ---------------------- | ------------ | ---------- |
| App Icon               | 512 x 512    | PNG        |
| Feature Graphic        | 1024 x 500   | PNG or JPG |
| Phone Screenshots      | 16:9 or 9:16 | PNG or JPG |
| 7" Tablet Screenshots  | 16:9 or 9:16 | PNG or JPG |
| 10" Tablet Screenshots | 16:9 or 9:16 | PNG or JPG |

### Privacy & Policies

- [ ] Privacy Policy URL: https://faroway.ai/privacy
- [ ] Data Safety form completed from current implementation
- [ ] Data encrypted in transit: Yes
- [ ] Data deletion request: Available in mobile Profile tab
- [ ] Shared itinerary reporting disclosed

### Build & Submit

```bash
cd apps/mobile
bunx eas build --platform android --profile production
bunx eas submit --platform android --latest
```

## Compliance Checklist

### iOS-Specific

- [x] App Tracking Transparency: No IDFA use in current code
- [x] Sign in with Apple: Enabled
- [x] Export compliance: `usesNonExemptEncryption` is explicit
- [ ] Push Notifications: APNs credentials configured and physical-device production build verified

### Android-Specific

- [x] Adaptive Icon: Configured
- [ ] FCM credentials configured for production push
- [ ] Play internal testing install verified

### Both Platforms

- [x] Privacy Policy hosted
- [x] Terms of Service hosted
- [x] Account deletion option in mobile Profile tab
- [x] Shared itinerary reporting flow present
- [ ] Physical iOS device QA
- [ ] Physical Android device QA
- [ ] Push notification foreground/background/cold-start tap QA

## Rejection Risk Checklist

1. Advertised feature unavailable: keep store copy matched to verified app behavior.
2. OAuth review blocked: provide reviewer access through store dashboards only.
3. Push notification claim unverified: do not claim full push support until physical-device testing passes.
4. Privacy mismatch: update store privacy disclosures whenever analytics, location, or partner data collection changes.
