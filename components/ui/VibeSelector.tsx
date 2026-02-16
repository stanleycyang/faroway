import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { colors, borderRadius } from '../../constants/theme';
import { travelVibes } from '../../constants/destinations';
import { hapticFeedback } from '../../utils/haptics';

interface VibeSelectorProps {
  selected: string[];
  onSelect: (vibes: string[]) => void;
  maxSelections?: number;
}

export function VibeSelector({
  selected,
  onSelect,
  maxSelections = 5,
}: VibeSelectorProps) {
  const toggleVibe = (vibeId: string) => {
    if (selected.includes(vibeId)) {
      hapticFeedback.light();
      onSelect(selected.filter((id) => id !== vibeId));
    } else if (selected.length < maxSelections) {
      hapticFeedback.medium();
      onSelect([...selected, vibeId]);
    } else {
      // Max reached - give error feedback
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
              style={[
                styles.vibeButton,
                isSelected && styles.vibeButtonSelected,
              ]}
              activeOpacity={0.7}
            >
              <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
              <Text
                style={[
                  styles.vibeLabel,
                  isSelected && styles.vibeLabelSelected,
                ]}
              >
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
    color: colors.neutral[900],
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vibeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  vibeButtonSelected: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  vibeEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  vibeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  vibeLabelSelected: {
    color: colors.primary[700],
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  chipEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[700],
  },
});
