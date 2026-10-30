import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, PlacesAutocomplete, DateRangePicker, VibeSelector } from '../../components/ui';
import { useTripStore, type TripInput } from '../../stores/tripStore';
import { useUserStore } from '../../stores/userStore';
import { usePromptStore } from '../../stores/promptStore';
import { useAuthContext } from '../../components/AuthProvider';
import {
  formatMissingTripRequirements,
  getMissingTripRequirements,
} from '../../lib/tripRequirements';
import {
  discardReviewedTripCreation,
  readTripCreationReceipt,
  savedTripCreationDraft,
} from '../../lib/tripCreationRecovery';
import { useGuestTripBrief } from '../../hooks/useGuestTripBrief';
import { tripInputFromLink } from '../../lib/tripLinkInput';
import { AuthGate } from '../../components/AuthGate';
import { popularDestinations, travelerTypes } from '@faroway/constants';
import { colors, borderRadius, shadows } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

function getStaticMapUrl(destination: string, country: string): string | null {
  if (!GOOGLE_API_KEY) return null;
  const center = encodeURIComponent(`${destination}${country ? `, ${country}` : ''}`);
  return (
    `https://maps.googleapis.com/maps/api/staticmap?center=${center}` +
    `&zoom=11&size=600x300&scale=2&maptype=roadmap` +
    `&markers=color:0x6366f1|${center}` +
    `&style=feature:all|element:geometry|color:0x242f3e` +
    `&style=feature:all|element:labels.text.stroke|color:0x242f3e` +
    `&style=feature:all|element:labels.text.fill|color:0x746855` +
    `&style=feature:water|element:geometry|color:0x17263c` +
    `&style=feature:road|element:geometry|color:0x38414e` +
    `&style=feature:road|element:geometry.stroke|color:0x212a37` +
    `&style=feature:poi|element:geometry|color:0x283d6a` +
    `&key=${GOOGLE_API_KEY}`
  );
}

