import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, typography, spacing, radius } from '@/theme';

type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  /** Icono opcional a la derecha del texto (ej: flecha en "INGRESAR →"). */
  rightIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Botón estándar de Auctify.
 * - `loading` muestra spinner y deshabilita (clave para "una puja a la vez", F05).
 * - Variantes: primary (azul), accent (marrón remate), outline (borde), ghost (sin fondo).
 */
export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  rightIcon,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const filled = variant === 'primary' || variant === 'accent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={filled ? colors.text.inverse : colors.brand.primary} />
      ) : (
        <View style={styles.content}>
          <Text style={[styles.text, filled ? styles.textInverse : styles.textBrand]}>
            {title}
          </Text>
          {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  icon: { justifyContent: 'center' },
  primary: { backgroundColor: colors.brand.primary },
  accent: { backgroundColor: colors.brand.accent },
  outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.brand.primary },
  ghost: { backgroundColor: 'transparent', minHeight: 0, paddingVertical: spacing.xs },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  text: { ...typography.label },
  textInverse: { color: colors.text.inverse },
  textBrand: { color: colors.brand.primary },
});
