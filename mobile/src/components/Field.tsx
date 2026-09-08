import { useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '@/theme';

interface FieldProps extends TextInputProps {
  label: string;
  /** Marca el campo como obligatorio (agrega `*`). */
  required?: boolean;
  /** Mensaje de error del campo (resalta el borde). */
  error?: string;
  /** Estilo "filled": fondo gris suave sin borde visible (diseño de las cards del Figma). */
  filled?: boolean;
  /** Label en MAYÚSCULA con tracking (overline) en vez del label normal. */
  overline?: boolean;
  /** Nodo alineado a la derecha de la fila del label (ej: link "¿Olvidó contraseña?"). */
  labelRight?: ReactNode;
  /** Icono trailing dentro del input (ej: sobre). Ignorado si `secureToggle`. */
  rightIcon?: ReactNode;
  /** Muestra un toggle de ojo para revelar/ocultar la contraseña. */
  secureToggle?: boolean;
}

/**
 * Campo de formulario con label, marca de obligatorio y mensaje de error.
 * Soporta variante `filled` (cards del diseño), label `overline`, accesorio a la
 * derecha del label (`labelRight`), icono trailing (`rightIcon`) y toggle de
 * visibilidad de contraseña (`secureToggle`). Acepta todas las props de TextInput.
 */
export function Field({
  label,
  required = false,
  error,
  filled = false,
  overline = false,
  labelRight,
  rightIcon,
  secureToggle = false,
  style,
  secureTextEntry,
  ...inputProps
}: FieldProps) {
  const [hidden, setHidden] = useState(true);
  const isSecure = secureToggle ? hidden : secureTextEntry;

  const trailing = secureToggle ? (
    <Pressable
      onPress={() => setHidden((h) => !h)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
    >
      <Feather name={hidden ? 'eye' : 'eye-off'} size={18} color={colors.text.tertiary} />
    </Pressable>
  ) : (
    rightIcon ?? null
  );

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={overline ? styles.labelOverline : styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
        {labelRight ?? null}
      </View>

      <View
        style={[
          styles.inputWrap,
          filled ? styles.inputWrapFilled : styles.inputWrapDefault,
          !!error && styles.inputWrapError,
        ]}
      >
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.text.tertiary}
          secureTextEntry={isSecure}
          {...inputProps}
        />
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: { ...typography.label, color: colors.text.primary },
  labelOverline: { ...typography.overline, color: colors.text.secondary },
  required: { color: colors.feedback.error },
  inputWrap: {
    minHeight: 52,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  inputWrapDefault: {
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.card,
  },
  inputWrapFilled: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputWrapError: { borderColor: colors.border.error },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },
  trailing: { marginLeft: spacing.sm },
  error: { ...typography.caption, color: colors.feedback.error, marginTop: spacing.xs },
});
