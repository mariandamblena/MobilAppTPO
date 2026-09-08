import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { post } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { colors, typography, spacing } from '@/theme';
import type { InclusionRequest } from '@/api/types';
import type { ApiError } from '@/api/client';

export default function DeclareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [itemDescription, setItemDescription] = useState('');
  const [ownershipDeclared, setOwnershipDeclared] = useState(false);
  const [legalityDeclared, setLegalityDeclared] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = ownershipDeclared && legalityDeclared;

  async function handleSubmit() {
    if (!canSubmit) return;
    if (!itemDescription.trim()) {
      setError('Completá una descripción breve del ítem antes de enviar.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await post<InclusionRequest>('/inclusion-requests', {
        productId: Number(id),
        itemDescription: itemDescription.trim(),
        ownershipDeclared: true,
        legalityDeclared: true,
      });

      Alert.alert(
        'Solicitud enviada',
        'Tu solicitud fue enviada. Te notificaremos cuando haya novedades.',
        [{ text: 'Ver mis artículos', onPress: () => router.replace('/(tabs)/items') }]
      );
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'MISSING_PHOTOS') {
        setError('El artículo necesita al menos 6 fotos. Volvé al paso anterior.');
      } else if (apiError.code === 'DECLARATION_REQUIRED') {
        setError('Debés marcar ambas declaraciones para continuar.');
      } else {
        setError(apiError.message ?? 'No se pudo enviar la solicitud. Intentá de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer scrollable header={<AppBar title="Declaraciones" />}>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      <Field
        label="Descripción del ítem"
        required
        value={itemDescription}
        onChangeText={setItemDescription}
        placeholder="Describí brevemente el ítem para la solicitud"
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity
        style={styles.checkRow}
        onPress={() => setOwnershipDeclared((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, ownershipDeclared && styles.checkboxChecked]}>
          {ownershipDeclared && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.checkLabel}>
          Declaro ser el legítimo propietario del bien y tener derecho a ofrecerlo para subasta.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.checkRow}
        onPress={() => setLegalityDeclared((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, legalityDeclared && styles.checkboxChecked]}>
          {legalityDeclared && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.checkLabel}>
          Declaro que el bien tiene origen lícito y no está sujeto a ningún impedimento legal.
        </Text>
      </TouchableOpacity>

      <Button
        title="Enviar solicitud"
        onPress={handleSubmit}
        loading={loading}
        disabled={!canSubmit}
        style={styles.button}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  errorBanner: {
    backgroundColor: colors.feedback.errorBackground,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorBannerText: { ...typography.bodySmall, color: colors.feedback.error },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel: { ...typography.body, color: colors.text.primary, flex: 1 },
  button: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
