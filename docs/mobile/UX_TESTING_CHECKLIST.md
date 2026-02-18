# TripGenie UX Testing Checklist

Use this checklist to verify all UX improvements are working correctly.

---

## 📱 General

- [ ] App launches smoothly
- [ ] No console errors on startup
- [ ] All screens render correctly
- [ ] Navigation transitions are smooth (no jank)

---

## 🎭 Haptic Feedback

### Onboarding
- [ ] "Next" button gives light haptic
- [ ] "Skip" button gives light haptic
- [ ] "Start Planning" gives success haptic

### Auth (Login/Signup)
- [ ] Social login buttons give light haptic
- [ ] Email login gives light haptic on press
- [ ] Success login gives success haptic
- [ ] Error login gives error haptic
- [ ] Signup button gives appropriate haptics

### Home Tab
- [ ] Search interaction gives feedback
- [ ] Hero "Start Planning" card gives medium haptic
- [ ] Inspiration chips give light haptic
- [ ] Destination cards give light haptic

### Create Trip
- [ ] Destination selection gives selection haptic
- [ ] Traveler +/- buttons give light haptic
- [ ] Traveler type selection gives selection haptic
- [ ] Vibe selection gives medium haptic
- [ ] Max vibes (5) gives error haptic
- [ ] "Generate Itinerary" gives success haptic

### Trips Tab
- [ ] Tab switching gives selection haptic
- [ ] Trip card tap gives light haptic
- [ ] "Create" button gives medium haptic

### Trip Detail
- [ ] Day switching gives selection haptic
- [ ] Pull-to-refresh gives light + success haptic
- [ ] Activity card interactions give feedback

### Profile
- [ ] All menu items give light haptic on tap
- [ ] Settings button gives haptic
- [ ] Logout gives haptic

---

## ✨ Animations

### Button Component
- [ ] Buttons scale down to 0.96 on press
- [ ] Scale animation is smooth (spring-based)
- [ ] Disabled buttons don't animate
- [ ] Loading state shows spinner without scale

### Onboarding
- [ ] Content fades in on slide change
- [ ] Slide animation is smooth
- [ ] Dots animate on page change
- [ ] Final slide shows value props with fade

### Auth Screens
- [ ] Form inputs have proper focus
- [ ] Error containers fade in smoothly
- [ ] Keyboard avoidance works properly
- [ ] Transitions between login/signup are smooth

### Home Tab
- [ ] Header fades in on mount
- [ ] Hero card has proper styling
- [ ] ScrollView tracks scroll position
- [ ] Destination cards scroll smoothly

### Create Trip
- [ ] Destination selection animates
- [ ] Selected destination displays properly
- [ ] Vibe pills have selected state animation
- [ ] Bottom bar stays fixed during scroll

### Trip Detail
- [ ] **Parallax**: Header image scales on pull-down
- [ ] **Parallax**: Header translates on scroll
- [ ] Pull-to-refresh indicator appears
- [ ] Day tabs scroll horizontally
- [ ] Selected day tab highlights smoothly

---

## 🎨 Visual Design

### Typography
- [ ] All text is readable (proper contrast)
- [ ] Font sizes are consistent
- [ ] Line heights are comfortable
- [ ] Font weights create proper hierarchy

