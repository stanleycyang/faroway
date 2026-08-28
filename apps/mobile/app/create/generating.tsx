import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Animated,
  Easing,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTripStore, Trip, TripDay, TripInput, Activity } from '../../stores/tripStore';
import { usePromptStore } from '../../stores/promptStore';
import { useAuthContext } from '../../components/AuthProvider';
import { AuthGate } from '../../components/AuthGate';
import { popularDestinations, IMAGE_PATHS, getImageUrl } from '@faroway/constants';
import { colors } from '../../constants/theme';
import { useStreamingItinerary, StreamingBlock } from '../../hooks/useStreamingItinerary';
import {
  buildSeededItineraryOutline,
  type SeededItineraryOutline,
} from '../../lib/itineraryPreview';
import { registry } from '../../lib/json-render/registry';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const { width, height } = Dimensions.get('window');

const GENERATION_STEPS = [
  { key: 'orchestrator', text: 'Planning', emoji: '🔍', color: '#8B5CF6' },
  { key: 'hotels', text: 'Hotels', emoji: '🏨', color: '#F59E0B' },
  { key: 'activities', text: 'Activities', emoji: '✨', color: '#10B981' },
  { key: 'dining', text: 'Dining', emoji: '🍽️', color: '#EF4444' },
  { key: 'transport', text: 'Transport', emoji: '✈️', color: '#06B6D4' },
  { key: 'budget', text: 'Budget', emoji: '💳', color: '#14B8A6' },
  { key: 'enrichment', text: 'Local tips', emoji: '💡', color: '#84CC16' },
  { key: 'aggregator', text: 'Itinerary', emoji: '📝', color: '#3B82F6' },
];
