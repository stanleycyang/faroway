import "server-only";
import type {
  AuthenticatedUser,
  AppleRevocationToken,
} from "./apple-revocation";

export type DeletionPhase =
  | "pending"
  | "revocation_ready"
  | "revoked"
  | "data_deleted"
  | "completed";
export interface DeletionReceipt {
  phase: DeletionPhase;
  apple_subject?: string | null;
  apple_token_ciphertext: string | null;
}
export class DeletionError extends Error {
  constructor(
    public code: string,
    public status = 503,
  ) {
    super(code);
  }
}
export interface DeletionDependencies {
  appleConfigured: boolean;
  claim: () => Promise<DeletionReceipt | null>;
  save: (phase: DeletionPhase, ciphertext: string | null) => Promise<void>;
  release: () => Promise<void>;
  seal: (token: AppleRevocationToken) => string;
  exchangeAndRevoke: (
    code: string,
    persist: (token: AppleRevocationToken) => Promise<void>,
    subject?: string,
  ) => Promise<unknown>;
  resumeRevocation: (ciphertext: string) => Promise<void>;
  purgeData: () => Promise<void>;
  deleteAuth: () => Promise<void>;
}

/** Each irreversible boundary is preceded by a durable, owner-bound receipt.
 * A consumed exchange code without a saved token needs fresh reauthentication.
 * Once saved, provider revocation retries use encrypted token material, not codes.
 */
export async function runAccountDeletion(
  user: AuthenticatedUser,
  code: string | undefined,
  deps: DeletionDependencies,
) {
  if (!Array.isArray(user.identities))
    throw new DeletionError("identity_unavailable");
  const apple = user.identities.some((i) => i.provider === "apple");
  if (apple && !deps.appleConfigured)
    throw new DeletionError("apple_revocation_not_configured");
  const receipt = await deps.claim();
  if (!receipt) throw new DeletionError("deletion_in_progress", 409);
  let phase = receipt.phase;
  try {
    const originalSubject = receipt.apple_subject;
    const currentApple = user.identities.filter((i) => i.provider === "apple");
    if (
      originalSubject &&
      currentApple.some((i) => i.identity_data?.sub !== originalSubject)
    )
      throw new DeletionError("apple_identity_changed");
    const needsApple = apple || !!originalSubject;
    if (needsApple && !deps.appleConfigured)
      throw new DeletionError("apple_revocation_not_configured");
    if (phase === "completed") return { deleted: true };
    if (phase === "pending" || phase === "revocation_ready") {
      if (needsApple) {
        if (phase === "revocation_ready") {
          if (!receipt.apple_token_ciphertext)
            throw new DeletionError("recovery_material_unavailable");
          await deps.resumeRevocation(receipt.apple_token_ciphertext);
        } else {
          if (!code)
            throw new DeletionError("apple_reauthentication_required", 428);
          await deps.exchangeAndRevoke(
            code,
            async (token) => {
              await deps.save("revocation_ready", deps.seal(token));
            },
            originalSubject || undefined,
          );
        }
      }
      await deps.save("revoked", null);
      phase = "revoked";
    }
    if (phase === "revoked") {
      await deps.purgeData();
      await deps.save("data_deleted", null);
    }
    await deps.deleteAuth();
    await deps.save("completed", null);
    return { deleted: true };
  } finally {
    await deps.release().catch(() => {});
  }
}
