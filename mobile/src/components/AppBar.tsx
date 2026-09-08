import { type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppDrawer } from '@/navigation/AppDrawerContext';
import { colors, fonts, typography, spacing } from '@/theme';

interface AppBarProps {
  /**
   * Si se pasa `title`, el AppBar entra en modo **subpantalla**: botón atrás + título.
   * Sin `title` es el modo raíz: hamburguesa + wordmark + campana.
   */
  title?: string;
  /** En modo raíz, muestra la campana (notificaciones). */
  showBell?: boolean;
  /** Acción opcional a la derecha (modo subpantalla): badge, botón "+ Nuevo", etc. */
  rightAction?: ReactNode;
  /** Override del botón atrás (ej: desconectar la sesión antes de salir del remate). */
  onBack?: () => void;
}

/**
 * Barra superior global y unificada.
 * - Modo raíz (tabs): hamburguesa (abre drawer) + AUCTIFY + campana.
 * - Modo subpantalla (`title`): ← atrás + título + acción. El atrás usa router.back()
 *   con fallback a la home si no hay historial (evita quedar sin salida).
 */
export function AppBar({ title, showBell = true, rightAction, onBack }: AppBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { openDrawer } = useAppDrawer();

  const goBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  if (title != null) {
    return (
      <View style={[styles.bar, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.leftFlex}>
          <Pressable onPress={goBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Atrás">
            <Feather name="chevron-left" size={26} color={colors.brand.primary} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {rightAction ?? null}
      </View>
    );
  }

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.left}>
        <Pressable onPress={openDrawer} hitSlop={8} accessibilityRole="button" accessibilityLabel="Abrir menú">
          <Feather name="menu" size={24} color={colors.brand.primary} />
        </Pressable>
        <Text style={styles.wordmark}>AUCTIFY</Text>
      </View>

      {showBell ? (
        <Pressable
          onPress={() => router.push('/(tabs)/notifications')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Notificaciones"
        >
          <Feather name="bell" size={22} color={colors.brand.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  leftFlex: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginRight: spacing.sm },
  wordmark: { fontFamily: fonts.display, fontSize: 20, color: colors.brand.primary, letterSpacing: 1 },
  title: { ...typography.heading3, color: colors.text.primary, flex: 1 },
});
