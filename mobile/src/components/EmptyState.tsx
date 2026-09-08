import { StyleSheet, Text, View } from 'react-native';
import { colors, typography, spacing } from '@/theme';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  message?: string;
  /** Acción opcional (CTA). Requiere `onAction`. */
  actionLabel?: string;
  onAction?: () => void;
}

/** Estado vacío centrado (listas sin resultados), con CTA opcional. */
export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} variant="outline" onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { ...typography.heading3, color: colors.text.primary, textAlign: 'center', marginBottom: spacing.xs },
  message: { ...typography.body, color: colors.text.secondary, textAlign: 'center' },
  action: { marginTop: spacing.lg },
});
