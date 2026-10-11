import { View, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { hotelPreviewFacts } from '../lib/generationFacts';

type FactStyles = {
  hotelPreviewInfo?: StyleProp<ViewStyle>;
  hotelPreviewName?: StyleProp<TextStyle>;
  hotelPreviewRating?: StyleProp<ViewStyle>;
  hotelPreviewStars?: StyleProp<TextStyle>;
  hotelPreviewScore?: StyleProp<TextStyle>;
  hotelPreviewPrice?: StyleProp<TextStyle>;
};

export function GenerationHotelFacts({
  hotel,
  styles = {},
}: {
  hotel: Record<string, unknown>;
  styles?: FactStyles;
}) {
  const facts = hotelPreviewFacts(hotel);
  return (
    <View style={styles.hotelPreviewInfo}>
      <Text style={styles.hotelPreviewName} numberOfLines={2}>
        {typeof hotel.name === 'string' && hotel.name.trim() ? hotel.name : 'Recommended hotel'}
      </Text>
      {(facts.stars || facts.rating) && (
        <View style={styles.hotelPreviewRating}>
          {facts.stars && <Text style={styles.hotelPreviewStars}>{facts.stars}</Text>}
          {facts.rating && <Text style={styles.hotelPreviewScore}>{facts.rating}</Text>}
        </View>
      )}
      <Text style={styles.hotelPreviewPrice}>{facts.price}</Text>
    </View>
  );
}
