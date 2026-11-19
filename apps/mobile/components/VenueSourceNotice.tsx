import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { readVenueSource } from '@faroway/types';
import { colors } from '../constants/theme';

export function VenueSourceNotice({ source: value }: { source: unknown }) {
  const source = readVenueSource(value);
  if (!source) return null;
  return (
    <View style={styles.notice}>
      <TouchableOpacity
        accessibilityRole="link"
        accessibilityLabel={`View source at ${new URL(source.url).hostname}`}
        onPress={async () => {
          try {
            await WebBrowser.openBrowserAsync(source.url);
          } catch {
            Alert.alert('Could not open source', 'Please try again when you have a connection.');
          }
        }}
        style={styles.link}
      >
        <Text style={styles.linkText}>View source · {new URL(source.url).hostname}</Text>
      </TouchableOpacity>
      <Text style={styles.note}>
        Retrieved {source.retrievedOn}. Confirm opening hours and availability for your dates.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  notice: {
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { color: colors.primary[700], fontSize: 13, textDecorationLine: 'underline' },
  note: { color: '#475569', fontSize: 12, lineHeight: 18 },
});
