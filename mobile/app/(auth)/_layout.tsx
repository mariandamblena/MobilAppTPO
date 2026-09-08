import { Stack } from 'expo-router';
import { colors } from '@/theme';

/**
 * Layout del grupo de autenticacion.
 * Sin bottom tabs; solo stack de pantallas de auth.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background.primary },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { fontWeight: '700' },
      }}
    />
  );
}