### Colors
- [ ] Primary orange is consistent (#ec7a1c)
- [ ] Neutrals follow scale (50-950)
- [ ] Error states use red (#ef4444)
- [ ] Success states use green (#22c55e)

### Spacing
- [ ] Consistent padding throughout (8px grid)
- [ ] Cards have proper margins
- [ ] Sections have breathing room
- [ ] No overlapping elements

### Shadows
- [ ] Cards have appropriate shadows
- [ ] Buttons have depth
- [ ] Modals stand out from background
- [ ] Shadows don't look pixelated

---

## 🔧 Component Functionality

### Inputs
- [ ] Email input has keyboard type
- [ ] Password field toggles visibility
- [ ] Icons display properly
- [ ] Focus states are clear
- [ ] Error states show inline

### Buttons
- [ ] Primary button uses orange
- [ ] Secondary button uses neutral
- [ ] Outline button has border
- [ ] Ghost button is transparent
- [ ] Loading state works
- [ ] Disabled state is visible

### Cards
- [ ] Images load properly
- [ ] Gradient overlays work
- [ ] Text is readable over images
- [ ] Tap feedback is immediate

### VibeSelector
- [ ] Shows "0/5" initially
- [ ] Updates count on selection
- [ ] Max 5 selection enforced
- [ ] Error haptic on 6th selection
- [ ] Selected pills have proper style
- [ ] Deselection works

---

## 📱 Screen-Specific

### Welcome Screen (index.tsx)
- [ ] Background image displays
- [ ] Logo animates in
- [ ] Title fades in
- [ ] Buttons appear last
- [ ] "Get Started" navigates correctly
- [ ] "I already have an account" works

### Onboarding
- [ ] All 3 slides display
- [ ] Images load properly
- [ ] Swiping works
- [ ] Pagination dots update
- [ ] "Skip" goes to tabs
- [ ] "Start Planning" goes to tabs

### Login Screen
- [ ] Google button shows logo
- [ ] Apple button shows (iOS only)
- [ ] Email/password inputs work
- [ ] "Forgot password" link works
- [ ] Inline errors display
- [ ] "Sign up" link navigates
- [ ] "Continue without account" works

### Signup Screen
- [ ] All 4 input fields work
- [ ] Password validation (min 8 chars)
- [ ] Confirm password matching
- [ ] Inline errors display
- [ ] Social signup works
- [ ] Terms link is visible

### Home Tab
- [ ] Greeting shows (morning/afternoon/evening)
- [ ] Search bar is functional
- [ ] Hero card is prominent
- [ ] Inspirations scroll horizontally
- [ ] Destination cards display
- [ ] Social proof shows
- [ ] Trending grid displays 4 items

### Trips Tab
- [ ] Filter tabs work (All/Upcoming/Past)
- [ ] Empty state shows for new users
- [ ] Sample trips display
- [ ] Trip cards are tappable
- [ ] Add button (+) works

### Create Trip
- [ ] Destination search works
- [ ] Destination selection works
- [ ] "Change" button appears
- [ ] Date pickers work
- [ ] Traveler counter works (1-10)
- [ ] Traveler types select
- [ ] Vibe selector works
- [ ] Bottom bar "Generate" is disabled initially
- [ ] Bottom bar enables when ready

### Generating Screen
- [ ] Destination displays
- [ ] Loading animation spins
- [ ] Progress bar animates
- [ ] Steps change with emoji
- [ ] Trip details show
- [ ] Navigates to trip detail on complete

### Trip Detail
- [ ] Hero image displays
- [ ] Back button works
- [ ] Heart/share buttons present
- [ ] Destination/country show
- [ ] Date range displays
- [ ] Traveler count shows
- [ ] Vibes chips display
- [ ] Day selector scrolls
- [ ] Selected day highlights
- [ ] Activities timeline displays
- [ ] Activity cards have proper icons
- [ ] "Book Now" buttons present
- [ ] Pull-to-refresh works
- [ ] Parallax scrolling works
- [ ] Bottom bar shows cost
- [ ] "Book All" button works

### Profile Tab
- [ ] Avatar displays
- [ ] User name shows
- [ ] Email displays
- [ ] Stats show (total/upcoming/completed)
- [ ] Premium banner displays
- [ ] All menu items are tappable
- [ ] Settings sections organized
- [ ] "Log Out" works
- [ ] App version shows at bottom

---

## 🚀 Performance

### Animations
- [ ] All animations run at 60fps
- [ ] No dropped frames on scroll
- [ ] Transitions feel instant (< 350ms)
- [ ] Native driver used everywhere

### Images
- [ ] Images load progressively
- [ ] No layout shift on image load
- [ ] Proper aspect ratios maintained
- [ ] Gradients overlay text areas

### Scroll Performance
- [ ] Lists scroll smoothly
- [ ] No jank on long lists
- [ ] Pull-to-refresh is responsive
- [ ] Parallax doesn't lag

---

## 🐛 Edge Cases

### Keyboard
- [ ] Keyboard doesn't hide content
- [ ] Keyboard dismisses on submit
- [ ] Return key submits forms
- [ ] Tab key moves between inputs

### Errors
- [ ] Network errors show inline
- [ ] Form validation is clear
- [ ] Empty states are helpful
- [ ] Retry options available

### Loading
- [ ] Skeleton screens display
- [ ] Spinners show for async actions
- [ ] No blank screens during load
- [ ] Proper loading → content transition

### Navigation
- [ ] Back button works everywhere
- [ ] Deep links work (trip/[id])
- [ ] Modal dismiss works
- [ ] Tab switching preserves state

---

## 📊 Platform-Specific

### iOS
- [ ] Safe area insets respected
- [ ] Notch doesn't hide content
- [ ] Home indicator has space
- [ ] Native feel maintained
- [ ] Apple login works

### Android
- [ ] Status bar color correct
- [ ] Navigation bar handled
- [ ] Back button works
- [ ] Material feel maintained
- [ ] System navigation works

---

## ✅ Final Checks

- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] All imports resolve
- [ ] Build completes successfully
- [ ] App runs on iOS simulator
- [ ] App runs on Android emulator
- [ ] Expo Go works (if applicable)

---

## 🎯 User Flow Testing

### Complete Journey 1: New User
1. [ ] Launch app → See welcome screen
2. [ ] Tap "Get Started" → See onboarding
3. [ ] Swipe through 3 slides
4. [ ] Tap "Start Planning" → See home tab
5. [ ] Tap hero card → See create trip
6. [ ] Select destination
7. [ ] Pick dates
8. [ ] Adjust travelers
9. [ ] Select 3 vibes
10. [ ] Tap "Generate Itinerary"
11. [ ] See loading animation
12. [ ] View generated trip
13. [ ] Pull to refresh
14. [ ] Switch between days
15. [ ] Navigate back to home

### Complete Journey 2: Returning User
1. [ ] Launch app → See tabs
2. [ ] View home with trips
3. [ ] Go to Trips tab
4. [ ] Filter to "Upcoming"
5. [ ] Tap a trip
6. [ ] View trip details
7. [ ] Pull to refresh
8. [ ] Go to Profile
9. [ ] Check stats
10. [ ] Review settings

---

## 🏆 Quality Gates

**Before shipping, ALL items must be checked:**

- [ ] ✨ All haptics work
- [ ] 🎭 All animations smooth
- [ ] 🎨 Design is consistent
- [ ] 🔧 Components function properly
- [ ] 📱 All screens work
- [ ] 🚀 Performance is good
- [ ] 🐛 Edge cases handled
- [ ] 📊 Both platforms work
- [ ] ✅ No critical bugs
- [ ] 🎯 User flows complete

---

**Tester**: _______________  
**Date**: _______________  
**Build**: _______________  
**Result**: ⭐️⭐️⭐️⭐️⭐️
