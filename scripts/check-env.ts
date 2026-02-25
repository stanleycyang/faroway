#!/usr/bin/env bun

/**
 * Environment variable validator for Faroway monorepo.
 * Run with: bun run env:check
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");

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
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
    vars[key] = value;
  }
  return vars;
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
      const masked = value.slice(0, 8) + "..." + value.slice(-4);
      console.log(`  ${GREEN}✓${RESET} ${v.name} ${DIM}${masked}${RESET}`);
    } else if (v.required) {
      console.log(`  ${RED}✗${RESET} ${v.name} ${RED}(required)${RESET} ${DIM}— ${v.description}${RESET}`);
      missing++;
    } else {
      console.log(`  ${YELLOW}○${RESET} ${v.name} ${DIM}(optional) — ${v.description}${RESET}`);
    }
  }

  return missing;
}

console.log(`\n${BOLD}  Faroway Environment Check${RESET}`);
console.log(`  ${"═".repeat(45)}`);

let totalMissing = 0;
totalMissing += check("Shared (Supabase)", SHARED);
totalMissing += check("Web App", WEB);
totalMissing += check("Mobile App", MOBILE);

console.log(`\n  ${"═".repeat(45)}`);
if (totalMissing === 0) {
  console.log(`  ${GREEN}${BOLD}All required variables are set!${RESET}\n`);
  process.exit(0);
} else {
  console.log(`  ${RED}${BOLD}${totalMissing} required variable(s) missing.${RESET}`);
  console.log(`  ${DIM}Add them to .env.local at the root or in the app directory.${RESET}\n`);
  process.exit(1);
}
