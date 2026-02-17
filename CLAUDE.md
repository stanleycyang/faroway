# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TripGenie is an AI-powered travel planning mobile app built with Expo (SDK 54) and React Native 0.81. Users can browse trips, create AI-generated itineraries via streaming, and manage travel plans with offline support.

## Development Commands

```bash
bun install              # Install dependencies
bun start                # Start Expo dev server (press 'i' for iOS, 'a' for Android)
bun run ios              # Start directly on iOS
bun run android          # Start directly on Android
```

No test runner or linter is currently configured.

**EAS Build** (cloud builds):
```bash
eas build --profile development --platform ios   # Dev build (simulator)
eas build --profile preview --platform ios        # Preview build (device)
```

## Environment Setup

Copy `.env.example` to `.env.local` with:
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase project credentials
- `EXPO_PUBLIC_API_URL` - Backend URL (`http://localhost:3000` for dev)
- For physical device testing, use machine's local IP instead of `localhost`

## Architecture

### Routing (Expo Router - file-based)

Routes live in `app/` using file-system conventions similar to Next.js:
- `app/_layout.tsx` - Root layout: provider stack (Auth → Notifications → Offline), auth guards, screen transitions
- `app/(tabs)/` - Bottom tab navigation (Explore, My Trips, Profile)
- `app/auth/` - Login, signup, forgot-password screens
- `app/onboarding/` - First-time user flow with preferences
- `app/create/` - Trip creation wizard (modal presentation) + AI generation screen
- `app/trip/[id].tsx` - Dynamic trip detail view

Auth guard logic: anonymous users can browse/create trips; only the Profile tab requires authentication (shows `AuthGate` component).

### State Management (Zustand)

Two stores in `stores/`:
- **tripStore** - Trips CRUD, draft form state (`draftInput`), generation progress, offline hydration
- **userStore** - User profile, onboarding status, travel preferences

### API & Auth

- `services/api.ts` - Centralized `apiFetch<T>()` with auth headers, 90s timeout (for AI operations)
- `lib/supabase.ts` - Supabase client init with Expo Secure Store for token persistence
- `components/AuthProvider.tsx` - Auth context providing login/signup via email + Google/Apple OAuth
- `hooks/useAuth.ts` - Auth state and methods hook

### Offline-First System

`lib/offline/` implements full offline support:
- `storage.ts` - AsyncStorage persistence + mutation queue
- `network.ts` - Network status monitoring
- `sync.ts` - Push/pull sync strategies
- `OfflineProvider` component orchestrates sync on mount, foreground, and network restore

### Streaming Itinerary Generation

- `hooks/useStreamingItinerary.ts` - SSE connection to `/api/itinerary/stream` for progressive document building
- `lib/json-render/` - Component catalog (13 types: HotelCard, ActivityCard, etc.) with Zod schemas and React Native renderers
- Used in `app/create/generating.tsx` for real-time trip display during AI generation

### Styling

- **NativeWind** (Tailwind CSS for React Native) with config in `tailwind.config.js`
- **Design tokens** in `constants/theme.ts`: colors (indigo primary, emerald accent, dark surface), spacing, typography, shadows, glassmorphism helpers
- Dark theme throughout (base: `#0a0a0a`)

### Haptics

`utils/haptics.ts` exports `hapticFeedback` with methods: `light()`, `medium()`, `heavy()`, `success()`, `error()`, `selection()`. Used on all interactive elements.

## Key Conventions

- TypeScript strict mode enabled
- Bundle ID: `ai.tripgenie.app`, deep link scheme: `tripgenie://`
- Typed routes enabled (`typedRoutes: true` in `app.config.ts`)
- UI components exported from `components/ui/index.ts` barrel file
- API URLs use `encodeURIComponent()` for path params (security requirement per audit)
