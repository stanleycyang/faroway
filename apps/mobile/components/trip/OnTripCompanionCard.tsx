import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { AFFILIATE_DISCLOSURE_SHORT } from '@faroway/constants';
import { borderRadius, colors } from '../../constants/theme';
import {
  TRIP_ESSENTIALS,
  confirmAndOpenAffiliateLink,
  itemTypeForAffiliateActivityType,
  resolveAffiliatePartnerForItem,
} from '../../lib/affiliateCheckout';
import { isAllowedAffiliateUrl } from '../../services/api';
import {
  buildStopDirectionsUrl,
  computeBookingReadiness,
  detectUpNextStop,
  findOutdoorStopsOnDay,
  formatTaxiDriverCard,
  type BookingReadinessSummary,
} from '../../lib/tripCompanion';
import type { Trip } from '../../lib/tripTypes';
import { hapticFeedback } from '../../utils/haptics';

const SafeModal = Modal ?? ('Modal' as unknown as typeof Modal);

export interface OnTripCompanionCardProps {
  trip: Trip;
  selectedDayIndex: number;
  scheduleShiftMinutes: number;
  onShiftSchedule: (offsetMinutes: number) => void;
  onTriggerRainSwap: (dayNumber: number) => void;
  onSelectActiveDay?: (dayIndex: number) => void;
}

async function openExternalMapsUrl(url: string) {
  try {
    if (Linking && typeof Linking.openURL === 'function') {
      await Linking.openURL(url);
      return;
    }
  } catch {
    // Fall back to in-app browser below.
  }
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    Alert.alert('Could not open Maps', 'Please open your Maps app to view directions.');
  }
}

