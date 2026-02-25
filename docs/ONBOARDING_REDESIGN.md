# Faroway Onboarding Redesign

## Problem Statement
Users are being prompted to sign in before experiencing any value. This creates friction and reduces conversion.

## Guiding Principle
**"Show value first, then ask for commitment."**

---

## Current Flow (❌ Problematic)

```
Splash → Onboarding Slides → Preferences → AUTH WALL → App
                                              ↑
                                    User leaves here
```

**Issues:**
- No value demonstrated before asking for account
- User has no emotional investment
- Unclear why they should create an account

---

## New Flow (✅ Optimized)

```
Splash (2s) → Quick Slides → CREATE TRIP → AI Generates → AUTH GATE
                              (anonymous)      (wow!)      (invested)
```

### Flow Details

1. **Welcome Splash** (2 seconds)
   - App logo animation
   - Tagline: "AI-Powered Travel Planning"

2. **Inspiration Slides** (skippable)
   - 3 quick slides showing value props
   - Each slide: image + 1 headline + 1 line description
   - "Skip" always visible, "Get Started" on last slide

3. **Quick Preferences** (optional)
   - "Help us personalize your experience"
   - Vibe selection (optional)
   - Budget preference (optional)
   - "Skip for now" prominently shown

4. **Create First Trip** (THE KEY)
   - User can immediately start planning
   - No account required
   - Full experience: destination, dates, travelers, vibes

5. **AI Generation** (THE WOW MOMENT)
   - Real-time progress indicators
   - "Discovering hidden gems..."
   - "Finding the best restaurants..."
   - User watches their trip come to life

6. **View Itinerary** (FULLY FUNCTIONAL)
   - Complete itinerary displayed
   - Can browse all days
   - Can see all activities
   - "Book" buttons visible

7. **Smart Auth Gate** (THE CONVERSION POINT)
   Triggers when user tries to:
   - Save the trip → "Create account to save this trip"
   - Book something → "Sign in to complete booking"
   - Return later → "Sign in to access your trip"
   - Share trip → "Sign in to share with friends"

---

## Auth Gate Design

### Visual Design
- Bottom sheet modal (not full screen blocking)
- Trip preview visible in background (they can see what they'll lose)
- Friendly, non-aggressive tone

### Copy
```
"Almost there! ✨"

Create a free account to:
📱 Save this trip & access anywhere
🔔 Get price drop alerts for your bookings  
⭐ Build your travel wishlist
🤝 Share & plan with travel companions

[Continue with Apple]
[Continue with Google]
[Continue with Email]

[Maybe Later] ← dimmed, but always available
```

### "Maybe Later" Behavior
- Trip saved locally (survives app restart)
- Gentle reminder badge on profile tab
- Prompt again on next high-intent action

---

## Itinerary Improvements

### Activity Cards - Current vs New

**Current:**
```
[Activity Name]
[Description...]
[Rating] 
[Book Now →]
```

**New:**
```
[Activity Name]                      [$Price]
[Description...]
⭐ 4.8 (2,340 reviews) • "Incredible views!" 
[Book Now - Free Cancellation] [Save ♡]
```

### Key Changes:
1. **Price prominent** - Users want to know cost
2. **Social proof** - Reviews + snippet
3. **Risk reduction** - "Free cancellation" reduces friction
4. **Save option** - Build wishlist without booking

### Booking Flow
1. Tap "Book Now"
2. If not logged in → Auth Gate (with context: "Sign in to book")
3. Opens booking modal with:
   - Date/time selection
   - Number of guests
   - Total price
   - "Reserve Now" button

---

## Technical Implementation

### 1. Update `_layout.tsx`
- Remove auth redirect for unauthenticated users
- Allow access to: index, onboarding, create, trip/[id]
- Only protect: (tabs)/profile, booking actions

### 2. New `AuthGate` Component
```tsx
<AuthGate 
  trigger="save" 
  onAuthenticated={() => saveTrip()}
  onDismiss={() => saveTripLocally()}
/>
```

### 3. Local Storage for Anonymous Trips
- Store draft trips in AsyncStorage
- Key: `faroway_anonymous_trips`
- Migrate to account on sign up

### 4. Update `ActivityCard`
- Add price display
- Add review snippet
- Add "Free cancellation" badge
- Add save/wishlist button

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Onboarding completion | ~40% | 80% |
| Trip creation (first session) | ~15% | 60% |
| Sign-up conversion | ~10% | 35% |
| Time to first trip | >5 min | <2 min |

---

## Implementation Priority

1. **P0**: Allow anonymous trip creation
2. **P0**: Smart AuthGate component
3. **P1**: Improved ActivityCard with booking CTA
4. **P1**: Local trip storage
5. **P2**: Booking modal flow
6. **P2**: Price drop alerts (post-MVP)
