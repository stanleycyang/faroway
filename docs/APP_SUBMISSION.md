# Faroway - App Store Submission Checklist

Last updated: February 3, 2026

---

## Pre-Submission Requirements

### ✅ App Configuration

- [x] **Bundle Identifier:** `ai.faroway.app` (iOS)
- [x] **Package Name:** `ai.faroway.app` (Android)
- [x] **Version:** 1.0.0
- [x] **Build Number:** Managed by EAS
- [x] **App Icons:** All sizes generated (1024x1024 source)
- [x] **Splash Screen:** Configured with brand colors
- [x] **Orientation:** Portrait only
- [x] **Supported Devices:** iPhone, iPad (iOS), Phone, Tablet (Android)

### ✅ EAS Configuration

- [x] **eas.json:** Created with development/preview/production profiles
- [ ] **EAS Project ID:** Link project with `eas init`
- [ ] **Apple Developer Account:** Connected to EAS
- [ ] **Google Play Account:** Service account JSON configured

---

## iOS App Store Submission

### Developer Account Setup
- [ ] Apple Developer Program membership active ($99/year)
- [ ] App Store Connect app record created
- [ ] Bundle ID registered in Apple Developer Portal
- [ ] Provisioning profiles generated

### App Store Connect Configuration
- [ ] **App Name:** Faroway - AI Travel Planner
- [ ] **Subtitle:** Smart Itineraries in Seconds
- [ ] **Category:** Primary: Travel, Secondary: Lifestyle
- [ ] **Keywords:** (100 chars) - See APP_STORE_COPY.md
- [ ] **Description:** (4000 chars) - See APP_STORE_COPY.md
- [ ] **Promotional Text:** - See APP_STORE_COPY.md
- [ ] **Support URL:** https://faroway.ai/support
- [ ] **Marketing URL:** https://faroway.ai
- [ ] **Privacy Policy URL:** https://faroway.ai/privacy

### Screenshots Required
All screenshots must be actual app captures, not mockups.

#### iPhone Screenshots (Required)
| Size | Dimensions | Device |
|------|------------|--------|
| 6.9" | 1320 x 2868 | iPhone 16 Pro Max |
| 6.7" | 1290 x 2796 | iPhone 15 Pro Max |
| 6.5" | 1284 x 2778 | iPhone 14 Plus / 13 Pro Max |
| 5.5" | 1242 x 2208 | iPhone 8 Plus |

#### iPad Screenshots (Required if supporting iPad)
| Size | Dimensions | Device |
|------|------------|--------|
| 13" | 2064 x 2752 | iPad Pro 13" |
| 12.9" | 2048 x 2732 | iPad Pro 12.9" |

**Screenshots to capture:**
1. Home/Explore screen with destinations
2. Trip creation flow
3. AI-generated itinerary
4. Day-by-day view
5. Map view with pins
6. Offline mode indicator
7. My Trips list
8. Profile/Settings

### App Preview Video (Optional but Recommended)
- 15-30 seconds showing key features
- No hands or device frames
- Proper dimensions for each device size

### Age Rating
- [ ] Questionnaire completed (Target: 4+)
- No violence, sexual content, gambling, or mature themes

### App Privacy
- [ ] Privacy nutrition labels configured
- [ ] Data collection disclosure:
  - Email address (Account features)
  - Location (Optional, for navigation)
  - Identifiers (Device ID for analytics)

### Review Notes
Add notes for Apple reviewers:
```
Demo account for testing:
Email: demo@faroway.ai
Password: DemoTrip2026!

The app uses AI to generate travel itineraries. Test by:
1. Select a destination (e.g., Tokyo, Japan)
2. Set travel dates
3. Tap "Generate Itinerary"
4. View the AI-created day-by-day plan

Offline mode can be tested by enabling Airplane mode after generating an itinerary.
```

### Build & Submit
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project (first time only)
eas init

