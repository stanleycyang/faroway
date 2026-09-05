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
const webReleaseMode = args.has("--web-release");

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  minLength?: number;
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
    name: "OPENAI_API_KEY",
    required: false,
    description: "OpenAI API key for AI features",
  },
  {
    name: "GOOGLE_AI_API_KEY",
    required: false,
    description: "Google AI API key",
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    required: false,
    description: "Public app URL",
  },
  {
    name: "NEXT_PUBLIC_GA_MEASUREMENT_ID",
    required: false,
    description: "Google Analytics measurement ID",
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
    name: "BOOKING_COM_TOKEN",
    required: false,
    description: "Booking.com Demand API bearer token for hotel inventory",
  },
  {
    name: "BOOKING_COM_AFFILIATE_ID",
    required: false,
    description: "Booking.com affiliate ID for hotel inventory and links",
  },
  {
    name: "BOOKING_COM_USERNAME",
    required: false,
    description: "Legacy Booking.com Distribution API username fallback",
  },
  {
    name: "BOOKING_COM_PASSWORD",
    required: false,
    description: "Legacy Booking.com Distribution API password fallback",
  },
  {
    name: "AMADEUS_CLIENT_ID",
    required: false,
    description: "Amadeus client ID for hotels and flights",
  },
  {
    name: "AMADEUS_CLIENT_SECRET",
    required: false,
    description: "Amadeus client secret for hotels and flights",
  },
  {
    name: "DUFFEL_API_TOKEN",
    required: false,
    description: "Duffel token for flight search and links",
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
];

const WEB_RELEASE: EnvVar[] = [
  ...SHARED,
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    description: "Supabase service role key (server-only)",
  },
  {
    name: "AI_GATEWAY_API_KEY",
    required: true,
    description: "Vercel AI Gateway API key for itinerary generation",
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    required: true,
    description: "Canonical production web origin",
  },
  {
    name: "IP_HASH_SALT",
    required: true,
    minLength: 32,
    description: "Server-only HMAC salt (at least 32 characters)",
  },
  {
    name: "CRON_SECRET",
    required: true,
    minLength: 32,
    description: "Cleanup cron bearer secret (at least 32 characters)",
  },
  {
    name: "NEXT_PUBLIC_SENTRY_DSN",
    required: true,
    description: "Browser error-monitoring DSN",
  },
  {
    name: "VIATOR_API_KEY",
    required: true,
    description: "Viator inventory API key",
  },
  {
    name: "VIATOR_PARTNER_ID",
    required: true,
    description: "Viator affiliate partner ID",
  },
  {
    name: "VIATOR_WEBHOOK_SECRET",
    required: true,
    minLength: 32,
    description: "Viator conversion webhook HMAC secret",
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
    if (value && (!v.minLength || value.length >= v.minLength)) {
      console.log(`  ${GREEN}✓${RESET} ${v.name} ${DIM}(configured)${RESET}`);
    } else if (v.required) {
      const requirement =
        value && v.minLength
          ? `(must be at least ${v.minLength} characters)`
          : "(required)";
      console.log(
        `  ${RED}✗${RESET} ${v.name} ${RED}${requirement}${RESET} ${DIM}— ${v.description}${RESET}`,
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
if (mobileReleaseMode) {
  totalMissing += check("Mobile Release", MOBILE_RELEASE);
} else if (webReleaseMode) {
  totalMissing += check("Web Release", WEB_RELEASE);
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
