import { Alert } from 'react-native';
import { savedTripReviewUrl } from './savedTripUrl';
export { savedTripReviewUrl } from './savedTripUrl';

/** Never use a generated provider URL or copy native credentials into the browser. */
export function reviewSavedTripBooking(
  tripId: string | undefined,
  openUrl: (url: string) => Promise<unknown>
): void {
  const url = savedTripReviewUrl(tripId);
  if (!url) {
    Alert.alert(
      'Booking preview',
      'Finish saving your trip, then review booking options from your saved trip. Preview links cannot be used to book.'
    );
    return;
  }
  Alert.alert(
    'Review booking options on Faroway?',
    'We’ll open your saved trip and check the current plan before any provider handoff. You may need to sign in. Prices, availability, and cancellation terms must be confirmed with the provider before payment. Opening the trip does not make a booking.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Review saved trip',
        onPress: () => {
          void openUrl(url).catch(() =>
            Alert.alert('Couldn’t open your trip', 'Your trip is still saved. Please try again.')
          );
        },
      },
    ]
  );
}
