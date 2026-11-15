import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '../../stores/userStore';
import { Button } from '../../components/ui/Button';
import { VenuePhotoCredit } from '../../components/VenuePhotoCredit';
import { firstRunDestinations } from '../../lib/firstRunDestinations';

export default function OnboardingScreen() {
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const stackDestinations = width < 360 || fontScale > 1.25;
  const setOnboardingComplete = useUserStore((state) => state.setOnboardingComplete);
  const choose = (destination?: { name: string; country: string }) => {
    setOnboardingComplete(true);
    router.replace(
      destination
        ? {
            pathname: '/create',
            params: { destination: destination.name, country: destination.country },
          }
        : '/create'
    );
  };
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={24} color="#143D46" />
        </TouchableOpacity>
        <Text style={styles.wordmark}>faroway</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>
          Where are you dreaming of?
        </Text>
        <Text style={styles.description}>
          Start with a place. Your dates, interests, and pace come next.
        </Text>
        <Button title="Find my destination" onPress={() => choose()} fullWidth size="lg" />
        <Text style={styles.collectionTitle}>Or start somewhere inspiring</Text>
        {firstRunDestinations.map((destination) => (
          <View key={destination.name} style={styles.destination}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Plan a trip to ${destination.name}, ${destination.country}`}
              onPress={() => choose(destination)}
              style={[styles.destinationButton, stackDestinations && styles.stackedDestination]}
            >
              <Image
                source={destination.source}
                style={[styles.photo, stackDestinations && styles.stackedPhoto]}
                accessible={false}
              />
              <View style={styles.destinationCopy}>
                <Text style={styles.destinationName}>{destination.name}</Text>
                <Text style={styles.country}>{destination.country}</Text>
                <Text style={styles.detail}>{destination.detail}</Text>
              </View>
              {!stackDestinations && (
                <Ionicons name="chevron-forward" size={20} color="#143D46" accessible={false} />
              )}
            </TouchableOpacity>
            <VenuePhotoCredit credit={destination.credit} />
          </View>
        ))}
        <Button
          title="Just looking? Explore first"
          variant="ghost"
          fullWidth
          onPress={() => {
            setOnboardingComplete(true);
            router.replace('/(tabs)');
          }}
        />
        <Text style={styles.note}>
          No account needed to explore. Sign in to generate and save your plan.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF8F3' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  back: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontSize: 22, fontWeight: '800', color: '#143D46', letterSpacing: -0.5 },
  content: { padding: 24, paddingTop: 12, paddingBottom: 32 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '800', color: '#143D46', letterSpacing: -0.8 },
  description: { fontSize: 17, lineHeight: 25, color: '#475D61', marginTop: 12, marginBottom: 24 },
  collectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475D61',
    marginTop: 32,
    marginBottom: 16,
  },
  destination: { marginBottom: 20 },
  destinationButton: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 116 },
  photo: { width: 100, height: 116, borderRadius: 12 },
  stackedDestination: { flexDirection: 'column', alignItems: 'stretch' },
  stackedPhoto: { width: '100%', height: 150 },
  destinationCopy: { flex: 1, minWidth: 0 },
  destinationName: { fontSize: 21, fontWeight: '700', color: '#143D46' },
  country: { fontSize: 13, color: '#475D61', marginTop: 4 },
  detail: { fontSize: 14, lineHeight: 20, color: '#475D61', marginTop: 8 },
  note: { fontSize: 13, lineHeight: 20, textAlign: 'center', color: '#475D61' },
});
