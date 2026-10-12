import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity } from 'react-native';
import { Input } from './ui';
import {
  HOTEL_SEARCH_CONSENT_VERSION,
  HOTEL_SEARCH_DISCLOSURE,
  parseHotelChildrenAges,
  hotelChildrenAgeText,
  validateHotelSearchDetails,
  type HotelSearchDetails,
} from '@faroway/constants';

export function HotelSearchFields({
  value,
  travelers,
  onChange,
}: {
  value: HotelSearchDetails | null;
  travelers: number;
  onChange: (value: HotelSearchDetails | null) => void;
}) {
  const [ageText, setAgeText] = useState(
    value?.rooms.map((room) => room.children.join(', ')) || []
  );
  return (
    <View
      style={{ padding: 16, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 16, gap: 12 }}
    >
      <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '600' }}>
        Hotel room details (optional)
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Switch
          accessibilityLabel="Save room details and allow hotel searches with Nuitee"
          value={value !== null}
          onValueChange={(enabled) => {
            setAgeText(['']);
            onChange(
              enabled
                ? {
                    countryCode: '',
                    guestNationality: '',
                    consentVersion: HOTEL_SEARCH_CONSENT_VERSION,
                    rooms: [{ adults: Math.min(travelers, 8), children: [] }],
                  }
                : null
            );
          }}
        />
        <Text style={{ flex: 1 }}>Save room details and allow hotel searches with Nuitee</Text>
      </View>
      <Text style={{ color: '#4b5563', lineHeight: 21 }}>{HOTEL_SEARCH_DISCLOSURE}</Text>
      {value && (
        <>
          <Input
            label="Destination country (two-letter code)"
            placeholder="For example: FR"
            value={value.countryCode}
            autoCapitalize="characters"
            onChangeText={(countryCode) =>
              onChange({ ...value, countryCode: countryCode.toUpperCase() })
            }
          />
          <Input
            label="Guest nationality (two-letter code)"
            placeholder="For example: US"
            value={value.guestNationality}
            autoCapitalize="characters"
            onChangeText={(guestNationality) =>
              onChange({ ...value, guestNationality: guestNationality.toUpperCase() })
            }
          />
          {value.rooms.map((room, index) => (
            <View key={index} style={{ gap: 10 }}>
              <Input
                label={`Adults in room ${index + 1}`}
                value={String(room.adults)}
                keyboardType="numeric"
                onChangeText={(text) =>
                  onChange({
                    ...value,
                    rooms: value.rooms.map((item, i) =>
                      i === index ? { ...item, adults: Number(text) } : item
                    ),
                  })
                }
              />
              <Input
                label={`Children’s ages at check-in, room ${index + 1}`}
                placeholder="For example: 6, 10"
                value={hotelChildrenAgeText(room.children, ageText[index])}
                onChangeText={(text) => {
                  setAgeText((previous) =>
                    value.rooms.map((item, i) =>
                      i === index ? text : (previous[i] ?? item.children.join(', '))
                    )
                  );
                  onChange({
                    ...value,
                    rooms: value.rooms.map((item, i) =>
                      i === index ? { ...item, children: parseHotelChildrenAges(text) } : item
                    ),
                  });
                }}
              />
            </View>
          ))}
          {value.rooms.length < 4 && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                setAgeText((previous) => [...previous, '']);
                onChange({ ...value, rooms: [...value.rooms, { adults: 1, children: [] }] });
              }}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text>Add room</Text>
            </TouchableOpacity>
          )}
          {value.rooms.length > 1 && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                setAgeText((previous) => previous.slice(0, -1));
                onChange({ ...value, rooms: value.rooms.slice(0, -1) });
              }}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text>Remove last room</Text>
            </TouchableOpacity>
          )}
          {!validateHotelSearchDetails(value, travelers) && (
            <Text accessibilityLiveRegion="polite" style={{ color: '#92400e' }}>
              Complete the country codes and room guests. Room guests must total {travelers};
              children’s ages must be 0–17.
            </Text>
          )}
        </>
      )}
    </View>
  );
}
