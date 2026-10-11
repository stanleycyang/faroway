import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { API_BASE_URL } from '../constants/api';
import { requestWithTimeout } from '../services/request';

export interface PlanningDispatch {
  userId: string;
  signal: AbortSignal;
  headers: () => Promise<Record<string, string>>;
}

/** One operation, one affirmative choice. No persisted or account-wide consent. */
export async function withPlanningConsent<T>(
  dispatch: (authorization: PlanningDispatch) => Promise<T>,
  parentSignal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  parentSignal?.addEventListener('abort', cancel);
  if (parentSignal?.aborted) cancel();
  let unsubscribe = () => {};
  const assertActive = () => {
    if (controller.signal.aborted) throw new Error('Planning cancelled. Please start again.');
  };
  try {
    assertActive();
    const initial = await supabase.auth.getSession();
    const userId = initial.data.session?.user.id;
    if (initial.error || !userId) throw new Error('Sign in before sharing trip details with AI.');
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || session?.user.id !== userId) cancel();
    });
    unsubscribe = () => data.subscription.unsubscribe();

    const currentHeaders = async (): Promise<Record<string, string>> => {
      assertActive();
      const network = await NetInfo.fetch();
      if (network.isConnected === false || network.isInternetReachable === false) {
        throw new Error(
          'You’re offline. Reconnect and choose to plan again; no request is queued.'
        );
      }
      const current = await supabase.auth.getSession();
      assertActive();
      if (current.error || current.data.session?.user.id !== userId) {
        throw new Error('Your account changed. Please start planning again.');
      }
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${current.data.session.access_token}`,
      };
    };
    const headers = await currentHeaders();
    const disclosure = await requestWithTimeout(
      `${API_BASE_URL}/api/ai/disclosure`,
      { headers, signal: controller.signal, cache: 'no-store' },
      async (response) => {
        if (!response.ok)
          throw new Error('AI sharing information is unavailable. Please try again.');
        return response.json();
      },
      15_000
    );
    if (
      !disclosure ||
      typeof disclosure.version !== 'string' ||
      !/^[a-zA-Z0-9-]{1,100}$/.test(disclosure.version) ||
      typeof disclosure.title !== 'string' ||
      !disclosure.title ||
      disclosure.title.length > 150 ||
      typeof disclosure.message !== 'string' ||
      !disclosure.message ||
      disclosure.message.length > 4000
    ) {
      throw new Error('AI sharing information could not be verified. Please try again.');
    }
    assertActive();
    const accepted = await new Promise<boolean>((resolve) => {
      const finish = (value: boolean) => {
        controller.signal.removeEventListener('abort', aborted);
        resolve(value);
      };
      const aborted = () => finish(false);
      controller.signal.addEventListener('abort', aborted, { once: true });
      if (controller.signal.aborted) {
        finish(false);
        return;
      }
      Alert.alert(
        disclosure.title,
        disclosure.message,
        [
          { text: 'Not now', style: 'cancel', onPress: () => finish(false) },
          { text: 'Share and plan', onPress: () => finish(!controller.signal.aborted) },
        ],
        { cancelable: true, onDismiss: () => finish(false) }
      );
    });
    assertActive();
    if (!accepted) throw new Error('AI sharing declined. Your saved trips are still available.');
    return await dispatch({
      userId,
      signal: controller.signal,
      headers: async () => ({
        ...(await currentHeaders()),
        'X-Faroway-AI-Disclosure': disclosure.version,
      }),
    });
  } finally {
    unsubscribe();
    parentSignal?.removeEventListener('abort', cancel);
  }
}
