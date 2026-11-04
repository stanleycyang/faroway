import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, verify } from "node:crypto";

import {
  createAppleClientSecret,
  rotateAppleClientSecret,
} from "../rotate-apple-secret";

const now = new Date("2026-07-24T12:00:00.000Z");
const teamId = "TEAMID1234";
const keyId = "KEYID12345";
const clientId = "ai.faroway.web";

function pkcs8Pem(): string {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return privateKey.export({ format: "pem", type: "pkcs8" }).toString();
}

function secretFrom(privateKeyPem: string) {
  return createAppleClientSecret({
    teamId,
    keyId,
    clientId,
    privateKeyPem,
    now,
  });
}

function validEnv(privateKeyPem: string): NodeJS.ProcessEnv {
  return {
    APPLE_TEAM_ID: teamId,
    APPLE_KEY_ID: keyId,
    APPLE_CLIENT_ID: clientId,
    APPLE_P8_PRIVATE_KEY: privateKeyPem,
    SUPABASE_ACCESS_TOKEN: "sbp_test_token",
    SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
  };
}

describe("createAppleClientSecret", () => {
  test("creates a verifiable ES256 Apple client secret", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const privateKeyPem = privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString();

    const { token, expiresAt } = createAppleClientSecret({
      teamId,
      keyId,
      clientId,
      privateKeyPem,
      now,
    });
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    const lifetimeSeconds = 1800446400 - 1784894400;

    expect(
      JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")),
    ).toEqual({
      alg: "ES256",
      kid: keyId,
    });
    expect(
      JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")),
    ).toEqual({
      iss: teamId,
      iat: 1784894400,
      exp: 1800446400,
      aud: "https://appleid.apple.com",
      sub: clientId,
    });
    expect(lifetimeSeconds).toBe(180 * 24 * 60 * 60);
    expect(lifetimeSeconds <= 15_777_000).toBe(true);
    expect(expiresAt.toISOString()).toBe("2027-01-20T12:00:00.000Z");
    expect(
      verify(
        "sha256",
        Buffer.from(`${encodedHeader}.${encodedPayload}`),
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(encodedSignature, "base64url"),
      ),
    ).toBe(true);
  });

  test("accepts escaped newlines from a GitHub Actions secret", () => {
    const escapedPrivateKey = pkcs8Pem().trim().replaceAll("\n", "\\n");

    expect(() => secretFrom(escapedPrivateKey)).not.toThrow();
  });

  test("accepts quotes, a BOM, and an env assignment around the PEM", () => {
    const pem = pkcs8Pem().trim();
    const wrapped = `\uFEFFAPPLE_P8_PRIVATE_KEY="${pem.replaceAll("\n", "\\n")}"`;

    expect(() => secretFrom(wrapped)).not.toThrow();
  });

  test("accepts a base64-encoded PEM and a raw PKCS8 body", () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const der = privateKey.export({ format: "der", type: "pkcs8" });

    expect(() =>
      secretFrom(Buffer.from(pem).toString("base64")),
    ).not.toThrow();
    expect(() => secretFrom(Buffer.from(der).toString("base64"))).not.toThrow();
  });

  test("accepts an SEC1 EC private key", () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const sec1 = privateKey.export({ format: "pem", type: "sec1" }).toString();

    expect(sec1).toContain("BEGIN EC PRIVATE KEY");
    expect(() => secretFrom(sec1)).not.toThrow();
  });

  test("rejects a non-ES256 private key", () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });

    expect(() =>
      secretFrom(privateKey.export({ format: "pem", type: "pkcs8" }).toString()),
    ).toThrow("must be an Apple ES256 key");
  });

  test("names a malformed private key without echoing it", () => {
    const stored = "not-a-key";

    expect(() => secretFrom(stored)).toThrow(
      /APPLE_P8_PRIVATE_KEY is malformed \(1 line, 9 characters, no PEM header, no PEM footer, no escaped newlines\)/,
    );
    try {
      secretFrom(stored);
    } catch (error) {
      expect(error instanceof Error ? error.message : "").not.toContain(stored);
    }
  });
});

describe("rotateAppleClientSecret", () => {
  test("names every missing environment variable", async () => {
    await expect(
      rotateAppleClientSecret({
        env: { APPLE_TEAM_ID: "   " },
        args: ["--dry-run"],
        fetchImpl: async () => {
          throw new Error("fetch should not be called");
        },
      }),
    ).rejects.toThrow(
      "Missing required environment variables: APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID, APPLE_P8_PRIVATE_KEY, SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF.",
    );
  });

  test("dry-run builds the client secret and does not call Supabase", async () => {
    const logs: string[] = [];

    await rotateAppleClientSecret({
      env: validEnv(pkcs8Pem()),
      args: ["bun", "scripts/rotate-apple-secret.ts", "--dry-run"],
      now,
      log: (message) => logs.push(message),
      fetchImpl: async () => {
        throw new Error("fetch should not be called");
      },
    });

    expect(logs).toEqual([
      "Apple client secret generated successfully; expires 2027-01-20.",
    ]);
  });

  test("updates Supabase only when not a dry run", async () => {
    let captured: { url: string; body: string; authorization: string } | null =
      null;

    await rotateAppleClientSecret({
      env: validEnv(pkcs8Pem()),
      args: ["bun", "scripts/rotate-apple-secret.ts"],
      now,
      log: () => {},
      fetchImpl: async (url, init) => {
        const headers = new Headers(init?.headers);
        captured = {
          url: String(url),
          body: String(init?.body),
          authorization: headers.get("authorization") ?? "",
        };
        return new Response(null, {
          status: 200,
          headers: { "x-request-id": "req_test" },
        });
      },
    });

    expect(captured == null).toBe(false);
    expect(captured!.url).toBe(
      "https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/config/auth",
    );
    expect(captured!.authorization).toBe("Bearer sbp_test_token");
    const body = JSON.parse(captured!.body) as {
      external_apple_enabled: boolean;
      external_apple_client_id: string;
      external_apple_secret: string;
    };
    expect(body.external_apple_enabled).toBe(true);
    expect(body.external_apple_client_id).toBe(clientId);
    expect(body.external_apple_secret.split(".")).toHaveLength(3);
  });

  test("rejects a malformed project ref before calling Supabase", async () => {
    const env = validEnv(pkcs8Pem());
    env.SUPABASE_PROJECT_REF = "not-a-ref";

    await expect(
      rotateAppleClientSecret({
        env,
        args: ["--dry-run"],
        fetchImpl: async () => {
          throw new Error("fetch should not be called");
        },
      }),
    ).rejects.toThrow(
      "SUPABASE_PROJECT_REF is malformed. Expected 20 lowercase letters.",
    );
  });
});
