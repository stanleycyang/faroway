#!/usr/bin/env bun

import { createPrivateKey, sign } from "node:crypto";

const APPLE_AUDIENCE = "https://appleid.apple.com";
const CLIENT_SECRET_LIFETIME_SECONDS = 180 * 24 * 60 * 60;

interface AppleClientSecretOptions {
  teamId: string;
  keyId: string;
  clientId: string;
  privateKeyPem: string;
  now?: Date;
}

function encodeJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function requireIdentifier(
  label: string,
  value: string,
  pattern: RegExp,
): void {
  if (!pattern.test(value)) {
    throw new Error(`${label} is missing or malformed.`);
  }
}

function normalizePrivateKey(value: string): string {
  const normalized = value.trim().replaceAll("\\n", "\n");
  if (
    !normalized.startsWith("-----BEGIN PRIVATE KEY-----") ||
    !normalized.endsWith("-----END PRIVATE KEY-----")
  ) {
    throw new Error("APPLE_P8_PRIVATE_KEY is missing or malformed.");
  }
  return normalized;
}

export function createAppleClientSecret({
  teamId,
  keyId,
  clientId,
  privateKeyPem,
  now = new Date(),
}: AppleClientSecretOptions): { token: string; expiresAt: Date } {
  requireIdentifier("APPLE_TEAM_ID", teamId, /^[A-Z0-9]{10}$/);
  requireIdentifier("APPLE_KEY_ID", keyId, /^[A-Z0-9]{10}$/);
  requireIdentifier("APPLE_CLIENT_ID", clientId, /^[A-Za-z0-9][A-Za-z0-9.-]+$/);

  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAtSeconds = issuedAt + CLIENT_SECRET_LIFETIME_SECONDS;
  const header = encodeJson({ alg: "ES256", kid: keyId });
  const payload = encodeJson({
    iss: teamId,
    iat: issuedAt,
    exp: expiresAtSeconds,
    aud: APPLE_AUDIENCE,
    sub: clientId,
  });
  const signingInput = `${header}.${payload}`;
  const privateKey = createPrivateKey(normalizePrivateKey(privateKeyPem));

  if (
    privateKey.asymmetricKeyType !== "ec" ||
    privateKey.asymmetricKeyDetails?.namedCurve !== "prime256v1"
  ) {
    throw new Error("APPLE_P8_PRIVATE_KEY must be an Apple ES256 key.");
  }

  const signature = sign("sha256", Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");

  return {
    token: `${signingInput}.${signature}`,
    expiresAt: new Date(expiresAtSeconds * 1000),
  };
}

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function updateSupabaseAppleSecret(): Promise<void> {
  const projectRef = requireEnvironmentVariable("SUPABASE_PROJECT_REF");
  requireIdentifier("SUPABASE_PROJECT_REF", projectRef, /^[a-z]{20}$/);

  const accessToken = requireEnvironmentVariable("SUPABASE_ACCESS_TOKEN");
  const { token, expiresAt } = createAppleClientSecret({
    teamId: requireEnvironmentVariable("APPLE_TEAM_ID"),
    keyId: requireEnvironmentVariable("APPLE_KEY_ID"),
    clientId: requireEnvironmentVariable("APPLE_CLIENT_ID"),
    privateKeyPem: requireEnvironmentVariable("APPLE_P8_PRIVATE_KEY"),
  });

  if (process.argv.includes("--dry-run")) {
    console.log(
      `Apple client secret generated successfully; expires ${expiresAt.toISOString().slice(0, 10)}.`,
    );
    return;
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_apple_enabled: true,
        external_apple_client_id: requireEnvironmentVariable("APPLE_CLIENT_ID"),
        external_apple_secret: token,
      }),
    },
  );

  if (!response.ok) {
    const requestId = response.headers.get("x-request-id");
    throw new Error(
      `Supabase Auth update failed with HTTP ${response.status}${requestId ? ` (request ${requestId})` : ""}.`,
    );
  }

  console.log(
    `Supabase Apple OAuth secret updated; expires ${expiresAt.toISOString().slice(0, 10)}.`,
  );
}

if (import.meta.main) {
  updateSupabaseAppleSecret().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Apple OAuth rotation failed: ${message}`);
    process.exit(1);
  });
}
