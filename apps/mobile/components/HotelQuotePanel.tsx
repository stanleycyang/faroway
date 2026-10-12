import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { HotelQuoteResult } from '@faroway/types';
import { validateHotelSearchDetails } from '@faroway/constants';
import type { Trip } from '../stores/tripStore';
import { getTripHotelQuotes } from '../services/api';

export function HotelQuotePanel({ trip }: { trip: Trip }) {
  const [quotes, setQuotes] = useState<HotelQuoteResult | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    []
  );
  const ready = !!trip.updatedAt && validateHotelSearchDetails(trip.hotelSearch, trip.travelers);
  async function search() {
    if (!ready || loading || !trip.updatedAt) return;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setQuotes(null);
    setMessage('');
    try {
      const result = await getTripHotelQuotes(trip.id, trip.updatedAt, controller.signal);
      if (active.current !== controller) return;
      if (result.error || !result.data) throw new Error(result.error || 'Hotel search failed.');
      if (result.data.tripId !== trip.id || result.data.tripUpdatedAt !== trip.updatedAt)
        throw new Error('Your trip changed. Refresh before searching hotels.');
      setQuotes(result.data);
    } catch (error) {
      if (active.current === controller)
        setMessage(error instanceof Error ? error.message : 'Hotel search failed.');
    } finally {
      if (active.current === controller) {
        setLoading(false);
        active.current = null;
      }
    }
  }
  return (
    <View
      style={{
        padding: 18,
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 16,
        gap: 12,
        marginVertical: 16,
      }}
    >
      <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '600' }}>
        Hotel options for your stay
      </Text>
      <Text>
        {ready
          ? 'Search with your saved dates, nationality and room guests. No reservation is made.'
          : 'Add hotel room details and consent in your trip brief on the website before searching.'}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready || loading }}
        disabled={!ready || loading}
        onPress={search}
        style={{
          backgroundColor: '#111827',
          padding: 14,
          borderRadius: 10,
          opacity: ready && !loading ? 1 : 0.5,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', textAlign: 'center' }}>Search hotel options</Text>
        )}
      </TouchableOpacity>
      {!!message && <Text accessibilityLiveRegion="polite">{message}</Text>}
      {quotes && (
        <>
          {quotes.sandbox && (
            <Text style={{ color: '#92400e' }}>
              Sandbox quotes for testing; these cannot be booked.
            </Text>
          )}
          {quotes.hotels.length === 0 && (
            <Text>No hotel quotes were available for these details.</Text>
          )}
          {quotes.hotels.map((hotel) => (
            <View key={hotel.id} style={{ gap: 8, paddingTop: 10 }}>
              <Text accessibilityRole="header" style={{ fontWeight: '600' }}>
                {hotel.name}
              </Text>
              {hotel.offers.map((offer) => (
                <View key={offer.id} style={{ gap: 4 }}>
                  <Text>
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: offer.currency,
                    }).format(offer.stayAmount)}{' '}
                    for the stay · {offer.roomCount} room(s)
                  </Text>
                  {offer.additionalTaxes.map((tax, i) => (
                    <Text key={i}>
                      Additional {tax.description}: {tax.amount} {tax.currency}
                    </Text>
                  ))}
                  <Text>{offer.cancellationNote}</Text>
                </View>
              ))}
            </View>
          ))}
        </>
      )}
    </View>
  );
}
