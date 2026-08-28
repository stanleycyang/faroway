import { useEffect, useState, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { styles } from './_generatingStyles';
import {
  GENERATION_STEPS,
  DESTINATION_FACTS,
  StreamingHotel,
} from './_generatingShared';
import type { SeededItineraryOutline } from '../../lib/itineraryPreview';

export function HotelPreviewCard({ hotel }: { hotel: Record<string, unknown> }) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.9));
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8 }),
    ]).start();
  }, [fadeAnim, scaleAnim]);
  const h = hotel as StreamingHotel;
  const starRating = Math.max(1, Math.min(5, Math.round(h.starRating || 4)));
  const userRating = h.userRating || h.rating;
  return (
    <Animated.View
      style={[styles.hotelPreview, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
    >
      <View style={styles.hotelPreviewHeader}>
        <Text style={styles.hotelPreviewLabel}>🏨 Your Top Hotel Match</Text>
      </View>
      <View style={styles.hotelPreviewContent}>
        <View style={styles.hotelPreviewInfo}>
          <Text style={styles.hotelPreviewName} numberOfLines={2}>
            {h.name || 'Recommended hotel'}
          </Text>
          <View style={styles.hotelPreviewRating}>
            <Text style={styles.hotelPreviewStars}>{'★'.repeat(starRating)}</Text>
            <Text style={styles.hotelPreviewScore}>{userRating?.toFixed(1) || '4.5'}</Text>
          </View>
          <Text style={styles.hotelPreviewPrice}>
            ${h.pricePerNight || 200}
            <Text style={styles.hotelPreviewPriceUnit}>/night</Text>
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

export function StepIndicator({
  step,
  status,
  count,
  microMessage,
}: {
  step: (typeof GENERATION_STEPS)[0];
  status: 'pending' | 'searching' | 'done';
  count?: number;
  microMessage?: string;
}) {
  const [scaleAnim] = useState(new Animated.Value(status === 'pending' ? 0.95 : 1));
  const [pulseAnim] = useState(new Animated.Value(1));
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (status !== prevStatusRef.current) {
      if (status === 'done') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      prevStatusRef.current = status;
    }
    if (status === 'searching') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    }
  }, [status, scaleAnim, pulseAnim]);
  const opacity = status === 'pending' ? 0.5 : 1;
  return (
    <Animated.View
      style={[
        styles.stepRow,
        { opacity, transform: [{ scale: status === 'searching' ? pulseAnim : scaleAnim }] },
      ]}
    >
      <View
        style={[
          styles.stepIcon,
          status === 'done' && { backgroundColor: step.color },
          status === 'searching' && styles.stepIconActive,
        ]}
      >
        <Text style={styles.stepEmoji}>{status === 'done' ? '✓' : step.emoji}</Text>
      </View>
      <View style={styles.stepContent}>
        <Text style={[styles.stepText, status === 'done' && styles.stepTextDone]}>{step.text}</Text>
        {microMessage && status === 'searching' && (
          <Text style={styles.stepMicro} numberOfLines={1}>
            {microMessage}
          </Text>
        )}
        {count !== undefined && count > 0 && status === 'done' && (
          <Text style={[styles.stepCount, { color: step.color }]}>{count} found</Text>
        )}
      </View>
      {status === 'done' && (
        <View style={[styles.stepCheckBadge, { backgroundColor: step.color }]}>
          <Text style={styles.stepCheckText}>✓</Text>
        </View>
      )}
    </Animated.View>
  );
}

export function FunFactCard({ destination }: { destination: string }) {
  const [factIndex, setFactIndex] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(1));
  const facts = DESTINATION_FACTS[destination] || DESTINATION_FACTS.default;
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setFactIndex((prev) => (prev + 1) % facts.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [facts.length, fadeAnim]);
  return (
    <View style={styles.funFact}>
      <Text style={styles.funFactLabel}>💡 Did you know?</Text>
      <Animated.Text style={[styles.funFactText, { opacity: fadeAnim }]}>
        {facts[factIndex]}
      </Animated.Text>
    </View>
  );
}

export function CelebrationOverlay({ onComplete }: { onComplete: () => void }) {
  const [scaleAnim] = useState(new Animated.Value(0));
  const [opacityAnim] = useState(new Animated.Value(0));
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [scaleAnim, opacityAnim, onComplete]);
  return (
    <Animated.View style={[styles.celebrationOverlay, { opacity: opacityAnim }]}>
      <Animated.View style={[styles.celebrationContent, { transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.celebrationEmoji}>🎉</Text>
        <Text style={styles.celebrationTitle}>Your Trip is Ready!</Text>
        <Text style={styles.celebrationSubtitle}>Personalized just for you</Text>
      </Animated.View>
    </Animated.View>
  );
}

export function SeededOutlineCard({ outline }: { outline: SeededItineraryOutline }) {
  return (
    <View
      style={styles.seededOutline}
      accessible
      accessibilityLabel={`${outline.title}. ${outline.dateLabel}. ${outline.travelersLabel}. ${outline.budgetLabel}.`}
    >
      <View style={styles.seededOutlineHeader}>
        <Text style={styles.seededOutlineKicker}>Outline ready</Text>
        <Text style={styles.seededOutlineTitle}>{outline.title}</Text>
      </View>
      <View style={styles.seededMetaRow}>
        {[outline.dateLabel, outline.travelersLabel, outline.budgetLabel, outline.styleLabel].map(
          (label) => (
            <View key={label} style={styles.seededMetaPill}>
              <Text style={styles.seededMetaText}>{label}</Text>
            </View>
          )
        )}
      </View>
      <View style={styles.seededSection}>
        <Text style={styles.seededSectionLabel}>Trip focus</Text>
        <View style={styles.seededChipRow}>
          {outline.focusAreas.map((area) => (
            <View key={area} style={styles.seededFocusChip}>
              <Text style={styles.seededFocusText}>{area}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.seededSection}>
        <Text style={styles.seededSectionLabel}>Planning now</Text>
        <Text style={styles.seededPlanningText}>{outline.planningAreas.join(' - ')}</Text>
      </View>
    </View>
  );
}
