import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  RefreshControl,
  ActivityIndicator,
  Share,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { Button, VibeChips } from '../../components/ui';
import { useTripStore, TripActivity, Activity } from '../../stores/tripStore';
import { usePromptStore } from '../../stores/promptStore';
import { useAuthContext } from '../../components/AuthProvider';
import { AuthGate } from '../../components/AuthGate';
import { RatingPrompt } from '../../components/RatingPrompt';
import { shareTrip, trackAffiliateClick } from '../../services/api';
import { colors, borderRadius, shadows } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';
import { useTrips } from '../../hooks/useTrips';

const HEADER_HEIGHT = 300;
