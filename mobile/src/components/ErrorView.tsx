import { StyleSheet, Text, View } from 'react-native';
import { colors, typography, spacing } from '@/theme';
import { Button } from './Button';

interface ErrorViewProps {
  message: string;
  onRetry?: () => void;
}

/** Vista de error a pantalla completa con acción de reintento opcional. */
export function ErrorView({ message, onRetry }: ErrorViewProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? <Button title="Reintentar" variant="outline" onPress={onRetry} style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
    padding: spacing.xl,
  },
  message: { ...typography.body, color: colors.text.secondary, textAlign: 'center' },
  button: { marginTop: spacing.lg },
});
