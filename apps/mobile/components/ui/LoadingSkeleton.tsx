import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, ViewStyle } from "react-native";
import { colors, borderRadius } from "../../constants/theme";

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = "100%",
  height = 20,
  borderRadius: radius = 8,
  style,
}: SkeletonProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.35],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius: radius,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function DestinationCardSkeleton() {
  return (
    <View style={styles.destinationCard}>
      <Skeleton width="100%" height={180} borderRadius={16} />
      <View style={styles.destinationCardContent}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

export function TripCardSkeleton() {
  return (
    <View style={styles.tripCard}>
      <Skeleton width={100} height={100} borderRadius={12} />
      <View style={styles.tripCardContent}>
        <Skeleton width="70%" height={18} />
        <Skeleton width="50%" height={14} style={{ marginTop: 8 }} />
        <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

export function ActivityCardSkeleton() {
  return (
    <View style={styles.activityCard}>
      <View style={styles.activityTime}>
        <Skeleton width={40} height={12} />
      </View>
      <View style={styles.activityContent}>
        <Skeleton width="80%" height={16} />
        <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
        <Skeleton width="100%" height={12} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "#e2e8f0",
  },
  destinationCard: {
    width: 240,
    marginRight: 16,
  },
  destinationCardContent: {
    marginTop: 12,
  },
  tripCard: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#ffffff",
    borderRadius: borderRadius.lg,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tripCardContent: {
    flex: 1,
    marginLeft: 16,
  },
  activityCard: {
    flexDirection: "row",
    marginBottom: 20,
  },
  activityTime: {
    width: 50,
    marginRight: 16,
  },
  activityContent: {
    flex: 1,
  },
});
