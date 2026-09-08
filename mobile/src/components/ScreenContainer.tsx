import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

interface ScreenContainerProps {
  children: ReactNode;
  /** Envuelve en ScrollView (default true). `scrollable` es alias de `scroll`. */
  scroll?: boolean;
  scrollable?: boolean;
  /** Centra el contenido verticalmente (pantallas simples tipo onboarding). */
  centered?: boolean;
  /** Header fijo arriba (ej. <AppBar/>). Si se pasa, el contenido no aplica inset superior. */
  header?: ReactNode;
}

/**
 * Contenedor base de pantalla: respeta el safe-area, aplica padding y fondo.
 * Si se pasa `header`, lo fija arriba (fuera del scroll) y omite el inset superior
 * del contenido — así el AppBar maneja el notch sin duplicar espacio.
 */
export function ScreenContainer({ children, scroll, scrollable, centered = false, header }: ScreenContainerProps) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: header ? spacing.md : insets.top + spacing.md,
    paddingBottom: insets.bottom + spacing.lg,
    paddingHorizontal: spacing.md,
  };

  // Por defecto scrollable, salvo que sea una pantalla centrada.
  const useScroll = (scrollable ?? scroll ?? true) && !centered;

  const body = useScroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, padding]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.content, centered && styles.centered, padding]}>{children}</View>
  );

  if (header) {
    return (
      <View style={styles.flex}>
        {header}
        {body}
      </View>
    );
  }

  return body;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background.primary },
  content: { flexGrow: 1 },
  centered: { justifyContent: 'center' },
});
