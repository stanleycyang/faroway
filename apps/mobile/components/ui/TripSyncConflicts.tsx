import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { syncService, offlineStorage, type PendingMutation } from '../../lib/offline';
import { API_BASE_URL } from '../../lib/supabase';
import { captureTripAccount } from '../../lib/tripAccountScope';
import { useUserStore } from '../../stores/userStore';
import { requestWithTimeout } from '../../services/request';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import {
  conflictRows,
  supportsConflictReapply,
  tripWebUrl,
} from '../../lib/offline/conflict-review';

export function TripSyncConflicts() {
  const ownerId = useUserStore((state) => state.user?.id);
  const revision = useUserStore((state) => state.accountRevision);
  return ownerId ? <ConflictSession key={`${ownerId}:${revision}`} /> : null;
}

function ConflictSession() {
  const reduceMotion = useReduceMotion();
  const [account] = useState(captureTripAccount);
  const mounted = useRef(false);
  const busyRef = useRef(false);
  const reviewEpoch = useRef(0);
  const refreshSequence = useRef(0);
  const comparisonAbort = useRef<AbortController | null>(null);
  const [mutations, setMutations] = useState<PendingMutation[]>([]);
  const [selected, setSelected] = useState<PendingMutation | null>(null);
  const [latest, setLatest] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = useCallback(() => mounted.current && account.isCurrent(), [account]);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      account.assertCurrent();
      const pending = await offlineStorage.getPendingMutations();
      if (!current() || sequence !== refreshSequence.current) return;
      setMutations(pending.filter((m) => m.ownerId === account.ownerId && m.blockedReason));
    } catch {
      if (current() && sequence === refreshSequence.current)
        setError('Your saved edits couldn’t load. Try reopening your trips.');
    }
  }, [account, current]);
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = syncService.subscribe(() => {
      void refresh();
    });
    void refresh();
    return () => {
      mounted.current = false;
      comparisonAbort.current?.abort();
      unsubscribe();
    };
  }, [refresh]);

  const begin = () => {
    if (!selected || !current() || busyRef.current || selected.ownerId !== account.ownerId)
      return false;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    return true;
  };
  const finish = () => {
    busyRef.current = false;
    if (current()) setBusy(false);
  };
  const loadLatest = async () => {
    if (!selected || !begin()) return;
    setLatest(null);
    const controller = new AbortController();
    comparisonAbort.current = controller;
    try {
      const headers = await account.headers();
      if (!current()) return;
      const trip = await requestWithTimeout(
        `${API_BASE_URL}/api/trips/${encodeURIComponent(selected.tripId)}`,
        { headers, signal: controller.signal },
        async (response) => {
          account.assertCurrent();
          const data = await response.json();
          account.assertCurrent();
          if (!response.ok)
            throw new Error(
              typeof data?.error === 'string'
                ? data.error
                : 'The latest trip could not be loaded. Your edits are kept.'
            );
          if (
            !data?.trip ||
            data.trip.id !== selected.tripId ||
            data.trip.user_id !== account.ownerId ||
            typeof data.trip.updated_at !== 'string' ||
            !data.trip.updated_at.trim()
          ) {
            throw new Error('The latest trip could not be verified. Your edits are kept.');
          }
          return data.trip as Record<string, unknown>;
        }
      );
      if (current()) setLatest(trip);
    } catch (reason) {
      if (current())
        setError(
          reason instanceof Error ? reason.message : 'Connect to the internet and try again.'
        );
    } finally {
      if (comparisonAbort.current === controller) comparisonAbort.current = null;
      finish();
    }
  };
  const resolve = async (reapply: boolean, confirmedEpoch: number) => {
    if (confirmedEpoch !== reviewEpoch.current) return;
    if (
      !selected ||
      (reapply && (!latest?.updated_at || latest.status === 'generating')) ||
      !begin()
    )
      return;
    let resolved = false;
    try {
      account.assertCurrent();
      await syncService.resolveBlockedMutation(
        selected,
        reapply ? String(latest!.updated_at) : undefined
      );
      resolved = true;
      if (!current()) return;
      reviewEpoch.current++;
      setSelected(null);
      setLatest(null);
      await refresh();
      if (!current()) return;
      const result = await syncService.sync(true);
      if (!result.success) throw new Error('Remaining edits need another sync attempt');
    } catch (reason) {
      if (!current()) return;
      setLatest(null);
      setError(
        resolved
          ? 'Your review was saved. Remaining edits couldn’t sync; retry from your trips.'
          : reason instanceof Error
            ? reason.message
            : 'Your edits are kept. Load the latest trip and try again.'
      );
    } finally {
      finish();
    }
  };
  const action = (label: string, onPress: () => void, disabled = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy || disabled}
      onPress={() => {
        if (current() && !busyRef.current && !disabled) onPress();
      }}
      style={{ minHeight: 48, justifyContent: 'center', opacity: busy || disabled ? 0.4 : 1 }}
    >
      <Text style={{ color: '#9f342e', fontWeight: '600', fontSize: 16 }}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <>
      {error && !selected && (
        <Text accessibilityRole="alert" style={{ padding: 16, color: '#a52820' }}>
          {error}
        </Text>
      )}
      {mutations.length > 0 && (
        <View style={{ padding: 16, backgroundColor: '#fff5ee' }}>
          <Text>
            Your unsynced trip changes need review. Nothing will be overwritten automatically.
          </Text>
          {action(
            `Review ${mutations.length} unsynced ${mutations.length === 1 ? 'change' : 'changes'}`,
            () => {
              reviewEpoch.current++;
              setSelected(mutations[0]);
              setLatest(null);
              setError(null);
            }
          )}
        </View>
      )}
      <Modal
        visible={selected !== null}
        animationType={reduceMotion ? 'none' : 'slide'}
        onRequestClose={() => {
          if (!busyRef.current) {
            reviewEpoch.current++;
            setSelected(null);
          }
        }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 48, gap: 16 }}
        >
          <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: '700' }}>
            Review your trip changes
          </Text>
          <Text>{selected?.blockedReason}</Text>
          <Text>
            Your saved trip and these local edits are kept separately. Compare them before choosing
            what to save.
          </Text>
          {selected &&
            conflictRows(selected, latest ?? undefined).map((row) => (
              <View
                key={row.label}
                style={{ padding: 16, backgroundColor: '#f5f5f5', borderRadius: 12, gap: 6 }}
              >
                <Text style={{ fontWeight: '700' }}>{row.label}</Text>
                <Text>Your edit: {row.yours}</Text>
                <Text>Latest saved: {row.latest}</Text>
              </View>
            ))}
          {error && (
            <Text accessibilityRole="alert" style={{ color: '#a52820' }}>
              {error}
            </Text>
          )}
          {action('Load latest trip to compare', () => {
            void loadLatest();
          })}
          {latest?.status === 'generating' && (
            <Text>
              Planning is still running. Wait for it to finish, then load the latest trip again.
            </Text>
          )}
          {selected &&
            supportsConflictReapply(selected) &&
            action(
              'Save my edits onto this version',
              () => {
                const confirmedEpoch = reviewEpoch.current;
                Alert.alert(
                  'Save your reviewed changes?',
                  'This updates the brief, turns off its public link, and keeps the previous plan for reference. It does not start planning or make a purchase.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Save changes',
                      onPress: () => {
                        void resolve(true, confirmedEpoch);
                      },
                    },
                  ]
                );
              },
              !latest?.updated_at || latest?.status === 'generating'
            )}
          {action('Keep latest and discard these local edits', () => {
            const confirmedEpoch = reviewEpoch.current;
            Alert.alert(
              'Discard these local edits?',
              'Only the edits shown here will be removed. Your saved trip stays unchanged.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Discard local edits',
                  style: 'destructive',
                  onPress: () => {
                    void resolve(false, confirmedEpoch);
                  },
                },
              ]
            );
          })}
          {selected &&
            action('Open trip on Faroway website', () => {
              const url = tripWebUrl(selected.tripId);
              if (!url) {
                setError('Could not open a safe link to this trip. Your changes are still kept.');
                return;
              }
              void Linking.openURL(url).catch(() => {
                if (current()) setError('Could not open the browser. Your changes are still kept.');
              });
            })}
          {action('Keep my edits for later', () => {
            reviewEpoch.current++;
            setSelected(null);
          })}
        </ScrollView>
      </Modal>
    </>
  );
}
