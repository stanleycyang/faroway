import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { readDiningReviewOptions } from '@faroway/types';
import { VenueSourceNotice } from './VenueSourceNotice';

export function DiningReviewOptions({ options }: { options: unknown }) {
  const items = readDiningReviewOptions(options);
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        Dining options to review
      </Text>
      <Text style={styles.note}>
        These options are not scheduled. Check meal service, prices and availability before choosing
        one.
      </Text>
      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.note}>{item.address}</Text>
          <VenueSourceNotice source={item.source} />
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { marginHorizontal: 24, marginVertical: 16 },
  heading: { fontSize: 18, fontWeight: '700', color: '#182B31', marginBottom: 8 },
  note: { fontSize: 14, lineHeight: 21, color: '#475569' },
  card: { marginTop: 12, padding: 16, backgroundColor: '#fff', borderRadius: 12 },
  name: { fontSize: 16, fontWeight: '600', color: '#182B31', marginBottom: 6 },
});
