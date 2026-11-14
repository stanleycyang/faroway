import { useEffect, useState } from 'react';
import { networkMonitor } from '../../lib/offline/network';
import { Image, View, Text, StyleSheet, type ImageProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { travel } from '../../constants/theme';

/** Keep a failed remote photo intentional, without substituting an unrelated venue. */
export function TravelImage({ source, style, ...props }: ImageProps) {
  const sourceKey = JSON.stringify(source ?? null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === sourceKey;
  const uri =
    source && !Array.isArray(source) && typeof source === 'object' ? source.uri : undefined;
  const hasSource =
    typeof source === 'number' ||
    (Array.isArray(source)
      ? source.some((item) => Boolean(item.uri?.trim()))
      : Boolean(uri?.trim()));
  useEffect(() => {
    if (!failed || !hasSource) return;
    let wasOffline = false;
    return networkMonitor.subscribe((state) => {
      if (state.status === 'offline') wasOffline = true;
      if (state.status === 'online' && wasOffline) setFailedSource(null);
    });
  }, [failed, hasSource]);
  return (
    <View style={[styles.frame, style]} accessible={false}>
      <View style={styles.placeholder}>
        <Ionicons name="image-outline" size={28} color={travel.muted} />
        {(failed || !hasSource) && <Text style={styles.label}>Photo unavailable</Text>}
      </View>
      {!failed && hasSource && (
        <Image
          {...props}
          key={sourceKey}
          source={source}
          style={StyleSheet.absoluteFill}
          onError={(event) => {
            setFailedSource(sourceKey);
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
