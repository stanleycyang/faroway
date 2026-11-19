import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { timingPresentation, type DayTimingProposal } from '@faroway/types';

export function ProposedTiming({
  proposal,
  names,
}: {
  proposal: DayTimingProposal;
  names: Record<string, string>;
}) {
  const view = timingPresentation(proposal, names);
  return (
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.heading}>
        {view.heading}
      </Text>
      <Text style={styles.description}>{view.description}</Text>
      {view.rows.map((row) => (
        <View key={row.id} style={[styles.row, row.kind === 'rest' && styles.rest]}>
          <Text style={styles.time}>{row.time}</Text>
          <Text style={[styles.label, row.kind === 'rest' && styles.restLabel]}>{row.label}</Text>
        </View>
      ))}
      <Text style={styles.assumptions}>{view.assumptions}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  heading: { fontSize: 18, fontWeight: '700', color: '#182B31' },
  description: { fontSize: 14, lineHeight: 21, color: '#475569', marginTop: 4, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 6,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  time: {
    width: 94,
    fontSize: 13,
    lineHeight: 21,
    color: '#334155',
    fontVariant: ['tabular-nums'],
  },
  label: { flex: 1, fontSize: 14, lineHeight: 21, color: '#334155' },
  rest: { backgroundColor: '#EFF5F3', borderRadius: 8 },
  restLabel: { fontWeight: '700', color: '#246757' },
  assumptions: { marginTop: 14, fontSize: 12, lineHeight: 18, color: '#475569' },
});
