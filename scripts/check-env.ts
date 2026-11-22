#!/usr/bin/env bun

/**
 * Environment variable validator for Faroway monorepo.
 * Run with: bun run env:check
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const args = new Set(process.argv.slice(2));
const mobileReleaseMode = args.has("--mobile-release");

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
}

const SHARED: EnvVar[] = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    required: true,
    description: "Supabase project URL",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anonymous API key",
  },
];

const WEB: EnvVar[] = [
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    description: "Supabase service role key (server-only)",
  },
  {
    name: "AI_GATEWAY_API_KEY",
    required: false,
    description: "Vercel AI Gateway API key for itinerary generation",
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    required: false,
    description: "Public app URL",
  },
  {
    name: "NEXT_PUBLIC_BASE_URL",
    required: false,
    description: "Canonical public web URL for OG tags and share links",
  },
  {
    name: "NEXT_PUBLIC_SITE_URL",
    required: false,
    description: "Fallback public site URL",
  },
  {
    name: "IP_HASH_SALT",
    required: false,
    description: "HMAC salt for rate-limit identifier hashing",
  },
  {
    name: "NEXT_PUBLIC_GA_MEASUREMENT_ID",
    required: false,
    description: "Google Analytics measurement ID",
  },
  {
    name: "IMPACT_SITE_VERIFICATION",
    required: false,
    description: "Impact affiliate network site verification token",
  },
  {
    name: "GOOGLE_PLACES_API_KEY",
    required: false,
    description:
      "Google Places API key for itinerary activity and dining enrichment",
  },
  {
    name: "VIATOR_API_KEY",
    required: false,
    description: "Viator Partner API key for activities",
  },
  {
    name: "VIATOR_PARTNER_ID",
    required: false,
    description: "Viator partner ID for affiliate tracking",
  },
  {
    name: "VIATOR_MCID",
    required: false,
    description: "Viator campaign attribution MCID",
  },
  {
    name: "VIATOR_CONTENT_ENABLED",
    required: false,
    description: "Viator commercial content display gate",
  },
  {
    name: "VIATOR_CONTENT_APPROVAL_REF",
    required: false,
    description: "Viator commercial approval reference",
  },
  {
    name: "DUFFEL_API_TOKEN",
    required: false,
    description: "Duffel token for flight search and links",
  },
  {
    name: "LITEAPI_API_KEY",
    required: false,
    description: "LiteAPI key for sandbox hotel/flight integration",
  },
  {
    name: "TRIPADVISOR_API_KEY",
    required: false,
    description: "TripAdvisor Content API key for enrichment",
  },
  {
    name: "GETYOURGUIDE_API_KEY",
    required: false,
    description: "GetYourGuide Partner API key for activities",
  },
  {
    name: "GETYOURGUIDE_PARTNER_ID",
    required: false,
    description: "GetYourGuide partner ID for affiliate tracking",
  },
  {
    name: "TAVILY_API_KEY",
    required: false,
    description: "Tavily key for local non-affiliate enrichment",
  },
  {
    name: "TRAVELPAYOUTS_MARKER",
    required: false,
    description: "Travelpayouts affiliate marker ID",
  },
  {
    name: "TRAVELPAYOUTS_TRS",
    required: false,
    description: "Travelpayouts campaign/TRS ID",
  },
  {
    name: "STAY22_AID",
    required: false,
    description: "Stay22 affiliate ID for accommodation links",
  },
  {
    name: "BOOKING_AFFILIATE_ID",
    required: false,
    description: "Booking.com affiliate aid",
  },
  {
    name: "EXPEDIA_AFFCID",
    required: false,
    description: "Expedia affiliate affcid",
  },
  {
    name: "EXPEDIA_CAMREF",
    required: false,
    description: "Expedia Partnerize camref",
  },
  {
    name: "HOSTELWORLD_AFFILIATE_ID",
    required: false,
    description: "Hostelworld affiliate source ID",
  },
  {
    name: "KLOOK_AFFILIATE_ID",
    required: false,
    description: "Klook affiliate aid",
  },
  {
    name: "OPENTABLE_AFFILIATE_ID",
    required: false,
    description: "OpenTable affiliate aid",
  },
  {
    name: "SKYSCANNER_ASSOCIATE_ID",
    required: false,
    description: "Skyscanner associate ID",
  },
  {
    name: "SAFETYWING_REFERENCE_ID",
    required: false,
    description: "SafetyWing affiliate referenceID",
  },
  {
    name: "AIRALO_AFFILIATE_ID",
    required: false,
    description: "Airalo affiliate ref ID",
  },
  {
    name: "DISCOVERCARS_AFFILIATE_ID",
    required: false,
    description: "DiscoverCars affiliate a_aid",
  },
  {
    name: "IVISA_AFFILIATE_ID",
    required: false,
    description: "iVisa affiliate affid",
  },
  {
    name: "WISE_IR_CLICK_ID",
    required: false,
    description: "Wise Impact affiliate tracking ID",
  },
  {
    name: "VIATOR_WEBHOOK_SECRET",
    required: false,
    description: "Viator conversion webhook HMAC secret",
  },
  {
    name: "GYG_WEBHOOK_SECRET",
    required: false,
    description: "GetYourGuide conversion webhook HMAC secret",
  },
  {
    name: "KLOOK_WEBHOOK_SECRET",
    required: false,
    description: "Klook conversion webhook HMAC secret",
  },
  {
    name: "TRAVELPAYOUTS_WEBHOOK_SECRET",
    required: false,
    description: "Travelpayouts conversion webhook HMAC secret",
  },
  {
    name: "STAY22_WEBHOOK_SECRET",
    required: false,
    description: "Stay22 conversion webhook HMAC secret",
  },
  {
    name: "DUFFEL_WEBHOOK_SECRET",
    required: false,
    description: "Duffel conversion webhook HMAC secret",
  },
  {
    name: "SAFETYWING_WEBHOOK_SECRET",
    required: false,
    description: "SafetyWing conversion webhook HMAC secret",
  },
  {
    name: "AIRALO_WEBHOOK_SECRET",
    required: false,
    description: "Airalo conversion webhook HMAC secret",
  },
];

const MOBILE: EnvVar[] = [
  {
    name: "EXPO_PUBLIC_SUPABASE_URL",
    required: true,
    description: "Supabase project URL (Expo)",
  },
  {
    name: "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anonymous key (Expo)",
  },
  {
    name: "EXPO_PUBLIC_API_URL",
    required: false,
    description: "Backend API URL",
  },
  {
    name: "EXPO_PUBLIC_WEB_URL",
    required: false,
    description: "Public web origin for shared links and legal views",
  },
  {
    name: "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY",
    required: false,
    description: "Google Places API key",
  },
];

const MOBILE_RELEASE: EnvVar[] = [
  {
    name: "EXPO_PUBLIC_SUPABASE_URL",
    required: true,
    description: "Supabase project URL (Expo)",
  },
  {
    name: "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    required: true,
    description: "Supabase anonymous key (Expo)",
  },
  {
    name: "EXPO_PUBLIC_API_URL",
    required: true,
    description: "Production web/API origin",
  },
  {
    name: "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
    required: true,
    description: "Google OAuth web client ID",
  },
  {
    name: "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
    required: true,
    description: "Google OAuth iOS client ID",
  },
  {
    name: "EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME",
    required: true,
    description: "Reversed Google iOS client ID URL scheme",
  },
  {
    name: "EXPO_PUBLIC_SENTRY_DSN",
    required: false,
    description: "Sentry DSN for mobile crash reporting",
  },
  {
    name: "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY",
    required: false,
    description: "Google Places API key",
  },
];

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const content = readFileSync(path, "utf-8");
  const vars: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed
      .slice(eqIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    vars[key] = value;
  }
  return vars;
}

function loadEasProductionEnv(): Record<string, string> {
  const easPath = resolve(ROOT, "apps/mobile/eas.json");
  if (!existsSync(easPath)) return {};

  try {
    const eas = JSON.parse(readFileSync(easPath, "utf-8")) as {
      build?: { production?: { env?: Record<string, string> } };
    };
    return eas.build?.production?.env ?? {};
  } catch {
    return {};
  }
}

// Load env files from multiple locations
const envSources = [
  resolve(ROOT, ".env"),
  resolve(ROOT, ".env.local"),
  resolve(ROOT, "apps/web/.env"),
  resolve(ROOT, "apps/web/.env.local"),
  resolve(ROOT, "apps/mobile/.env"),
  resolve(ROOT, "apps/mobile/.env.local"),
];

const allVars: Record<string, string> = {};
for (const source of envSources) {
  Object.assign(allVars, loadEnvFile(source));
}
if (mobileReleaseMode) {
  Object.assign(allVars, loadEasProductionEnv());
}

// Also include process.env
Object.assign(allVars, process.env);

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function check(label: string, vars: EnvVar[]): number {
  let missing = 0;
  console.log(`\n${BOLD}${CYAN}  ${label}${RESET}`);
  console.log(`  ${"─".repeat(45)}`);

  for (const v of vars) {
    const value = allVars[v.name];
    if (value) {
      console.log(`  ${GREEN}✓${RESET} ${v.name} ${DIM}(configured)${RESET}`);
    } else if (v.required) {
      console.log(
        `  ${RED}✗${RESET} ${v.name} ${RED}(required)${RESET} ${DIM}— ${v.description}${RESET}`,
      );
      missing++;
    } else {
      console.log(
        `  ${YELLOW}○${RESET} ${v.name} ${DIM}(optional) — ${v.description}${RESET}`,
      );
    }
  }

  return missing;
}

console.log(`\n${BOLD}  Faroway Environment Check${RESET}`);
console.log(`  ${"═".repeat(45)}`);

let totalMissing = 0;
if (mobileReleaseMode && process.env.EXPO_PUBLIC_TEST_LOGIN === "true") {
  console.error("EXPO_PUBLIC_TEST_LOGIN must be disabled for mobile releases.");
  process.exit(1);
}
if (mobileReleaseMode) {
  totalMissing += check("Mobile Release", MOBILE_RELEASE);
} else {
  totalMissing += check("Shared (Supabase)", SHARED);
  totalMissing += check("Web App", WEB);
  totalMissing += check("Mobile App", MOBILE);
}

console.log(`\n  ${"═".repeat(45)}`);
if (totalMissing === 0) {
  console.log(`  ${GREEN}${BOLD}All required variables are set!${RESET}\n`);
  process.exit(0);
} else {
  console.log(
    `  ${RED}${BOLD}${totalMissing} required variable(s) missing.${RESET}`,
  );
  console.log(
    `  ${DIM}Add them to .env.local at the root or in the app directory.${RESET}\n`,
  );
  process.exit(1);
}