export function OnTripCompanionCard({
  trip,
  selectedDayIndex,
  scheduleShiftMinutes,
  onShiftSchedule,
  onTriggerRainSwap,
  onSelectActiveDay,
}: OnTripCompanionCardProps) {
  const [showTaxiModal, setShowTaxiModal] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [clockTick, setClockTick] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setClockTick(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const upNext = useMemo(
    () => detectUpNextStop(trip, new Date(clockTick), scheduleShiftMinutes),
    [trip, clockTick, scheduleShiftMinutes]
  );

  const readiness: BookingReadinessSummary = useMemo(
    () => computeBookingReadiness(trip, new Date(clockTick)),
    [trip, clockTick]
  );

  const currentDay = trip.days[selectedDayIndex];
  const outdoorStops = useMemo(() => findOutdoorStopsOnDay(currentDay), [currentDay]);

  if (trip.days.length === 0) return null;

  const taxiCard = upNext.nextStop
    ? formatTaxiDriverCard(upNext.nextStop, trip.destination, trip.country)
    : null;

  const platform: 'ios' | 'android' | 'web' =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

  const handleOpenDirections = () => {
    if (!upNext.nextStop) return;
    hapticFeedback.light();
    const url = buildStopDirectionsUrl(upNext.nextStop, trip.destination, trip.country, platform);
    void openExternalMapsUrl(url);
  };

  const openPartnerBrowser = (url: string) =>
    WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle?.AUTOMATIC,
      controlsColor: colors.action.primary,
    });

  const handleOpenFlaggedStop = (item: BookingReadinessSummary['flaggedStops'][number]) => {
    if (!item.bookingUrl || !isAllowedAffiliateUrl(item.bookingUrl)) return;
    const partner = resolveAffiliatePartnerForItem(item.bookingUrl, item.affiliatePartner);
    confirmAndOpenAffiliateLink(
      {
        itemType: itemTypeForAffiliateActivityType(item.activityType || 'activity'),
        itemId: item.id || `${item.dayNumber}-${item.title}`,
        itemName: item.title,
        affiliatePartner: partner,
        affiliateUrl: item.bookingUrl,
        tripId: trip.id,
        priceLabel: item.price,
        source: 'itinerary',
      },
      openPartnerBrowser
    );
  };

  const handleOpenEssential = (essential: (typeof TRIP_ESSENTIALS)[number]) => {
    confirmAndOpenAffiliateLink(
      {
        itemType: 'activity',
        itemId: essential.id,
        itemName: essential.title,
        affiliatePartner: essential.partner,
        affiliateUrl: essential.url,
        tripId: trip.id,
        source: 'itinerary',
      },
      openPartnerBrowser
    );
  };

  const urgencyColors =
    readiness.urgency === 'now'
      ? { bg: '#FFF5F4', border: '#FDB4AF', text: '#7A241E', icon: '#C03A31' }
      : readiness.urgency === 'soon'
        ? { bg: '#FFFBEB', border: '#FDE68A', text: '#78350F', icon: '#B45309' }
        : { bg: '#F0FDFA', border: '#CCFBF1', text: '#134E4A', icon: '#0F766E' };

  return (
    <View style={styles.container}>
      {/* Live "Up Next" Card when trip is active today */}
      {upNext.isActiveTrip && upNext.nextStop ? (
        <View style={styles.upNextCard}>
          <View style={styles.upNextTopRow}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>
                Up next · Day {upNext.dayNumber} of {upNext.totalDays}
              </Text>
            </View>
            {upNext.scheduledLabel ? (
              <Text style={styles.upNextTime}>{upNext.scheduledLabel}</Text>
            ) : null}
          </View>

          <Text style={styles.upNextTitle}>{upNext.nextStop.title}</Text>
          {upNext.nextStop.venueAddress || upNext.nextStop.location ? (
            <Text style={styles.upNextAddress} numberOfLines={2}>
              {upNext.nextStop.venueAddress || upNext.nextStop.location}
            </Text>
          ) : null}

          {upNext.followingStop ? (
            <Text style={styles.followingText} numberOfLines={1}>
              After that: {upNext.followingStop.title}
            </Text>
          ) : null}

          {/* Action buttons: Directions & Show Taxi Driver */}
          <View style={styles.upNextActions}>
            <TouchableOpacity
              style={styles.primaryCompanionBtn}
              onPress={handleOpenDirections}
              accessibilityRole="button"
              accessibilityLabel={`Get directions to ${upNext.nextStop.title}`}
            >
              <Ionicons name="navigate" size={16} color="#0f172a" />
              <Text style={styles.primaryCompanionBtnText}>Directions</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryCompanionBtn}
              onPress={() => {
                hapticFeedback.light();
                setShowTaxiModal(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Show taxi driver address for ${upNext.nextStop.title}`}
            >
              <Ionicons name="car-outline" size={16} color="#ffffff" />
              <Text style={styles.secondaryCompanionBtnText}>Show taxi driver</Text>
            </TouchableOpacity>
          </View>

          {/* Running Late? Schedule Shifter */}
          <View style={styles.shiftRow}>
            <Text style={styles.shiftLabel}>Running late?</Text>
            <View style={styles.shiftButtons}>
              {[30, 60].map((mins) => {
                const active = scheduleShiftMinutes === mins;
                return (
                  <TouchableOpacity
                    key={mins}
                    style={[styles.shiftChip, active && styles.shiftChipActive]}
                    onPress={() => {
                      hapticFeedback.selection();
                      onShiftSchedule(active ? 0 : mins);
                      if (onSelectActiveDay && selectedDayIndex !== upNext.dayIndex) {
                        onSelectActiveDay(upNext.dayIndex);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Shift today’s schedule by ${mins} minutes`}
                  >
                    <Text style={[styles.shiftChipText, active && styles.shiftChipTextActive]}>
                      +{mins}m
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {scheduleShiftMinutes > 0 ? (
                <TouchableOpacity
                  style={styles.shiftResetChip}
                  onPress={() => {
                    hapticFeedback.light();
                    onShiftSchedule(0);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Reset schedule shift"
                >
                  <Text style={styles.shiftResetText}>Reset</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      {/* Proactive Booking Readiness & Rain-Swap Banner */}
      {readiness.urgency !== 'past' ? (
        <View
          style={[
            styles.readinessBanner,
            { backgroundColor: urgencyColors.bg, borderColor: urgencyColors.border },
          ]}
        >
          <View style={styles.readinessHeader}>
            <Ionicons name="calendar-outline" size={18} color={urgencyColors.icon} />
            <View style={styles.readinessHeaderText}>
              <Text style={[styles.readinessTitle, { color: urgencyColors.text }]}>
                {readiness.headline}
              </Text>
              <Text style={styles.readinessDetail}>{readiness.detail}</Text>
            </View>
          </View>

          <View style={styles.readinessActions}>
            {readiness.flaggedStops.length > 0 ? (
              <TouchableOpacity
                style={styles.readinessPillBtn}
                onPress={() => {
                  hapticFeedback.light();
                  setShowChecklist((v) => !v);
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: showChecklist }}
                accessibilityLabel={
                  showChecklist
                    ? 'Hide advance-booking checklist'
                    : 'View advance-booking checklist'
                }
              >
                <Text style={[styles.readinessPillText, { color: urgencyColors.text }]}>
                  {showChecklist
                    ? 'Hide checklist'
                    : `Checklist (${readiness.flaggedStops.length})`}
                </Text>
              </TouchableOpacity>
            ) : null}

            {currentDay && !trip.planNeedsRefresh ? (
              <TouchableOpacity
                style={styles.rainSwapBtn}
                onPress={() => {
                  hapticFeedback.light();
                  onTriggerRainSwap(currentDay.dayNumber);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Rainy-day indoor backup for Day ${currentDay.dayNumber}`}
              >
                <Ionicons name="rainy-outline" size={15} color="#143D46" />
                <Text style={styles.rainSwapText}>
                  {outdoorStops.length > 0
                    ? `Rain backup · ${outdoorStops.length} outdoor`
                    : `Rainy-day backup`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {showChecklist && readiness.flaggedStops.length > 0 ? (
            <View style={styles.checklistBox}>
              {readiness.flaggedStops.map((item) => {
                const canBookDirect = Boolean(
                  item.bookingUrl && isAllowedAffiliateUrl(item.bookingUrl)
                );
                return (
                  <View key={`${item.dayNumber}-${item.title}`} style={styles.checklistRow}>
                    <Text style={styles.checklistDay}>Day {item.dayNumber}</Text>
                    <View style={styles.checklistBody}>
                      <Text style={styles.checklistStop}>{item.title}</Text>
                      <Text style={styles.checklistReason}>{item.reason}</Text>
                    </View>
                    {canBookDirect ? (
                      <TouchableOpacity
                        style={styles.checklistActionBtn}
                        onPress={() => handleOpenFlaggedStop(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Check options for ${item.title}`}
                      >
                        <Text style={styles.checklistActionText}>Book</Text>
                        <Ionicons name="open-outline" size={12} color="#ffffff" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })}
              <Text style={styles.companionDisclosure}>{AFFILIATE_DISCLOSURE_SHORT}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Trip Essentials Strip (eSIM & Travel Insurance) */}
      <View style={styles.essentialsCard}>
        <Text style={styles.essentialsTitle}>Trip essentials</Text>
        <View style={styles.essentialsRow}>
          {TRIP_ESSENTIALS.map((essential) => (
            <TouchableOpacity
              key={essential.id}
              style={styles.essentialChip}
              onPress={() => handleOpenEssential(essential)}
              accessibilityRole="button"
              accessibilityLabel={`${essential.title} via ${essential.partnerLabel}`}
            >
              <Ionicons name={essential.icon} size={16} color="#143D46" />
              <View style={styles.essentialTextWrap}>
                <Text style={styles.essentialLabel}>{essential.title}</Text>
                <Text style={styles.essentialPartner}>{essential.partnerLabel}</Text>
              </View>
              <Ionicons name="open-outline" size={14} color="#C03A31" />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.companionDisclosure}>{AFFILIATE_DISCLOSURE_SHORT}</Text>
      </View>

      {/* Full-Screen High-Contrast "Show Taxi Driver" Modal */}
      {showTaxiModal && taxiCard ? (
        <SafeModal
          visible={showTaxiModal}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowTaxiModal(false)}
        >
          <SafeAreaView style={styles.taxiModalContainer} edges={['top', 'bottom']}>
            <View style={styles.taxiModalHeader}>
              <Text style={styles.taxiModalKicker}>DRIVER CARD</Text>
              <TouchableOpacity
                style={styles.taxiCloseButton}
                onPress={() => setShowTaxiModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Close taxi driver card"
              >
                <Ionicons name="close" size={24} color="#0f172a" />
                <Text style={styles.taxiCloseText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.taxiCardBody}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.taxiPhrase}>{taxiCard.driverPhrase}</Text>
              <Text style={styles.taxiVenueName}>{taxiCard.venueName}</Text>
              <View style={styles.taxiAddressBox}>
                <Text style={styles.taxiAddressText} selectable>
                  {taxiCard.addressLine}
                </Text>
                <Text style={styles.taxiDestinationText}>{taxiCard.destinationLine}</Text>
              </View>
              <Text style={styles.taxiFootnote}>{taxiCard.englishSubtitle}</Text>
            </ScrollView>
          </SafeAreaView>
        </SafeModal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 24,
    marginBottom: 20,
    gap: 12,
  },
  upNextCard: {
    backgroundColor: '#143D46',
    borderRadius: borderRadius.lg,
    padding: 16,
    gap: 10,
  },
  upNextTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5EEAD4',
  },
  liveBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#99F6E4',
  },
  upNextTime: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  upNextTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  upNextAddress: {
    fontSize: 14,
    lineHeight: 20,
    color: '#E2E8F0',
  },
  followingText: {
    fontSize: 13,
    color: '#CBD5E1',
  },
  upNextActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryCompanionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  primaryCompanionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  secondaryCompanionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  secondaryCompanionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
  },
  shiftLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  shiftButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shiftChip: {
    minHeight: 44,
    minWidth: 52,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftChipActive: {
    backgroundColor: '#99F6E4',
  },
  shiftChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  shiftChipTextActive: {
    color: '#0f172a',
  },
  shiftResetChip: {
    minHeight: 44,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  shiftResetText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#99F6E4',
    textDecorationLine: 'underline',
  },
  readinessBanner: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  readinessHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  readinessHeaderText: {
    flex: 1,
    gap: 3,
  },
  readinessTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  readinessDetail: {
    fontSize: 13,
    lineHeight: 18,
    color: '#334155',
  },
  readinessActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  readinessPillBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
  },
  readinessPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  rainSwapBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rainSwapText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#143D46',
  },
  checklistBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  checklistRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  checklistDay: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  checklistBody: {
    flex: 1,
    gap: 2,
  },
  checklistStop: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  checklistReason: {
    fontSize: 12,
    lineHeight: 17,
    color: '#475569',
  },
  checklistActionBtn: {
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.action.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
  },
  checklistActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  essentialsCard: {
    backgroundColor: '#FAF8F3',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#DCE5E3',
    padding: 14,
    gap: 8,
  },
  essentialsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#143D46',
  },
  essentialsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  essentialChip: {
    flex: 1,
    minWidth: 140,
    minHeight: 48,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE5E3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  essentialTextWrap: {
    flex: 1,
  },
  essentialLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  essentialPartner: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  companionDisclosure: {
    fontSize: 11,
    lineHeight: 15,
    color: '#475569',
  },
  taxiModalContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  taxiModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  taxiModalKicker: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#99F6E4',
  },
  taxiCloseButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taxiCloseText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  taxiCardBody: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  taxiPhrase: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    color: '#FEF08A',
  },
  taxiVenueName: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
    color: '#ffffff',
  },
  taxiAddressBox: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#475569',
    gap: 8,
  },
  taxiAddressText: {
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '700',
    color: '#ffffff',
  },
  taxiDestinationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  taxiFootnote: {
    fontSize: 14,
    lineHeight: 20,
    color: '#CBD5E1',
  },
});