export default function CreateTripScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    destination?: string;
    country?: string;
    placeId?: string;
    vibes?: string;
    startDate?: string;
    endDate?: string;
    travelerType?: string;
    travelers?: string;
  }>();
  const { draftInput, setDraftInput } = useTripStore();
  const { isAuthenticated, user } = useAuthContext();
  const userId = user?.id;
  const accountRevision = useUserStore((state) => state.accountRevision);
  const recoveryScope = `${userId ?? 'guest'}:${accountRevision}`;
  const recoveryOwner = useRef<string | undefined>(recoveryScope);
  const discardLock = useRef(false);
  const [storedCreation, setStoredCreation] = useState<{
    scope: string;
    draft: Partial<TripInput>;
  } | null>(null);
  const savedCreation = storedCreation?.scope === recoveryScope ? storedCreation.draft : null;
  const setSavedCreation = useCallback(
    (draft: Partial<TripInput> | null) => {
      setStoredCreation(draft ? { scope: recoveryScope, draft } : null);
    },
    [recoveryScope]
  );
  const isRecoveryCurrent = useCallback(() => {
    const current = useUserStore.getState();
    return (
      recoveryOwner.current === recoveryScope &&
      current.user?.id === userId &&
      current.accountRevision === accountRevision
    );
  }, [recoveryScope, userId, accountRevision]);
  const [storedRecoveryError, setStoredRecoveryError] = useState<{
    scope: string;
    message: string;
  } | null>(null);
  const recoveryError =
    storedRecoveryError?.scope === recoveryScope ? storedRecoveryError.message : null;
  const setRecoveryError = useCallback(
    (message: string | null) => {
      setStoredRecoveryError(message ? { scope: recoveryScope, message } : null);
    },
    [recoveryScope]
  );
  useEffect(() => {
    let active = true;
    recoveryOwner.current = recoveryScope;
    setSavedCreation(null);
    setRecoveryError(null);
    if (userId)
      void savedTripCreationDraft(userId)
        .then((draft) => {
          if (active && isRecoveryCurrent()) setSavedCreation(draft);
        })
        .catch(() => {
          if (active && isRecoveryCurrent())
            setRecoveryError(
              'Your unfinished trip request could not be read. Check My Trips before starting a new trip.'
            );
        });
    return () => {
      active = false;
      recoveryOwner.current = undefined;
    };
  }, [userId, recoveryScope, isRecoveryCurrent, setSavedCreation, setRecoveryError]);
  const { tripGenerationCount, hasDismissedCreateBanner, dismissCreateBanner } = usePromptStore();

  const [showSearch, setShowSearch] = useState(!params.destination && !draftInput?.destination);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authGateAction, setAuthGateAction] = useState<'banner' | 'generate'>('generate');

  const showSignInBanner =
    !isAuthenticated && tripGenerationCount >= 1 && !hasDismissedCreateBanner;

  useEffect(() => {
    const updates = tripInputFromLink({
      destination: params.destination,
      country: params.country,
      placeId: params.placeId,
      vibes: params.vibes,
      startDate: params.startDate,
      endDate: params.endDate,
      travelerType: params.travelerType,
      travelers: params.travelers,
    });
    if (updates) setDraftInput(updates);
  }, [
    params.destination,
    params.country,
    params.placeId,
    params.vibes,
    params.startDate,
    params.endDate,
    params.travelerType,
    params.travelers,
    setDraftInput,
  ]);

  const guestBrief = useGuestTripBrief(tripInputFromLink(params));
  useEffect(() => {
    if (guestBrief.restored) setShowSearch(false);
  }, [guestBrief.restored]);

  const handleSelectDestination = (name: string, country: string, placeId?: string) => {
    hapticFeedback.selection();
    setMapLoadFailed(false);
    setDraftInput({ destination: name, country, placeId });
    setShowSearch(false);
  };

  const handleTravelerTypeSelect = (typeId: string) => {
    hapticFeedback.selection();
    setDraftInput({ travelerType: typeId });
  };

  const handleVibesSelect = (vibes: string[]) => {
    hapticFeedback.light();
    setDraftInput({ vibes });
  };

  const handleTravelersChange = (delta: number) => {
    const current = useTripStore.getState().draftInput?.travelers || 2;
    const newValue = Math.max(1, Math.min(10, current + delta));
    if (newValue !== current) {
      hapticFeedback.light();
      setDraftInput({ travelers: newValue });
    }
  };

  const missingRequirements = getMissingTripRequirements(draftInput);
  const canProceed = missingRequirements.length === 0;

  const handleContinue = () => {
    if (!canProceed) {
      hapticFeedback.error();
      return;
    }
    // Generation is auth-required end-to-end. Open the sheet first so the
    // user signs in before we POST /api/trips (which would otherwise 401).
    if (!isAuthenticated) {
      hapticFeedback.light();
      setAuthGateAction('generate');
      setShowAuthGate(true);
      return;
    }
    hapticFeedback.success();
    router.push('/create/generating');
  };

  const handleAuthenticated = () => {
    setShowAuthGate(false);
    if (authGateAction === 'generate' && canProceed) {
      router.push('/create/generating');
    }
  };

  const selectedDestination = popularDestinations.find((d) => d.name === draftInput?.destination);

  const mapUrl = draftInput?.destination
    ? getStaticMapUrl(draftInput.destination, draftInput.country || '')
    : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close trip planner"
          >
            <Ionicons name="close" size={24} color={colors.neutral[700]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} accessibilityRole="header">
            Plan your trip
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Soft sign-in banner */}
          {showSignInBanner && (
            <View style={styles.signInBanner}>
              <TouchableOpacity
                style={styles.signInBannerContent}
                onPress={() => {
                  setAuthGateAction('banner');
                  setShowAuthGate(true);
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Sign in to sync your trips across devices"
              >
                <Ionicons name="cloud-upload-outline" size={18} color={colors.primary[600]} />
                <Text style={styles.signInBannerText}>
                  Sign in to sync your trips across devices
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.signInBannerClose}
                onPress={() => dismissCreateBanner()}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Dismiss sign-in reminder"
              >
                <Ionicons name="close" size={18} color={colors.primary[400]} />
              </TouchableOpacity>
            </View>
          )}

          {guestBrief.message && (
            <Text
              accessibilityLiveRegion="polite"
              style={{
                color: '#475569',
                fontSize: 14,
                lineHeight: 20,
                marginHorizontal: 24,
                marginBottom: 16,
                padding: 12,
                borderRadius: 12,
                backgroundColor: '#f8fafc',
              }}
            >
              {guestBrief.message}
            </Text>
          )}

          {guestBrief.discardUnreadable && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Discard unreadable saved choices"
              style={{
                minHeight: 44,
                marginHorizontal: 24,
                marginBottom: 16,
                justifyContent: 'center',
              }}
              onPress={() =>
                Alert.alert(
                  'Discard unreadable saved choices?',
                  'This removes only the unfinished guest brief on this device. Your current edits and saved trips remain available.',
                  [
                    { text: 'Keep saved choices', style: 'cancel' },
                    {
                      text: 'Discard unreadable choices',
                      style: 'destructive',
                      onPress: () => {
                        void guestBrief.discardUnreadable?.();
                      },
                    },
                  ]
                )
              }
            >
              <Text style={{ color: '#475569', textDecorationLine: 'underline' }}>
                Discard unreadable saved choices
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.section}>
            <Text style={{ fontSize: 16, lineHeight: 24, color: '#53676C' }}>
              Choose a place and your dates. We’ll bring the days together.
            </Text>
          </View>

          {/* Destination Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Where do you want to go?</Text>

            {!showSearch && draftInput?.destination ? (
              <TouchableOpacity
                style={styles.selectedDestination}
                onPress={() => setShowSearch(true)}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={`Change destination from ${draftInput.destination}${draftInput.country ? `, ${draftInput.country}` : ''}`}
              >
                <LinearGradient
                  colors={['#284D57', '#142D3B']}
                  style={StyleSheet.absoluteFill}
                  accessible={false}
                />
                {mapUrl && !mapLoadFailed ? (
                  <Image
                    source={{ uri: mapUrl }}
                    style={styles.selectedDestinationImage}
                    resizeMode="cover"
                    onError={() => setMapLoadFailed(true)}
                    accessible={false}
                  />
                ) : selectedDestination ? (
                  <Image
                    source={{ uri: selectedDestination.image }}
                    style={styles.selectedDestinationImage}
                    accessible={false}
                  />
                ) : (
                  <LinearGradient
                    colors={[colors.primary[800], colors.primary[600]]}
                    style={styles.selectedDestinationImage}
                  />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.7)']}
                  style={styles.selectedDestinationGradient}
                />
                {(!mapUrl || mapLoadFailed) && !selectedDestination && (
                  <Ionicons
                    name="location"
                    size={40}
                    color="rgba(255,255,255,0.25)"
                    style={styles.selectedDestinationIcon}
                  />
                )}
                <View style={styles.selectedDestinationContent}>
                  <Text style={styles.selectedDestinationCountry}>{draftInput.country}</Text>
                  <Text style={styles.selectedDestinationName}>{draftInput.destination}</Text>
                </View>
                <View style={styles.changeButton}>
                  <Text style={styles.changeButtonText}>Change</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <>
                <PlacesAutocomplete onSelect={handleSelectDestination} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.destinationList}
                  contentContainerStyle={styles.destinationListContent}
                >
                  {popularDestinations.map((dest) => (
                    <TouchableOpacity
                      key={dest.id}
                      style={styles.destinationOption}
                      onPress={() => handleSelectDestination(dest.name, dest.country)}
                      accessibilityRole="button"
                      accessibilityLabel={`Choose ${dest.name}, ${dest.country}`}
                    >
                      <LinearGradient
                        colors={['#284D57', '#142D3B']}
                        style={StyleSheet.absoluteFill}
                        accessible={false}
                      />
                      <Image
                        source={{ uri: dest.image }}
                        style={styles.destinationOptionImage}
                        accessible={false}
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.6)']}
                        style={styles.destinationOptionGradient}
                      />
                      <View style={styles.destinationOptionContent}>
                        <Text style={styles.destinationOptionName}>{dest.name}</Text>
                        <Text style={styles.destinationOptionCountry}>{dest.country}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </View>

          {/* Date Selection */}
          <View style={styles.section}>
            <DateRangePicker
              startDate={draftInput?.startDate || ''}
              endDate={draftInput?.endDate || ''}
              onStartDateChange={(date) => setDraftInput({ startDate: date })}
              onEndDateChange={(date) => setDraftInput({ endDate: date })}
            />
          </View>

          {/* Travelers */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Who's traveling?</Text>

            <View style={styles.travelerCounter}>
              <Text style={styles.travelerCounterLabel}>Number of travelers</Text>
              <View style={styles.counterControls}>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => handleTravelersChange(-1)}
                  disabled={(draftInput?.travelers || 2) <= 1}
                  accessibilityRole="button"
                  accessibilityLabel="Remove one traveler"
                  accessibilityState={{ disabled: (draftInput?.travelers || 2) <= 1 }}
                >
                  <Ionicons
                    name="remove"
                    size={20}
                    color={
                      (draftInput?.travelers || 2) <= 1 ? colors.neutral[300] : colors.neutral[700]
                    }
                  />
                </TouchableOpacity>
                <Text
                  style={styles.counterValue}
                  accessibilityLabel={`${draftInput?.travelers || 2} ${(draftInput?.travelers || 2) === 1 ? 'traveler' : 'travelers'}`}
                >
                  {draftInput?.travelers || 2}
                </Text>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => handleTravelersChange(1)}
                  disabled={(draftInput?.travelers || 2) >= 10}
                  accessibilityRole="button"
                  accessibilityLabel="Add one traveler"
                  accessibilityState={{ disabled: (draftInput?.travelers || 2) >= 10 }}
                >
                  <Ionicons
                    name="add"
                    size={20}
                    color={
                      (draftInput?.travelers || 2) >= 10 ? colors.neutral[300] : colors.neutral[700]
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.travelerTypes}>
              {travelerTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.travelerTypeButton,
                    draftInput?.travelerType === type.id && styles.travelerTypeButtonSelected,
                  ]}
                  onPress={() => handleTravelerTypeSelect(type.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${type.label} travelers`}
                  accessibilityState={{ selected: draftInput?.travelerType === type.id }}
                >
                  <Ionicons
                    name={type.icon as React.ComponentProps<typeof Ionicons>['name']}
                    size={20}
                    color={
                      draftInput?.travelerType === type.id
                        ? colors.primary[600]
                        : colors.neutral[500]
                    }
                  />
                  <Text
                    style={[
                      styles.travelerTypeLabel,
                      draftInput?.travelerType === type.id && styles.travelerTypeLabelSelected,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Vibes */}
          <View style={styles.section}>
            <VibeSelector
              selected={draftInput?.vibes || []}
              onSelect={handleVibesSelect}
              maxSelections={5}
            />
          </View>

          {/* Spacer for button */}
          <View style={{ height: 16 }} />
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.bottomBar}>
          <Button
            title="Generate itinerary"
            onPress={handleContinue}
            disabled={!canProceed}
            size="lg"
            fullWidth
          />
        </View>

        {!canProceed && (
          <Text
            accessibilityLiveRegion="polite"
            style={{ textAlign: 'center', color: colors.surface[600], marginBottom: 12 }}
          >
            {formatMissingTripRequirements(missingRequirements)}
          </Text>
        )}

        {recoveryError && (
          <Text
            accessibilityRole="alert"
            style={{ color: colors.surface[600], textAlign: 'center' }}
          >
            {recoveryError}
          </Text>
        )}
        {savedCreation && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Restore unfinished trip"
            style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => {
              if (!isRecoveryCurrent()) return;
              setDraftInput(savedCreation);
              setShowSearch(false);
              setMapLoadFailed(false);
            }}
          >
            <Text>Restore unfinished trip to {savedCreation.destination}</Text>
          </TouchableOpacity>
        )}
        {user && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Start a new trip"
            style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
            onPress={async () => {
              if (!isRecoveryCurrent() || discardLock.current) return;
              discardLock.current = true;
              let reviewedReceipt: string | null;
              try {
                reviewedReceipt = await readTripCreationReceipt(user.id);
                if (!isRecoveryCurrent()) return;
              } catch {
                if (isRecoveryCurrent())
                  setRecoveryError(
                    'Your pending request couldn’t be checked. Check My Trips and try again.'
                  );
                return;
              } finally {
                discardLock.current = false;
              }
              Alert.alert(
                'Start a new trip?',
                'Check My Trips first if an earlier request was interrupted. This clears the pending retry; any saved trip stays in My Trips.',
                [
                  { text: 'Keep pending trip', style: 'cancel' },
                  {
                    text: 'Start a new trip',
                    onPress: () => {
                      if (!isRecoveryCurrent() || discardLock.current) return;
                      discardLock.current = true;
                      void discardReviewedTripCreation(user.id, reviewedReceipt)
                        .then(() => {
                          if (!isRecoveryCurrent()) return;
                          setSavedCreation(null);
                          setRecoveryError(null);
                          useTripStore.getState().clearDraft();
                          setShowSearch(true);
                          setMapLoadFailed(false);
                        })
                        .catch((reason: unknown) => {
                          if (!isRecoveryCurrent()) return;
                          Alert.alert(
                            'Could not clear pending trip',
                            reason instanceof Error
                              ? reason.message
                              : 'Your saved request is kept. Please try again.'
                          );
                        })
                        .finally(() => {
                          discardLock.current = false;
                        });
                    },
                  },
                ]
              );
            }}
          >
            <Text style={{ color: colors.surface[600] }}>Start a new trip</Text>
          </TouchableOpacity>
        )}

        {/* Auth gate from banner */}
        <AuthGate
          visible={showAuthGate}
          trigger={authGateAction === 'generate' && !isAuthenticated ? 'generate' : 'general'}
          onAuthenticated={handleAuthenticated}
          onClose={() => {
            setShowAuthGate(false);
            setAuthGateAction('generate');
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  signInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F4',
    marginHorizontal: 24,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: borderRadius.lg,
  },
  signInBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  signInBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[600],
  },
  signInBannerClose: {
    padding: 4,
    marginLeft: 8,
  },
  scrollContent: {
    paddingVertical: 24,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  selectedDestination: {
    height: 160,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    ...shadows.md,
  },
  selectedDestinationImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  selectedDestinationGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  selectedDestinationIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -20,
    marginLeft: -20,
  },
  selectedDestinationContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
  },
  selectedDestinationCountry: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    letterSpacing: 0,
    marginBottom: 4,
  },
  selectedDestinationName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  changeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  changeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  destinationList: {
    marginTop: 16,
    marginHorizontal: -24,
  },
  destinationListContent: {
    paddingHorizontal: 24,
    gap: 12,
  },
  destinationOption: {
    width: 140,
    height: 180,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  destinationOptionImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  destinationOptionGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  destinationOptionContent: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  destinationOptionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  destinationOptionCountry: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  travelerCounter: {
    gap: 12,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: borderRadius.lg,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  travelerCounterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    justifyContent: 'space-between',
  },
  counterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    minWidth: 30,
    textAlign: 'center',
  },
  travelerTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  travelerTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  travelerTypeButtonSelected: {
    backgroundColor: '#FFF5F4',
    borderColor: colors.primary[500],
  },
  travelerTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  travelerTypeLabelSelected: {
    color: colors.primary[400],
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
});
