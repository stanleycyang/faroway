import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import type { TripBooking, TripBookingStatus } from '@faroway/types';
import { getTripBookings, updateTripBooking } from '../../services/api';
import { colors } from '../../constants/theme';
import { hapticFeedback } from '../../utils/haptics';

interface BookingDashboardProps {
  tripId: string;
}

const partnerDisplayNames: Record<string, string> = {
  viator: 'Viator',
  getyourguide: 'GetYourGuide',
  duffel: 'Duffel',
};

const statusConfig: Record<
  TripBookingStatus,
  { label: string; icon: string; color: string; bg: string }
> = {
  confirmed: { label: 'Confirmed', icon: 'checkmark-circle', color: '#15803d', bg: '#f0fdf4' },
  user_confirmed: { label: 'Confirmed', icon: 'checkmark-circle', color: '#15803d', bg: '#f0fdf4' },
  pending: { label: 'Pending', icon: 'time', color: '#a16207', bg: '#fefce8' },
  cancelled: { label: 'Cancelled', icon: 'close-circle', color: '#dc2626', bg: '#fef2f2' },
  expired: { label: 'Expired', icon: 'alert-circle', color: '#6b7280', bg: '#f9fafb' },
};

export function BookingDashboard({ tripId }: BookingDashboardProps) {
  const [bookings, setBookings] = useState<TripBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await getTripBookings(tripId);
      if (res.data?.bookings) {
        setBookings(res.data.bookings);
      }
    } catch {
      // Silent fail — dashboard is non-critical
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Re-fetch when app returns to foreground (return-from-OTA detection)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        fetchBookings();
      }
    });
    return () => subscription.remove();
  }, [fetchBookings]);

  const handleUserConfirm = async (bookingId: string) => {
    setConfirmingId(bookingId);
    hapticFeedback.light();
    try {
      await updateTripBooking(tripId, bookingId, 'user_confirmed');
      await fetchBookings();
      hapticFeedback.success();
    } catch {
      // Silent fail
    } finally {
      setConfirmingId(null);
    }
  };

  const handleManage = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
        controlsColor: colors.primary[600],
      });
    } catch (error) {
      console.error('Failed to open manage URL:', error);
    }
  };

  if (loading) return null;

  const activeBookings = bookings.filter(
    (b) => b.status !== 'expired' && b.status !== 'cancelled',
  );
  if (activeBookings.length === 0) return null;

  const confirmedCount = activeBookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'user_confirmed',
  ).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Bookings</Text>
        <Text style={styles.counter}>
          {confirmedCount} of {activeBookings.length} confirmed
        </Text>
      </View>

      {activeBookings.map((booking) => {
        const status = statusConfig[booking.status];
        const partnerName = partnerDisplayNames[booking.partner] || booking.partner;
        const isConfirmed = booking.status === 'confirmed' || booking.status === 'user_confirmed';
        const isPending = booking.status === 'pending';

        return (
          <View key={booking.id} style={styles.bookingRow}>
            <Ionicons
              name={booking.category === 'flight' ? 'airplane' : 'location'}
              size={18}
              color={booking.category === 'flight' ? '#3b82f6' : '#8b5cf6'}
            />
            <View style={styles.bookingInfo}>
              <Text style={styles.bookingName} numberOfLines={1}>
                {booking.itemName}
              </Text>
              <Text style={styles.bookingPartner}>
                {isConfirmed ? `Booked via ${partnerName}` : `Pending on ${partnerName}`}
              </Text>
            </View>

            <View style={styles.bookingActions}>
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Ionicons name={status.icon as any} size={12} color={status.color} />
                <Text style={[styles.statusText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>

              {isConfirmed && booking.partnerManageUrl && (
                <TouchableOpacity
                  style={styles.manageButton}
                  onPress={() => handleManage(booking.partnerManageUrl!)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.manageButtonText}>Manage</Text>
                  <Ionicons name="open-outline" size={12} color={colors.primary[600]} />
                </TouchableOpacity>
              )}

              {isPending && (
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => handleUserConfirm(booking.id)}
                  disabled={confirmingId === booking.id}
                  activeOpacity={0.7}
                >
                  {confirmingId === booking.id ? (
                    <ActivityIndicator size="small" color="#15803d" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={12} color="#15803d" />
                      <Text style={styles.confirmButtonText}>I booked this</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Bookings are managed by our partners. Use the "Manage" link for changes or support.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  counter: {
    fontSize: 12,
    color: '#6b7280',
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
    gap: 10,
  },
  bookingInfo: {
    flex: 1,
    minWidth: 0,
  },
  bookingName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  bookingPartner: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  bookingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  manageButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.primary[600],
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
  },
  confirmButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#15803d',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
  },
  footerText: {
    fontSize: 10,
    color: '#9ca3af',
    lineHeight: 14,
  },
});
