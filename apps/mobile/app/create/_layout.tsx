import { Stack } from 'expo-router';
import { useReduceMotion } from '../../hooks/useReduceMotion';

export default function CreateLayout() {
  const reduceMotion = useReduceMotion();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#fff' },
        animation: reduceMotion ? 'none' : 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="generating" />
    </Stack>
  );
}
