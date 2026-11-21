import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, borderRadius } from '../../constants/theme';
import {
  parseDreamTripPrompt,
  suggestDestinations,
  type DestinationSuggestion,
  type ParsedTripPrompt,
} from '../../lib/promptParser';
import {
  hasTravelerMemoryContent,
  summarizeTravelerMemory,
  type TravelerMemoryDefaults,
} from '../../lib/travelerMemory';
import { hapticFeedback } from '../../utils/haptics';

const SafeTextInput = TextInput ?? ('TextInput' as unknown as typeof TextInput);
const SafeActivityIndicator =
  ActivityIndicator ?? ('ActivityIndicator' as unknown as typeof ActivityIndicator);

const EXAMPLE_PROMPTS = [
  '5 days in Kyoto in October, couple, foodie & temples',
  'Long weekend in Lisbon, budget-friendly, vegan',
  'Relaxed family of 4 in Bali for 6 days, no early starts',
];

export interface DreamTripPromptBarProps {
  onApplyParsed: (parsed: ParsedTripPrompt) => void;
  onUndoParsed?: () => void;
  canUndo?: boolean;
  onSelectSuggestion: (suggestion: DestinationSuggestion) => void;
  memory: TravelerMemoryDefaults | null;
  memoryApplied?: boolean;
  onSaveCurrentAsMemory?: () => void;
  onClearMemory?: () => void;
  onEditMemory?: () => void;
}