# Build for iOS production
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --latest
```

---

## Google Play Store Submission

### Developer Account Setup
- [ ] Google Play Developer account active ($25 one-time)
- [ ] App created in Google Play Console
- [ ] Service account JSON for automated submissions

### Store Listing
- [ ] **App Name:** Faroway - AI Travel Planner
- [ ] **Short Description:** (80 chars) - See APP_STORE_COPY.md
- [ ] **Full Description:** (4000 chars) - See APP_STORE_COPY.md
- [ ] **Category:** Travel & Local
- [ ] **Tags:** Travel, Planner, Itinerary, AI, Vacation

### Graphics Assets Required

| Asset | Dimensions | Format |
|-------|------------|--------|
| App Icon | 512 x 512 | PNG (32-bit with alpha) |
| Feature Graphic | 1024 x 500 | PNG or JPG |
| Phone Screenshots | 16:9 or 9:16 | PNG or JPG |
| 7" Tablet Screenshots | 16:9 or 9:16 | PNG or JPG |
| 10" Tablet Screenshots | 16:9 or 9:16 | PNG or JPG |

### Screenshots (2-8 per device type)
- Same screens as iOS
- Add marketing text overlays

### Content Rating
- [ ] IARC questionnaire completed
- Expected rating: Everyone / PEGI 3

### Privacy & Policies
- [ ] **Privacy Policy URL:** https://faroway.ai/privacy
- [ ] **Data Safety form completed:**
  - Location: Optional, shared for navigation
  - Personal info: Email for account
  - Identifiers: Device ID for analytics
  - Data encrypted in transit: Yes
  - Data deletion request: Available

### Target Audience
- [ ] **Target Age:** All ages (not primarily for children)
- [ ] App is not designed for children under 13

### Build & Submit
```bash
# Build for Android production
eas build --platform android --profile production

# Submit to Google Play
eas submit --platform android --latest

# Or upload manually:
# Build outputs an .aab file - upload to Play Console > Release > Production
```

---

## Compliance Checklist

### iOS-Specific
- [x] **App Tracking Transparency:** Not using IDFA, no ATT prompt needed
- [x] **Sign in with Apple:** Implemented (required if any social login)
- [x] **Camera/Photo Permissions:** Proper usage descriptions in Info.plist
- [ ] **Push Notifications:** APNs certificate configured

### Android-Specific
- [x] **Adaptive Icon:** Configured with foreground/background
- [x] **Target SDK:** API 34 (Android 14)
- [ ] **Google Services:** google-services.json configured
- [ ] **Push Notifications:** FCM configured

### Both Platforms
- [x] **Privacy Policy:** Created and hosted
- [x] **Terms of Service:** Created and hosted
- [x] **GDPR Compliance:**
  - Data export functionality
  - Account deletion option
  - Consent for data collection
  - EU data processing disclosure
- [x] **CCPA Compliance:**
  - "Do Not Sell My Data" option
  - California privacy notice
- [x] **Children's Privacy (COPPA):**
  - App is not directed at children
  - No data collection from users under 13

---

## Testing Checklist

### Pre-submission Testing
- [ ] Test on physical iPhone device
- [ ] Test on physical Android device
- [ ] Test on iPad
- [ ] Test on Android tablet
- [ ] Test offline mode (airplane mode)
- [ ] Test push notifications
- [ ] Test sign in / sign up flow
- [ ] Test itinerary generation
- [ ] Test all navigation paths
- [ ] Test dark mode
- [ ] Test accessibility (VoiceOver/TalkBack)

### TestFlight (iOS)
- [ ] Upload build to TestFlight
- [ ] Add internal testers
- [ ] Add external testers (optional)
- [ ] Collect feedback before public release

### Play Console Internal Testing
- [ ] Upload build to internal testing track
- [ ] Add internal testers
- [ ] Test in-app updates (if applicable)
- [ ] Verify play store listing preview

---

## Post-Submission

### After Approval
- [ ] Announce on social media
- [ ] Update website with download links
- [ ] Set up app analytics monitoring
- [ ] Prepare for first bug fix release
- [ ] Monitor reviews and ratings

### Review Rejection Handling
If rejected, common issues and fixes:
1. **Metadata issues:** Update descriptions/screenshots
2. **Crashes:** Fix and resubmit build
3. **Missing functionality:** Ensure all advertised features work
4. **Privacy issues:** Update privacy policy or disclosures
5. **Login issues:** Provide demo account or fix auth flow

---

## Timeline Estimate

| Task | Duration |
|------|----------|
| Account setup | 1-2 days |
| Screenshots & assets | 2-3 hours |
| Store listing copy | 1-2 hours |
| Build submission | 30 mins |
| Apple review | 1-7 days |
| Google review | 1-3 days |

**Total estimated time to stores:** 3-10 days

---

## Important URLs

- **Apple Developer Portal:** https://developer.apple.com
- **App Store Connect:** https://appstoreconnect.apple.com
- **Google Play Console:** https://play.google.com/console
- **EAS Dashboard:** https://expo.dev
- **App Privacy:** https://faroway.ai/privacy
- **App Terms:** https://faroway.ai/terms
- **Support:** https://faroway.ai/support

---

## Contacts

**Developer Account Owner:** Stanley Yang  
**Support Email:** support@faroway.ai  
**Technical Contact:** dev@faroway.ai
