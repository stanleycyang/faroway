# Faroway Brand Guidelines

> Canonical cross-platform design, voice, accessibility, and asset specification for **Faroway** (`faroway.ai`) across Web (`apps/web`), Mobile (`apps/mobile`), and shared packages (`packages/*`).

---

## 1. Brand Positioning & Voice

- **Brand Name**: **Faroway** (`faroway.ai`)
- **Support & Trust Contact**: `support@faroway.ai`
- **Taglines**:
  - Primary: *"A journey, shaped around you."*
  - Descriptor: *"AI Travel Planner"*
- **Personality & Tone**:
  - **Warm, grounded, editorial, traveler-first**: write like a well-traveled concierge—clear, practical, and inspiring without hype or exclamation bloat.
  - **Honest about scope**: Faroway plans personalized itineraries and connects travelers to verified booking partners. Never overclaim capabilities flagged by release checks (`scripts/check-eas-release.ts`):
    - Do **not** claim direct in-app checkout or payment processing inside Faroway (`"One-tap booking"`, `"real-time booking"`). Handoff opens trusted partner checkouts externally.
    - Do **not** claim offline GPS turn-by-turn navigation, web offline sync, or unshipped group collaboration features (`"GPS navigation"`, `"Full offline access"`, `"Auto-sync across devices"`).
- **Mandatory FTC Affiliate Disclosure Rules**:
  - Every surface featuring bookable stays, activities, flights, car rentals, dining reservations, or travel essentials (eSIM, insurance, visas, currency) must pair partner CTAs with a clear, honest disclosure:
    - **Standard (checkout modal / footer / editorial guides)**:
      > *"Faroway may earn a commission when you book through partner links, at no extra cost to you."*
    - **Compact inline (cards / sticky sheets / mobile handoff)**:
      > *"We may earn a commission at no extra cost to you."* (exported as `AFFILIATE_DISCLOSURE_SHORT` in `@faroway/constants`).

---

## 2. Color Palette & WCAG AA Rules

Every interactive text element, link, badge, and CTA button on light surfaces (`#FFFFFF` and `#FAF8F3`) must meet **WCAG 2.1 AA** (>= 4.5:1 normal text, >= 3.0:1 large text/UI components).

### 2.1 Primary Coral Scale

| Token / Role | Hex | Contrast on `#FFFFFF` | Contrast on `#FAF8F3` | Permitted Usage |
|---|---|---|---|---|
| **Primary Brand Coral** (`primary-400` / `primary-500`) | `#F97066` | 2.79:1 *(Fails AA)* | 2.63:1 *(Fails AA)* | **Large fills, Route-F brand mark, decorative icons, and illustrations ONLY. NEVER use for body text, links, or small UI borders/labels.** |
| **Coral Gradient** (`brand-gradient`) | `#F97066` → `#E04D43` | — | — | App icon backdrop, Route-F mark badge, decorative brand accents. |
| **Accessible Action Coral** (`primary-700` / `colors.action.primary`) | `#C03A31` | **5.40:1** *(AA Pass)* | **5.09:1** *(AA Pass)* | **Primary CTA button fills** (with `#FFFFFF` text), active tab highlights, interactive text links. |
| **Deep Action Coral** (`primary-800`) | `#9B2D25` | **7.51:1** *(AAA Pass)* | **7.08:1** *(AAA Pass)* | **Small coral text, pill badges, price/discount callouts, hover/pressed states.** |

### 2.2 Deep Ocean Teal (Trust, Companion & Secondary)

| Token / Role | Hex | Contrast on `#FFFFFF` | Contrast on `#FAF8F3` | Permitted Usage |
|---|---|---|---|---|
| **Deep Ocean Teal** (`travel.ocean`) | `#143D46` | **11.76:1** *(AAA Pass)* | **11.08:1** *(AAA Pass)* | Editorial dark panels, splash backdrop, high-trust headers, wordmark text, secondary dark buttons. |
| **Accessible Teal** (`accent-700`) | `#0F766E` | **5.47:1** *(AA Pass)* | **5.16:1** *(AA Pass)* | Accessible teal links, verified/booked badges, inline trust indicators. |
| **Bright Teal Fill** (`accent-500`) | `#14B8A6` | < 3:1 *(Fails AA text)* | < 3:1 *(Fails AA text)* | Large decorative fills and icons only (never text on light backgrounds). |

