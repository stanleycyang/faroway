import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { colors, borderRadius } from '../../constants/theme';
import { travelVibes } from '@faroway/constants';
import { hapticFeedback } from '../../utils/haptics';

interface VibeSelectorProps {
  selected: string[];
  onSelect: (vibes: string[]) => void;
  maxSelections?: number;
  disabled?: boolean;
}

export function VibeSelector({
  selected,
  onSelect,
  maxSelections = 5,
  disabled = false,
}: VibeSelectorProps) {
  const toggleVibe = (vibeId: string) => {
    if (disabled) return;
    if (selected.includes(vibeId)) {
      hapticFeedback.light();
      onSelect(selected.filter((id) => id !== vibeId));
    } else if (selected.length < maxSelections) {
      hapticFeedback.medium();
      onSelect([...selected, vibeId]);
    } else {
      hapticFeedback.error();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>What's your travel vibe?</Text>
        <Text style={styles.subtitle}>
          Select up to {maxSelections} ({selected.length}/{maxSelections})
        </Text>
      </View>
      <View style={styles.grid}>
        {travelVibes.map((vibe) => {
          const isSelected = selected.includes(vibe.id);
          return (
            <TouchableOpacity
              key={vibe.id}
              onPress={() => toggleVibe(vibe.id)}
              style={[styles.vibeButton, isSelected && styles.vibeButtonSelected]}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityLabel={`${vibe.label} travel vibe`}
              aria-checked={isSelected}
              aria-disabled={disabled || (!isSelected && selected.length >= maxSelections)}
              disabled={disabled || (!isSelected && selected.length >= maxSelections)}
            >
              <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
              <Text style={[styles.vibeLabel, isSelected && styles.vibeLabelSelected]}>
                {vibe.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

interface VibeChipsProps {
  vibes: string[];
}

export function VibeChips({ vibes }: VibeChipsProps) {
  const selectedVibes = travelVibes.filter((v) => vibes.includes(v.id));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsContainer}
    >
      {selectedVibes.map((vibe) => (
        <View key={vibe.id} style={styles.chip}>
          <Text style={styles.chipEmoji}>{vibe.emoji}</Text>
          <Text style={styles.chipLabel}>{vibe.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.surface[600],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vibeButton: {
    width: '48%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  vibeButtonSelected: {
    backgroundColor: '#FFF5F4',
    borderColor: colors.action.primary,
    ...Platform.select({
      web: { boxShadow: '0 0 8px rgba(249, 112, 102, 0.25)' },
      default: {
        shadowColor: '#F97066',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
    }),
  },
  vibeEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  vibeLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface[600],
  },
  vibeLabelSelected: {
    color: colors.primary[600],
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  chipEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[600],
  },
});
