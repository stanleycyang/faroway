import { useState, useEffect } from 'react';
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
import {
  Button,
  PlacesAutocomplete,
  DateRangePicker,
  VibeSelector,
} from '../../components/ui';
import { useTripStore } from '../../stores/tripStore';
import { popularDestinations, travelerTypes } from '@tripgenie/constants';
import { colors, borderRadius, shadows } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';

export default function CreateTripScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ destination?: string; country?: string; placeId?: string }>();
  const { draftInput, setDraftInput } = useTripStore();

  const [showSearch, setShowSearch] = useState(!params.destination);

  useEffect(() => {
    if (params.destination) {
      setDraftInput({
        destination: params.destination,
        country: params.country,
        placeId: params.placeId,
      });
    }
  }, [params.destination, params.country, params.placeId]);

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
    const current = draftInput?.travelers || 2;
    const newValue = Math.max(1, Math.min(10, current + delta));
    if (newValue !== current) {
      hapticFeedback.light();
      setDraftInput({ travelers: newValue });
    }
  };

  const canProceed =
    draftInput?.destination &&
    draftInput?.startDate &&
    draftInput?.endDate;

  const handleContinue = () => {
    if (canProceed) {
      hapticFeedback.success();
      router.push('/create/generating');
    } else {
      hapticFeedback.error();
    }
  };

  const selectedDestination = popularDestinations.find(
    (d) => d.name === draftInput?.destination
  );

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
          >
            <Ionicons name="close" size={24} color={colors.neutral[700]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Plan Your Trip</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Destination Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Where do you want to go?</Text>

            {!showSearch && draftInput?.destination ? (
              <TouchableOpacity
                style={styles.selectedDestination}
                onPress={() => setShowSearch(true)}
                activeOpacity={0.9}
              >
                {selectedDestination ? (
                  <Image
                    source={{ uri: selectedDestination.image }}
                    style={styles.selectedDestinationImage}
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
                {!selectedDestination && (
                  <Ionicons
                    name="location"
                    size={40}
                    color="rgba(255,255,255,0.25)"
                    style={styles.selectedDestinationIcon}
                  />
                )}
                <View style={styles.selectedDestinationContent}>
                  <Text style={styles.selectedDestinationCountry}>
                    {draftInput.country}
                  </Text>
                  <Text style={styles.selectedDestinationName}>
                    {draftInput.destination}
                  </Text>
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
                      onPress={() =>
                        handleSelectDestination(dest.name, dest.country)
                      }
                    >
                      <Image
                        source={{ uri: dest.image }}
                        style={styles.destinationOptionImage}
                      />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.6)']}
                        style={styles.destinationOptionGradient}
                      />
                      <View style={styles.destinationOptionContent}>
                        <Text style={styles.destinationOptionName}>
                          {dest.name}
                        </Text>
                        <Text style={styles.destinationOptionCountry}>
                          {dest.country}
                        </Text>
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
                <Text style={styles.counterValue}>
                  {draftInput?.travelers || 2}
                </Text>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => handleTravelersChange(1)}
                  disabled={(draftInput?.travelers || 2) >= 10}
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
                    draftInput?.travelerType === type.id &&
                      styles.travelerTypeButtonSelected,
                  ]}
                  onPress={() => handleTravelerTypeSelect(type.id)}
                >
                  <Ionicons
                    name={type.icon as any}
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
                      draftInput?.travelerType === type.id &&
                        styles.travelerTypeLabelSelected,
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface[900],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface[800],
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
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
    color: '#fff',
    marginBottom: 16,
  },
  selectedDestination: {
    height: 180,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
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
    backgroundColor: colors.surface[800],
    padding: 16,
    borderRadius: borderRadius.lg,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  travelerCounterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface[300],
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface[700],
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
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
    backgroundColor: colors.surface[800],
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: borderRadius.full,
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  travelerTypeButtonSelected: {
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderColor: colors.primary[500],
  },
  travelerTypeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.surface[400],
  },
  travelerTypeLabelSelected: {
    color: colors.primary[400],
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface[800],
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
});
