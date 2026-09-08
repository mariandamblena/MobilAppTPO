import { Stack } from 'expo-router';

export default function ItemsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]/photos" />
      <Stack.Screen name="[id]/declare" />
      <Stack.Screen name="[id]/index" />
    </Stack>
  );
}
