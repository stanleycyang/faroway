import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useAuthContext } from '../../components/AuthProvider';
import { colors } from '../../constants/theme';

export default function ProfileLayout() {
  const reduceMotion = useReduceMotion();
  const { initialized, isAuthenticated } = useAuthContext();

  if (!initialized) {
    return (
      <View
        style={styles.loading}
        accessibilityRole="progressbar"
        accessibilityLabel="Checking your account"
      >
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(tabs)/profile" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0a0a0f' },
        animation: reduceMotion ? 'none' : 'slide_from_right',
        animationDuration: reduceMotion ? 0 : 300,
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
