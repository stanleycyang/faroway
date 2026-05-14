#!/usr/bin/env bun

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const MOBILE = resolve(ROOT, "apps/mobile");

interface EasConfig {
  cli?: {
    version?: string;
    appVersionSource?: string;
  };
  build?: {
    production?: {
      distribution?: string;
      ios?: {
        image?: string;
        simulator?: boolean;
        resourceClass?: string;
      };
      android?: {
        buildType?: string;
      };
      env?: Record<string, string>;
    };
  };
  submit?: {
    production?: {
      ios?: Record<string, unknown>;
      android?: Record<string, unknown>;
    };
  };
}

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const failures: string[] = [];
const warnings: string[] = [];

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch (error) {
    failures.push(`Unable to parse ${path}: ${String(error)}`);
    return null;
  }
}

function requireCondition(condition: boolean, message: string) {
  if (!condition) failures.push(message);
}

function warnCondition(condition: boolean, message: string) {
  if (!condition) warnings.push(message);
}

function containsPlaceholder(value: string | undefined) {
  if (!value) return true;
  return /localhost|127\.0\.0\.1|example|placeholder|your-|todo|vercel\.app/i.test(
    value,
  );
}

function hasText(path: string, pattern: RegExp) {
  if (!existsSync(path)) return false;
  return pattern.test(readFileSync(path, "utf-8"));
}

console.log(`\n${BOLD}  Faroway EAS Release Config Check${RESET}`);
console.log(`  ${"=".repeat(45)}`);

const easPath = resolve(MOBILE, "eas.json");
const appConfigPath = resolve(MOBILE, "app.config.ts");
const appJsonPath = resolve(MOBILE, "app.json");
const apiConfigPath = resolve(MOBILE, "constants/api.ts");
const supabaseBridgePath = resolve(MOBILE, "lib/supabase.ts");
const mobileTripsPath = resolve(MOBILE, "app/(tabs)/trips.tsx");
const mobileProfilePath = resolve(MOBILE, "app/(tabs)/profile.tsx");
const mobileAuthGatePath = resolve(MOBILE, "components/AuthGate.tsx");
const mobileReleasePath = resolve(MOBILE, "RELEASE.md");
const appSubmissionPath = resolve(ROOT, "docs/APP_SUBMISSION.md");
const appStoreCopyPath = resolve(ROOT, "docs/APP_STORE_COPY.md");
const webManifestPath = resolve(ROOT, "apps/web/public/manifest.json");
const marketingPagePath = resolve(ROOT, "apps/web/app/(marketing)/page.tsx");
const aboutPagePath = resolve(ROOT, "apps/web/app/(marketing)/about/page.tsx");
const sitemapPath = resolve(ROOT, "apps/web/app/sitemap.ts");
const sharedTripLayoutPath = resolve(ROOT, "apps/web/app/s/[token]/layout.tsx");
const sharedTripViewPath = resolve(
  ROOT,
  "apps/web/components/trips/SharedTripView.tsx",
);
const reportPagePath = resolve(
  ROOT,
  "apps/web/app/(marketing)/report/page.tsx",
);
const contentReportRoutePath = resolve(
  ROOT,
  "apps/web/app/api/content-reports/route.ts",
);
const termsPagePath = resolve(ROOT, "apps/web/app/(marketing)/terms/page.tsx");
const supportPagePath = resolve(
  ROOT,
  "apps/web/app/(marketing)/support/page.tsx",
);
const supportLayoutPath = resolve(
  ROOT,
  "apps/web/app/(marketing)/support/layout.tsx",
);
const footerPath = resolve(ROOT, "apps/web/components/Footer.tsx");
const rootLayoutPath = resolve(ROOT, "apps/web/app/layout.tsx");
const blogTypesPath = resolve(ROOT, "apps/web/lib/blog/types.ts");
const screenshotGuidePath = resolve(
  ROOT,
  "docs/screenshots/SCREENSHOT_GUIDE.md",
);
const privacyDocPath = resolve(ROOT, "docs/PRIVACY_POLICY.md");
const termsDocPath = resolve(ROOT, "docs/TERMS_OF_SERVICE.md");
const contentReportsMigrationPath = resolve(
  ROOT,
  "supabase/migrations/20260512005000_content_reports.sql",
);

