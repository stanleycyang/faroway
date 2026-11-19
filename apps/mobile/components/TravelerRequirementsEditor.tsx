import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { TravelerRequirements } from '@faroway/types';
import { colors } from '../constants/theme';

const empty: TravelerRequirements = {
  allergies: [],
  dietaryPreferences: [],
  accessibility: [],
  mobilityNotes: '',
};
const accessOptions = [
  ['step_free_entrance', 'Step-free entrance'],
  ['accessible_restroom', 'Accessible restroom'],
  ['accessible_seating', 'Accessible seating'],
  ['accessible_parking', 'Accessible parking'],
] as const;
const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

function RequirementList({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [text, setText] = useState(() => values.join('\n'));
  const saved = JSON.stringify(values);
  useEffect(() => {
    // Preserve a trailing newline while typing, but reflect restored briefs.
    setText((current) => (JSON.stringify(lines(current)) === saved ? current : values.join('\n')));
  }, [saved, values]);
  const invalid = values.length > 20 || values.some((value) => value.length > 100);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.hint}>One per line. Up to 20 items, 100 characters each.</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint="Enter one item per line"
        multiline
        textAlignVertical="top"
        style={styles.input}
        value={text}
        onChangeText={(next) => {
          setText(next);
          onChange(lines(next));
        }}
      />
      {invalid ? (
        <Text accessibilityRole="alert" style={styles.error}>
          Use up to 20 items with no more than 100 characters each.
        </Text>
      ) : null}
    </View>
  );
}

export function TravelerRequirementsEditor({
  value,
  onChange,
  collapsible = false,
}: {
  value?: TravelerRequirements | null;
  collapsible?: boolean;
  onChange: (
    update: (current: TravelerRequirements | null | undefined) => TravelerRequirements
  ) => void;
}) {
  const requirements = value ?? empty;
  const hasNeeds =
    requirements.allergies.length > 0 ||
    requirements.dietaryPreferences.length > 0 ||
    requirements.accessibility.length > 0 ||
    requirements.mobilityNotes.trim().length > 0;
  const [expanded, setExpanded] = useState(false);
  // Never hide saved needs or invalid input behind an optional disclosure.
  const showFields = !collapsible || expanded || hasNeeds;
  const patch = (change: Partial<TravelerRequirements>) =>
    onChange((current) => ({ ...(current ?? empty), ...change }));
  return (
    <View>
      <Text accessibilityRole="header" style={styles.heading}>
        Dietary and access needs
      </Text>
      <Text style={styles.hint}>
        Optional. These guide your plan; confirm allergy handling and accessibility directly with
        venues.
      </Text>
      {collapsible && !hasNeeds && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded: showFields }}
          onPress={() => setExpanded((current) => !current)}
          style={styles.option}
        >
          <Text style={styles.optionLabel}>
            {showFields ? 'Hide optional needs' : 'Add dietary or access needs'}
          </Text>
          <Ionicons
            name={showFields ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.surface[600]}
            accessible={false}
          />
        </TouchableOpacity>
      )}
      {showFields && (
        <>
          <RequirementList
            label="Food allergies"
            values={requirements.allergies}
            onChange={(allergies) => patch({ allergies })}
          />
          <RequirementList
            label="Dietary preferences"
            values={requirements.dietaryPreferences}
            onChange={(dietaryPreferences) => patch({ dietaryPreferences })}
          />
          <Text style={styles.label}>Access needs</Text>
          {accessOptions.map(([key, label]) => {
            const checked = requirements.accessibility.includes(key);
            return (
              <TouchableOpacity
                key={key}
                accessibilityRole="checkbox"
                accessibilityLabel={label}
                accessibilityState={{ checked }}
                style={styles.option}
                onPress={() =>
                  onChange((current) => {
                    const latest = current ?? empty;
                    return {
                      ...latest,
                      accessibility: latest.accessibility.includes(key)
                        ? latest.accessibility.filter((item) => item !== key)
                        : [...latest.accessibility, key],
                    };
                  })
                }
              >
                <Ionicons
                  name={checked ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={checked ? colors.action.primary : colors.surface[600]}
                />
                <Text style={styles.optionLabel}>{label}</Text>
              </TouchableOpacity>
            );
          })}
          <View style={styles.field}>
            <Text style={styles.label}>Mobility and rest needs</Text>
            <Text style={styles.hint}>
              Include walking limits, wheelchair dimensions or rest breaks. Up to 500 characters.
            </Text>
            <TextInput
              accessibilityLabel="Mobility and rest needs"
              accessibilityHint="Up to 500 characters"
              multiline
              textAlignVertical="top"
              style={styles.input}
              value={requirements.mobilityNotes}
              onChangeText={(mobilityNotes) => patch({ mobilityNotes })}
            />
            {requirements.mobilityNotes.trim().length > 500 ? (
              <Text accessibilityRole="alert" style={styles.error}>
                Shorten mobility and rest needs to 500 characters.
              </Text>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', color: colors.surface[900], marginBottom: 8 },
  field: { marginVertical: 12 },
  label: { fontSize: 16, fontWeight: '600', color: colors.surface[700], marginBottom: 6 },
  hint: { fontSize: 14, lineHeight: 21, color: colors.surface[600], marginBottom: 8 },
  input: {
    minHeight: 88,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.surface[300],
    borderRadius: 12,
    fontSize: 16,
    color: colors.surface[900],
    backgroundColor: '#ffffff',
  },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  optionLabel: { flex: 1, fontSize: 16, color: colors.surface[700] },
  error: { fontSize: 14, lineHeight: 21, color: colors.primary[800], marginTop: 6 },
});
