import { Ionicons } from '@expo/vector-icons';
import { TravelImage } from '../../components/ui/TravelImage';
import {
  travelerRequirementsSchema,
  readTravelerRequirements,
} from '../../lib/travelerRequirements';
import { destinationImage } from '../../lib/destinationImage';
import { getMissingTripRequirements } from '../../lib/tripRequirements';
import { formatTripDate } from '../../lib/tripDate';
import { transformItineraryDays, transformApiHotel } from '../../lib/itineraryNormalization';
import { GenerationHotelFacts } from '../../components/GenerationHotelFacts';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTripStore, Trip, TripInput } from '../../stores/tripStore';
import { useUserStore } from '../../stores/userStore';
import { usePromptStore } from '../../stores/promptStore';
import { useAuthContext } from '../../components/AuthProvider';
import { popularDestinations } from '@faroway/constants';
import { colors } from '../../constants/theme';
import {
  useStreamingItinerary,
  StreamingBlock,
  type AgentDiscovery,
} from '../../hooks/useStreamingItinerary';
import {
  buildSeededItineraryOutline,
  type SeededItineraryOutline,
} from '../../lib/itineraryPreview';
import { validatePreviewBlocks } from '../../lib/json-render/validate-preview';
import { registry, StreamingTripContext } from '../../lib/json-render/registry';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { USE_NATIVE_DRIVER } from '../../lib/animation';

const { width, height } = Dimensions.get('window');

const GENERATION_STEPS = [
  { key: 'orchestrator', text: 'Your preferences', icon: 'options-outline' },
  { key: 'hotels', text: 'Places to stay', icon: 'bed-outline' },
  { key: 'activities', text: 'Things to do', icon: 'compass-outline' },
  { key: 'dining', text: 'Places to eat', icon: 'restaurant-outline' },
  { key: 'transport', text: 'Getting around', icon: 'train-outline' },
  { key: 'budget', text: 'Your budget', icon: 'wallet-outline' },
  { key: 'enrichment', text: 'Useful details', icon: 'information-circle-outline' },
  { key: 'aggregator', text: 'Your day-by-day plan', icon: 'map-outline' },
] as const;

const PLANNING_TIPS = [
  'Check opening hours and ticket availability before you book.',
  'Leave time between stops for travel, meals, and rest.',
  'Confirm dietary and accessibility needs directly with each venue.',
  'Review the plan’s source notes and any unfilled parts before you travel.',
];

function convertStreamingDataToTrip(
  tripId: string,
  itineraryDays: unknown[],
  topHotel: Record<string, unknown> | null,
  input: TripInput
): Trip {
  const destinationInfo = popularDestinations.find((d) => d.name === input.destination);
  const hotel = transformApiHotel(topHotel);
  return {
    id: tripId,
    destination: input.destination,
    country: input.country || destinationInfo?.country || '',
    startDate: input.startDate,
    endDate: input.endDate,
    travelers: input.travelers || 2,
    travelerType: input.travelerType,
    originCity: input.originCity,
    originAirport: input.originAirport,
    requirements: readTravelerRequirements(input.requirements),
    vibes: input.vibes || [],
    budget: input.budget,
    days: transformItineraryDays(itineraryDays),
    hotel,
    coverImage: destinationImage(
      input.country ? `${input.destination}, ${input.country}` : input.destination
    ),
    createdAt: new Date().toISOString(),
    status: 'planned',
  };
}

function JsonRenderRenderer({
  blocks,
  tripId,
}: {
  blocks: StreamingBlock[];
  tripId?: string | null;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();
  const prevLengthRef = useRef(0);

  useEffect(() => {
    if (blocks.length > prevLengthRef.current) {
      const animation = Animated.timing(fadeAnim, {
        toValue: 1,
        duration: reduceMotion ? 150 : 300,
        useNativeDriver: USE_NATIVE_DRIVER,
      });
      animation.start();
      prevLengthRef.current = blocks.length;
      return () => animation.stop();
    }
  }, [blocks.length, fadeAnim, reduceMotion]);

  if (blocks.length === 0) return null;

  const content = (
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

  if (StreamingTripContext) {
    return (
      <StreamingTripContext.Provider value={tripId ?? undefined}>
        {content}
      </StreamingTripContext.Provider>
    );
  }

  return content;
}

// Pulsing dot for streaming indicator
function PulsingDot() {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim, reduceMotion]);

  return <Animated.View style={[styles.streamingDot, { opacity: pulseAnim }]} />;
}

