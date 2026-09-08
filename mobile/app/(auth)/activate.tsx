import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { colors, typography, spacing } from '@/theme';
import type { ApiError } from '@/api/client';

interface ActivateErrors {
  token?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

/**
 * Activacion de cuenta etapa 2 (F01).
 * Recibe el token del deep-link (scheme "auctify://activate?token=xxx")
 * o el usuario lo escribe manualmente.
 * Al exito guarda el JWT y entra logueado directamente.
 */
export default function ActivateScreen() {
  const router = useRouter();
  const { activate } = useAuth();

  // Soporte de deep-link: auctify://activate?token=act_abc123
  const params = useLocalSearchParams<{ token?: string }>();

  const [token, setToken] = useState(params.token ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ActivateErrors>({});

  function validate(): boolean {
    const next: ActivateErrors = {};

    if (!token.trim()) next.token = 'El token de activación es obligatorio';

    if (!password) {
      next.password = 'La contraseña es obligatoria';
    } else if (password.length < 8) {
      next.password = 'La contraseña debe tener al menos 8 caracteres';
    }

    if (!confirmPassword) {
      next.confirmPassword = 'Confirmá tu contraseña';
    } else if (password !== confirmPassword) {
      next.confirmPassword = 'Las contraseñas no coinciden';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleActivate() {
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      await activate(token.trim(), password);
      // activate() guarda el JWT; ir directo a la app
      router.replace('/(tabs)');
    } catch (err) {
      const apiError = err as ApiError;

      if (apiError.code === 'INVALID_TOKEN') {
        setErrors({ token: 'El token no es válido o expiró. Pedí que te reenvíen el email.' });
        return;
      }

      if (apiError.code === 'ACCOUNT_ALREADY_ACTIVATED') {
        setErrors({ general: 'Tu cuenta ya fue activada. Podés iniciar sesión.' });
        return;
      }

      setErrors({ general: apiError.message ?? 'No se pudo activar la cuenta. Intentá de nuevo.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Activar cuenta</Text>
      <Text style={styles.subtitle}>
        Ingresá el token que recibiste por email y elegí tu contraseña.
      </Text>

      {errors.general ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{errors.general}</Text>
        </View>
      ) : null}

      <Field
        label="Token de activación"
        required
        value={token}
        onChangeText={setToken}
        error={errors.token}
        placeholder="act_abc123"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Field
        label="Nueva contraseña"
        required
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        placeholder="Mínimo 8 caracteres"
        secureTextEntry
      />

      <Field
        label="Confirmar contraseña"
        required
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={errors.confirmPassword}
        placeholder="Repetí tu contraseña"
        secureTextEntry
      />

      <Button
        title="Activar y entrar"
        onPress={handleActivate}
        loading={loading}
        style={styles.button}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.heading2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  errorBanner: {
    backgroundColor: colors.feedback.errorBackground,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    ...typography.bodySmall,
    color: colors.feedback.error,
  },
  button: {
    marginTop: spacing.md,
  },
});
