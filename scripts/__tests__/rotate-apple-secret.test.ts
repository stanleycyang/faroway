import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, verify } from "node:crypto";

import { createAppleClientSecret } from "../rotate-apple-secret";

describe("createAppleClientSecret", () => {
  test("creates a verifiable ES256 Apple client secret", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const privateKeyPem = privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString();
    const now = new Date("2026-07-24T12:00:00.000Z");

    const { token, expiresAt } = createAppleClientSecret({
      teamId: "TEAMID1234",
      keyId: "KEYID12345",
      clientId: "ai.faroway.web",
      privateKeyPem,
      now,
    });
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

    expect(
      JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")),
    ).toEqual({
      alg: "ES256",
      kid: "KEYID12345",
    });
    expect(
      JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")),
    ).toEqual({
      iss: "TEAMID1234",
      iat: 1784894400,
      exp: 1800446400,
      aud: "https://appleid.apple.com",
      sub: "ai.faroway.web",
    });
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
    const { privateKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const escapedPrivateKey = privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString()
      .trim()
      .replaceAll("\n", "\\n");

    expect(() =>
      createAppleClientSecret({
        teamId: "TEAMID1234",
        keyId: "KEYID12345",
        clientId: "ai.faroway.web",
        privateKeyPem: escapedPrivateKey,
      }),
    ).not.toThrow();
  });

  test("rejects a non-ES256 private key", () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });

    expect(() =>
      createAppleClientSecret({
        teamId: "TEAMID1234",
        keyId: "KEYID12345",
        clientId: "ai.faroway.web",
        privateKeyPem: privateKey
          .export({ format: "pem", type: "pkcs8" })
          .toString(),
      }),
    ).toThrow("must be an Apple ES256 key");
  });
});
