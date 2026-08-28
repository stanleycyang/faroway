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
  { key: 'orchestrator', text: 'Planning', emoji: '\ud83d\udd0d', color: '#8B5CF6' },
  { key: 'hotels', text: 'Hotels', emoji: '\ud83c\udfe8', color: '#F59E0B' },
  { key: 'activities', text: 'Activities', emoji: '\u2728', color: '#10B981' },
  { key: 'dining', text: 'Dining', emoji: '\ud83c\udf7d\ufe0f', color: '#EF4444' },
  { key: 'transport', text: 'Transport', emoji: '\u2708\ufe0f', color: '#06B6D4' },
  { key: 'budget', text: 'Budget', emoji: '\ud83d\udcb3', color: '#14B8A6' },
  { key: 'enrichment', text: 'Local tips', emoji: '\ud83d\udca1', color: '#84CC16' },
  { key: 'aggregator', text: 'Itinerary', emoji: '\ud83d\udcdd', color: '#3B82F6' },
];

const DESTINATION_FACTS: Record<string, string[]> = {
  Paris: [
    "The Eiffel Tower was meant to be temporary, built for the 1889 World's Fair.",
    'Paris has 470+ parks and gardens covering 3,000+ acres.',
    'The Louvre would take 100 days to see every artwork for 30 seconds each.',
    'There are more dogs than children in Paris.',
  ],
  Tokyo: [
    'Tokyo has more Michelin-starred restaurants than any other city.',
    'The Shibuya Crossing sees 3,000 people cross at once during rush hour.',
    'Tokyo was called Edo until 1868 when it became the capital.',
    'Vending machines in Tokyo sell everything from eggs to umbrellas.',
  ],
  Rome: [
    'Rome has more fountains than any other city in the world.',
    "The Pantheon has the world's largest unreinforced concrete dome.",
    'Trevi Fountain collects \u20ac1.5 million in coins annually.',
    'Cats have legal protection at Roman archaeological sites.',
  ],
  London: [
    'Big Ben is actually the name of the bell, not the tower.',
    'London has 170 museums, many of which are free.',
    "The Underground is the world's oldest metro system.",
    'There are over 300 languages spoken in London.',
  ],
  'New York': [
    'The NYC subway runs 24/7, 365 days a year.',
    'Central Park is larger than Monaco.',
    'Times Square was originally called Longacre Square.',
    'The Statue of Liberty was a gift from France in 1886.',
  ],
  default: [
    'Your personalized itinerary includes local hidden gems.',
    'Our AI considers weather, crowds, and local events.',
    'We match activities to your unique travel style.',
    'Every recommendation is curated for your preferences.',
  ],
};
