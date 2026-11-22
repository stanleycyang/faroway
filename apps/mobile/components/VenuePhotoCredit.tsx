import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { openSafeHttpsUrl } from '../lib/openExternalUrl';
import type { VenuePhotoCredit as Credit } from '../lib/venuePhotos';

export function VenuePhotoCredit({ credit }: { credit: Credit }) {
  const open = (url: string) =>
    openSafeHttpsUrl(url, {
      fallbackTitle: 'Could not open photo details',
      fallbackMessage: 'Please try again when you have a connection.',
    });
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.link}
        accessibilityRole="link"
        onPress={() => void open(credit.sourceUrl)}
      >
        <Text style={styles.text}>Photo: {credit.artist} · cropped</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.link}
        accessibilityRole="link"
        onPress={() => void open(credit.licenseUrl)}
      >
        <Text style={styles.text}>{credit.license}</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, gap: 8 },
  link: { minHeight: 44, justifyContent: 'center', flexShrink: 1 },
  text: { color: '#475569', fontSize: 11, lineHeight: 16, textDecorationLine: 'underline' },
});
