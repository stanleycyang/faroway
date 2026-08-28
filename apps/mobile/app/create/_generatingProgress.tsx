import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../constants/theme';
import { useStreamingItinerary, StreamingBlock } from '../../hooks/useStreamingItinerary';
import { registry } from '../../lib/json-render/registry';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { styles } from './_generatingStyles';

const { width } = Dimensions.get('window');

export function JsonRenderRenderer({
  blocks,
  onNewContent,
}: {
  blocks: StreamingBlock[];
  onNewContent?: () => void;
}) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const prevLengthRef = useRef(0);

  useEffect(() => {
    if (blocks.length > prevLengthRef.current) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      prevLengthRef.current = blocks.length;
      onNewContent?.();
    }
  }, [blocks.length, fadeAnim, onNewContent]);

  if (blocks.length === 0) return null;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      {blocks.map((comp, index) => {
        if (!comp || !comp.type) return null;
        const Component = registry[comp.type as keyof typeof registry] as React.ComponentType<
          Record<string, unknown>
        >;
        if (!Component) return null;
        return <Component key={`${comp.type}-${index}`} {...(comp.props || {})} />;
      })}
    </Animated.View>
  );
}

export function PulsingDot() {
  const [pulseAnim] = useState(new Animated.Value(1));
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim, reduceMotion]);

  return <Animated.View style={[styles.streamingDot, { opacity: pulseAnim }]} />;
}

export function ProgressRing({ progress, size = 180 }: { progress: number; size?: number }) {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const strokeWidth = 8;

  useEffect(() => {
    Animated.spring(animatedProgress, {
      toValue: progress,
      useNativeDriver: false,
      friction: 8,
    }).start();
  }, [progress, animatedProgress]);

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ rotate: '-90deg' }],
          },
        ]}
      >
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: 'rgba(255,255,255,0.15)',
          }}
        />
      </Animated.View>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <LinearGradient
          colors={[colors.primary[400], colors.primary[600]]}
          style={{
            width: size - strokeWidth * 4,
            height: size - strokeWidth * 4,
            borderRadius: (size - strokeWidth * 4) / 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
        </LinearGradient>
      </View>
    </View>
  );
}

export function SkeletonLoader() {
  const [shimmerAnim] = useState(new Animated.Value(0));
  const reduceMotion = useReduceMotion();
  useEffect(() => {
    if (reduceMotion) return;
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerAnim, reduceMotion]);
  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });
  const SkeletonBox = ({ w, h, style }: { w: number | string; h: number; style?: object }) => (
    <View
      style={[
        {
          width: w,
          height: h,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: 8,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(255,255,255,0.05)',
          transform: [{ translateX }],
        }}
      />
    </View>
  );
  return (
    <View style={styles.skeletonContainer}>
      <SkeletonBox w="100%" h={200} style={{ marginBottom: 16, borderRadius: 16 }} />
      <SkeletonBox w="70%" h={24} style={{ marginBottom: 12 }} />
      <SkeletonBox w="50%" h={16} style={{ marginBottom: 24 }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <SkeletonBox w={100} h={80} style={{ borderRadius: 12 }} />
        <SkeletonBox w={100} h={80} style={{ borderRadius: 12 }} />
        <SkeletonBox w={100} h={80} style={{ borderRadius: 12 }} />
      </View>
    </View>
  );
}
