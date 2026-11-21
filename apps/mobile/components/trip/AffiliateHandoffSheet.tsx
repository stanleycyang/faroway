import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AFFILIATE_DISCLOSURE_SHORT } from '@faroway/constants';
import { borderRadius, colors, shadows } from '../../constants/theme';
import {
  formatAffiliatePartnerName,
  type ConfirmAffiliateOpenParams,
} from '../../lib/affiliateCheckout';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const SafeModal = Modal ?? ('Modal' as unknown as typeof Modal);

export interface AffiliateHandoffSheetProps {
  visible: boolean;
  params: ConfirmAffiliateOpenParams | null;
  opening?: boolean;
  onClose: () => void;
  onConfirm: (params: ConfirmAffiliateOpenParams) => void;
}

export function AffiliateHandoffSheet({
  visible,
  params,
  opening = false,
  onClose,
  onConfirm,
}: AffiliateHandoffSheetProps) {
  const reduceMotion = useReduceMotion();
  if (!params) return null;

  const partnerName = formatAffiliatePartnerName(params.affiliatePartner);

  return (
    <SafeModal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.header}>
              <View style={styles.partnerBadge}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#0F766E" />
                <Text style={styles.partnerBadgeText}>{partnerName}</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close partner handoff"
              >
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <Text style={styles.title} accessibilityRole="header">
              Continue to {partnerName}
            </Text>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {params.itemName}
            </Text>

            <View style={styles.detailsBox}>
              <View style={styles.detailRow}>
                <Ionicons name="pricetag-outline" size={16} color="#475569" />
                <Text style={styles.detailText}>
                  {params.priceLabel
                    ? `Estimated price: ${params.priceLabel}`
                    : 'Final price is confirmed on the partner site'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="document-text-outline" size={16} color="#475569" />
                <Text style={styles.detailText}>
                  {params.cancellationLabel ||
                    'Availability, taxes, and cancellation terms are confirmed with the partner before payment.'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="bookmark-outline" size={16} color="#475569" />
                <Text style={styles.detailText}>
                  Your Faroway itinerary stays saved here when you return.
                </Text>
              </View>
            </View>

            <Text style={styles.disclosure}>{AFFILIATE_DISCLOSURE_SHORT}</Text>

            <TouchableOpacity
              style={[styles.primaryButton, opening && styles.primaryButtonDisabled]}
              onPress={() => onConfirm(params)}
              disabled={opening}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Continue to ${partnerName}`}
            >
              {opening ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Continue to {partnerName}</Text>
                  <Ionicons name="open-outline" size={16} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onClose}
              disabled={opening}
              accessibilityRole="button"
              accessibilityLabel="Not now"
            >
              <Text style={styles.secondaryButtonText}>Not now</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </View>
    </SafeModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 16,
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  partnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  partnerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#143D46',
    marginBottom: 14,
  },
  detailsBox: {
    backgroundColor: '#FAF8F3',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#DCE5E3',
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#334155',
  },
  disclosure: {
    fontSize: 12,
    lineHeight: 17,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 14,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: borderRadius.md,
    backgroundColor: colors.action.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
});