### 2.3 Warm Paper Surfaces & Editorial Ink

| Token / Role | Hex | Contrast Notes | Permitted Usage |
|---|---|---|---|
| **Warm Paper** (`surface-paper`) | `#FAF8F3` | Canonical page canvas (`#FAF6EF` legacy web alias normalized to `#FAF8F3`). | Primary app & marketing page background. |
| **Card White** (`surface-card`) | `#FFFFFF` | — | Elevated itinerary cards, modals, sheets, input fields. |
| **Mist Tint** (`travel.mist`) | `#EFF5F3` | — | Subtle callout panels, trust strips, map/empty states. |
| **Hairline Border** (`travel.line`) | `#DCE5E3` / `#E2E8F0` | — | Card dividers, subtle input outlines. |
| **Editorial Ink** (`ink`) | `#0F172A` / `#182B31` | **17.85:1** on `#FFFFFF`, **16.82:1** on `#FAF8F3` | Headings, primary body copy, itinerary titles. |
| **Muted Ink** (`surface-600` / `travel.muted`) | `#475569` / `#53676C` | **7.14:1** (`#475569`) and **5.61:1** (`#53676C`) on `#FAF8F3`; **5.96:1** (`#53676C`) on `#FFFFFF` | Metadata, timestamps, secondary labels, disclosures. |
| **Banned Low-Contrast Gray** | `#94A3B8` (`surface-400`) | Fails AA on light surfaces | **BANNED** for text or essential labels on `#FFFFFF` or `#FAF8F3`. |

---

## 3. Typography (Web & Mobile)

Faroway pairs an editorial display serif with a crisp geometric/humanist sans across both platforms:

- **Display Serif — `Playfair Display`** (`700`–`900`, normal & italic):
  - **Usage**: Hero headlines, destination & trip titles, day numbers/headers, editorial numerals, `"Faroway"` display wordmark.
  - **Web**: Local WOFF2 via `next/font/local` (`apps/web/app/fonts/PlayfairDisplay-Variable.woff2` and `PlayfairDisplay-Italic-Variable.woff2`, `--font-playfair`, Tailwind `font-editorial`).
  - **Mobile**: Bundled and loaded via `expo-font` (`PlayfairDisplay` weights 700–900).
- **UI Sans — `Plus Jakarta Sans`** (`300`–`800`):
  - **Usage**: UI controls, buttons, forms, body descriptions, itinerary metadata, badges, disclosures.
  - **Web**: Local WOFF2 via `next/font/local` (`apps/web/app/fonts/PlusJakartaSans-Variable.woff2`, `--font-plus-jakarta`, Tailwind `font-sans`).
  - **Mobile**: Bundled and loaded via `expo-font` (`PlusJakartaSans`), replacing legacy `Inter` in `apps/mobile/tailwind.config.js`.

---

## 4. Iconography & Emoji Ban

- **Web**: Use **`lucide-react`** exclusively for UI icons, category markers, booking actions, and reactions.
- **Mobile**: Use **`@expo/vector-icons` (`Ionicons`)** exclusively for UI icons, tab bars, vibe chips, and booking actions.
- **No Raw OS Emojis**: Do **not** render raw OS emojis (`✈️`, `🏨`, `🧠`, `🗺️`, `❤️`, etc.) inside production UI chrome, cards, navigation, buttons, or reaction chips. *(Data fields in shared constants may retain legacy `emoji` metadata only where existing tests depend on it; UI components must render Lucide/Ionicons icons instead.)*

---

## 5. Unified Logo, Route-F App Icon & Splash Specification

### 5.1 Canonical Brand Mark — Route-F Monogram

