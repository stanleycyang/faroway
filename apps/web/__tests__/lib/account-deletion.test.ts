import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  runAccountDeletion,
  type DeletionDependencies,
  type DeletionReceipt,
} from "@/lib/auth/account-deletion";
import {
  sealRevocationToken,
  openRevocationToken,
  appleDeletionConfiguration,
} from "@/lib/auth/deletion-recovery";
const apple = {
  identities: [{ provider: "apple", identity_data: { sub: "owner" } }],
};
const token = {
  token: "synthetic-token",
  tokenType: "refresh_token" as const,
  clientId: "synthetic-client",
};
let receipt: DeletionReceipt;
let deps: DeletionDependencies;
beforeEach(() => {
  vi.unstubAllEnvs();
  receipt = { phase: "pending", apple_token_ciphertext: null };
  deps = {
    appleConfigured: true,
    claim: vi.fn(async () => ({ ...receipt })),
    save: vi.fn(async (phase, cipher) => {
      receipt = { phase, apple_token_ciphertext: cipher };
    }),
    release: vi.fn(async () => {}),
    seal: vi.fn(() => "encrypted"),
    exchangeAndRevoke: vi.fn(async (_code, persist) => {
      await persist(token);
    }),
    resumeRevocation: vi.fn(async () => {}),
    purgeData: vi.fn(async () => {}),
    deleteAuth: vi.fn(async () => {}),
  };
});
describe("durable account deletion", () => {
  it("fails before any claim or deletion when Apple credentials are missing", async () => {
    deps.appleConfigured = false;
    await expect(
      runAccountDeletion(apple, "fresh-code", deps),
    ).rejects.toMatchObject({ code: "apple_revocation_not_configured" });
    expect(deps.claim).not.toHaveBeenCalled();
    expect(deps.purgeData).not.toHaveBeenCalled();
    expect(appleDeletionConfiguration()).toBeNull();
  });
  it("requires fresh Apple reauthentication before data removal", async () => {
    await expect(
      runAccountDeletion(apple, undefined, deps),
    ).rejects.toMatchObject({ status: 428 });
    expect(receipt.phase).toBe("pending");
    expect(deps.purgeData).not.toHaveBeenCalled();
    expect(deps.release).toHaveBeenCalled();
  });
  it("persists verified encrypted recovery material before revocation and removes it after success", async () => {
    deps.exchangeAndRevoke = vi.fn(async (_code, persist) => {
      await persist(token);
      expect(receipt).toEqual({
        phase: "revocation_ready",
        apple_token_ciphertext: "encrypted",
      });
      expect(deps.purgeData).not.toHaveBeenCalled();
    });
    await expect(
      runAccountDeletion(apple, "fresh-code", deps),
    ).resolves.toEqual({ deleted: true });
    expect(receipt).toEqual({
      phase: "completed",
      apple_token_ciphertext: null,
    });
  });
  it("retries a provider timeout with the saved token, never the consumed authorization code", async () => {
    deps.exchangeAndRevoke = vi.fn(async (_code, persist) => {
      await persist(token);
      throw new Error("timeout");
    });
    await expect(runAccountDeletion(apple, "fresh-code", deps)).rejects.toThrow(
      "timeout",
    );
    expect(deps.purgeData).not.toHaveBeenCalled();
    await runAccountDeletion(apple, undefined, deps);
    expect(deps.exchangeAndRevoke).toHaveBeenCalledTimes(1);
    expect(deps.resumeRevocation).toHaveBeenCalledWith("encrypted");
  });
  it("does not revoke if durable token storage fails", async () => {
    deps.save = vi.fn(async () => {
      throw new Error("storage unavailable");
    });
    await expect(runAccountDeletion(apple, "fresh-code", deps)).rejects.toThrow(
      "storage unavailable",
    );
    expect(deps.purgeData).not.toHaveBeenCalled();
    expect(deps.deleteAuth).not.toHaveBeenCalled();
  });
  it("resumes partial data cleanup without another Apple exchange", async () => {
    vi.mocked(deps.purgeData).mockRejectedValueOnce(new Error("database"));
    await expect(runAccountDeletion(apple, "fresh-code", deps)).rejects.toThrow(
      "database",
    );
    expect(receipt.phase).toBe("revoked");
    await runAccountDeletion(apple, undefined, deps);
    expect(deps.exchangeAndRevoke).toHaveBeenCalledTimes(1);
    expect(deps.purgeData).toHaveBeenCalledTimes(2);
  });
  it("resumes Auth deletion without re-running provider revocation or data cleanup", async () => {
    vi.mocked(deps.deleteAuth).mockRejectedValueOnce(
      new Error("auth unavailable"),
    );
    await expect(
      runAccountDeletion(apple, "fresh-code", deps),
    ).rejects.toThrow();
    expect(receipt.phase).toBe("data_deleted");
    await runAccountDeletion(apple, undefined, deps);
    expect(deps.purgeData).toHaveBeenCalledTimes(1);
    expect(deps.deleteAuth).toHaveBeenCalledTimes(2);
  });
  it("rejects concurrent deletion claims without side effects", async () => {
    deps.claim = vi.fn(async () => null);
    await expect(
      runAccountDeletion(apple, "fresh-code", deps),
    ).rejects.toMatchObject({ status: 409 });
    expect(deps.exchangeAndRevoke).not.toHaveBeenCalled();
  });
  it("returns an existing completion receipt without repeating deletion", async () => {
    receipt.phase = "completed";
    await runAccountDeletion(apple, undefined, deps);
    expect(deps.deleteAuth).not.toHaveBeenCalled();
  });
  it("allows explicit non-Apple accounts without Apple credentials, but rejects missing identity evidence", async () => {
    deps.appleConfigured = false;
    await runAccountDeletion({ identities: [] }, undefined, deps);
    expect(deps.exchangeAndRevoke).not.toHaveBeenCalled();
    await expect(runAccountDeletion({}, undefined, deps)).rejects.toMatchObject(
      { code: "identity_unavailable" },
    );
  });
  it("authenticates encrypted token recovery to the account and rejects tampering or wrong keys", () => {
    const key = Buffer.alloc(32, 7);
    const cipher = sealRevocationToken(token, "a", key);
    expect(cipher).not.toContain(token.token);
    expect(openRevocationToken(cipher, "a", key)).toEqual(token);
    expect(() => openRevocationToken(cipher, "b", key)).toThrow();
    expect(() =>
      openRevocationToken(cipher, "a", Buffer.alloc(32, 8)),
    ).toThrow();
    expect(() => openRevocationToken(cipher.slice(1), "a", key)).toThrow();
  });
});

it("does not bypass saved Apple revocation after the identity is unlinked", async () => {
  receipt = {
    phase: "revocation_ready",
    apple_token_ciphertext: "encrypted",
    apple_subject: "owner",
  };
  await runAccountDeletion({ identities: [] }, undefined, deps);
  expect(deps.resumeRevocation).toHaveBeenCalledWith("encrypted");
});
it("rejects a different newly linked Apple identity instead of revoking the wrong authorization", async () => {
  receipt = {
    phase: "pending",
    apple_token_ciphertext: null,
    apple_subject: "original-owner",
  };
  await expect(
    runAccountDeletion(apple, "fresh-code", deps),
  ).rejects.toMatchObject({ code: "apple_identity_changed" });
  expect(deps.purgeData).not.toHaveBeenCalled();
  expect(deps.exchangeAndRevoke).not.toHaveBeenCalled();
});
