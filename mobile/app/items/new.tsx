import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { post } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { colors, typography, spacing } from '@/theme';
import type { Product } from '@/api/types';
import type { ApiError } from '@/api/client';

interface FormErrors {
  fullDescription?: string;
  general?: string;
}

export default function NewItemScreen() {
  const router = useRouter();

  const [fullDescription, setFullDescription] = useState('');
  const [catalogDescription, setCatalogDescription] = useState('');
  const [artist, setArtist] = useState('');
  const [historicalDate, setHistoricalDate] = useState('');
  const [history, setHistory] = useState('');
  const [pieceCount, setPieceCount] = useState('1');

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): boolean {
    const next: FormErrors = {};
    if (!fullDescription.trim()) next.fullDescription = 'La descripción completa es obligatoria';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleNext() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});

    try {
      const product = await post<Product>('/products', {
        fullDescription: fullDescription.trim(),
        ...(catalogDescription.trim() && { catalogDescription: catalogDescription.trim() }),
        ...(artist.trim() && { artist: artist.trim() }),
        ...(historicalDate.trim() && { historicalDate: historicalDate.trim() }),
        ...(history.trim() && { history: history.trim() }),
        pieceCount: parseInt(pieceCount, 10) || 1,
      });
      router.push(`/items/${product.id}/photos`);
    } catch (err) {
      setErrors({ general: (err as ApiError).message ?? 'No se pudo crear el artículo.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer scrollable header={<AppBar title="Nuevo artículo" />}>
      {errors.general ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{errors.general}</Text>
        </View>
      ) : null}

      <Field
        label="Descripción completa"
        required
        value={fullDescription}
        onChangeText={setFullDescription}
        error={errors.fullDescription}
        placeholder="Descripción detallada del bien, estado, historia..."
        multiline
        numberOfLines={4}
      />

      <Field
        label="Descripción para catálogo"
        value={catalogDescription}
        onChangeText={setCatalogDescription}
        placeholder="Descripción breve (aparece en el catálogo)"
      />

      <Field
        label="Artista / autor"
        value={artist}
        onChangeText={setArtist}
        placeholder="Opcional"
      />

      <Field
        label="Época / fecha histórica"
        value={historicalDate}
        onChangeText={setHistoricalDate}
        placeholder="Ej: Siglo XIX, 1890"
      />

      <Field
        label="Historia / procedencia"
        value={history}
        onChangeText={setHistory}
        placeholder="Cómo llegó a tus manos, procedencia..."
        multiline
        numberOfLines={3}
      />

      <Field
        label="Cantidad de piezas"
        value={pieceCount}
        onChangeText={setPieceCount}
        placeholder="1"
        keyboardType="numeric"
      />

      <Button
        title="Cargar fotos"
        onPress={handleNext}
        loading={loading}
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
  button: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
