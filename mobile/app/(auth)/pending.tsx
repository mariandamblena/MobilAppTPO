import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { colors, typography, spacing } from '@/theme';

/**
 * Pantalla informativa "pendiente de admision" (F01).
 * Se muestra tras el registro exitoso de etapa 1 (nextStep: "await_admission_email")
 * o cuando el login retorna 403 NOT_ADMITTED.
 */
export default function PendingScreen() {
  const router = useRouter();

  return (
    <ScreenContainer centered>
      <Text style={styles.title}>Registro en revisión</Text>
      <Text style={styles.body}>
        Tu solicitud fue recibida. La empresa verificará tus datos y te enviarán un{' '}
        <Text style={styles.emphasis}>email con un token de activación</Text>.
      </Text>
      <Text style={styles.body}>
        Una vez que recibas ese email, volvé a la app para completar tu contraseña y empezar a pujar.
      </Text>

      <View style={styles.actions}>
        <Button
          title="Ya tengo el token de activación"
          onPress={() => router.push('/(auth)/activate')}
        />
        <Button
          title="Volver al inicio"
          variant="outline"
          onPress={() => router.replace('/(auth)/login')}
          style={styles.secondaryButton}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.heading2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 24,
  },
  emphasis: {
    fontWeight: '700',
    color: colors.brand.primary,
  },
  actions: {
    marginTop: spacing.xl,
    width: '100%',
    gap: spacing.sm,
  },
  secondaryButton: {
    marginTop: spacing.xs,
  },
});
