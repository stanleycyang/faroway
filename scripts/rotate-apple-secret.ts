#!/usr/bin/env bun

import { createPrivateKey, sign } from "node:crypto";

const APPLE_AUDIENCE = "https://appleid.apple.com";
// Apple rejects an exp more than 15777000 seconds (six months) after iat.
const CLIENT_SECRET_LIFETIME_SECONDS = 180 * 24 * 60 * 60;
const REQUIRED_ENV_VARS = [
  "APPLE_TEAM_ID",
  "APPLE_KEY_ID",
  "APPLE_CLIENT_ID",
  "APPLE_P8_PRIVATE_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_REF",
] as const;

interface AppleClientSecretOptions {
  teamId: string;
  keyId: string;
  clientId: string;
  privateKeyPem: string;
  now?: Date;
}

export interface RotateAppleClientSecretOptions {
  env?: NodeJS.ProcessEnv;
  args?: readonly string[];
  fetchImpl?: typeof fetch;
  now?: Date;
  log?: (message: string) => void;
}

function encodeJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function requireIdentifier(
  label: string,
  value: string,
  pattern: RegExp,
  expectation: string,
): void {
  if (!pattern.test(value)) {
    throw new Error(`${label} is malformed. Expected ${expectation}.`);
  }
}

function stripWrapping(value: string): string {
  let text = value.replace(/^\uFEFF/, "").trim();
  const assignment = text.match(
    /^(?:export\s+)?APPLE_P8_PRIVATE_KEY\s*=\s*([\s\S]*)$/,
  );
  if (assignment?.[1]) {
    text = assignment[1].trim();
  }
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  return text
    .replaceAll("\\r\\n", "\n")
    .replaceAll("\\n", "\n")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .trim();
}

function extractPem(value: string): string | null {
  const match = value.match(
    /-----BEGIN ((?:EC )?PRIVATE KEY)-----([\s\S]*?)-----END \1-----/,
  );
  if (!match) {
    return null;
  }
  const body = match[2].replace(/[^A-Za-z0-9+/=]/g, "");
  if (!body) {
    return null;
  }
  const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `-----BEGIN ${match[1]}-----\n${wrapped}\n-----END ${match[1]}-----`;
}

function isBase64(value: string): boolean {
  return (
    value.length >= 64 &&
    value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]+={0,2}$/.test(value)
  );
}

function decodeBase64Text(value: string): string | null {
  const compact = value.replace(/\s+/g, "");
  if (!isBase64(compact)) {
    return null;
  }
  const decoded = Buffer.from(compact, "base64");
  const text = decoded.toString("utf8");
  if (!text.includes("-----BEGIN") || text.includes("\uFFFD")) {
    return null;
  }
  return text;
}

function readEs256Pkcs8(pem: string): string | null {
  try {
    const key = createPrivateKey(pem);
    if (
      key.asymmetricKeyType !== "ec" ||
      key.asymmetricKeyDetails?.namedCurve !== "prime256v1"
    ) {
      throw new Error("APPLE_P8_PRIVATE_KEY must be an Apple ES256 key.");
    }
    const exported = key.export({ format: "pem", type: "pkcs8" });
    return (
      typeof exported === "string" ? exported : exported.toString()
    ).trim();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("must be an Apple ES256 key")
    ) {
      throw error;
    }
    return null;
  }
}

function malformedPrivateKeyError(value: string): Error {
  const trimmed = value.trim();
  const lines = trimmed ? trimmed.split(/\r\n|\n|\r/).length : 0;
  const hasPemHeader = /-----BEGIN (?:EC )?PRIVATE KEY-----/.test(trimmed);
  const hasPemFooter = /-----END (?:EC )?PRIVATE KEY-----/.test(trimmed);
  const hasEscapedNewlines = trimmed.includes("\\n");
  return new Error(
    `APPLE_P8_PRIVATE_KEY is malformed (${lines} line${lines === 1 ? "" : "s"}, ${trimmed.length} characters, ${hasPemHeader ? "PEM header present" : "no PEM header"}, ${hasPemFooter ? "PEM footer present" : "no PEM footer"}, ${hasEscapedNewlines ? "escaped newlines present" : "no escaped newlines"}). Paste the AuthKey .p8 from Apple Developer into the Actions secret APPLE_P8_PRIVATE_KEY, including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----.`,
  );
}

