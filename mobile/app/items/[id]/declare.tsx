import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, post } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { colors, typography, spacing } from '@/theme';
import type { InclusionRequest, Product } from '@/api/types';
import type { ApiError } from '@/api/client';

export default function DeclareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [itemDescription, setItemDescription] = useState('');
  const [ownershipDeclared, setOwnershipDeclared] = useState(false);
  const [legalityDeclared, setLegalityDeclared] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [submitted, setSubmitted] = useState<InclusionRequest | null>(null);
  const submitting = useRef(false);
  const submittedRef = useRef(false);
  const descriptionEdited = useRef(false);

  useEffect(() => {
    let active = true;
    setLoadingProduct(true);
    setError(null);
    get<Product>(`/products/${id}`)
      .then((data) => {
        if (!active) return;
        setProduct(data);
        if (!descriptionEdited.current) setItemDescription(data.fullDescription);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar el artículo. Reintentá.');
      })
      .finally(() => { if (active) setLoadingProduct(false); });
    return () => { active = false; };
  }, [id, reloadKey]);

  const canSubmit = !!product && ownershipDeclared && legalityDeclared && !submitted;

  async function handleSubmit() {
    if (!canSubmit || submitting.current || submittedRef.current) return;
    if (!itemDescription.trim()) {
      setError('Completá una descripción breve del ítem antes de enviar.');
      return;
    }

    submitting.current = true;
    setLoading(true);
    setError(null);

    try {
      const request = await post<InclusionRequest>('/inclusion-requests', {
        productId: Number(id),
        itemDescription: itemDescription.trim(),
        ownershipDeclared: true,
        legalityDeclared: true,
      });

      // Render confirmation on every platform: React Native's Alert is a no-op on web.
      submittedRef.current = true;
      setSubmitted(request);
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
      submitting.current = false;
      setLoading(false);
    }
  }

  if (loadingProduct) {
    return <ScreenContainer header={<AppBar title="Declaraciones" />}><Loading /></ScreenContainer>;
  }

  if (submitted) {
    return (
      <ScreenContainer scrollable header={<AppBar title="Solicitud enviada" onBack={() => router.replace('/(tabs)/items')} />}>
        <View style={styles.confirmation} accessibilityLiveRegion="polite">
          <Text style={styles.confirmationTitle}>Recibimos tu solicitud #{submitted.id}</Text>
          <Text style={styles.helper}>Podés consultar su estado y las novedades desde Mis artículos.</Text>
        </View>
        <Button title="Ver solicitud" onPress={() => router.replace(`/items/${submitted.id}`)} />
        <Button title="Ver mis artículos" variant="outline" onPress={() => router.replace('/(tabs)/items')} style={styles.button} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable header={<AppBar title="Declaraciones" />}>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      {!product ? (
        <Button title="Reintentar carga" onPress={() => setReloadKey((value) => value + 1)} />
      ) : null}

      {product?.estimatedStartingPrice != null ? (
        <View style={styles.confirmation}>
          <Text style={styles.confirmationTitle}>Precio de inicio sugerido (ARS)</Text>
          <Text style={styles.price}>{product.estimatedStartingPrice.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</Text>
          <Text style={styles.helper}>Importe orientativo sujeto a revisión antes de la subasta.</Text>
        </View>
      ) : null}

      <Field
        label="Descripción del ítem"
        required
        value={itemDescription}
        onChangeText={(value) => { descriptionEdited.current = true; setItemDescription(value); }}
        editable={!!product && !loading}
        placeholder="Describí brevemente el ítem para la solicitud"
        multiline
        numberOfLines={3}
      />

      <TouchableOpacity
        style={styles.checkRow}
        onPress={() => setOwnershipDeclared((v) => !v)}
        disabled={!product || loading}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: ownershipDeclared, disabled: !product || loading }}
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
        disabled={!product || loading}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: legalityDeclared, disabled: !product || loading }}
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
  confirmation: { backgroundColor: colors.background.card, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg },
  confirmationTitle: { ...typography.heading3, color: colors.brand.primary, marginBottom: spacing.sm },
  price: { ...typography.heading2, color: colors.text.primary, marginBottom: spacing.sm },
  helper: { ...typography.bodySmall, color: colors.text.secondary },
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
