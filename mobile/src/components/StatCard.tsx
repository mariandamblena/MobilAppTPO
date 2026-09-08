import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius, shadows } from '@/theme';

/**
 * Tarjeta de estadística reutilizable (valor + etiqueta).
 *
 * Variantes:
 * - `card` (default): tarjeta blanca con borde y sombra suave; valor en azul de marca.
 * - `accent`: fondo azul de marca, valor y etiqueta en blanco.
 * - `pill`: tarjeta blanca compacta con borde; valor grande en azul + etiqueta en overline.
 *
 * Cubre los bloques de stats de Métricas (card/accent), Vender (pill) y Perfil (pill).
 */
interface StatCardProps {
  value: string | number;
  label: string;
  variant?: 'card' | 'pill' | 'accent';
}

export function StatCard({ value, label, variant = 'card' }: StatCardProps) {
  const accent = variant === 'accent';

  if (variant === 'pill') {
    return (
      <View style={styles.pill}>
        <Text style={styles.pillValue}>{value}</Text>
        <Text style={styles.pillLabel}>{label.toUpperCase()}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, accent && styles.cardAccent]}>
      <Text style={[styles.value, accent && styles.valueAccent]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.label, accent && styles.labelAccent]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── card / accent (Métricas) ──
  card: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
    ...shadows.card,
  },
  cardAccent: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  value: {
    ...typography.heading2,
    color: colors.brand.primary,
    marginBottom: 4,
  },
  valueAccent: {
    color: '#FFFFFF',
  },
  label: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  labelAccent: {
    color: 'rgba(255,255,255,0.8)',
  },

  // ── pill (Vender / Perfil) ──
  pill: {
    flex: 1,
    backgroundColor: colors.background.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  pillValue: { fontFamily: 'Inter_700Bold', fontSize: 22, color: colors.brand.primary },
  pillLabel: { ...typography.overline, color: colors.text.tertiary, fontSize: 10, marginTop: 2 },
});