- **Concept**: A bold, continuous sculptural uppercase **F** monogram formed from a winding travel route ribbon. Two generous horizontal arms sweep right and angle subtly upward, suggesting forward travel and an open horizon, balanced over a grounded vertical stem.
- **Colors**:
  - Monogram foreground: Warm Ivory **`#FFF5EE`** (`#FDF3EC` optical match)
  - Backdrop gradient: Full-bleed Coral **`#F97066`** (top) → **`#E04D43`** (bottom)
- **Clear Space & Safe Zone**:
  - Square `1024×1024` full-bleed canvas with **no baked-in rounded corners** (iOS and Android apply platform squircle/adaptive masks).
  - Monogram occupies ~56% width × ~64% height centered optically, guaranteeing >= 18–20% perimeter clear space inside iOS squircle and Android adaptive-icon 66% safe zones.
  - Do **not** use the retired paper-airplane-in-circle mark or any legacy genie-lamp artwork.

### 5.2 Wordmark Lockup

- `brand/wordmark.svg` (`600×160`): Rounded-square Route-F mark (`#F97066` → `#E04D43`, `#FFF5EE` Route-F path) paired with **`Faroway`** in Deep Ocean Teal (`#143D46`) and descriptor **`AI TRAVEL PLANNER`** in Muted Ink (`#53676C`).

### 5.3 Splash Screen

- `brand/splash.svg` (`1284×2778`): Deep Ocean Teal vertical gradient (`#143D46` → `#0E2C33`), subtle coral radial glow (`#F97066` at 14% opacity), centered Route-F rounded-square badge, warm ivory **`Faroway`** display wordmark, and soft mist tagline **`AI TRAVEL PLANNER`**.

### 5.4 Cross-Platform Asset Matrix

| Surface / File | Dimensions / Format | Notes |
|---|---|---|
| `brand/icon.svg` | `1024×1024` SVG | Canonical full-bleed Route-F vector source |
| `brand/icon-1024.png`, `icon-512.png`, `icon-256.png` | `1024`, `512`, `256` RGB PNG | Opaque raster exports of Route-F icon |
| `brand/wordmark.svg` | `600×160` SVG | Route-F mark + `Faroway` wordmark |
| `brand/splash.svg`, `brand/splash-1284x2778.png` | `1284×2778` SVG / RGB PNG | Deep Ocean Teal `#143D46` splash master |
| `apps/mobile/assets/icon.png` | `1024×1024` RGB PNG (no alpha) | iOS & Expo primary app icon |
| `apps/mobile/assets/adaptive-icon.png` | `1024×1024` RGB PNG | Full-bleed opaque coral adaptive foreground (safe-zone compliant) |
| `apps/mobile/assets/splash.png` | `1284×2778` RGB PNG | Mobile launch splash screen |
| `apps/mobile/assets/splash-icon.png` | `512×512` RGB PNG | Compact splash mark |
| `apps/mobile/assets/notification-icon.png` | `96×96` RGBA PNG | Pure `#FFFFFF` Route-F silhouette on transparent background (Android) |
| `apps/mobile/assets/favicon.png` | `64×64` RGB PNG | Expo web favicon |
| `apps/web/public/icon.png`, `icon-512.png`, `icon-192.png` | `512`, `512`, `192` RGB PNG | Web header `<Logo />` & PWA manifest icons (`any` and `maskable`) |
| `apps/web/public/apple-touch-icon.png` | `180×180` RGB PNG | Legacy Apple touch icon |
| `apps/web/public/favicon-32.png`, `favicon.png`, `favicon-16.png` | `32×32`, `32×32`, `16×16` PNG | Browser favicons |
| `apps/web/app/favicon.ico` | `16×16` + `32×32` ICO | Next.js App Router favicon |
| `apps/web/app/apple-icon.tsx` | `180×180` Edge `ImageResponse` | Full-bleed Route-F coral icon (`runtime = "edge"`) |
| `apps/web/public/manifest.json` | Web App Manifest | `background_color: "#FAF8F3"`, `theme_color: "#F97066"`, split `any` / `maskable` icons |
