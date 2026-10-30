import { useState, useEffect } from 'react';
import { Image, View, Text, StyleSheet, type ImageProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { travel } from '../../constants/theme';

/** Keep a failed remote photo intentional, without substituting an unrelated venue. */
export function TravelImage({ source, style, ...props }: ImageProps) {
  const [failed, setFailed] = useState(false);
  const uri =
    source && !Array.isArray(source) && typeof source === 'object' ? source.uri : undefined;
  useEffect(() => setFailed(false), [uri]);
  return (
    <View style={[styles.frame, style]} accessible={false}>
      <View style={styles.placeholder}>
        <Ionicons name="image-outline" size={28} color={travel.muted} />
        {failed && <Text style={styles.label}>Photo unavailable</Text>}
      </View>
      {!failed && source && (
        <Image
          {...props}
          source={source}
          style={StyleSheet.absoluteFill}
          onError={(event) => {
            setFailed(true);
            props.onError?.(event);
          }}
          accessible={false}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { backgroundColor: travel.mist, overflow: 'hidden' },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: { fontSize: 13, color: travel.muted },
});