const eas = readJson<EasConfig>(easPath);
const production = eas?.build?.production;
const productionEnv = production?.env ?? {};

requireCondition(
  existsSync(appConfigPath),
  "apps/mobile/app.config.ts is required.",
);
requireCondition(
  !existsSync(appJsonPath),
  "apps/mobile/app.json must not exist; app.config.ts is the single Expo config source.",
);

requireCondition(
  eas?.cli?.appVersionSource === "remote",
  "EAS appVersionSource must be remote.",
);
requireCondition(
  Boolean(eas?.cli?.version),
  "EAS CLI version requirement is missing.",
);
requireCondition(
  Boolean(production),
  "EAS production build profile is missing.",
);
requireCondition(
  production?.distribution === "store",
  "EAS production distribution must be store.",
);
requireCondition(
  production?.ios?.image === "latest",
  "EAS production iOS image must be latest for current App Store SDK coverage.",
);
requireCondition(
  production?.ios?.simulator !== true,
  "EAS production iOS build must target devices, not simulator.",
);
warnCondition(
  Boolean(production?.ios?.resourceClass),
  "EAS production iOS resourceClass is not set.",
);
requireCondition(
  production?.android?.buildType === "app-bundle",
  "EAS production Android buildType must be app-bundle.",
);
requireCondition(
  productionEnv.EXPO_PUBLIC_API_URL?.startsWith("https://") === true,
  "EAS production EXPO_PUBLIC_API_URL must be an HTTPS origin.",
);
requireCondition(
  !containsPlaceholder(productionEnv.EXPO_PUBLIC_API_URL),
  "EAS production EXPO_PUBLIC_API_URL must not be localhost, a placeholder, or a preview URL.",
);
requireCondition(
  hasText(
    apiConfigPath,
    /PRODUCTION_API_URL\s*=\s*['"]https:\/\/api\.faroway\.ai['"]/,
  ),
  "Mobile production API fallback must be the release API origin.",
);
requireCondition(
  !hasText(apiConfigPath, /faroway\.vercel\.app/i),
  "Mobile API config must not fall back to a Vercel preview URL.",
);
requireCondition(
  hasText(
    supabaseBridgePath,
    /export\s+\{\s*API_BASE_URL\s*\}\s+from\s+['"]\.\.\/constants\/api['"]/,
  ),
  "Mobile Supabase bridge must reuse the shared API_BASE_URL config.",
);

const secretLikeEasEnvKeys = Object.keys(productionEnv).filter((key) =>
  /(SECRET|TOKEN|PRIVATE|SERVICE_ROLE|PASSWORD)/i.test(key),
);
requireCondition(
  secretLikeEasEnvKeys.length === 0,
  `Secret-looking values do not belong in eas.json production.env: ${secretLikeEasEnvKeys.join(", ")}`,
);

requireCondition(
  Boolean(eas?.submit?.production),
  "EAS production submit profile is missing.",
);
requireCondition(
  Boolean(eas?.submit?.production?.ios),
  "EAS production iOS submit profile is missing.",
);
requireCondition(
  hasText(
    mobileReleasePath,
    /intentionally does not store Apple account identifiers|App Store Connect app ID|Android service-account credentials/i,
  ) &&
    hasText(
      appSubmissionPath,
      /Do not commit Apple account identifiers|App Store Connect app ID for `ai\.faroway\.app`|Apple Team ID/i,
    ),
  "EAS submit credentials must be documented when submit profiles omit account identifiers.",
);
requireCondition(
  hasText(appConfigPath, /bundleIdentifier:\s*['"]ai\.faroway\.app['"]/),
  "iOS bundleIdentifier must be ai.faroway.app.",
);
requireCondition(
  hasText(appConfigPath, /package:\s*['"]ai\.faroway\.app['"]/),
  "Android package must be ai.faroway.app.",
);
requireCondition(
  hasText(appConfigPath, /usesAppleSignIn:\s*true/),
  "Apple Sign-In must stay enabled for iOS release.",
);
requireCondition(
  hasText(appConfigPath, /EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME/) &&
    hasText(appConfigPath, /iosUrlScheme:\s*googleIosUrlScheme/),
  "Google Sign-In iOS URL scheme must be configured from EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME.",
);
requireCondition(
  hasText(
    resolve(MOBILE, "hooks/useAuth.ts"),
    /iosClientId:\s*process\.env\.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID/,
  ),
  "Google Sign-In must pass EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID to the native iOS SDK.",
);
requireCondition(
  hasText(appConfigPath, /usesNonExemptEncryption:\s*false/),
  "iOS export compliance flag usesNonExemptEncryption must be explicit.",
);
requireCondition(
  !hasText(appConfigPath, /NS(Location|Camera|PhotoLibrary|UserTracking)/),
  "Expo config must not declare unused iOS privacy prompts.",
);
requireCondition(
  hasText(appConfigPath, /projectId:\s*process\.env\.EAS_PROJECT_ID/),
  "Expo projectId must come from EAS_PROJECT_ID.",
);

requireCondition(
  !hasText(appSubmissionPath, /demo@faroway\.ai|DemoTrip|demo account/i),
  "App submission notes must not contain placeholder demo account credentials.",
);
requireCondition(
  !hasText(
    appSubmissionPath,
    /Map view with pins|API 34|Device ID for analytics/i,
  ),
  "App submission checklist contains stale App Store metadata claims.",
);
requireCondition(
  !hasText(
    appStoreCopyPath,
    /Interactive maps|Weather forecasts|Secure iCloud sync|Book hotels, experiences, and activities directly through the app|50\+ popular destinations|Location Sharing:\s*Yes|GPS navigation|AI-powered travel companion|AI travel companion|flights/i,
  ),
  "App Store copy advertises features that are not release-ready in the mobile app.",
);
requireCondition(
  hasText(appStoreCopyPath, /User Generated Content:\s*Yes/i) &&
    hasText(
      appStoreCopyPath,
      /User-Generated Content or Social Networking:\s*Yes/i,
    ),
  "Store content-rating notes must disclose shared itinerary user-generated content.",
);
requireCondition(
  !hasText(
    aboutPagePath,
    /real-time booking|group trip planning|AI travel companion/i,
  ),
  "About page advertises roadmap features that are not release-ready.",
);
requireCondition(
  !hasText(
    marketingPagePath,
    /Full offline access|One-tap booking|Auto-sync across devices|maps, reservations, and daily plans accessible even without a connection|Changes sync instantly/i,
  ),
  "Marketing page advertises offline, booking, or sync behavior beyond the release-ready product.",
);
requireCondition(
  !hasText(
    webManifestPath,
    /find hotels, flights|GPS navigation|navigation/i,
  ) &&
    !hasText(
      rootLayoutPath,
      /flights|revisit saved plans offline|saved plans offline/i,
    ) &&
    !hasText(marketingPagePath, /Get flights|flights, hotels/i) &&
    !hasText(aboutPagePath, /hotels, flights|flights, restaurants/i),
  "Review-facing web metadata and marketing copy must not imply full flight search, GPS navigation, or web offline behavior.",
);
requireCondition(
  !hasText(
    mobileTripsPath,
    /never lose|any device|Collaborate on trips|Synced everywhere/i,
  ) &&
    !hasText(mobileAuthGatePath, /plan together|Share & plan|access anywhere/i),
  "Mobile trips sign-in copy advertises sync or collaboration behavior beyond the release-ready product.",
);
requireCondition(
  !hasText(
    supportPagePath,
    /fully editable|add, remove, or rearrange|edit, customize|editing your day-by-day|adding or removing activities|exporting your itinerary|export your itinerary|regenerate that part|provide feedback|access your trips anywhere/i,
  ) &&
    !hasText(
      supportLayoutPath,
      /fully editable|add, remove, or rearrange|edit, customize|editing your day-by-day|adding or removing activities|exporting your itinerary|export your itinerary|regenerate that part|provide feedback|access your trips anywhere/i,
    ),
  "Support FAQ advertises itinerary editing, export, regeneration, or feedback flows that are not release-ready.",
);
requireCondition(
  !hasText(sharedTripLayoutPath, /robots:\s*\{\s*index:\s*true/i) &&
    hasText(
      sharedTripLayoutPath,
      /robots:\s*\{\s*index:\s*false,\s*follow:\s*true/i,
    ) &&
    !hasText(sitemapPath, /sharedTripPages|is_shared|share_token/i),
  "Shared trip pages must be link-only/noindex and excluded from sitemap indexing.",
);
requireCondition(
  hasText(sharedTripViewPath, /Report this itinerary/) &&
    hasText(sharedTripViewPath, /\/report\?type=shared_trip&token=/),
  "Shared trip pages must link to the content report flow.",
);
requireCondition(
  hasText(reportPagePath, /SharedItineraryReportForm/) &&
    hasText(
      reportPagePath,
      /robots:\s*\{\s*index:\s*false,\s*follow:\s*true/i,
    ) &&
    hasText(contentReportRoutePath, /content_reports/) &&
    hasText(contentReportRoutePath, /checkRateLimit/) &&
    hasText(contentReportRoutePath, /reported_user_id/) &&
    hasText(contentReportRoutePath, /status:\s*["']open["']/) &&
    existsSync(contentReportsMigrationPath),
  "Shared itinerary reports must have a noindex report page and persisted moderation records.",
);
requireCondition(
  hasText(termsPagePath, /objectionable/i) &&
    hasText(termsPagePath, /support@faroway\.ai/i) &&
    hasText(termsDocPath, /objectionable/i) &&
    hasText(termsDocPath, /support@faroway\.ai/i),
  "Terms must prohibit objectionable shared content and explain reporting.",
);
requireCondition(
  hasText(mobileAuthGatePath, /By continuing, you agree to our/) &&
    hasText(mobileProfilePath, /By continuing, you agree to our/),
  "Mobile sign-in entry points must show Terms and Privacy agreement copy.",
);
requireCondition(
  !hasText(
    `${supportPagePath}`,
    /twitter\.com\/faroway|instagram\.com\/faroway|facebook\.com\/faroway/i,
  ) &&
    !hasText(
      footerPath,
      /twitter\.com\/faroway|instagram\.com\/faroway|facebook\.com\/faroway/i,
    ) &&
    !hasText(
      rootLayoutPath,
      /twitter\.com\/faroway|instagram\.com\/faroway|facebook\.com\/faroway|creator:\s*["']@faroway["']/i,
    ) &&
    !hasText(
      blogTypesPath,
      /twitter:\s*["']@faroway["']|twitter\.com\/faroway|instagram\.com\/faroway|facebook\.com\/faroway/i,
    ),
  "Review-facing web surfaces must not link to unverified placeholder social accounts.",
);
requireCondition(
  !hasText(screenshotGuidePath, /Interactive map with pins|demo account/i),
  "Screenshot guide contains stale or placeholder capture instructions.",
);
requireCondition(
  !hasText(privacyDocPath, /\[Your Business Address\]|\[City, State/i),
  "Privacy policy contains placeholder business address text.",
);
requireCondition(
  !hasText(termsDocPath, /\[Your Business Address\]|\[City, State/i),
  "Terms of Service contains placeholder business address text.",
);

for (const asset of [
  "assets/icon.png",
  "assets/splash.png",
  "assets/adaptive-icon.png",
  "assets/notification-icon.png",
  "assets/favicon.png",
]) {
  requireCondition(
    existsSync(resolve(MOBILE, asset)),
    `Missing release asset: ${asset}`,
  );
}

if (failures.length === 0) {
  console.log(
    `  ${GREEN}OK${RESET} EAS production profile and Expo config are release-shaped.`,
  );
} else {
  for (const failure of failures) {
    console.log(`  ${RED}FAIL${RESET} ${failure}`);
  }
}

for (const warning of warnings) {
  console.log(`  ${YELLOW}WARN${RESET} ${warning}`);
}

console.log(
  `  ${DIM}${failures.length} failure(s), ${warnings.length} warning(s)${RESET}\n`,
);

process.exit(failures.length === 0 ? 0 : 1);
