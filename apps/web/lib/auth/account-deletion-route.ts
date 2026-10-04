import "server-only";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClientFromRequest, getSupabase } from "@/lib/supabase/server";
import { purgeAccountData } from "./account-data";
import {
  DeletionError,
  runAccountDeletion,
  type DeletionReceipt,
  type DeletionPhase,
} from "./account-deletion";
import {
  AppleRevocationError,
  revokeAppleAuthorizationForUser,
  revokeVerifiedAppleToken,
} from "./apple-revocation";
import {
  appleDeletionConfiguration,
  recoveryHash,
  sealRevocationToken,
  openRevocationToken,
} from "./deletion-recovery";

const schema = z.object({
  recoveryToken: z.string().regex(/^[a-f0-9]{64}$/),
  confirm: z.literal(true),
  appleAuthorizationCode: z.string().min(8).max(4096).optional(),
});
const reply = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
const enabled = () => process.env.ACCOUNT_DELETION_ENABLED === "true";

export async function DELETE(request: NextRequest) {
  if (!enabled())
    return reply(
      {
        error:
          "Account deletion is temporarily unavailable. Please try again later.",
        code: "deletion_not_configured",
      },
      503,
    );
  try {
    const input = schema.safeParse(await request.json().catch(() => null));
    if (!input.success)
      return reply(
        {
          error: "Confirm deletion using the updated app.",
          code: "deletion_confirmation_required",
        },
        400,
      );
    const auth = await createClientFromRequest(request);
    const {
      data: { user },
      error,
    } = await auth.auth.getUser();
    if (error || !user)
      return reply(
        { error: "Sign in to resume deletion.", code: "unauthorized" },
        401,
      );
    const db = getSupabase();
    const config = appleDeletionConfiguration();
    const lease = randomUUID();
    const hash = recoveryHash(input.data.recoveryToken);
    const result = await runAccountDeletion(
      user,
      input.data.appleAuthorizationCode,
      {
        appleConfigured: !!config,
        claim: async () => {
          const { data, error } = await db.rpc("claim_account_deletion", {
            p_user_id: user.id,
            p_recovery_hash: hash,
            p_lease_id: lease,
            p_apple_subject:
              user.identities?.find((i) => i.provider === "apple")
                ?.identity_data?.sub || null,
          });
          if (error) throw new DeletionError("deletion_schema_unavailable");
          return (data?.[0] as DeletionReceipt) || null;
        },
        save: async (phase: DeletionPhase, ciphertext) => {
          const { data, error } = await db
            .from("account_deletion_receipts")
            .update({
              phase,
              apple_token_ciphertext: ciphertext,
              ...(phase === "completed" ? { apple_subject: null } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id)
            .eq("lease_id", lease)
            .select("user_id");
          if (error || data?.length !== 1)
            throw new DeletionError("deletion_receipt_unavailable");
        },
        release: async () => {
          await db
            .from("account_deletion_receipts")
            .update({ lease_id: null, lease_until: null })
            .eq("user_id", user.id)
            .eq("lease_id", lease);
        },
        seal: (token) => sealRevocationToken(token, user.id, config!.key),
        exchangeAndRevoke: (code, persist, subject) =>
          revokeAppleAuthorizationForUser(
            subject
              ? {
                  identities: [
                    { provider: "apple", identity_data: { sub: subject } },
                  ],
                }
              : user,
            code,
            config!,
            persist,
          ),
        resumeRevocation: (ciphertext) =>
          revokeVerifiedAppleToken(
            openRevocationToken(ciphertext, user.id, config!.key),
            config!,
          ),
        purgeData: () => purgeAccountData(db, user.id),
        deleteAuth: async () => {
          const { error } = await db.auth.admin.deleteUser(user.id);
          if (error && error.code !== "user_not_found")
            throw new DeletionError("auth_deletion_pending");
        },
      },
    );
    return reply(result);
  } catch (error) {
    const code =
      error instanceof DeletionError || error instanceof AppleRevocationError
        ? error.code
        : "deletion_retry_required";
    const status =
      error instanceof DeletionError
        ? error.status
        : code === "exchange_failed"
          ? 428
          : 503;
    return reply(
      {
        error:
          status === 428
            ? "Confirm your Apple account again to continue deletion."
            : "Deletion is not complete. Your request is saved; please retry.",
        code,
      },
      status,
    );
  }
}

/** Opaque recovery proof can only confirm completion, never authorize deletion.
 * Handles a lost response after Auth deletion invalidated the original session.
 */
export async function POST(request: NextRequest) {
  if (!enabled())
    return reply({ error: "Deletion recovery is unavailable." }, 503);
  const input = z
    .object({ recoveryToken: z.string().regex(/^[a-f0-9]{64}$/) })
    .safeParse(await request.json().catch(() => null));
  if (!input.success) return reply({ error: "Invalid recovery request" }, 400);
  try {
    const db = getSupabase();
    const { data, error } = await db
      .from("account_deletion_receipts")
      .select("user_id,phase")
      .eq("recovery_hash", recoveryHash(input.data.recoveryToken))
      .maybeSingle();
    if (error)
      return reply({ error: "Deletion recovery is unavailable." }, 503);
    if (!data) return reply({ deleted: false });
    if (data.phase === "completed") return reply({ deleted: true });
    if (data.phase === "data_deleted") {
      const result = await db.auth.admin.getUserById(data.user_id);
      if (result.error?.code === "user_not_found") {
        await db
          .from("account_deletion_receipts")
          .update({
            phase: "completed",
            apple_subject: null,
            apple_token_ciphertext: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", data.user_id)
          .eq("phase", "data_deleted");
        return reply({ deleted: true });
      }
    }
    return reply({ deleted: false });
  } catch {
    return reply({ error: "Deletion recovery is unavailable." }, 503);
  }
}

// Cancellation is allowed only before any durable revocation material exists,
// under fresh owner authentication, with no request currently holding the lease.
export async function PATCH(request: NextRequest) {
  if (!enabled())
    return reply({ error: "Deletion recovery is unavailable." }, 503);
  const input = z
    .object({
      recoveryToken: z.string().regex(/^[a-f0-9]{64}$/),
      cancel: z.literal(true),
    })
    .safeParse(await request.json().catch(() => null));
  if (!input.success)
    return reply({ error: "Invalid cancellation request" }, 400);
  try {
    const auth = await createClientFromRequest(request);
    const {
      data: { user },
      error,
    } = await auth.auth.getUser();
    if (error || !user)
      return reply({ error: "Sign in to cancel this request." }, 401);
    const result = await getSupabase()
      .from("account_deletion_receipts")
      .delete()
      .eq("user_id", user.id)
      .eq("recovery_hash", recoveryHash(input.data.recoveryToken))
      .eq("phase", "pending")
      .is("lease_id", null)
      .select("user_id");
    if (result.error || result.data?.length !== 1)
      return reply(
        {
          error:
            "The request cannot be cancelled at this stage. Resume deletion.",
        },
        409,
      );
    return reply({ cancelled: true });
  } catch {
    return reply(
      { error: "Cancellation could not be confirmed. Please retry." },
      503,
    );
  }
}
