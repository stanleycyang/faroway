import React, { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { colors, borderRadius } from '../../constants/theme';
import { normalizeVibeList, travelVibes } from '@faroway/constants';
import { hapticFeedback } from '../../utils/haptics';

// Bundled icons keep these controls independent of the OS emoji font.
const vibeIcons: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  adventure: 'trail-sign-outline',
  relaxation: 'sunny-outline',
  culture: 'library-outline',
  foodie: 'restaurant-outline',
  nightlife: 'musical-notes-outline',
  nature: 'leaf-outline',
  romantic: 'heart-outline',
  family: 'people-outline',
  budget: 'wallet-outline',
  luxury: 'sparkles-outline',
  solo: 'bag-outline',
  wellness: 'fitness-outline',
};

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
  const normalizedSelected: string[] = useMemo(
    () => normalizeVibeList(selected, maxSelections),
    [selected, maxSelections]
  );

  const toggleVibe = (vibeId: string) => {
    if (disabled) return;
    if (normalizedSelected.includes(vibeId)) {
      hapticFeedback.light();
      onSelect(normalizedSelected.filter((id) => id !== vibeId));
    } else if (normalizedSelected.length < maxSelections) {
      hapticFeedback.medium();
      onSelect([...normalizedSelected, vibeId]);
    } else {
      hapticFeedback.error();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>What's your travel vibe?</Text>
        <Text style={styles.subtitle}>
          Select up to {maxSelections} ({normalizedSelected.length}/{maxSelections})
        </Text>
      </View>
      <View style={styles.grid}>
        {travelVibes.map((vibe) => {
          const isSelected = normalizedSelected.includes(vibe.id);
          return (
            <TouchableOpacity
              key={vibe.id}
              onPress={() => toggleVibe(vibe.id)}
              style={[styles.vibeButton, isSelected && styles.vibeButtonSelected]}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityLabel={`${vibe.label} travel vibe`}
              aria-checked={isSelected}
              aria-disabled={
                disabled || (!isSelected && normalizedSelected.length >= maxSelections)
              }
              disabled={disabled || (!isSelected && normalizedSelected.length >= maxSelections)}
            >
              <Ionicons
                name={vibeIcons[vibe.id] ?? 'compass-outline'}
                size={18}
                color={isSelected ? colors.action.primary : colors.surface[600]}
                style={styles.vibeIcon}
                accessible={false}
              />
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
  const normalizedVibes: string[] = normalizeVibeList(vibes, vibes.length || 14);
  const selectedVibes = travelVibes.filter((v) => normalizedVibes.includes(v.id));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsContainer}
    >
      {selectedVibes.map((vibe) => (
        <View key={vibe.id} style={styles.chip}>
          <Ionicons
            name={vibeIcons[vibe.id] ?? 'compass-outline'}
            size={14}
            color={colors.action.primary}
            style={styles.chipIcon}
            accessible={false}
          />
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
  vibeIcon: {
    marginRight: 8,
  },
  vibeLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface[600],
  },
  vibeLabelSelected: {
    color: colors.primary[800],
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
  chipIcon: {
    marginRight: 4,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[800],
  },
});
