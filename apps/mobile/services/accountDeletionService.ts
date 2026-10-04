import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../lib/supabase';
import { API_BASE_URL } from '../constants/api';

const key = 'faroway-account-deletion-recovery-v1';
type Receipt = { userId: string; recoveryToken: string };

async function request(method: 'DELETE' | 'POST' | 'PATCH', body: object, bearer?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/account`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

/** Only called after the user's destructive confirmation. Codes stay in memory.
 * The recovery proof authorizes status lookup only; every DELETE requires fresh auth.
 */
export async function deleteAccountWithRecovery(userId: string) {
  try {
    const saved = await SecureStore.getItemAsync(key);
    let receipt: Receipt | null = saved ? JSON.parse(saved) : null;
    if (receipt && receipt.userId !== userId)
      throw new Error(
        'Another account has a saved deletion request. Sign in to that account to finish it.'
      );
    if (!receipt) {
      const bytes = await Crypto.getRandomBytesAsync(32);
      receipt = {
        userId,
        recoveryToken: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''),
      };
      await SecureStore.setItemAsync(key, JSON.stringify(receipt));
    }
    const recovery = await request('POST', { recoveryToken: receipt.recoveryToken });
    if (recovery.ok && recovery.data.deleted === true) {
      return { data: { deleted: true } };
    }
    if (!recovery.ok)
      throw new Error(recovery.data.error || 'Deletion recovery is unavailable. Please retry.');
    const dispatch = async (appleAuthorizationCode?: string) => {
      const { data, error } = await supabase.auth.getSession();
      if (error || data.session?.user.id !== userId)
        throw new Error('Sign in to the same account to resume deletion.');
      return request(
        'DELETE',
        {
          recoveryToken: receipt!.recoveryToken,
          confirm: true,
          ...(appleAuthorizationCode ? { appleAuthorizationCode } : {}),
        },
        data.session.access_token
      );
    };
    let result = await dispatch();
    if (result.status === 428) {
      let credential;
      try {
        credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
      } catch (error) {
        if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
          const current = await supabase.auth.getSession();
          if (current.data.session?.user.id === userId) {
            const cancelled = await request(
              'PATCH',
              { recoveryToken: receipt.recoveryToken, cancel: true },
              current.data.session.access_token
            );
            if (cancelled.ok && cancelled.data.cancelled === true) {
              await SecureStore.deleteItemAsync(key);
              throw new Error('Deletion cancelled. Your account is still available.');
            }
          }
          throw new Error(
            'Apple confirmation was cancelled. Deletion is still pending; retry from Settings.'
          );
        }
        throw error;
      }
      if (!credential.authorizationCode)
        throw new Error('Apple confirmation was not completed. Your account has not been deleted.');
      result = await dispatch(credential.authorizationCode);
    }
    if (!result.ok || result.data.deleted !== true)
      throw new Error(result.data.error || 'Deletion is not complete. Please retry.');
    return { data: { deleted: true } };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Deletion is not complete. Your request is saved; please retry.',
    };
  }
}

/** Status-only restoration: never starts or resumes deletion without a new user action. */
export async function reconcileCompletedAccountDeletion(
  onDeleted: (userId: string) => Promise<void>
) {
  try {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return;
    const receipt = JSON.parse(raw) as Receipt;
    if (typeof receipt.userId !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.recoveryToken)) return;
    const result = await request('POST', { recoveryToken: receipt.recoveryToken });
    if (!result.ok || result.data.deleted !== true) return;
    await onDeleted(receipt.userId);
    if ((await SecureStore.getItemAsync(key)) === raw) await SecureStore.deleteItemAsync(key);
  } catch {
    /* Preserve proof and retry status on the next foreground event. */
  }
}

/** Clear proof only after all durable local cleanup succeeds. Status reconciliation
 * uses the same callback after a crash; cleanup must be idempotent. */
export async function finishAccountDeletionCleanup(
  userId: string,
  cleanup: (userId: string) => Promise<void>
) {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw || (JSON.parse(raw) as Receipt).userId !== userId)
    throw new Error('Deletion recovery proof is unavailable.');
  await cleanup(userId);
  if ((await SecureStore.getItemAsync(key)) === raw) await SecureStore.deleteItemAsync(key);
}
