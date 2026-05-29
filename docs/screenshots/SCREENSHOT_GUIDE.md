# Faroway Screenshot Guide

This guide explains how to capture screenshots for App Store and Google Play submission.

## Required Screenshot Set

Capture real app screens from a reviewable build:

1. Home/Explore screen
   - Popular destinations visible
   - Plan with AI card visible
   - Search bar visible
   - Caption: "Your Next Adventure Starts Here"

2. Trip Creation - Destination
   - Destination search or selection
   - Destination imagery visible
   - Caption: "Tell Us Where You're Going"

3. Trip Creation - Preferences
   - Travel dates selected
   - Preferences being set
   - Caption: "Personalize Your Trip"

4. AI Generation
   - Generation progress state
   - Clear loading feedback
   - Caption: "AI Builds Your Trip"

5. Itinerary View
   - Day-by-day itinerary
   - Activities with times
   - Timeline design visible
   - Caption: "Beautiful Day-by-Day Plans"

6. Trips List
   - Saved trip cards
   - Refreshable list visible
   - Caption: "Keep Trips Organized"

7. Profile and Account
   - Sign-in/account controls
   - Legal and account deletion links visible
   - Caption: "Stay in Control"

8. Real State Screen
   - Use a verified loading, error, empty, offline, or share/reporting state
   - Do not stage a feature that is not available in the shipping build

## iOS Screenshot Dimensions

| Display Size | Resolution  | Devices                       |
| ------------ | ----------- | ----------------------------- |
| 6.9"         | 1320 x 2868 | iPhone 16 Pro Max             |
| 6.7"         | 1290 x 2796 | iPhone 15 Pro Max, 14 Pro Max |
| 6.5"         | 1284 x 2778 | iPhone 14 Plus, 13 Pro Max    |
| 5.5"         | 1242 x 2208 | iPhone 8 Plus                 |

## Android Screenshot Dimensions

- Phone screenshots: 1080 x 1920 or 1080 x 2400 recommended
- 7-inch tablet: 1200 x 1920 recommended
- 10-inch tablet: 1600 x 2560 recommended
- Feature graphic: 1024 x 500 PNG or JPG

## Screenshot Capture Process

### 1. Start Local Services

From the repo root:

```bash
bun dev:web
```

From `apps/mobile`:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000 bun start
```

### 2. Prepare Review Content

Before capturing:

- Sign in with a test account provided through the store review dashboard.
- Create several sample trips with real destinations.
- Generate at least one complete itinerary.
- Verify the Trips list, Profile screen, legal links, and account deletion controls.
- Use only screens that are functional in the build being submitted.

### 3. Device Capture

**iOS Simulator:**

```bash
xcrun simctl io booted screenshot screenshot.png
```

**Android Emulator:**

```bash
adb shell screencap -p /sdcard/screenshot.png
```

**Physical Device:**

- iPhone: Power + Volume Up
- Android: Power + Volume Down

## Design Guidelines

### Do

- Use actual app screenshots.
- Show real, useful content.
- Keep captions truthful and specific.
- Make overlay text readable.
- Use consistent brand colors and typography.

### Do Not

- Do not show empty states unless the screenshot is explicitly about an empty state.
- Do not show unavailable features.
- Do not include private user data or credentials.
- Do not imply direct purchase completion inside Faroway unless that flow has passed review QA.
