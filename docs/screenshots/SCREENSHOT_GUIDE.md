# Faroway Screenshot Guide

This guide explains how to capture and prepare screenshots for App Store and Google Play submission.

---

## Required Screenshots

### Screenshots to Capture (8 screens)

1. **Home/Explore Screen**
   - Show popular destinations
   - "Plan with AI" card visible
   - Search bar visible
   - Caption: "Your Next Adventure Starts Here"

2. **Trip Creation - Destination**
   - Destination search or selection
   - Beautiful destination imagery
   - Caption: "Tell Us Where You're Going"

3. **Trip Creation - Preferences**
   - Travel dates selected
   - Preferences being set
   - Caption: "Personalize Your Trip"

4. **AI Generation (Loading)**
   - AI generating itinerary animation
   - Progress indicator
   - Caption: "AI Creates Your Perfect Trip"

5. **Itinerary View - Day Detail**
   - Day-by-day itinerary
   - Activities with times
   - Beautiful timeline design
   - Caption: "Beautiful Day-by-Day Plans"

6. **Map View**
   - Interactive map with pins
   - Route visualization
   - Caption: "See It All on the Map"

7. **Offline Mode Indicator**
   - Show offline badge/indicator
   - Itinerary still accessible
   - Caption: "Works Without WiFi"

8. **My Trips List**
   - Multiple saved trips
   - Cards with destination images
   - Caption: "All Your Trips in One Place"

---

## iOS Screenshot Dimensions

### Required Sizes

| Display Size | Resolution | Devices |
|--------------|------------|---------|
| 6.9" | 1320 x 2868 | iPhone 16 Pro Max |
| 6.7" | 1290 x 2796 | iPhone 15 Pro Max, 14 Pro Max |
| 6.5" | 1284 x 2778 | iPhone 14 Plus, 13 Pro Max |
| 5.5" | 1242 x 2208 | iPhone 8 Plus (required fallback) |

### iPad Sizes (If Supporting Tablet)

| Display Size | Resolution | Devices |
|--------------|------------|---------|
| 13" | 2064 x 2752 | iPad Pro 13" (M4) |
| 12.9" | 2048 x 2732 | iPad Pro 12.9" |

---

## Android Screenshot Dimensions

### Phone Screenshots
- Minimum: 320 x 320 px
- Maximum: 3840 x 3840 px
- Recommended: 1080 x 1920 (16:9) or 1080 x 2400 (9:20)

### Tablet Screenshots (7" & 10")
- 7-inch: 1200 x 1920 recommended
- 10-inch: 1600 x 2560 recommended

### Feature Graphic
- **Size:** 1024 x 500 px
- **Format:** PNG or JPG
- **Content:** App logo + tagline + travel imagery

---

## Screenshot Capture Process

### 1. Set Up Test Environment

```bash
# Start the app in development
cd /Users/stanleyyang/.openclaw/workspace/faroway
npx expo start
```

### 2. Prepare Demo Content

Before capturing:
- Log into a demo account
- Create 3-4 sample trips with nice destinations
- Generate at least one complete itinerary
- Enable offline mode for one trip

### 3. Device Capture Settings

**iOS Simulator:**
```bash
# Capture screenshot
xcrun simctl io booted screenshot screenshot.png

# Or use Cmd+S in Simulator
```

**Android Emulator:**
- Use Android Studio's screenshot tool
- Or `adb shell screencap -p /sdcard/screenshot.png`

**Physical Device (Recommended):**
- iPhone: Power + Volume Up
- Android: Power + Volume Down

### 4. Post-Processing

Add marketing overlays using Figma, Sketch, or similar:

**Overlay Template:**
- Background: Device screenshot
- Top: Caption text (bold, readable)
- Optional: Subtitle text (smaller)
- Consistent branding and colors

**Text Guidelines:**
- Font: SF Pro or similar sans-serif
- Caption: 48-64pt bold
- Subtitle: 24-32pt regular
- Colors: White text with subtle shadow for contrast

---

## Design Guidelines

### Do's ✅
- Use actual app screenshots (not mockups)
- Show real, useful content
- Use consistent branding
- Make text readable
- Highlight key features
- Show the app in best light
- Use high-quality images

### Don'ts ❌
- Don't use fake data that looks fake
- Don't show empty states
- Don't include personal information
- Don't show error states
- Don't use misleading imagery
- Don't include competitor names
- Don't use excessive device frames

---

## Color Palette for Overlays

Based on Faroway branding:

| Color | Hex | Usage |
|-------|-----|-------|
| Primary | #FF6B6B | Accent, highlights |
| Dark BG | #0a0a0a | App background |
| White | #FFFFFF | Text on dark |
| Neutral | #374151 | Secondary text |

---

## File Naming Convention

```
faroway_[platform]_[size]_[number]_[screen].png

Examples:
faroway_ios_6.7_01_home.png
faroway_ios_6.7_02_create.png
faroway_android_phone_01_home.png
faroway_android_feature_graphic.png
```

---

## Output Folder Structure

```
docs/screenshots/
├── ios/
│   ├── 6.9/
│   │   ├── 01_home.png
│   │   ├── 02_create.png
│   │   └── ...
│   ├── 6.7/
│   ├── 6.5/
│   ├── 5.5/
│   └── ipad/
├── android/
│   ├── phone/
│   ├── tablet_7/
│   ├── tablet_10/
│   └── feature_graphic.png
└── raw/
    └── (unprocessed captures)
```

---

## Feature Graphic (Android)

### Requirements
- Size: 1024 x 500 px
- Format: PNG or JPG (no alpha)

### Content Suggestions
- App icon on left side
- App name "Faroway"
- Tagline: "AI-Powered Travel Planning"
- Background: Travel imagery (beach, city, mountains)
- Clean, professional design

---

## Localization

For international markets, create localized versions:

1. Translate caption text
2. Show localized app content (if available)
3. Use region-appropriate destinations

Priority languages:
1. English (US)
2. Spanish
3. French
4. German
5. Japanese

---

## Tools Recommended

### Design Tools
- **Figma** (free) - Screenshot frames and overlays
- **Sketch** - macOS design tool
- **Canva** - Quick and easy designs
- **Adobe Photoshop** - Professional editing

### Screenshot Tools
- **iOS Simulator** - Built into Xcode
- **Android Emulator** - Built into Android Studio
- **Screenshots.Pro** - Marketing frames
- **AppLaunchpad** - Screenshot templates

### Automation
- **Fastlane Snapshot** - Automated iOS screenshots
- **Screengrab** - Automated Android screenshots

---

## Checklist

- [ ] Capture all 8 screens on iOS
- [ ] Capture all 8 screens on Android
- [ ] Create 6.9" iPhone screenshots
- [ ] Create 6.7" iPhone screenshots
- [ ] Create 6.5" iPhone screenshots
- [ ] Create 5.5" iPhone screenshots
- [ ] Create iPad screenshots (if supporting)
- [ ] Create Android phone screenshots
- [ ] Create Android tablet screenshots
- [ ] Create Feature Graphic (Android)
- [ ] Add marketing overlays to all
- [ ] Export in correct dimensions
- [ ] Name files correctly
- [ ] Review for quality and accuracy
