import React, { useEffect, useState } from 'react';
import { Alert, Linking, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { syncService, offlineStorage, type PendingMutation } from '../../lib/offline';
import { API_BASE_URL, getAuthHeaders } from '../../lib/supabase';
import {
  conflictRows,
  supportsConflictReapply,
  tripWebUrl,
} from '../../lib/offline/conflict-review';

export function TripSyncConflicts() {
  const [mutations, setMutations] = useState<PendingMutation[]>([]);
  const [selected, setSelected] = useState<PendingMutation | null>(null);
  const [latest, setLatest] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = async () =>
    setMutations((await offlineStorage.getPendingMutations()).filter((m) => m.blockedReason));
  useEffect(
    () =>
      syncService.subscribe(() => {
        void refresh();
      }),
    []
  );
  const loadLatest = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setLatest(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/trips/${selected.tripId}`, {
        headers: await getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || 'The latest trip could not be loaded. Your changes are still kept.'
        );
      setLatest(data.trip);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Connect to the internet and try again.');
    } finally {
      setBusy(false);
    }
  };
  const resolve = async (reapply: boolean) => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await syncService.resolveBlockedMutation(
        selected,
        reapply ? String(latest!.updated_at) : undefined
      );
      setSelected(null);
      setLatest(null);
      await refresh();
      await syncService.sync(true);
    } catch (reason) {
      setLatest(null);
      setError(
        reason instanceof Error
          ? reason.message
          : 'Your changes are still kept. Load the latest trip and try again.'
      );
    } finally {
      setBusy(false);
    }
  };
  const action = (label: string, onPress: () => void, disabled = false) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy || disabled}
      onPress={onPress}
      style={{ minHeight: 48, justifyContent: 'center', opacity: busy || disabled ? 0.4 : 1 }}
    >
      <Text style={{ color: '#9f342e', fontWeight: '600', fontSize: 16 }}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <>
      {mutations.length > 0 && (
        <View style={{ padding: 16, backgroundColor: '#fff5ee' }}>
          <Text>
            Your unsynced trip changes need review. Nothing will be overwritten automatically.
          </Text>
          {action(
            `Review ${mutations.length} unsynced ${mutations.length === 1 ? 'change' : 'changes'}`,
            () => {
              setSelected(mutations[0]);
              setLatest(null);
              setError(null);
            }
          )}
        </View>
      )}
      <Modal
        visible={selected !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setSelected(null);
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
                Alert.alert(
                  'Save your reviewed changes?',
                  'This updates the brief, turns off its public link, and keeps the previous plan for reference. It does not start planning or make a purchase.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Save changes',
                      onPress: () => {
                        void resolve(true);
                      },
                    },
                  ]
                );
              },
              !latest?.updated_at || latest?.status === 'generating'
            )}
          {action('Keep latest and discard these local edits', () => {
            Alert.alert(
              'Discard these local edits?',
              'Only the edits shown here will be removed. Your saved trip stays unchanged.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Discard local edits',
                  style: 'destructive',
                  onPress: () => {
                    void resolve(false);
                  },
                },
              ]
            );
          })}
          {selected &&
            action('Open trip on Faroway website', () => {
              void Linking.openURL(tripWebUrl(selected.tripId)).catch(() =>
                setError('Could not open the browser. Your changes are still kept.')
              );
            })}
          {action('Keep my edits for later', () => setSelected(null))}
        </ScrollView>
      </Modal>
    </>
  );
}
