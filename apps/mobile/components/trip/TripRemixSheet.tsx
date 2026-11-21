import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors } from '../../constants/theme';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import {
  runTripCopilotAction,
  type CopilotActionType,
  type CopilotDiffItem,
} from '../../lib/tripCompanion';
import type { TripDay } from '../../lib/itineraryTypes';
import { hapticFeedback } from '../../utils/haptics';

const SafeModal = Modal ?? ('Modal' as unknown as typeof Modal);
const SafeTextInput = TextInput ?? ('TextInput' as unknown as typeof TextInput);
const SafeActivityIndicator =
  ActivityIndicator ?? ('ActivityIndicator' as unknown as typeof ActivityIndicator);

export interface TripRemixSheetProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  days: TripDay[];
  dayNumber: number;
  initialAction?: CopilotActionType | null;
  onApplyUpdatedDays: (updatedDays: TripDay[]) => void;
  onSyncComplete?: () => void;
}

export function TripRemixSheet({
  visible,
  onClose,
  tripId,
  days,
  dayNumber,
  initialAction = null,
  onApplyUpdatedDays,
  onSyncComplete,
}: TripRemixSheetProps) {
  const reduceMotion = useReduceMotion();
  const [instruction, setInstruction] = useState('');
  const [selectedStop, setSelectedStop] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [resultSummary, setResultSummary] = useState<string | null>(null);
  const [resultNotice, setResultNotice] = useState<string | null>(null);
  const [diffItems, setDiffItems] = useState<CopilotDiffItem[]>([]);
  const [undoSnapshot, setUndoSnapshot] = useState<{
    localDays: TripDay[];
    apiSnapshot?: unknown;
  } | null>(null);

  const mountedRef = useRef(true);
  const busyLockRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const lastInitialActionRef = useRef<CopilotActionType | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      controllerRef.current?.abort();
      busyLockRef.current = false;
      setBusy(false);
      lastInitialActionRef.current = null;
      setSelectedStop(undefined);
      setInstruction('');
      setResultSummary(null);
      setResultNotice(null);
      setDiffItems([]);
      setUndoSnapshot(null);
    }
  }, [visible]);

  useEffect(() => {
    controllerRef.current?.abort();
    busyLockRef.current = false;
    setBusy(false);
    setSelectedStop(undefined);
    setInstruction('');
    setResultSummary(null);
    setResultNotice(null);
    setDiffItems([]);
    setUndoSnapshot(null);
  }, [dayNumber]);

  const executeAction = async (
    action: CopilotActionType,
    opts?: { stopName?: string; text?: string; slot?: 'morning' | 'afternoon' | 'evening' }
  ) => {
    if (busyLockRef.current) return;
    busyLockRef.current = true;
    setBusy(true);
    setResultNotice(null);
    hapticFeedback.light();

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await runTripCopilotAction({
        tripId,
        days,
        action,
        dayNumber,
        slot: opts?.slot,
        stopName: opts?.stopName,
        instruction: opts?.text,
        signal: controller.signal,
      });
      if (!mountedRef.current || controller.signal.aborted) return;

      setResultSummary(response.summary);
      setResultNotice(response.notice ?? null);
      setDiffItems(response.diff);

      if (response.applied && response.updatedDays) {
        setUndoSnapshot({
          localDays: response.previousDays ?? days,
          apiSnapshot: response.apiSnapshot,
        });
        onApplyUpdatedDays(response.updatedDays);
        if (response.source === 'api') {
          onSyncComplete?.();
        }
        hapticFeedback.success();
      }
    } catch (error) {
      if (!mountedRef.current || (error as Error)?.name === 'AbortError') return;
      setResultSummary('Could not update this day right now.');
      setResultNotice(
        error instanceof Error ? error.message : 'Check your connection and try again.'
      );
      hapticFeedback.error();
    } finally {
      if (mountedRef.current && controllerRef.current === controller) {
        setBusy(false);
      }
      busyLockRef.current = false;
    }
  };

  useEffect(() => {
    if (visible && initialAction && lastInitialActionRef.current !== initialAction) {
      lastInitialActionRef.current = initialAction;
      void executeAction(initialAction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialAction]);

  const handleUndo = async () => {
    if (!undoSnapshot || busyLockRef.current) return;
    hapticFeedback.light();
    const snapshot = undoSnapshot;

    // Immediately restore local state so UI feels instant
    onApplyUpdatedDays(snapshot.localDays);
    setUndoSnapshot(null);
    setDiffItems([]);
    setResultSummary(`Reverted your last edit on Day ${dayNumber}.`);
    setResultNotice(null);

    if (!tripId.startsWith('local_') && snapshot.apiSnapshot) {
      busyLockRef.current = true;
      setBusy(true);
      const controller = new AbortController();
      controllerRef.current = controller;
      try {
        await runTripCopilotAction({
          tripId,
          days: snapshot.localDays,
          action: 'undo',
          dayNumber,
          previousApiSnapshot: snapshot.apiSnapshot,
          signal: controller.signal,
        });
        if (mountedRef.current && !controller.signal.aborted) {
          onSyncComplete?.();
        }
      } catch {
        // Local state is already restored; next pull-to-refresh reconciles.
      } finally {
        if (mountedRef.current && controllerRef.current === controller) {
          setBusy(false);
        }
        busyLockRef.current = false;
      }
    }
  };

  if (!visible) return null;

  const activeDay = days.find((d) => d.dayNumber === dayNumber);
  const swappableStops = (activeDay?.activities ?? []).filter(
    (a) => a.type !== 'transport' && a.type !== 'accommodation'
  );

  return (
    <SafeModal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle} accessibilityRole="header">
              Remix Day {dayNumber}
            </Text>
            <Text style={styles.headerSubtitle}>
              Make targeted tweaks without regenerating your whole trip.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close remix sheet"
          >
            <Ionicons name="close" size={24} color="#0f172a" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Quick 1-Tap Actions */}
          <Text style={styles.sectionLabel}>Quick adjustments</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              disabled={busy}
              onPress={() => void executeAction('relax_day')}
              accessibilityRole="button"
              accessibilityLabel={`Make Day ${dayNumber} more relaxed`}
            >
              <Ionicons name="cafe-outline" size={20} color="#0F766E" />
              <View style={styles.quickActionCopy}>
                <Text style={styles.quickActionTitle}>Make this day more relaxed</Text>
                <Text style={styles.quickActionSub}>Trim an optional stop for breathing room</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              disabled={busy}
              onPress={() => void executeAction('rain_backup')}
              accessibilityRole="button"
              accessibilityLabel={`Rainy-day indoor backup for Day ${dayNumber}`}
            >
              <Ionicons name="rainy-outline" size={20} color="#143D46" />
              <View style={styles.quickActionCopy}>
                <Text style={styles.quickActionTitle}>Rainy-day indoor backup</Text>
                <Text style={styles.quickActionSub}>
                  Swap outdoor stops for grounded indoor options
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              disabled={busy}
              onPress={() => void executeAction('shift_day', { slot: 'morning' })}
              accessibilityRole="button"
              accessibilityLabel={`Later start on Day ${dayNumber}`}
            >
              <Ionicons name="sunny-outline" size={20} color="#B45309" />
              <View style={styles.quickActionCopy}>
                <Text style={styles.quickActionTitle}>Slower morning</Text>
                <Text style={styles.quickActionSub}>Move a morning visit into the afternoon</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Swap a specific stop */}
          {swappableStops.length > 0 ? (
            <View style={styles.swapSection}>
              <Text style={styles.sectionLabel}>Swap a stop</Text>
              <View style={styles.stopChips}>
                {swappableStops.map((stop) => {
                  const chosen = selectedStop === stop.title;
                  return (
                    <TouchableOpacity
                      key={stop.id}
                      style={[styles.stopChip, chosen && styles.stopChipSelected]}
                      onPress={() => {
                        hapticFeedback.selection();
                        setSelectedStop(chosen ? undefined : stop.title);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: chosen }}
                      accessibilityLabel={`Select ${stop.title} to swap`}
                    >
                      <Text
                        style={[styles.stopChipText, chosen && styles.stopChipTextSelected]}
                        numberOfLines={1}
                      >
                        {stop.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={[styles.swapButton, busy && styles.buttonDisabled]}
                disabled={busy}
                onPress={() =>
                  void executeAction('swap_stop', {
                    stopName: selectedStop ?? swappableStops[0]?.title,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={
                  selectedStop ? `Swap ${selectedStop}` : 'Swap a stop for a grounded alternative'
                }
              >
                <Ionicons name="swap-horizontal" size={18} color="#ffffff" />
                <Text style={styles.swapButtonText}>
                  {selectedStop ? `Swap "${selectedStop}"` : 'Swap selected stop'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Natural-Language Remix Input */}
          <View style={styles.nlSection}>
            <Text style={styles.sectionLabel}>Or tell Faroway what to change</Text>
            <SafeTextInput
              style={styles.nlInput}
              value={instruction}
              onChangeText={setInstruction}
              placeholder={`e.g., Make Day ${dayNumber} less packed or swap the afternoon museum`}
              placeholderTextColor="#64748b"
              multiline
              maxLength={300}
              textAlignVertical="top"
              accessibilityLabel="Describe how to remix this day"
            />
            <TouchableOpacity
              style={[styles.nlSubmitBtn, (!instruction.trim() || busy) && styles.buttonDisabled]}
              disabled={!instruction.trim() || busy}
              onPress={() => {
                const text = instruction.trim();
                if (!text) return;
                void executeAction('natural_language', { text });
              }}
              accessibilityRole="button"
              accessibilityLabel="Apply remix instruction"
            >
              {busy ? (
                <SafeActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="sparkles" size={16} color="#ffffff" />
              )}
              <Text style={styles.nlSubmitText}>{busy ? 'Updating Day…' : 'Apply change'}</Text>
            </TouchableOpacity>
          </View>

          {/* Before / After Diff Card + Undo */}
          {resultSummary ? (
            <View style={styles.resultCard} accessibilityLiveRegion="polite">
              <Text style={styles.resultSummary}>{resultSummary}</Text>
              {diffItems.map((item, idx) => (
                <View key={`${item.dayNumber}-${item.slot}-${idx}`} style={styles.diffRow}>
                  <Text style={styles.diffBadge}>{item.action.toUpperCase()}</Text>
                  <Text style={styles.diffText}>
                    {item.before && item.after && item.before !== item.after
                      ? `${item.before} → ${item.after}`
                      : item.before || item.after || item.slot}
                  </Text>
                </View>
              ))}
              {resultNotice ? <Text style={styles.resultNotice}>{resultNotice}</Text> : null}
              {undoSnapshot ? (
                <TouchableOpacity
                  style={styles.undoBtn}
                  onPress={() => void handleUndo()}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Undo last remix change"
                >
                  <Ionicons name="arrow-undo-outline" size={16} color="#0f172a" />
                  <Text style={styles.undoBtnText}>Undo change</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </SafeModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    gap: 18,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  quickGrid: {
    gap: 10,
  },
  quickActionCard: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  quickActionCopy: {
    flex: 1,
    gap: 2,
  },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  quickActionSub: {
    fontSize: 13,
    color: '#475569',
  },
  swapSection: {
    gap: 10,
  },
  stopChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stopChip: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  stopChipSelected: {
    borderColor: colors.action.primary,
    backgroundColor: '#FFF5F4',
  },
  stopChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  stopChipTextSelected: {
    color: '#9B2D25',
  },
  swapButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#143D46',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  swapButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  nlSection: {
    gap: 10,
  },
  nlInput: {
    minHeight: 76,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    padding: 12,
    fontSize: 15,
    lineHeight: 21,
    color: '#0f172a',
  },
  nlSubmitBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.action.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  nlSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  resultCard: {
    borderRadius: borderRadius.md,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    padding: 14,
    gap: 10,
  },
  resultSummary: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#134E4A',
  },
  diffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diffBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F766E',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  diffText: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  resultNotice: {
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
  },
  undoBtn: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  undoBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
});