function normalizeApplePrivateKey(value: string): string {
  const text = stripWrapping(value);
  const pemCandidates: string[] = [];
  const directPem = extractPem(text);
  if (directPem) {
    pemCandidates.push(directPem);
  }
  const decoded = decodeBase64Text(text);
  if (decoded) {
    const decodedPem = extractPem(decoded);
    if (decodedPem) {
      pemCandidates.push(decodedPem);
    }
  }

  if (pemCandidates.length > 0) {
    for (const pem of pemCandidates) {
      const key = readEs256Pkcs8(pem);
      if (key) {
        return key;
      }
    }
    throw malformedPrivateKeyError(value);
  }

  const compact = text.replace(/\s+/g, "");
  if (isBase64(compact)) {
    const body = compact.match(/.{1,64}/g)?.join("\n");
    if (body) {
      const key = readEs256Pkcs8(
        `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`,
      );
      if (key) {
        return key;
      }
    }
  }

  throw malformedPrivateKeyError(value);
}

function missingRotationEnvVars(env: NodeJS.ProcessEnv): string[] {
  return REQUIRED_ENV_VARS.filter((name) => !env[name]?.trim());
}

export function createAppleClientSecret({
  teamId,
  keyId,
  clientId,
  privateKeyPem,
  now = new Date(),
}: AppleClientSecretOptions): { token: string; expiresAt: Date } {
  requireIdentifier(
    "APPLE_TEAM_ID",
    teamId,
    /^[A-Z0-9]{10}$/,
    "10 uppercase letters or digits",
  );
  requireIdentifier(
    "APPLE_KEY_ID",
    keyId,
    /^[A-Z0-9]{10}$/,
    "10 uppercase letters or digits",
  );
  requireIdentifier(
    "APPLE_CLIENT_ID",
    clientId,
    /^[A-Za-z0-9][A-Za-z0-9.-]+$/,
    "an Apple Services ID or App ID",
  );

  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAtSeconds = issuedAt + CLIENT_SECRET_LIFETIME_SECONDS;
  const privateKey = createPrivateKey(normalizeApplePrivateKey(privateKeyPem));
  const header = encodeJson({ alg: "ES256", kid: keyId });
  const payload = encodeJson({
    iss: teamId,
    iat: issuedAt,
    exp: expiresAtSeconds,
    aud: APPLE_AUDIENCE,
    sub: clientId,
  });
  const signingInput = `${header}.${payload}`;

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

export async function rotateAppleClientSecret({
  env = process.env,
  args = process.argv,
  fetchImpl = fetch,
  now,
  log = console.log,
}: RotateAppleClientSecretOptions = {}): Promise<void> {
  const missing = missingRotationEnvVars(env);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
    );
  }

  const read = (name: (typeof REQUIRED_ENV_VARS)[number]) => env[name]!.trim();
  const projectRef = read("SUPABASE_PROJECT_REF");
  requireIdentifier(
    "SUPABASE_PROJECT_REF",
    projectRef,
    /^[a-z]{20}$/,
    "20 lowercase letters",
  );
  const accessToken = read("SUPABASE_ACCESS_TOKEN");
  const clientId = read("APPLE_CLIENT_ID");
  const { token, expiresAt } = createAppleClientSecret({
    teamId: read("APPLE_TEAM_ID"),
    keyId: read("APPLE_KEY_ID"),
    clientId,
    privateKeyPem: read("APPLE_P8_PRIVATE_KEY"),
    now,
  });

  const expiryDate = expiresAt.toISOString().slice(0, 10);
  if (args.includes("--dry-run")) {
    log(
      `Apple client secret generated successfully; expires ${expiryDate}.`,
    );
    return;
  }

  const response = await fetchImpl(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_apple_enabled: true,
        external_apple_client_id: clientId,
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

  log(`Supabase Apple OAuth secret updated; expires ${expiryDate}.`);
}

if (import.meta.main) {
  rotateAppleClientSecret().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Apple OAuth rotation failed: ${message}`);
    process.exit(1);
  });
}
