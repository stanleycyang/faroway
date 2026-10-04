import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

const issuer = "https://appleid.apple.com";
const appleKeys = createRemoteJWKSet(new URL(`${issuer}/auth/keys`), {
  timeoutDuration: 10_000,
});

export class AppleRevocationError extends Error {
  constructor(
    public readonly code:
      | "not_configured"
      | "identity_unavailable"
      | "invalid_code"
      | "exchange_failed"
      | "identity_mismatch"
      | "revocation_failed",
  ) {
    super(`Apple account revocation could not be completed (${code}).`);
    this.name = "AppleRevocationError";
  }
}

export interface AuthenticatedUser {
  identities?: Array<{ provider: string; identity_data?: { sub?: unknown } }>;
}
export interface AppleRevocationConfiguration {
  // Server-selected bundle ID or Services ID matching this authorization flow.
  clientId: string;
  // Supplied by a reviewed server credential mechanism; never from the client.
  clientSecret: string;
}

/**
 * Used by the configuration-gated durable account deletion coordinator.
 * Caller must authenticate the user, obtain deliberate deletion consent and a
 * fresh Apple authorization code, and select server-owned client configuration.
 * A 200 revocation response is an accepted request, not a deletion receipt.
 * Do not delete Auth identities until revocation + durable retry are resolved.
 * No credentials are generated, persisted, logged or returned by this helper.
 */
export async function revokeAppleAuthorizationForUser(
  user: AuthenticatedUser,
  authorizationCode: string,
  configuration?: AppleRevocationConfiguration,
  persistVerifiedToken?: (token: AppleRevocationToken) => Promise<void>,
): Promise<{ status: "not_applicable" | "revocation_accepted" }> {
  if (!Array.isArray(user.identities))
    throw new AppleRevocationError("identity_unavailable");
  const identities =
    user.identities?.filter((identity) => identity.provider === "apple") || [];
  if (!identities.length) return { status: "not_applicable" };
  const subject =
    identities.length === 1 ? identities[0].identity_data?.sub : null;
  if (typeof subject !== "string" || !subject)
    throw new AppleRevocationError("identity_unavailable");
  if (!configuration?.clientId || !configuration.clientSecret)
    throw new AppleRevocationError("not_configured");
  if (
    typeof authorizationCode !== "string" ||
    authorizationCode.length < 8 ||
    authorizationCode.length > 4096 ||
    /\s/.test(authorizationCode)
  )
    throw new AppleRevocationError("invalid_code");

  const request = (
    path: "/auth/token" | "/auth/revoke",
    fields: Record<string, string>,
  ) =>
    fetch(`${issuer}${path}`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: configuration.clientId,
        client_secret: configuration.clientSecret,
        ...fields,
      }),
    });

  let tokens: {
    id_token?: unknown;
    refresh_token?: unknown;
    access_token?: unknown;
  };
  try {
    const response = await request("/auth/token", {
      grant_type: "authorization_code",
      code: authorizationCode,
    });
    if (!response.ok) throw new Error();
    tokens = await response.json();
    if (!tokens || typeof tokens.id_token !== "string") throw new Error();
  } catch {
    // Never propagate upstream error text, which may contain codes or tokens.
    throw new AppleRevocationError("exchange_failed");
  }

  try {
    const { payload } = await jwtVerify(tokens.id_token as string, appleKeys, {
      issuer,
      audience: configuration.clientId,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "iat", "exp"],
      maxTokenAge: "10m",
    });
    if (payload.sub !== subject) throw new Error();
  } catch {
    throw new AppleRevocationError("identity_mismatch");
  }

  const refreshToken =
    typeof tokens.refresh_token === "string" && tokens.refresh_token
      ? tokens.refresh_token
      : null;
  const accessToken =
    typeof tokens.access_token === "string" && tokens.access_token
      ? tokens.access_token
      : null;
  const token = refreshToken || accessToken;
  if (!token) throw new AppleRevocationError("exchange_failed");
  const verified = {
    token,
    tokenType: refreshToken
      ? ("refresh_token" as const)
      : ("access_token" as const),
    clientId: configuration.clientId,
  };
  // A durable caller persists encrypted recovery material BEFORE revocation.
  if (persistVerifiedToken) await persistVerifiedToken(verified);
  await revokeVerifiedAppleToken(verified, configuration);
  return { status: "revocation_accepted" };
}

export interface AppleRevocationToken {
  token: string;
  tokenType: "refresh_token" | "access_token";
  clientId: string;
}
export async function revokeVerifiedAppleToken(
  token: AppleRevocationToken,
  configuration: AppleRevocationConfiguration,
) {
  if (
    token.clientId !== configuration.clientId ||
    !token.token ||
    !["refresh_token", "access_token"].includes(token.tokenType)
  )
    throw new AppleRevocationError("identity_mismatch");
  try {
    const response = await fetch(`${issuer}/auth/revoke`, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: configuration.clientId,
        client_secret: configuration.clientSecret,
        token: token.token,
        token_type_hint: token.tokenType,
      }),
    });
    if (response.status !== 200) throw new Error();
  } catch {
    throw new AppleRevocationError("revocation_failed");
  }
}
