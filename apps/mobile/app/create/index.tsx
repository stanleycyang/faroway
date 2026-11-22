import { TravelerRequirementsEditor } from '../../components/TravelerRequirementsEditor';
import { DreamTripPromptBar } from '../../components/create/DreamTripPromptBar';
import { travelerRequirementsSchema } from '../../lib/travelerRequirements';
import {
  clearTravelerMemory,
  extractMemoryFromDraft,
  hasTravelerMemoryContent,
  loadTravelerMemory,
  mergeTravelerMemoryIntoDraft,
  saveTravelerMemory,
  type TravelerMemoryDefaults,
} from '../../lib/travelerMemory';
import type { DestinationSuggestion, ParsedTripPrompt } from '../../lib/promptParser';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
const useOptionalFocusEffect =
  typeof useFocusEffect === 'function' ? useFocusEffect : (_cb: () => void) => {};
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Button,
  Input,
  PlacesAutocomplete,
  DateRangePicker,
  VibeSelector,
} from '../../components/ui';
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
import { isValidIataAirportCode } from '../../lib/flightOrigin';
import { AuthGate } from '../../components/AuthGate';
import {
  BUDGET_TIERS,
  FLIGHT_SEARCH_DISCLOSURE,
  normalizeBudgetTier,
  popularDestinations,
  travelerTypes,
} from '@faroway/constants';
import { colors, borderRadius, shadows, fontFamilies } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';

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
  const savedProfileBudget = useUserStore((state) => state.user?.preferences?.budget);
  const activeBudget = normalizeBudgetTier(draftInput?.budget ?? savedProfileBudget) ?? 'moderate';
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
  const [showAllDestinations, setShowAllDestinations] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authGateAction, setAuthGateAction] = useState<'banner' | 'generate'>('generate');
  const [travelerMemory, setTravelerMemory] = useState<TravelerMemoryDefaults | null>(null);
  const [memoryApplied, setMemoryApplied] = useState(false);
  const [undoDraftSnapshot, setUndoDraftSnapshot] = useState<TripInput | null>(null);
  const memoryLoadedScopeRef = useRef<string | null>(null);

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

  // Load saved Traveler Memory defaults scoped by userId and auto-apply without
  // overwriting explicit URL parameters or unfinished guest briefs.
  const reloadTravelerMemory = useCallback(
    (allowAutoApply: boolean) => {
      let active = true;
      const scope = `${userId ?? 'guest'}:${accountRevision}`;

      void loadTravelerMemory(userId)
        .then((loaded) => {
          if (!active || !isRecoveryCurrent()) return;
          setTravelerMemory(loaded);
          if (!allowAutoApply || !loaded || !hasTravelerMemoryContent(loaded)) return;
          if (memoryLoadedScopeRef.current === scope) return;
          memoryLoadedScopeRef.current = scope;

          const explicit = new Set<string>();
          if (params.destination) explicit.add('destination');
          if (params.vibes) explicit.add('vibes');
          if (params.travelerType) explicit.add('travelerType');
          if (params.travelers) explicit.add('travelers');

          const currentDraft = useTripStore.getState().draftInput;
          const merged = mergeTravelerMemoryIntoDraft(currentDraft, loaded, explicit);
          if (Object.keys(merged).length > 0) {
            setDraftInput(merged);
            setMemoryApplied(true);
          }
        })
        .catch(() => {
          // Ignore storage read failures so the planner stays usable.
        });

      return () => {
        active = false;
      };
    },
    [
      userId,
      accountRevision,
      isRecoveryCurrent,
      params.destination,
      params.vibes,
      params.travelerType,
      params.travelers,
      setDraftInput,
    ]
  );

  useEffect(() => {
    setTravelerMemory(null);
    setMemoryApplied(false);
    // For guests, wait until useGuestTripBrief finishes restoring any unfinished brief
    // so auto-applying defaults never marks the guest brief as edited & clobbers it.
    if (!isAuthenticated && !guestBrief.settled) return;
    return reloadTravelerMemory(true);
  }, [isAuthenticated, guestBrief.settled, reloadTravelerMemory]);

  useOptionalFocusEffect(
    useCallback(() => {
      if (!isAuthenticated && !guestBrief.settled) return;
      return reloadTravelerMemory(false);
    }, [isAuthenticated, guestBrief.settled, reloadTravelerMemory])
  );

  const handleApplyParsedPrompt = useCallback(
    (parsed: ParsedTripPrompt) => {
      const previous = useTripStore.getState().draftInput;
      if (previous) {
        setUndoDraftSnapshot({
          ...previous,
          vibes: [...(previous.vibes ?? [])],
          requirements: previous.requirements
            ? {
                ...previous.requirements,
                allergies: [...previous.requirements.allergies],
                dietaryPreferences: [...previous.requirements.dietaryPreferences],
                accessibility: [...previous.requirements.accessibility],
              }
            : previous.requirements,
        });
      }

      const updates: Partial<TripInput> = {};
      if (parsed.destination) {
        updates.destination = parsed.destination;
        updates.country = parsed.country ?? '';
        setShowSearch(false);
      }
      if (parsed.startDate) updates.startDate = parsed.startDate;
      if (parsed.endDate) updates.endDate = parsed.endDate;
      if (parsed.travelers) updates.travelers = parsed.travelers;
      if (parsed.travelerType) updates.travelerType = parsed.travelerType;
      if (parsed.budget) updates.budget = parsed.budget;
      if (parsed.vibes.length > 0) updates.vibes = parsed.vibes;
      if (parsed.requirements) {
        const prevReq = previous?.requirements;
        const mergedAllergies = Array.from(
          new Set([...(prevReq?.allergies ?? []), ...parsed.requirements.allergies])
        ).slice(0, 10);
        const mergedDietary = Array.from(
          new Set([
            ...(prevReq?.dietaryPreferences ?? []),
            ...parsed.requirements.dietaryPreferences,
          ])
        ).slice(0, 10);
        const mergedAccess = Array.from(
          new Set([...(prevReq?.accessibility ?? []), ...parsed.requirements.accessibility])
        ).slice(0, 10);
        const prevNotes = prevReq?.mobilityNotes?.trim() ?? '';
        const nextNotes = parsed.requirements.mobilityNotes?.trim() ?? '';
        const mergedNotes =
          prevNotes && nextNotes && !prevNotes.toLowerCase().includes(nextNotes.toLowerCase())
            ? `${prevNotes}; ${nextNotes}`.slice(0, 500)
            : (nextNotes || prevNotes).slice(0, 500);
        updates.requirements = {
          allergies: mergedAllergies,
          dietaryPreferences: mergedDietary,
          accessibility: mergedAccess,
          mobilityNotes: mergedNotes,
        };
      }

      if (Object.keys(updates).length > 0) {
        setDraftInput(updates);
      }
    },
    [setDraftInput]
  );

  const handleUndoParsedPrompt = useCallback(() => {
    if (!undoDraftSnapshot) return;
    setDraftInput(undoDraftSnapshot);
    setShowSearch(!undoDraftSnapshot.destination);
    setUndoDraftSnapshot(null);
  }, [undoDraftSnapshot, setDraftInput]);

  const handleSelectSuggestion = useCallback(
    (suggestion: DestinationSuggestion) => {
      const previous = useTripStore.getState().draftInput;
      if (previous) {
        setUndoDraftSnapshot({ ...previous, vibes: [...(previous.vibes ?? [])] });
      }
      const start = new Date();
      start.setDate(start.getDate() + 30);
      const end = new Date(start);
      end.setDate(start.getDate() + Math.max(1, suggestion.suggestedDays - 1));
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const updates: Partial<TripInput> = {
        destination: suggestion.destination,
        country: suggestion.country,
        budget: suggestion.suggestedBudget,
        vibes: suggestion.suggestedVibes,
      };
      if (suggestion.startDate && suggestion.endDate) {
        updates.startDate = suggestion.startDate;
        updates.endDate = suggestion.endDate;
      } else if (!previous?.startDate || !previous?.endDate) {
        updates.startDate = fmt(start);
        updates.endDate = fmt(end);
      }
      setShowSearch(false);
      setDraftInput(updates);
    },
    [setDraftInput]
  );

  const handleSaveCurrentAsMemory = useCallback(() => {
    const currentDraft = useTripStore.getState().draftInput;
    const patch = extractMemoryFromDraft(currentDraft);
    void saveTravelerMemory(userId, patch)
      .then((saved) => {
        if (!isRecoveryCurrent()) return;
        setTravelerMemory(saved);
        setMemoryApplied(Boolean(saved));
        Alert.alert(
          'Defaults saved',
          saved
            ? 'Your budget tier, vibes, and dietary/access notes will prefill future trips. You can edit or clear them anytime.'
            : 'Choose a budget tier, vibes, or dietary/access needs first to save defaults.'
        );
      })
      .catch(() => {
        if (isRecoveryCurrent()) {
          Alert.alert('Could not save defaults', 'Please try again.');
        }
      });
  }, [userId, isRecoveryCurrent]);

  const handleClearMemory = useCallback(() => {
    void clearTravelerMemory(userId)
      .then(() => {
        if (!isRecoveryCurrent()) return;
        setTravelerMemory(null);
        setMemoryApplied(false);
      })
      .catch(() => undefined);
  }, [userId, isRecoveryCurrent]);

  const handleSelectDestination = (name: string, country: string, placeId?: string) => {
    hapticFeedback.selection();
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
  const requirementsValid = travelerRequirementsSchema
    .nullish()
    .safeParse(draftInput?.requirements).success;
  const originCityTrimmed = draftInput?.originCity?.trim() || '';
  const originAirportTrimmed = draftInput?.originAirport?.trim() || '';
  const airportCodeError =
    originAirportTrimmed && !isValidIataAirportCode(originAirportTrimmed)
      ? 'Enter a 3-letter IATA code like SFO or JFK'
      : undefined;
  const flightOriginMissing =
    Boolean(draftInput?.flightConsent) && !originCityTrimmed && !originAirportTrimmed;
  const canProceed =
    missingRequirements.length === 0 &&
    requirementsValid &&
    !airportCodeError &&
    !flightOriginMissing;

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'android' ? 'padding' : undefined}
      >
        <View style={{ flex: 1 }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                if (typeof router.canGoBack === 'function' && !router.canGoBack()) {
                  router.replace('/(tabs)');
                } else {
                  router.back();
                }
              }}
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
            // Native inset adjustment also scrolls the focused multiline input
            // above the iOS keyboard; resizing the outer view alone does not.
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            keyboardDismissMode="on-drag"
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
                  accessibilityLabel="Sign in to save your trips to your account"
                >
                  <Ionicons name="cloud-upload-outline" size={18} color={colors.action.primary} />
                  <Text style={styles.signInBannerText}>
                    Sign in to save your trips to your account
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.signInBannerClose}
                  onPress={() => dismissCreateBanner()}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss sign-in reminder"
                >
                  <Ionicons name="close" size={18} color={colors.action.primary} />
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

            <DreamTripPromptBar
              onApplyParsed={handleApplyParsedPrompt}
              onUndoParsed={handleUndoParsedPrompt}
              canUndo={Boolean(undoDraftSnapshot)}
              onSelectSuggestion={handleSelectSuggestion}
              memory={travelerMemory}
              memoryApplied={memoryApplied}
              onSaveCurrentAsMemory={handleSaveCurrentAsMemory}
              onClearMemory={handleClearMemory}
              onEditMemory={() => {
                if (typeof router.dismissTo === 'function') {
                  router.dismissTo('/(tabs)/profile');
                } else {
                  router.replace('/(tabs)/profile');
                }
              }}
            />

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
                  {selectedDestination ? (
                    <Image
                      source={{ uri: selectedDestination.image }}
                      style={styles.selectedDestinationImage}
                      accessible={false}
                    />
                  ) : (
                    <LinearGradient
                      colors={[colors.primary[800], colors.action.primary]}
                      style={styles.selectedDestinationImage}
                    />
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(20,61,70,0.85)']}
                    style={styles.selectedDestinationGradient}
                  />
                  {!selectedDestination && (
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
                    {(showAllDestinations
                      ? popularDestinations
                      : popularDestinations.slice(0, 6)
                    ).map((dest) => (
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
                  {!showAllDestinations && popularDestinations.length > 6 ? (
                    <TouchableOpacity
                      onPress={() => setShowAllDestinations(true)}
                      accessibilityRole="button"
                      accessibilityLabel="See all places"
                      style={{ minHeight: 44, justifyContent: 'center', marginTop: 8 }}
                    >
                      <Text style={{ color: colors.primary[700], fontWeight: '600' }}>
                        See all places
                      </Text>
                    </TouchableOpacity>
                  ) : null}
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
                        (draftInput?.travelers || 2) <= 1
                          ? colors.neutral[300]
                          : colors.neutral[700]
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
                        (draftInput?.travelers || 2) >= 10
                          ? colors.neutral[300]
                          : colors.neutral[700]
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
                          ? colors.action.primary
                          : colors.surface[600]
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

            {/* Flights & Departure (optional) */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Flights & departure (optional)</Text>
              <View style={styles.flightOriginCard}>
                <Input
                  label="Departure city (optional)"
                  placeholder="e.g., San Francisco"
                  value={draftInput?.originCity || ''}
                  onChangeText={(text) => setDraftInput({ originCity: text.slice(0, 200) })}
                  icon="airplane-outline"
                  autoCapitalize="words"
                />
                <Input
                  label="Departure airport (optional)"
                  placeholder="e.g., SFO"
                  value={draftInput?.originAirport || ''}
                  onChangeText={(text) =>
                    setDraftInput({ originAirport: text.toUpperCase().slice(0, 10) })
                  }
                  icon="navigate-outline"
                  autoCapitalize="characters"
                  error={airportCodeError}
                />
                <TouchableOpacity
                  style={styles.flightConsentRow}
                  onPress={() => {
                    hapticFeedback.selection();
                    setDraftInput({ flightConsent: !draftInput?.flightConsent });
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: Boolean(draftInput?.flightConsent) }}
                  accessibilityLabel="Include flight options"
                >
                  <Ionicons
                    name={draftInput?.flightConsent ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={draftInput?.flightConsent ? colors.action.primary : colors.surface[600]}
                  />
                  <Text style={styles.flightConsentLabel}>Include flight options</Text>
                </TouchableOpacity>
                <Text style={styles.flightDisclosureText}>{FLIGHT_SEARCH_DISCLOSURE}</Text>
                {flightOriginMissing ? (
                  <Text accessibilityRole="alert" style={styles.flightOriginWarning}>
                    Add a departure city or 3-letter airport code to include flight options.
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Budget */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your budget tier</Text>
              <View style={styles.travelerTypes}>
                {BUDGET_TIERS.map((option) => {
                  const selected = activeBudget === option.id;
                  const budgetIcon =
                    option.id === 'budget'
                      ? 'wallet-outline'
                      : option.id === 'luxury'
                        ? 'sparkles-outline'
                        : 'cash-outline';
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[
                        styles.travelerTypeButton,
                        selected && styles.travelerTypeButtonSelected,
                      ]}
                      onPress={() => {
                        hapticFeedback.selection();
                        setDraftInput({ budget: option.id });
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Budget tier: ${option.label}`}
                    >
                      <Ionicons
                        name={budgetIcon}
                        size={18}
                        color={selected ? colors.action.primary : colors.surface[600]}
                      />
                      <Text
                        style={[
                          styles.travelerTypeLabel,
                          selected && styles.travelerTypeLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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

            <View style={styles.section}>
              <TravelerRequirementsEditor
                collapsible
                value={draftInput?.requirements}
                onChange={(update) =>
                  setDraftInput({
                    requirements: update(useTripStore.getState().draftInput?.requirements),
                  })
                }
              />
              {!requirementsValid ? (
                <Text accessibilityRole="alert" style={{ color: colors.primary[800] }}>
                  Review dietary and access needs before generating.
                </Text>
              ) : null}
            </View>

            {/* Spacer for button */}
            <View style={{ height: 16 }} />
          </ScrollView>

          {/* Continue Button */}
          <View style={styles.bottomBar}>
            {!canProceed ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ textAlign: 'center', color: colors.surface[600], marginBottom: 8 }}
              >
                {formatMissingTripRequirements(missingRequirements)}
              </Text>
            ) : null}
            <Button
              title="Generate itinerary"
              onPress={handleContinue}
              disabled={!canProceed}
              size="lg"
              fullWidth
              accessibilityHint={
                canProceed ? undefined : formatMissingTripRequirements(missingRequirements)
              }
            />
          </View>

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
        </View>
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
    fontFamily: fontFamilies.display,
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
    color: colors.action.primary,
  },
  signInBannerClose: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
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
    borderColor: colors.action.primary,
  },
  travelerTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface[600],
  },
  travelerTypeLabelSelected: {
    color: colors.primary[800],
  },
  flightOriginCard: {
    backgroundColor: '#FAF8F3',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#DCE5E3',
    padding: 16,
  },
  flightConsentRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flightConsentLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  flightDisclosureText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#475569',
    marginTop: 4,
  },
  flightOriginWarning: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary[800],
    marginTop: 8,
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
