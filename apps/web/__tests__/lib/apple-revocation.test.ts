import { beforeEach, describe, expect, it, vi } from "vitest";
const verify = vi.hoisted(() => vi.fn());
const keys = vi.hoisted(() => vi.fn(() => "fixed-apple-key-resolver"));
vi.mock("jose", () => ({ jwtVerify: verify, createRemoteJWKSet: keys }));
import { revokeAppleAuthorizationForUser } from "@/lib/auth/apple-revocation";

const fetchMock = vi.fn();
const user = {
  identities: [{ provider: "apple", identity_data: { sub: "apple-subject" } }],
};
const config = {
  clientId: "ai.faroway.app",
  clientSecret: "synthetic-test-client-secret",
};
const code = "synthetic-auth-code";
const tokens = {
  id_token: "synthetic-id-token",
  refresh_token: "synthetic-refresh-token",
  access_token: "synthetic-access-token",
};
beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  verify.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  verify.mockResolvedValue({ payload: { sub: "apple-subject" } });
  fetchMock
    .mockResolvedValueOnce({ ok: true, json: async () => tokens })
    .mockResolvedValueOnce({ status: 200 });
});

describe("Apple revocation preparation (no live calls)", () => {
  it("has no side effects for non-Apple accounts", async () => {
    expect(
      await revokeAppleAuthorizationForUser(
        { identities: [{ provider: "google" }] },
        code,
      ),
    ).toEqual({ status: "not_applicable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("fails closed without reviewed server configuration or a stable Apple subject", async () => {
    await expect(
      revokeAppleAuthorizationForUser({}, code, config),
    ).rejects.toMatchObject({ code: "identity_unavailable" });
    await expect(
      revokeAppleAuthorizationForUser(user, code),
    ).rejects.toMatchObject({ code: "not_configured" });
    await expect(
      revokeAppleAuthorizationForUser(
        { identities: [{ provider: "apple" }] },
        code,
        config,
      ),
    ).rejects.toMatchObject({ code: "identity_unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("exchanges the fresh code, verifies issuer/audience/algorithm/age and revokes a refresh token", async () => {
    expect(await revokeAppleAuthorizationForUser(user, code, config)).toEqual({
      status: "revocation_accepted",
    });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://appleid.apple.com/auth/token",
      "https://appleid.apple.com/auth/revoke",
    ]);
    const exchange = fetchMock.mock.calls[0][1];
    expect(exchange.redirect).toBe("error");
    expect(exchange.cache).toBe("no-store");
    expect(Object.fromEntries(exchange.body)).toEqual({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
    });
    expect(verify).toHaveBeenCalledWith(
      tokens.id_token,
      "fixed-apple-key-resolver",
      {
        issuer: "https://appleid.apple.com",
        audience: config.clientId,
        algorithms: ["RS256"],
        requiredClaims: ["sub", "iat", "exp"],
        maxTokenAge: "10m",
      },
    );
    expect(Object.fromEntries(fetchMock.mock.calls[1][1].body)).toMatchObject({
      token: tokens.refresh_token,
      token_type_hint: "refresh_token",
    });
  });
  it("never revokes another Apple identity", async () => {
    verify.mockResolvedValue({ payload: { sub: "another-person" } });
    await expect(
      revokeAppleAuthorizationForUser(user, code, config),
    ).rejects.toMatchObject({ code: "identity_mismatch" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects an unverifiable, expired or wrong-audience ID token without revocation", async () => {
    verify.mockRejectedValue(new Error("synthetic-token-in-upstream-error"));
    await expect(
      revokeAppleAuthorizationForUser(user, code, config),
    ).rejects.toMatchObject({
      code: "identity_mismatch",
      message: expect.not.stringContaining("synthetic-token"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("can revoke an access token when no refresh token is returned, never an ID token", async () => {
    fetchMock
      .mockReset()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id_token: tokens.id_token,
          access_token: tokens.access_token,
        }),
      })
      .mockResolvedValueOnce({ status: 200 });
    await revokeAppleAuthorizationForUser(user, code, config);
    expect(Object.fromEntries(fetchMock.mock.calls[1][1].body)).toMatchObject({
      token: tokens.access_token,
      token_type_hint: "access_token",
    });
  });
  it("does not report successful revocation on an upstream failure or leak its error body", async () => {
    fetchMock
      .mockReset()
      .mockResolvedValueOnce({ ok: true, json: async () => tokens })
      .mockRejectedValueOnce(new Error("synthetic-secret-from-provider"));
    await expect(
      revokeAppleAuthorizationForUser(user, code, config),
    ).rejects.toMatchObject({
      code: "revocation_failed",
      message: expect.not.stringContaining("synthetic-secret"),
    });
  });
  it("rejects an expired/used code and malformed exchange responses before revocation", async () => {
    fetchMock.mockReset().mockResolvedValue({ ok: false });
    await expect(
      revokeAppleAuthorizationForUser(user, code, config),
    ).rejects.toMatchObject({ code: "exchange_failed" });
    expect(verify).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