export function DreamTripPromptBar({
  onApplyParsed,
  onUndoParsed,
  canUndo = false,
  onSelectSuggestion,
  memory,
  memoryApplied = false,
  onSaveCurrentAsMemory,
  onClearMemory,
  onEditMemory,
}: DreamTripPromptBarProps) {
  const [prompt, setPrompt] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [lastSummary, setLastSummary] = useState<string[]>([]);
  const [parseMessage, setParseMessage] = useState<string | null>(null);

  const [showDecide, setShowDecide] = useState(false);
  const [decideQuery, setDecideQuery] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);

  const mountedRef = useRef(true);
  const parseControllerRef = useRef<AbortController | null>(null);
  const suggestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      parseControllerRef.current?.abort();
      suggestControllerRef.current?.abort();
    };
  }, []);

  const runParse = async (textToParse: string) => {
    const trimmed = textToParse.trim();
    if (!trimmed || isParsing) return;

    hapticFeedback.selection();
    parseControllerRef.current?.abort();
    const controller = new AbortController();
    parseControllerRef.current = controller;
    setIsParsing(true);
    setParseMessage(null);

    try {
      const parsed = await parseDreamTripPrompt(trimmed, { signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted) return;

      if (parsed.summary.length === 0) {
        setLastSummary([]);
        setParseMessage(
          'Add a destination, month, trip length, or travel style so we can prefill your brief.'
        );
      } else {
        setLastSummary(parsed.summary);
        setParseMessage(null);
        onApplyParsed(parsed);
        hapticFeedback.success();
      }
    } finally {
      if (mountedRef.current && parseControllerRef.current === controller) {
        setIsParsing(false);
      }
    }
  };

  const runSuggest = async (queryText: string) => {
    if (isSuggesting) return;
    hapticFeedback.light();
    suggestControllerRef.current?.abort();
    const controller = new AbortController();
    suggestControllerRef.current = controller;
    setIsSuggesting(true);

    try {
      const results = await suggestDestinations(
        { query: queryText.trim() },
        { signal: controller.signal }
      );
      if (!mountedRef.current || controller.signal.aborted) return;
      setSuggestions(results);
    } finally {
      if (mountedRef.current && suggestControllerRef.current === controller) {
        setIsSuggesting(false);
      }
    }
  };

  const handleToggleDecide = () => {
    hapticFeedback.light();
    const next = !showDecide;
    setShowDecide(next);
    if (next && suggestions.length === 0) {
      void runSuggest(decideQuery || prompt);
    }
  };

  const memoryItems = summarizeTravelerMemory(memory);
  const hasMemory = hasTravelerMemoryContent(memory);

  return (
    <View style={styles.wrapper}>
      {/* Magic NL Dream Trip Prompt Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <Ionicons name="sparkles" size={18} color={colors.action.primary} />
            <Text style={styles.cardTitle}>Describe your dream trip</Text>
          </View>
          <TouchableOpacity
            style={styles.decideToggle}
            onPress={handleToggleDecide}
            accessibilityRole="button"
            accessibilityState={{ expanded: showDecide }}
            accessibilityLabel="Help me decide where to go"
          >
            <Ionicons
              name={showDecide ? 'chevron-up' : 'compass-outline'}
              size={16}
              color={colors.primary[700]}
            />
            <Text style={styles.decideToggleText}>
              {showDecide ? 'Hide ideas' : 'Help me decide'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Type a destination, dates, pace, or dietary notes — we’ll fill the planner for you.
        </Text>

        <SafeTextInput
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="e.g., 5 days in Kyoto in October, couple, foodie & temples, peanut allergy"
          placeholderTextColor="#64748b"
          multiline
          maxLength={600}
          textAlignVertical="top"
          accessibilityLabel="Describe your dream trip"
          accessibilityHint="Enter destination, dates, travelers, budget, or dietary notes"
        />

        {/* Example quick-fill chips */}
        <View style={styles.examplesRow}>
          {EXAMPLE_PROMPTS.map((example) => (
            <TouchableOpacity
              key={example}
              style={styles.exampleChip}
              onPress={() => {
                setPrompt(example);
                void runParse(example);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Try example: ${example}`}
            >
              <Text style={styles.exampleChipText} numberOfLines={1}>
                {example}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.fillButton, (!prompt.trim() || isParsing) && styles.fillButtonDisabled]}
            onPress={() => void runParse(prompt)}
            disabled={!prompt.trim() || isParsing}
            accessibilityRole="button"
            accessibilityLabel="Fill my trip from description"
          >
            {isParsing ? (
              <SafeActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="sparkles-outline" size={18} color="#ffffff" />
            )}
            <Text style={styles.fillButtonText}>
              {isParsing ? 'Filling brief…' : 'Fill my trip'}
            </Text>
          </TouchableOpacity>

          {canUndo && onUndoParsed ? (
            <TouchableOpacity
              style={styles.undoButton}
              onPress={() => {
                hapticFeedback.light();
                setLastSummary([]);
                onUndoParsed();
              }}
              accessibilityRole="button"
              accessibilityLabel="Undo auto-filled trip brief"
            >
              <Ionicons name="arrow-undo-outline" size={16} color="#0f172a" />
              <Text style={styles.undoButtonText}>Undo</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {lastSummary.length > 0 ? (
          <View style={styles.summaryPill} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={16} color="#0F766E" />
            <Text style={styles.summaryText}>Filled: {lastSummary.join(' · ')}</Text>
          </View>
        ) : null}

        {parseMessage ? (
          <Text style={styles.helperError} accessibilityLiveRegion="polite">
            {parseMessage}
          </Text>
        ) : null}

        {/* Help Me Decide 3-Destination Picker */}
        {showDecide ? (
          <View style={styles.decidePanel}>
            <Text style={styles.decideHeading}>Not sure where to go?</Text>
            <Text style={styles.decideSub}>
              Share a vibe, season, or region and pick from 3 tailored ideas.
            </Text>
            <View style={styles.decideInputRow}>
              <SafeTextInput
                style={styles.decideInput}
                value={decideQuery}
                onChangeText={setDecideQuery}
                placeholder="Warm beaches in November, great food…"
                placeholderTextColor="#64748b"
                returnKeyType="search"
                onSubmitEditing={() => void runSuggest(decideQuery)}
                accessibilityLabel="Describe what kind of trip you want"
              />
              <TouchableOpacity
                style={styles.decideSearchButton}
                onPress={() => void runSuggest(decideQuery)}
                disabled={isSuggesting}
                accessibilityRole="button"
                accessibilityLabel="Find 3 destination ideas"
              >
                {isSuggesting ? (
                  <SafeActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.decideSearchButtonText}>Match</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.suggestionList}>
              {suggestions.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.suggestionCard}
                  onPress={() => {
                    hapticFeedback.selection();
                    onSelectSuggestion(item);
                    setShowDecide(false);
                    setLastSummary([
                      item.country ? `${item.destination}, ${item.country}` : item.destination,
                      `${item.suggestedDays} days`,
                      ...item.suggestedVibes.slice(0, 2),
                    ]);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${item.destination}, ${item.country}`}
                >
                  <View style={styles.suggestionHeader}>
                    <Text style={styles.suggestionTitle}>
                      {item.destination}
                      {item.country ? `, ${item.country}` : ''}
                    </Text>
                    <Text style={styles.suggestionDays}>{item.suggestedDays}d</Text>
                  </View>
                  <Text style={styles.suggestionWhy}>{item.whyItFits}</Text>
                  <Text style={styles.suggestionSeason}>{item.seasonNote}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {/* Transparent Saved Traveler Memory Banner */}
      <View style={styles.memoryBanner}>
        <View style={styles.memoryHeader}>
          <View style={styles.memoryTitleRow}>
            <Ionicons
              name={hasMemory ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color="#0F766E"
            />
            <Text style={styles.memoryTitle}>
              {hasMemory
                ? memoryApplied
                  ? 'Using your saved defaults'
                  : 'Saved traveler defaults'
                : 'Traveler memory'}
            </Text>
          </View>
          <View style={styles.memoryActions}>
            {onSaveCurrentAsMemory ? (
              <TouchableOpacity
                style={styles.memoryActionBtn}
                onPress={() => {
                  hapticFeedback.selection();
                  onSaveCurrentAsMemory();
                }}
                accessibilityRole="button"
                accessibilityLabel="Save current trip preferences as defaults"
              >
                <Text style={styles.memoryActionText}>
                  {hasMemory ? 'Update defaults' : 'Save defaults'}
                </Text>
              </TouchableOpacity>
            ) : null}
            {hasMemory && onEditMemory ? (
              <TouchableOpacity
                style={styles.memoryActionBtn}
                onPress={() => {
                  hapticFeedback.light();
                  onEditMemory();
                }}
                accessibilityRole="button"
                accessibilityLabel="Manage traveler memory in Profile"
              >
                <Text style={styles.memoryActionText}>Manage</Text>
              </TouchableOpacity>
            ) : null}
            {hasMemory && onClearMemory ? (
              <TouchableOpacity
                style={styles.memoryActionBtn}
                onPress={() => {
                  hapticFeedback.light();
                  onClearMemory();
                }}
                accessibilityRole="button"
                accessibilityLabel="Clear saved traveler defaults"
              >
                <Text style={styles.memoryClearText}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        {hasMemory && memoryItems.length > 0 ? (
          <Text style={styles.memorySummary}>{memoryItems.join(' · ')}</Text>
        ) : (
          <Text style={styles.memoryEmpty}>
            Save your usual budget tier, vibes, or dietary notes to prefill future trips.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 24,
    marginBottom: 20,
    gap: 12,
  },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  decideToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FFF5F4',
    borderWidth: 1,
    borderColor: '#FDB4AF',
  },
  decideToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9B2D25',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
  },
  input: {
    minHeight: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 21,
    color: '#0f172a',
  },
  examplesRow: {
    gap: 6,
  },
  exampleChip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  exampleChipText: {
    fontSize: 13,
    color: '#334155',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fillButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.action.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  fillButtonDisabled: {
    opacity: 0.5,
  },
  fillButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  undoButton: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  undoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#134E4A',
    fontWeight: '600',
  },
  helperError: {
    fontSize: 13,
    lineHeight: 18,
    color: '#9B2D25',
  },
  decidePanel: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 10,
  },
  decideHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  decideSub: {
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
  },
  decideInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  decideInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  decideSearchButton: {
    minHeight: 44,
    minWidth: 72,
    borderRadius: 10,
    backgroundColor: '#143D46',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  decideSearchButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  suggestionList: {
    gap: 8,
  },
  suggestionCard: {
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 4,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  suggestionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  suggestionDays: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  suggestionWhy: {
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
  },
  suggestionSeason: {
    fontSize: 12,
    lineHeight: 17,
    color: '#475569',
  },
  memoryBanner: {
    backgroundColor: '#F0FDFA',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  memoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  memoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#134E4A',
  },
  memoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memoryActionBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  memoryActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
    textDecorationLine: 'underline',
  },
  memoryClearText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9B2D25',
  },
  memorySummary: {
    fontSize: 13,
    lineHeight: 19,
    color: '#115E59',
  },
  memoryEmpty: {
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
  },
});
