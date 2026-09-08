import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, typography, spacing } from '@/theme';

interface LoadingProps {
  message?: string;
}

/** Indicador de carga centrado a pantalla completa. */
export function Loading({ message }: LoadingProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.brand.primary} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
    padding: spacing.lg,
  },
  message: { ...typography.body, color: colors.text.secondary, marginTop: spacing.md },
});
