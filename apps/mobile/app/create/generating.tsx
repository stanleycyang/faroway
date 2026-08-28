import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTripStore } from '../../stores/tripStore';
import { usePromptStore } from '../../stores/promptStore';
import { useAuthContext } from '../../components/AuthProvider';
import { AuthGate } from '../../components/AuthGate';
import { popularDestinations } from '@faroway/constants';
import { colors } from '../../constants/theme';
import { useStreamingItinerary, StreamingBlock } from '../../hooks/useStreamingItinerary';
import { buildSeededItineraryOutline } from '../../lib/itineraryPreview';
import { GENERATION_STEPS, convertStreamingDataToTrip } from './_generatingShared';
import { styles } from './_generatingStyles';
import {
  JsonRenderRenderer,
  PulsingDot,
  ProgressRing,
  SkeletonLoader,
} from './_generatingProgress';
import {
  HotelPreviewCard,
  StepIndicator,
  FunFactCard,
  CelebrationOverlay,
  SeededOutlineCard,
} from './_generatingCards';

export default function GeneratingScreen() {
  const router = useRouter();
  const { draftInput, finishGeneration } = useTripStore();
  const { isAuthenticated } = useAuthContext();
  const { incrementTripGeneration, hasDismissedSignUpAfterGeneration, dismissSignUpPrompt } =
    usePromptStore();
  const [showCelebration, setShowCelebration] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authGateTrigger, setAuthGateTrigger] = useState<'save' | 'generate'>('save');
  const [retryTripId, setRetryTripId] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const destinationInfo = popularDestinations.find((d) => d.name === draftInput?.destination);
  const seededOutline = useMemo(() => buildSeededItineraryOutline(draftInput), [draftInput]);

  useEffect(() => {
    if (!draftInput) router.replace('/create');
  }, [draftInput, router]);

  const handleComplete = useCallback(
    (_document: StreamingBlock[]) => {
      incrementTripGeneration();
      setShowCelebration(true);
    },
    [incrementTripGeneration]
  );

  const handleError = useCallback((_error: Error) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  const streamingInput = useMemo(
    () =>
      draftInput
        ? {
            destination: draftInput.destination,
            startDate: draftInput.startDate,
            endDate: draftInput.endDate,
            travelers: draftInput.travelers || 2,
            travelerType: draftInput.travelerType || 'couple',
            originCity: draftInput.originCity,
            originAirport: draftInput.originAirport,
            vibes: draftInput.vibes || [],
            budget: draftInput.budget,
          }
        : undefined,
    [draftInput]
  );

  const streaming = useStreamingItinerary(
    retryTripId
      ? {
          tripId: retryTripId,
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
    if (streaming.tripId) setRetryTripId(streaming.tripId);
    setRetryNonce((value) => value + 1);
  }, [streaming.tripId]);

  useEffect(() => {
    if (streaming.errorKind === 'incomplete') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [streaming.errorKind]);

  useEffect(() => {
    if (streaming.errorKind === 'unauthorized') {
      setAuthGateTrigger('generate');
      setShowAuthGate(true);
    }
  }, [streaming.errorKind]);

  const handleViewTrip = useCallback(() => {
    if (!draftInput || !streaming.tripId) return;
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
  }, [draftInput, streaming.tripId, streaming.days, streaming.topHotel, finishGeneration, router]);

  const searchProgress = streaming.searchProgress || {};
  const showProgressiveBlocks = streaming.blocks.length > 0;
  const handleNewContent = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);
  const getMicroMessage = (step: string) => {
    if (streaming.microProgress?.stage === step) return streaming.microProgress.message;
    return undefined;
  };
  const counts = useMemo(
    () => ({
      hotels: streaming.hotelsCount,
      activities: streaming.activitiesCount,
      dining: streaming.diningCount,
      transport: streaming.transportCount,
    }),
    [
      streaming.hotelsCount,
      streaming.activitiesCount,
      streaming.diningCount,
      streaming.transportCount,
    ]
  );
  const isIncompleteError = streaming.errorKind === 'incomplete';
  const isUnauthorizedError = streaming.errorKind === 'unauthorized';

  return (
    <View style={styles.container}>
      {destinationInfo && (
        <Image source={{ uri: destinationInfo.image }} style={styles.bgImage} blurRadius={25} />
      )}
      <LinearGradient colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']} style={styles.overlay} />
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.headerLabel}>Creating your trip to</Text>
            <Text style={styles.headerDestination}>{draftInput?.destination}</Text>
            <View style={styles.headerMeta}>
              <Text style={styles.headerMetaText}>
                {draftInput?.startDate &&
                  new Date(draftInput.startDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                -{' '}
                {draftInput?.endDate &&
                  new Date(draftInput.endDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
              </Text>
              <Text style={styles.headerMetaDot}>•</Text>
              <Text style={styles.headerMetaText}>{draftInput?.travelers || 2} travelers</Text>
            </View>
          </View>

          {!streaming.isComplete && !showProgressiveBlocks && (
            <View style={styles.progressArea}>
              <ProgressRing progress={streaming.progress} />
              <Text style={styles.currentMessage}>{streaming.message}</Text>
              {seededOutline && <SeededOutlineCard outline={seededOutline} />}
              <View style={styles.stepsContainer}>
                {GENERATION_STEPS.map((step) => {
                  const status =
                    (searchProgress[step.key] as 'pending' | 'searching' | 'done') || 'pending';
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
              {streaming.topHotel && <HotelPreviewCard hotel={streaming.topHotel} />}
              <FunFactCard destination={draftInput?.destination || 'default'} />
            </View>
          )}

          {streaming.error && !isUnauthorizedError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorEmoji}>{isIncompleteError ? '⏳' : '😔'}</Text>
              <Text style={styles.errorTitle}>
                {isIncompleteError ? 'Still planning your trip' : 'Something went wrong'}
              </Text>
              <Text style={styles.errorMessage}>{streaming.error}</Text>
              <View style={styles.errorActions}>
                <TouchableOpacity
                  style={[styles.errorButton, styles.errorButtonPrimary]}
                  onPress={handleReconnect}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isIncompleteError || streaming.tripId
                      ? 'Reconnect to trip generation'
                      : 'Try trip generation again'
                  }
                >
                  <Text style={styles.errorButtonText}>
                    {isIncompleteError || streaming.tripId ? 'Reconnect' : 'Try Again'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.errorButton}
                  onPress={() => router.back()}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to trip setup"
                >
                  <Text style={styles.errorButtonText}>Go Back</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {showProgressiveBlocks && (
            <View style={styles.blocksContainer}>
              {!streaming.isComplete && streaming.isStreaming && (
                <View style={styles.streamingBanner}>
                  <PulsingDot />
                  <Text style={styles.streamingText}>{streaming.message}</Text>
                </View>
              )}
              <JsonRenderRenderer blocks={streaming.blocks} onNewContent={handleNewContent} />
            </View>
          )}

          {!streaming.error && !showProgressiveBlocks && streaming.progress > 60 && (
            <SkeletonLoader />
          )}

          {streaming.isComplete && streaming.tripId && !showCelebration && (
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
          )}
        </SafeAreaView>
      </ScrollView>

      {showCelebration && (
        <CelebrationOverlay
          onComplete={() => {
            setShowCelebration(false);
            if (!isAuthenticated && !hasDismissedSignUpAfterGeneration) {
              setAuthGateTrigger('save');
              setShowAuthGate(true);
            }
          }}
        />
      )}

      <AuthGate
        visible={showAuthGate}
        trigger={authGateTrigger}
        tripPreview={
          draftInput?.destination && destinationInfo
            ? { destination: draftInput.destination, coverImage: destinationInfo.image }
            : undefined
        }
        onAuthenticated={() => {
          setShowAuthGate(false);
          if (authGateTrigger === 'generate') handleReconnect();
        }}
        onDismiss={() => {
          dismissSignUpPrompt();
          if (authGateTrigger === 'generate') router.back();
        }}
        onClose={() => setShowAuthGate(false)}
      />
    </View>
  );
}