// Hotel preview card shown when hotel data arrives
function HotelPreviewCard({ hotel }: { hotel: Record<string, unknown> }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduceMotion) {
      fadeAnim.setValue(1);
      scaleAnim.setValue(1);
      return;
    }

    const animation = Animated.parallel([
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
        friction: 8,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [fadeAnim, reduceMotion, scaleAnim]);

  return (
    <Animated.View
      style={[styles.hotelPreview, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
    >
      <View style={styles.hotelPreviewHeader}>
        <Text style={styles.hotelPreviewLabel}>A place to stay</Text>
      </View>
      <View style={styles.hotelPreviewContent}>
        <GenerationHotelFacts hotel={hotel} styles={styles} />
      </View>
    </Animated.View>
  );
}

// These states come from the server, never an elapsed-time estimate.
function StepIndicator({
  step,
  status,
  count,
  microMessage,
  surface = 'dark',
}: {
  step: (typeof GENERATION_STEPS)[number];
  status: 'pending' | 'searching' | 'done' | 'failed';
  count?: number;
  microMessage?: string;
  surface?: 'dark' | 'light';
}) {
  const isLight = surface === 'light';
  const iconColor = isLight ? '#0f172a' : '#fff';
  const spinnerColor = isLight ? colors.primary[600] : '#fff';
  return (
    <View style={[styles.stepRow, isLight && styles.stepRowLight]}>
      <Ionicons name={step.icon} size={22} color={iconColor} />
      <View style={styles.stepContent}>
        <Text style={[styles.stepText, isLight && styles.stepTextLight]}>{step.text}</Text>
        {status === 'searching' && microMessage ? (
          <Text style={[styles.stepMicro, isLight && styles.stepMicroLight]}>{microMessage}</Text>
        ) : null}
        {status === 'done' && count !== undefined && (
          <Text style={[styles.stepMicro, isLight && styles.stepMicroLight]}>
            {count > 0 ? `${count} options to review` : 'No options found'}
          </Text>
        )}
        {status === 'failed' ? (
          <Text style={[styles.stepMicro, isLight && styles.stepMicroLight]}>
            Did not finish. Nothing from this search is ready.
          </Text>
        ) : null}
      </View>
      {status === 'searching' ? (
        <ActivityIndicator color={spinnerColor} accessibilityLabel={`${step.text}: in progress`} />
      ) : (
        <Text style={[styles.stepMicro, isLight && styles.stepMicroLight]}>
          {status === 'done' ? 'Checked' : status === 'failed' ? 'Not ready' : 'Next'}
        </Text>
      )}
    </View>
  );
}

// Cycling planning guidance
function PlanningTipCard() {
  const [factIndex, setFactIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const facts = PLANNING_TIPS;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) return;

    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    const interval = setInterval(() => {
      animation = Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: USE_NATIVE_DRIVER,
      });
      animation.start(({ finished }) => {
        if (!active || !finished) return;
        setFactIndex((prev) => (prev + 1) % facts.length);
        animation = Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: USE_NATIVE_DRIVER,
        });
        animation.start();
      });
    }, 4000);
    return () => {
      active = false;
      clearInterval(interval);
      animation?.stop();
      fadeAnim.setValue(1);
    };
  }, [facts.length, fadeAnim, reduceMotion]);

  return (
    <View style={styles.funFact}>
      <Text style={styles.funFactLabel}>Planning tip</Text>
      <Animated.Text style={[styles.funFactText, { opacity: fadeAnim }]}>
        {facts[factIndex]}
      </Animated.Text>
    </View>
  );
}

