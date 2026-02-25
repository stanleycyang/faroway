# Faroway Mobile — Security & UX Audit Report

**Date:** 2026-02-16  
**Auditor:** Claude (automated)

---

## Security Issues Found & Fixed

### 🔴 CRITICAL: Mock Authentication Bypass (onboarding/login.tsx)
**Issue:** The onboarding login screen used `setTimeout` with hardcoded fake users (`user-1`, `google-user`, `apple-user`) instead of actual Supabase authentication. Any user could "log in" without credentials.  
**Fix:** Replaced all three mock auth handlers with real `supabase.auth.signInWithPassword()` and `supabase.auth.signInWithOAuth()` calls with proper error handling.

### 🟡 HIGH: Unnecessary iOS Permissions Requested (app.config.ts)
**Issue:** App requested `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, and `NSUserTrackingUsageDescription` but never uses camera, photo library, or ATT tracking. Apple may reject apps requesting unused permissions.  
**Fix:** Removed camera, photo library, and tracking permission declarations. Kept only location (used for navigation to destinations).

### 🟡 HIGH: No Input Validation on Email Fields
**Issue:** Login, signup, and forgot-password forms accepted any string as email without format validation.  
**Fix:** Added email regex validation (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) to login, signup, and forgot-password forms before API calls.

### 🟡 MEDIUM: Insecure API_BASE_URL Fallback in Production (lib/supabase.ts)
**Issue:** `API_BASE_URL` fell back to `http://localhost:3000` even in production builds if env var was missing, which could cause insecure connections or silent failures.  
**Fix:** Fallback now uses `__DEV__` check — only falls back to localhost in development; production returns empty string (will fail loudly if misconfigured).

### 🟡 MEDIUM: Path Traversal Risk in API Endpoints
**Issue:** Trip IDs and search IDs were interpolated directly into URL paths without encoding (`/api/trips/${id}`).  
**Fix:** Added `encodeURIComponent()` to all dynamic path parameters in `services/api.ts`. Added explicit ID format validation in `searchService.ts`.

### 🟢 LOW: Hardcoded Production URL (constants/api.ts)
**Issue:** Production backend URL hardcoded as fallback.  
**Fix:** Now reads from `EXPO_PUBLIC_API_URL` env var first, falls back to hardcoded URL only as last resort.

### ✅ Already Good
- **Auth token storage:** Supabase session uses `expo-secure-store` (SecureStore/Keychain) — properly secured
- **In-memory API token:** `services/api.ts` token is memory-only, not persisted insecurely
- **Deep linking:** Scheme is `faroway://` with proper auth callback handling
- **No hardcoded API keys/secrets** in source — all use env vars (`EXPO_PUBLIC_*`)
- **HTTPS enforced** for Supabase URLs and production API

---

## UX Issues Found & Fixed

### 🔴 Loading State: Trip Detail Shows Plain "Loading..." Text
**Issue:** `app/trip/[id].tsx` showed bare `<Text>Loading...</Text>` with no styling or indicator.  
**Fix:** Replaced with centered `ActivityIndicator` + styled loading text on white background.

### 🟡 Animated Values Created with useState (Memory/Performance)
**Issue:** `app/index.tsx` (WelcomeScreen) and `app/(tabs)/index.tsx` (ExploreScreen) created `Animated.Value` instances inside `useState()`. This is incorrect — animated values should use `useRef` to avoid re-creation on re-renders.  
**Fix:** Changed all `useState(new Animated.Value(...))` to `useRef(new Animated.Value(...)).current` in both screens.

### 🟡 Error Display: Forgot Password Uses Alert.alert
**Issue:** `forgot-password.tsx` used system `Alert.alert()` for errors, which is disruptive and inconsistent with the inline error pattern used in login/signup.  
**Fix:** Added inline error display with icon (matching login/signup pattern) and removed Alert import. Added email format validation too.

### 🟡 Touch Target Too Small: Back Button (forgot-password.tsx)
**Issue:** Back button had only `padding: 8`, making the touch target ~40px — below the 44pt minimum for accessibility.  
**Fix:** Increased to `padding: 12` with explicit `minWidth: 44, minHeight: 44` and added `hitSlop` for additional touch area.

### 🟡 Missing Accessibility Labels
**Issue:** Key interactive elements (login button, email/password inputs, social login buttons) had no `accessibilityLabel` or `accessibilityRole`.  
**Fix:** Added `accessibilityLabel`, `accessibilityRole`, and `textContentType` to login screen inputs and submit button.

### 🟡 useEffect Dependency Issues (Potential Infinite Loops / Memory Leaks)
**Issue:**
1. `useAuth.ts` — listed `setUser` and `clearUserStore` (zustand selectors) as deps, causing unnecessary re-subscriptions
2. `useStreamingItinerary.ts` — `input` object in deps caused infinite re-renders (new object reference each render)
3. `useNotifications.ts` — callback deps caused repeated listener registration

**Fix:** 
1. Removed unnecessary deps with eslint-disable comment explaining they're stable
2. Used `JSON.stringify(input)` for stable comparison
3. Reduced deps to only `autoRequestPermissions`

### ✅ Already Good
- **Offline handling:** Comprehensive offline-first architecture with `OfflineProvider`, sync service, and `SyncStatusBanner`
- **Empty states:** Trips screen has proper empty state with CTA and sample trips
- **Loading indicators:** Search generation has animated progress, polling, and step indicators
- **Keyboard handling:** Login/signup use `KeyboardAvoidingView` and `Keyboard.dismiss()`
- **Navigation:** Consistent with expo-router, proper auth guards, animated transitions
- **Haptic feedback:** Used throughout for touch interactions
- **Error states:** Login/signup show inline errors with icons

---

## Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Security | 1 | 2 | 2 | 1 | 6 |
| UX | 1 | 4 | 0 | 0 | 5 |
| **Total** | **2** | **6** | **2** | **1** | **11** |

All 11 issues have been fixed directly in the code.
