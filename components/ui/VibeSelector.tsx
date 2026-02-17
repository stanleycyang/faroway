import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
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
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.surface[400],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vibeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface[800],
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  vibeButtonSelected: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderColor: colors.primary[500],
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  vibeEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  vibeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface[300],
  },
  vibeLabelSelected: {
    color: colors.primary[300],
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99,102,241,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  chipEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[300],
  },
});