function SeededOutlineCard({ outline }: { outline: SeededItineraryOutline }) {
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

function discoveryIconName(
  agent: AgentDiscovery['agent']
): React.ComponentProps<typeof Ionicons>['name'] {
  switch (agent) {
    case 'hotels':
      return 'bed-outline';
    case 'activities':
      return 'compass-outline';
    case 'dining':
      return 'restaurant-outline';
    case 'transport':
      return 'train-outline';
    case 'enrichment':
      return 'information-circle-outline';
    case 'aggregator':
      return 'map-outline';
    default:
      return 'sparkles-outline';
  }
}

function LiveDiscoveryTicker({
  discoveries,
  surface = 'dark',
}: {
  discoveries: AgentDiscovery[];
  surface?: 'dark' | 'light';
}) {
  if (discoveries.length === 0) return null;
  const isLight = surface === 'light';
  const visible = discoveries.slice(-5).reverse();

  return (
    <View
      style={[styles.discoveryBox, isLight && styles.discoveryBoxLight]}
      accessibilityLiveRegion="polite"
      accessibilityLabel="Live planning finds"
    >
      <Text style={[styles.discoveryKicker, isLight && styles.discoveryKickerLight]}>
        Live scout feed
      </Text>
      {visible.map((item) => (
        <View key={item.id} style={[styles.discoveryRow, isLight && styles.discoveryRowLight]}>
          <Ionicons
            name={discoveryIconName(item.agent)}
            size={18}
            color={isLight ? '#0F766E' : '#99F6E4'}
          />
          <View style={styles.discoveryCopy}>
            <Text style={[styles.discoveryHeadline, isLight && styles.discoveryHeadlineLight]}>
              {item.headline}
            </Text>
            {item.detail ? (
              <Text style={[styles.discoveryDetail, isLight && styles.discoveryDetailLight]}>
                {item.detail}
              </Text>
            ) : null}
          </View>
          {item.badge ? (
            <View style={[styles.discoveryBadge, isLight && styles.discoveryBadgeLight]}>
              <Text style={[styles.discoveryBadgeText, isLight && styles.discoveryBadgeTextLight]}>
                {item.badge}
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function DayOnePreviewPanel({
  rawDay,
  expanded,
  onToggle,
  surface = 'dark',
}: {
  rawDay: unknown;
  expanded: boolean;
  onToggle: () => void;
  surface?: 'dark' | 'light';
}) {
  const day = useMemo(() => transformItineraryDays([rawDay])[0], [rawDay]);
  if (!day) return null;
  const isLight = surface === 'light';

  return (
    <View style={[styles.dayOneCard, isLight && styles.dayOneCardLight]}>
      <TouchableOpacity
        style={[styles.dayOneButton, isLight && styles.dayOneButtonLight]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? 'Hide Day 1 preview' : 'Day 1 ready — preview now'}
      >
        <View style={styles.dayOneButtonCopy}>
          <Text style={[styles.dayOneKicker, isLight && styles.dayOneKickerLight]}>
            Day 1 ready — preview now
          </Text>
          <Text style={[styles.dayOneTheme, isLight && styles.dayOneThemeLight]} numberOfLines={1}>
            {day.theme}
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={isLight ? '#0f172a' : '#ffffff'}
        />
      </TouchableOpacity>

      {expanded ? (
        <View style={[styles.dayOneStops, isLight && styles.dayOneStopsLight]}>
          {day.activities.length > 0 ? (
            day.activities.slice(0, 6).map((stop) => (
              <View key={stop.id} style={styles.dayOneStopRow}>
                <Text style={[styles.dayOneStopTime, isLight && styles.dayOneStopTimeLight]}>
                  {stop.scheduleSlot || stop.time || 'Stop'}
                </Text>
                <View style={styles.dayOneStopCopy}>
                  <Text style={[styles.dayOneStopTitle, isLight && styles.dayOneStopTitleLight]}>
                    {stop.title}
                  </Text>
                  {stop.location ? (
                    <Text
                      style={[styles.dayOneStopLocation, isLight && styles.dayOneStopLocationLight]}
                    >
                      {stop.location}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.dayOneStopLocation, isLight && styles.dayOneStopLocationLight]}>
              Day 1 outline is ready — stops are being finalized while remaining days load.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function GeneratingScreen() {
  const owner = useUserStore((state) => state.user?.id);
  const revision = useUserStore((state) => state.accountRevision);
  return <GenerationSession key={`${owner ?? 'guest'}:${revision}`} />;
}

function GenerationSession() {
  const router = useRouter();
  const { draftInput, finishGeneration } = useTripStore();
  const { initialized, isAuthenticated } = useAuthContext();
  const { incrementTripGeneration } = usePromptStore();
  const openingTrip = useRef(false);
  const mounted = useRef(false);
  const [account] = useState(() => {
    const state = useUserStore.getState();
    return { owner: state.user?.id, revision: state.accountRevision };
  });
  const isActive = useCallback(() => {
    const current = useUserStore.getState();
    return (
      mounted.current &&
      current.user?.id === account.owner &&
      current.accountRevision === account.revision
    );
  }, [account]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [showDetails, setShowDetails] = useState(false);
  const [showDayOnePreview, setShowDayOnePreview] = useState(false);
  const [retryTripId, setRetryTripId] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [restartUnstarted, setRestartUnstarted] = useState(false);
  const savedProfileBudget = useUserStore((state) => state.user?.preferences?.budget);

  const destinationInfo = popularDestinations.find((d) => d.name === draftInput?.destination);
  const reduceMotion = useReduceMotion();
  const seededOutline = useMemo(() => buildSeededItineraryOutline(draftInput), [draftInput]);
  const isDraftComplete =
    getMissingTripRequirements(draftInput).length === 0 &&
    travelerRequirementsSchema.nullish().safeParse(draftInput?.requirements).success;
  const canGenerate = initialized && isAuthenticated && isDraftComplete;

  useEffect(() => {
    if (initialized && !canGenerate && !openingTrip.current) {
      router.replace('/create');
    }
  }, [canGenerate, initialized, router]);

  const handleComplete = useCallback(
    (_document: StreamingBlock[]) => {
      if (!isActive()) return;
      incrementTripGeneration();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [incrementTripGeneration, isActive]
  );

  const handleError = useCallback(
    (_error: Error) => {
      if (!isActive()) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    [isActive]
  );

  const streamingInput = useMemo(
    () =>
      canGenerate && draftInput
        ? {
            destination: draftInput.destination,
            startDate: draftInput.startDate,
            endDate: draftInput.endDate,
            travelers: draftInput.travelers || 2,
            travelerType: draftInput.travelerType || 'couple',
            originCity: draftInput.originCity,
            originAirport: draftInput.originAirport,
            flightConsent: draftInput.flightConsent,
            requirements: readTravelerRequirements(draftInput.requirements) ?? undefined,
            vibes: draftInput.vibes || [],
            budget: draftInput.budget ?? savedProfileBudget,
          }
        : undefined,
    [canGenerate, draftInput, savedProfileBudget]
  );

  const streaming = useStreamingItinerary(
    retryTripId
      ? {
          tripId: retryTripId,
          restartUnstarted,
          retryKey: retryNonce,
          onComplete: handleComplete,
          onError: handleError,
        }
      : streamingInput
        ? {
            input: streamingInput,
            retryKey: retryNonce,
            onComplete: handleComplete,
            onError: handleError,
          }
        : { retryKey: retryNonce, onComplete: handleComplete, onError: handleError }
  );

  const handleReconnect = useCallback(() => {
    if (!isActive()) return;
    setRestartUnstarted(streaming.canStart);
    if (streaming.tripId) {
      setRetryTripId(streaming.tripId);
    }
    setRetryNonce((value) => value + 1);
  }, [streaming.tripId, streaming.canStart, isActive]);

  const handleViewTrip = useCallback(() => {
    if (!isActive() || !draftInput || !streaming.tripId || openingTrip.current) return;
    openingTrip.current = true;

    if (streaming.days && streaming.days.length > 0) {
      const trip = convertStreamingDataToTrip(
        streaming.tripId,
        streaming.days,
        streaming.topHotel,
        draftInput
      );
      finishGeneration(trip);
      router.replace(`/trip/${trip.id}`);
    } else {
      router.replace(`/trip/${streaming.tripId}`);
    }
  }, [
    draftInput,
    streaming.tripId,
    streaming.days,
    streaming.topHotel,
    finishGeneration,
    router,
    isActive,
  ]);

  const searchProgress = streaming.searchProgress || {};
  const discoveries = streaming.discoveries ?? [];
  const firstStreamedDay =
    !streaming.isComplete && Array.isArray(streaming.days) && streaming.days.length > 0
      ? streaming.days[0]
      : null;
  const preview = useMemo(() => validatePreviewBlocks(streaming.blocks), [streaming.blocks]);
  const showProgressiveBlocks = preview.blocks.length > 0;

  // Get micro-message for each step
  const getMicroMessage = (step: string) => {
    if (streaming.microProgress?.stage === step) {
      return streaming.microProgress.message;
    }
    return undefined;
  };

  const counts = {
    hotels: streaming.hotelsCount,
    activities: streaming.activitiesCount,
    dining: streaming.diningCount,
    transport: streaming.transportCount,
  };

  if (!canGenerate) {
    return (
      <View
        style={styles.loadingGuard}
        accessibilityRole="progressbar"
        accessibilityLabel={initialized ? 'Returning to trip setup' : 'Checking your account'}
      >
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingGuardText}>
          {initialized ? 'Returning to trip setup…' : 'Checking your account…'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {destinationInfo && !reduceMotion ? (
        <TravelImage
          source={{
            uri: destinationInfo.image.replace(/([?&])w=\d+/, '$1w=640'),
          }}
          style={styles.bgImage}
          accessible={false}
        />
      ) : null}
      <LinearGradient colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']} style={styles.overlay} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerDestination} accessibilityRole="header">
              {streaming.isComplete
                ? draftInput?.destination
                : `Planning ${draftInput?.destination}`}
            </Text>
            <View style={styles.headerMeta}>
              <Text style={styles.headerMetaText}>
                {draftInput?.startDate &&
                  formatTripDate(draftInput.startDate, {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                -{' '}
                {draftInput?.endDate &&
                  formatTripDate(draftInput.endDate, {
                    month: 'short',
                    day: 'numeric',
                  })}
              </Text>
              <Text style={styles.headerMetaDot}>•</Text>
              <Text style={styles.headerMetaText}>{draftInput?.travelers || 2} travelers</Text>
            </View>
          </View>

          {/* Main progress area */}
          {!streaming.isComplete && !streaming.error && !showProgressiveBlocks && (
            <View style={styles.progressArea}>
              <ActivityIndicator size="large" color="#fff" />

              <Text style={styles.currentMessage} accessibilityLiveRegion="polite">
                {streaming.message || 'Finding options for your trip…'}
              </Text>
              <Text style={styles.waitingNote}>
                We’ll build your days as results arrive. You can review everything before booking.
              </Text>

              {/* Step indicators */}
              <View style={styles.stepsContainer}>
                {GENERATION_STEPS.filter(
                  (step) => showDetails || searchProgress[step.key] === 'searching'
                ).map((step) => {
                  const reported = searchProgress[step.key];
                  const status =
                    reported === 'failed' || reported === 'error'
                      ? 'failed'
                      : reported === 'done' || reported === 'searching'
                        ? reported
                        : 'pending';
                  const count =
                    step.key === 'hotels'
                      ? counts.hotels
                      : step.key === 'activities'
                        ? counts.activities
                        : step.key === 'dining'
                          ? counts.dining
                          : step.key === 'transport'
                            ? counts.transport
                            : undefined;
                  return (
                    <StepIndicator
                      key={step.key}
                      step={step}
                      status={status}
                      count={status === 'done' ? count : undefined}
                      microMessage={getMicroMessage(step.key)}
                    />
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.detailsButton}
                onPress={() => setShowDetails((value) => !value)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showDetails }}
              >
                <Text style={styles.detailsButtonText}>
                  {showDetails ? 'Hide planning details' : 'Show planning details'}
                </Text>
              </TouchableOpacity>
              {showDetails && seededOutline && <SeededOutlineCard outline={seededOutline} />}

              {/* Live Agent Discovery Ticker */}
              {discoveries.length > 0 ? (
                <LiveDiscoveryTicker discoveries={discoveries} surface="dark" />
              ) : null}

              {/* Day 1 Progressive Preview (placed after details toggle to preserve disclosure order) */}
              {firstStreamedDay ? (
                <DayOnePreviewPanel
                  rawDay={firstStreamedDay}
                  expanded={showDayOnePreview}
                  onToggle={() => setShowDayOnePreview((v) => !v)}
                  surface="dark"
                />
              ) : null}

              {/* Hotel preview */}
              {streaming.topHotel && <HotelPreviewCard hotel={streaming.topHotel} />}

              {/* Planning guidance */}
              <PlanningTipCard />
            </View>
          )}

          {/* Error state */}
          {streaming.error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>
                {streaming.tripId ? 'Your trip is saved' : 'Planning interrupted'}
              </Text>
              <Text style={styles.errorMessage}>{streaming.error}</Text>
              <View style={styles.errorActions}>
                <TouchableOpacity
                  style={[styles.errorButton, styles.errorButtonPrimary]}
                  onPress={handleReconnect}
                  accessibilityRole="button"
                  accessibilityLabel={
                    streaming.canStart
                      ? 'Review AI sharing and start planning'
                      : streaming.tripId
                        ? 'Reconnect to trip generation'
                        : 'Try trip generation again'
                  }
                >
                  <Text style={styles.errorButtonText}>
                    {streaming.canStart
                      ? 'Review and start'
                      : streaming.tripId
                        ? 'Reconnect'
                        : 'Try Again'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.errorButton}
                  onPress={() => router.dismissTo('/create')}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to trip setup"
                >
                  <Text style={styles.errorButtonText}>Go Back</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {preview.rejected > 0 && (
            <View
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 12,
                backgroundColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <Text accessibilityLiveRegion="polite" style={{ color: '#fff', fontSize: 14 }}>
                Some preview details couldn’t be shown.
              </Text>
            </View>
          )}

          {/* Progressive blocks */}
          {showProgressiveBlocks && (
            <View style={styles.blocksContainer}>
              {!streaming.isComplete && (
                <View style={styles.streamingBanner} accessibilityLiveRegion="polite">
                  {streaming.error ? null : <PulsingDot />}
                  <Text style={styles.streamingText}>
                    {streaming.error || streaming.message || 'Still collecting results'}
                  </Text>
                </View>
              )}
              {!streaming.isComplete && discoveries.length > 0 ? (
                <LiveDiscoveryTicker discoveries={discoveries} surface="light" />
              ) : null}
              {firstStreamedDay &&
              !preview.blocks.some((block) => block.type === 'ItineraryDay') ? (
                <DayOnePreviewPanel
                  rawDay={firstStreamedDay}
                  expanded={showDayOnePreview}
                  onToggle={() => setShowDayOnePreview((v) => !v)}
                  surface="light"
                />
              ) : null}
              <View accessibilityLabel="Planning stages">
                {GENERATION_STEPS.map((step) => {
                  const reported = searchProgress[step.key];
                  const status =
                    reported === 'failed' || reported === 'error'
                      ? 'failed'
                      : reported === 'done' || reported === 'searching'
                        ? reported
                        : 'pending';
                  return (
                    <StepIndicator key={step.key} step={step} status={status} surface="light" />
                  );
                })}
              </View>
              <JsonRenderRenderer blocks={preview.blocks} tripId={streaming.tripId} />
            </View>
          )}
        </SafeAreaView>
      </ScrollView>

      {/* Keep the completion action reachable regardless of itinerary length. */}
      {streaming.isComplete && streaming.tripId && (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.completionFooter}>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={handleViewTrip}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="View your generated trip"
          >
            <LinearGradient
              colors={[colors.primary[500], colors.primary[700]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.viewButtonGradient}
            >
              <Text style={styles.viewButtonText}>View Your Trip</Text>
              <Text style={styles.viewButtonArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingGuard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
  },
  loadingGuardText: {
    marginTop: 14,
    fontSize: 15,
    color: colors.neutral[400],
  },
  container: { flex: 1, backgroundColor: '#143D46' },
  bgImage: { position: 'absolute', width, height, resizeMode: 'cover' },
  overlay: { position: 'absolute', width, height },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  safeArea: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 16 },
  detailsButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  detailsButtonText: { fontSize: 15, color: '#fff', textDecorationLine: 'underline' },
  completionFooter: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },

  // Header
  header: { alignItems: 'center', marginBottom: 24 },
  headerDestination: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    width: '100%',
  },
  headerMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  headerMetaText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  headerMetaDot: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginHorizontal: 8 },

  // Progress area
  progressArea: { alignItems: 'center' },
  waitingNote: {
    fontSize: 15,
    lineHeight: 22,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  currentMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    fontWeight: '600',
  },

  // Steps
  stepsContainer: { width: '100%', marginBottom: 20 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  stepRowLight: {
    borderBottomColor: '#e2e8f0',
  },
  stepContent: { flex: 1 },
  stepText: { fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  stepTextLight: { color: '#0f172a' },
  stepMicro: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  stepMicroLight: { color: '#475569' },
  // Hotel preview
  hotelPreview: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  hotelPreviewHeader: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  hotelPreviewLabel: { fontSize: 13, color: '#F59E0B', fontWeight: '700' },
  hotelPreviewContent: { padding: 16 },
  hotelPreviewInfo: {},
  hotelPreviewName: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 6 },
  hotelPreviewRating: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  hotelPreviewStars: { fontSize: 14, color: '#F59E0B', marginRight: 8 },
  hotelPreviewScore: {
    fontSize: 14,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '600',
  },
  hotelPreviewPrice: { fontSize: 22, fontWeight: '800', color: colors.primary[400] },
  hotelPreviewPriceUnit: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },

  // Fun fact
  funFact: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  funFactLabel: { fontSize: 12, color: colors.primary[400], fontWeight: '700', marginBottom: 6 },
  funFactText: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },

  // Seeded outline
  seededOutline: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  seededOutlineHeader: {
    marginBottom: 12,
  },
  seededOutlineKicker: {
    fontSize: 12,
    color: colors.primary[300],
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  seededOutlineTitle: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '800',
  },
  seededMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  seededMetaPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  seededMetaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '700',
  },
  seededSection: {
    marginTop: 10,
  },
  seededSectionLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.58)',
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  seededChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  seededFocusChip: {
    backgroundColor: 'rgba(20,184,166,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  seededFocusText: {
    fontSize: 12,
    color: '#99F6E4',
    fontWeight: '700',
  },
  seededPlanningText: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },

  // Skeleton
  skeletonContainer: { padding: 20, marginTop: 20 },

  // Blocks container
  blocksContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    marginTop: 16,
    padding: 20,
    minHeight: 300,
  },
  streamingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  streamingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[500],
    marginRight: 10,
  },
  streamingText: { fontSize: 14, color: colors.primary[700], fontWeight: '500' },

  // Error
  errorBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 20,
    padding: 24,
    marginTop: 20,
  },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  errorMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorActions: {
    width: '100%',
    gap: 10,
  },
  errorButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  errorButtonPrimary: {
    backgroundColor: colors.primary[600],
  },
  errorButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  // View button
  viewButton: { borderRadius: 16, overflow: 'hidden' },
  viewButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  viewButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  viewButtonArrow: { color: '#fff', fontSize: 20, marginLeft: 8 },

  // Live Discovery Ticker (dark and light surfaces)
  discoveryBox: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  discoveryBoxLight: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
  },
  discoveryKicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#99F6E4',
  },
  discoveryKickerLight: {
    color: '#0F766E',
  },
  discoveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.16)',
  },
  discoveryRowLight: {
    borderTopColor: '#e2e8f0',
  },
  discoveryCopy: {
    flex: 1,
    gap: 2,
  },
  discoveryHeadline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  discoveryHeadlineLight: {
    color: '#0f172a',
  },
  discoveryDetail: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  discoveryDetailLight: {
    color: '#475569',
  },
  discoveryBadge: {
    backgroundColor: 'rgba(20,184,166,0.22)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discoveryBadgeLight: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  discoveryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#99F6E4',
  },
  discoveryBadgeTextLight: {
    color: '#0F766E',
  },

  // Day 1 Progressive Preview
  dayOneCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: 'rgba(20,184,166,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(153,246,228,0.4)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  dayOneCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#99F6E4',
  },
  dayOneButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  dayOneButtonLight: {
    backgroundColor: '#F0FDFA',
  },
  dayOneButtonCopy: {
    flex: 1,
    gap: 2,
  },
  dayOneKicker: {
    fontSize: 12,
    fontWeight: '800',
    color: '#99F6E4',
  },
  dayOneKickerLight: {
    color: '#0F766E',
  },
  dayOneTheme: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  dayOneThemeLight: {
    color: '#0f172a',
  },
  dayOneStops: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 8,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  dayOneStopsLight: {
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  dayOneStopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  dayOneStopTime: {
    width: 72,
    fontSize: 12,
    fontWeight: '700',
    color: '#99F6E4',
    textTransform: 'capitalize',
  },
  dayOneStopTimeLight: {
    color: '#0F766E',
  },
  dayOneStopCopy: {
    flex: 1,
    gap: 2,
  },
  dayOneStopTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  dayOneStopTitleLight: {
    color: '#0f172a',
  },
  dayOneStopLocation: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  dayOneStopLocationLight: {
    color: '#475569',
  },
});
