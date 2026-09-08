import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/auth/AuthContext';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { colors, typography, spacing, radius, fonts } from '@/theme';
import type { ApiError } from '@/api/client';

/**
 * Pantalla de login (F01).
 * Autenticación por **email** + contraseña (decisión D3 —.
 * Maneja: 401 credenciales inválidas, 403 NOT_ADMITTED / CLIENT_BLOCKED.
 */
export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  function validate(): boolean {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'El email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'El email no es válido';
    if (!password) next.password = 'La contraseña es obligatoria';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err) {
      const apiError = err as ApiError;

      if (apiError.code === 'NOT_ADMITTED') {
        router.replace('/(auth)/pending');
        return;
      }

      if (apiError.code === 'CLIENT_BLOCKED') {
        setErrors({ general: 'Tu cuenta está bloqueada por una multa pendiente. Contactá a la empresa.' });
        return;
      }

      setErrors({ general: apiError.message ?? 'Email o contraseña incorrectos.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer centered>
      <Text style={styles.wordmark}>AUCTIFY</Text>

      <View style={styles.card}>
        <Text style={styles.title}>Bienvenido</Text>
        <Text style={styles.subtitle}>
          Por favor ingresá tus credenciales para acceder a tu cuenta.
        </Text>

        {errors.general ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errors.general}</Text>
          </View>
        ) : null}

        <Field
          label="Email"
          overline
          filled
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          placeholder="nombre@compañia.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          rightIcon={<Feather name="mail" size={18} color={colors.text.tertiary} />}
        />

        <Field
          label="Contraseña"
          overline
          filled
          secureToggle
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          placeholder="••••••••"
          labelRight={
            <Pressable
              onPress={() => Alert.alert('Recuperar contraseña', 'Función próximamente disponible.')}
              hitSlop={6}
            >
              <Text style={styles.forgot}>¿Olvidó contraseña?</Text>
            </Pressable>
          }
        />

        <Button
          title="INGRESAR"
          onPress={handleLogin}
          loading={loading}
          rightIcon={<Feather name="arrow-right" size={18} color={colors.text.inverse} />}
          style={styles.submit}
        />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>¿Todavía no tenés cuenta? </Text>
        <Pressable onPress={() => router.push('/(auth)/register')} hitSlop={6}>
          <Text style={styles.footerLink}>Crear cuenta</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => router.push('/(auth)/activate')} hitSlop={6} style={styles.activate}>
        <Text style={styles.activateText}>Tengo un token de activación</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.brand.primary,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  forgot: {
    ...typography.caption,
    color: colors.brand.primaryStrong,
    fontWeight: '600',
  },
  submit: { marginTop: spacing.sm },
  errorBanner: {
    backgroundColor: colors.feedback.errorBackground,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorBannerText: { ...typography.bodySmall, color: colors.feedback.error },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  footerText: { ...typography.bodySmall, color: colors.text.secondary },
  footerLink: { ...typography.bodySmall, color: colors.brand.primary, fontWeight: '700' },
  activate: { alignSelf: 'center', marginTop: spacing.md },
  activateText: { ...typography.caption, color: colors.text.tertiary, textDecorationLine: 'underline' },
});
