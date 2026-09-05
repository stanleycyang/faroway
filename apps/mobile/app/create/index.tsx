import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, PlacesAutocomplete, DateRangePicker, VibeSelector } from '../../components/ui';
import { useTripStore, type TripInput } from '../../stores/tripStore';
import { usePromptStore } from '../../stores/promptStore';
import { useAuthContext } from '../../components/AuthProvider';
import { AuthGate } from '../../components/AuthGate';
import { popularDestinations, travelerTypes } from '@faroway/constants';
import { colors, borderRadius, shadows } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';
import { API_BASE_URL } from '../../constants/api';

function getStaticMapUrl(destination: string, country: string): string {
  const query = new URLSearchParams({ destination });
  if (country) query.set('country', country);
  return `${API_BASE_URL}/api/places/static-map?${query.toString()}`;
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
  const { isAuthenticated } = useAuthContext();
  const { tripGenerationCount, hasDismissedCreateBanner, dismissCreateBanner } = usePromptStore();

  const [showSearch, setShowSearch] = useState(!params.destination);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [authGateAction, setAuthGateAction] = useState<'banner' | 'generate'>('generate');

  const showSignInBanner =
    !isAuthenticated && tripGenerationCount >= 1 && !hasDismissedCreateBanner;

  useEffect(() => {
    if (params.destination) {
      const updates: Partial<TripInput> = {
        destination: params.destination,
        country: params.country,
        placeId: params.placeId,
      };
      if (params.vibes) {
        updates.vibes = params.vibes.split(',');
      }
      if (params.startDate) {
        updates.startDate = params.startDate;
      }
      if (params.endDate) {
        updates.endDate = params.endDate;
      }
      if (params.travelerType) {
        updates.travelerType = params.travelerType;
      }
      if (params.travelers) {
        const count = parseInt(params.travelers, 10);
        if (!isNaN(count)) {
          updates.travelers = count;
        }
      }
      setDraftInput(updates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.destination,
    params.country,
    params.placeId,
    params.vibes,
    params.startDate,
    params.endDate,
    params.travelerType,
    params.travelers,
  ]);

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
    const current = draftInput?.travelers || 2;
    const newValue = Math.max(1, Math.min(10, current + delta));
    if (newValue !== current) {
      hapticFeedback.light();
      setDraftInput({ travelers: newValue });
    }
  };

  const canProceed = draftInput?.destination && draftInput?.startDate && draftInput?.endDate;

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
    <SafeAreaView style={styles.container} edges={['top']}>
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
            Plan Your Trip
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
                  accessibilityLabel={`${draftInput?.travelers || 2} travelers`}
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
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.bottomBar}>
          <Button
            title="Generate Itinerary ✨"
            onPress={handleContinue}
            disabled={!canProceed}
            size="lg"
            fullWidth
          />
        </View>

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
    height: 180,
    borderRadius: borderRadius.xl,
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
    color: colors.primary[300],
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
});
