import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { get, post, postMultipart } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { colors, typography, spacing, radius } from '@/theme';
import type { Photo, Product } from '@/api/types';

interface FormErrors {
  fullDescription?: string;
  pieceCount?: string;
  estimatedStartingPrice?: string;
  general?: string;
}

interface SuggestedFields {
  catalogDescription: string;
  fullDescription: string;
  pieceCount: string;
  estimatedStartingPrice: string;
}

interface PhotoAnalysis {
  suggestions: {
    catalogDescription: string;
    fullDescription: string;
    pieceCount: number | null;
    estimatedStartingPrice: number | null;
  };
  message?: string;
}

interface SelectedPhoto {
  uri: string;
  name: string;
  type: string;
}

type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error';
type SuggestedField = keyof SuggestedFields;

const EMPTY_FIELDS: SuggestedFields = { catalogDescription: '', fullDescription: '', pieceCount: '1', estimatedStartingPrice: '' };
const SUGGESTED_FIELDS: SuggestedField[] = ['catalogDescription', 'fullDescription', 'pieceCount', 'estimatedStartingPrice'];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_STARTING_PRICE = 1_000_000_000;
// Argentine notation: dots group thousands, and a comma separates cents.
// In particular, "15.000" means 15000; decimal-dot shorthand is rejected.
const PRICE_PATTERN = /^(?:\d+|[1-9]\d{0,2}(?:\.\d{3})+)(?:,\d{1,2})?$/;

function parseStartingPrice(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (!PRICE_PATTERN.test(text)) return Number.NaN;
  return Number(text.replace(/\./g, '').replace(',', '.'));
}

export default function NewItemScreen() {
  const router = useRouter();

  const [fields, setFields] = useState<SuggestedFields>({ ...EMPTY_FIELDS });
  const fieldsRef = useRef(fields);
  const edits = useRef({ catalogDescription: 0, fullDescription: 0, pieceCount: 0, estimatedStartingPrice: 0 });
  const generatedFields = useRef(new Set<SuggestedField>());
  const [artist, setArtist] = useState('');
  const [historicalDate, setHistoricalDate] = useState('');
  const [history, setHistory] = useState('');

  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);
  const [picking, setPicking] = useState(false);
  const pickingRef = useRef(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle');
  const [analysisMessage, setAnalysisMessage] = useState('');
  const analysisRequest = useRef(0);
  const analysisController = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const [loading, setLoading] = useState(false);
  const saving = useRef(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [createdProductId, setCreatedProductId] = useState<number | null>(null);
  const savedProductId = useRef<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      analysisRequest.current += 1;
      analysisController.current?.abort();
    };
  }, []);

  function changeField(field: SuggestedField, value: string) {
    edits.current[field] += 1;
    generatedFields.current.delete(field);
    const next = { ...fieldsRef.current, [field]: value };
    fieldsRef.current = next;
    setFields(next);
  }

  function stopAnalysis() {
    analysisRequest.current += 1;
    analysisController.current?.abort();
    analysisController.current = null;
    setAnalysisStatus('idle');
    setAnalysisMessage('Podés completar la ficha manualmente.');
  }

  function clearGeneratedFields() {
    const next = { ...fieldsRef.current };
    // Only discard untouched suggestions when the source photo changes.
    for (const field of generatedFields.current) {
      next[field] = EMPTY_FIELDS[field];
      edits.current[field] = 0;
    }
    generatedFields.current.clear();
    fieldsRef.current = next;
    setFields(next);
  }

  async function analyzePhoto(selected: SelectedPhoto) {
    analysisController.current?.abort();
    const controller = new AbortController();
    analysisController.current = controller;
    const requestId = ++analysisRequest.current;
    const startingEdits = { ...edits.current };
    const eligible = SUGGESTED_FIELDS.filter((field) =>
      edits.current[field] === 0 || generatedFields.current.has(field) || !fieldsRef.current[field].trim()
    );
    setAnalysisStatus('loading');
    setAnalysisMessage('Analizando tu artículo…');

    try {
      const result = await postMultipart<PhotoAnalysis>(
        '/products/analyze-photo', {}, { photo: selected },
        { timeoutMs: 50_000, signal: controller.signal }
      );
      if (!mounted.current || requestId !== analysisRequest.current) return;

      const suggestions = result.suggestions;
      const suggestedPrice = suggestions.estimatedStartingPrice;
      const next = { ...fieldsRef.current };
      const values: Partial<SuggestedFields> = {
        catalogDescription: suggestions.catalogDescription,
        fullDescription: suggestions.fullDescription,
        ...(Number.isInteger(suggestions.pieceCount) && Number(suggestions.pieceCount) > 0
          ? { pieceCount: String(suggestions.pieceCount) } : {}),
        estimatedStartingPrice: typeof suggestedPrice === 'number' && Number.isFinite(suggestedPrice)
          && suggestedPrice > 0 && suggestedPrice <= MAX_STARTING_PRICE
          ? suggestedPrice.toFixed(2).replace('.', ',') : '',
      };
      let applied = 0;
      for (const field of eligible) {
        // A response arriving while someone types must never replace their edits.
        if (edits.current[field] !== startingEdits[field]) continue;
        const value = values[field];
        if (field === 'estimatedStartingPrice' && value === '') {
          // No reliable estimate: leave this optional field blank, without
          // discarding the other suggestions or a price entered manually.
          next[field] = '';
          generatedFields.current.delete(field);
          continue;
        }
        if (typeof value !== 'string' || !value.trim()) continue;
        next[field] = value.trim();
        generatedFields.current.add(field);
        applied += 1;
      }
      fieldsRef.current = next;
      setFields(next);
      setAnalysisStatus('success');
      setAnalysisMessage(applied > 0
        ? 'Completamos los campos disponibles con sugerencias de IA. Revisalas y corregí lo que haga falta.'
        : 'Conservamos los datos que escribiste. Podés borrar un campo y volver a analizar para recibir una sugerencia.');
    } catch (err) {
      if (!mounted.current || requestId !== analysisRequest.current) return;
      setAnalysisStatus('error');
      setAnalysisMessage(err instanceof Error ? err.message : 'No pudimos analizar la foto. Podés reintentar o completar la ficha manualmente.');
    } finally {
      if (requestId === analysisRequest.current) analysisController.current = null;
    }
  }

  async function pickPhoto(source: 'camera' | 'library') {
    if (pickingRef.current || saving.current || savedProductId.current !== null) return;
    pickingRef.current = true;
    setPicking(true);
    setPhotoError(null);
    try {
      if (source === 'camera' && Platform.OS !== 'web') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!mounted.current) return;
        if (!permission.granted) {
          setPhotoError('Permití el acceso a la cámara o adjuntá una foto de tu galería.');
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: Platform.OS === 'android' ? 1 : 0.8,
      };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (!mounted.current || result.canceled || !result.assets.length) return;

      const asset = result.assets[0];
      const extension = asset.fileName?.split('.').pop()?.toLowerCase();
      const type = asset.mimeType ?? (extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg');
      if (!PHOTO_TYPES.includes(type)) {
        setPhotoError('Elegí una foto JPG, PNG o WebP para completar la ficha.');
        return;
      }
      if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
        setPhotoError('La foto debe pesar hasta 10 MB. Elegí una imagen más pequeña.');
        return;
      }
      const selected = {
        uri: asset.uri,
        name: asset.fileName ?? `articulo-${Date.now()}.${type.split('/')[1]}`,
        type,
      };
      clearGeneratedFields();
      setPhoto(selected);
      void analyzePhoto(selected);
    } catch {
      if (mounted.current) setPhotoError('No se pudo abrir la foto. Intentá adjuntarla desde tu galería.');
    } finally {
      pickingRef.current = false;
      if (mounted.current) setPicking(false);
    }
  }

  function removePhoto() {
    stopAnalysis();
    clearGeneratedFields();
    setPhoto(null);
    setPhotoError(null);
    setAnalysisMessage('');
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!fields.fullDescription.trim()) next.fullDescription = 'La descripción completa es obligatoria';
    const count = Number(fields.pieceCount);
    if (!Number.isSafeInteger(count) || count < 1) next.pieceCount = 'Ingresá una cantidad entera mayor a cero';
    const price = parseStartingPrice(fields.estimatedStartingPrice);
    if (fields.estimatedStartingPrice.trim() && !PRICE_PATTERN.test(fields.estimatedStartingPrice.trim())) {
      next.estimatedStartingPrice = 'Usá puntos para miles y coma para hasta 2 decimales. Ej: 15.000,50';
    } else if (price !== null && (!Number.isFinite(price) || price <= 0 || price > MAX_STARTING_PRICE)) {
      next.estimatedStartingPrice = 'Ingresá un importe mayor a 0 y de hasta ARS 1.000.000.000, o dejalo vacío';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleNext() {
    if (saving.current || pickingRef.current || analysisStatus === 'loading') return;
    if (savedProductId.current === null && !validate()) return;
    saving.current = true;
    setLoading(true);
    setErrors({});

    try {
      let productId = savedProductId.current;
      const retryingUpload = productId !== null;
      if (productId === null) {
        const estimatedStartingPrice = parseStartingPrice(fields.estimatedStartingPrice);
        const product = await post<Product>('/products', {
          fullDescription: fields.fullDescription.trim(),
          ...(fields.catalogDescription.trim() && { catalogDescription: fields.catalogDescription.trim() }),
          ...(artist.trim() && { artist: artist.trim() }),
          ...(historicalDate.trim() && { historicalDate: historicalDate.trim() }),
          ...(history.trim() && { history: history.trim() }),
          pieceCount: Number(fields.pieceCount),
          ...(estimatedStartingPrice !== null && { estimatedStartingPrice }),
        });
        productId = product.id;
        savedProductId.current = product.id;
        if (mounted.current) setCreatedProductId(product.id);
      }

      if (photo) {
        // A timed out upload may already have succeeded. Check the saved draft
        // before retrying, and never POST a second product after an upload error.
        const existing = retryingUpload ? await get<Product>(`/products/${productId}`) : null;
        if (!existing?.photos.length) {
          await postMultipart<Photo>(`/products/${productId}/photos`, {}, { photo });
        }
      }
      if (mounted.current) router.replace(`/items/${productId}/photos`);
    } catch (err) {
      if (!mounted.current) return;
      const detail = err instanceof Error ? err.message : 'Intentá nuevamente.';
      setErrors({ general: savedProductId.current !== null
        ? `Tu artículo quedó guardado, pero no pudimos confirmar la carga de la foto. ${detail} Reintentá la carga o continuá para agregar las fotos después.`
        : `No se pudo crear el artículo. ${detail}` });
    } finally {
      saving.current = false;
      if (mounted.current) setLoading(false);
    }
  }

  const analyzing = analysisStatus === 'loading';
  const locked = loading || createdProductId !== null;

  return (
    <ScreenContainer scrollable header={<AppBar title="Nuevo artículo" />}>
      {errors.general ? (
        <View style={styles.errorBanner} accessibilityLiveRegion="polite">
          <Text style={styles.errorBannerText}>{errors.general}</Text>
        </View>
      ) : null}

      <View style={styles.photoCard}>
        <Text style={styles.photoTitle}>Empezá con una foto</Text>
        <Text style={styles.helper}>
          Adjuntá una foto para sugerir el título, la descripción, las piezas visibles y un precio de inicio orientativo. También podés completar todo manualmente.
        </Text>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="contain" accessibilityLabel="Foto elegida para el artículo" />
        ) : null}
        <View style={styles.photoActions}>
          <Button title="Tomar foto" variant="outline" onPress={() => void pickPhoto('camera')} disabled={locked || picking} style={styles.photoButton} />
          <Button title={photo ? 'Cambiar foto' : 'Adjuntar foto'} variant="outline" onPress={() => void pickPhoto('library')} disabled={locked || picking} style={styles.photoButton} />
        </View>
        <Text style={styles.helper}>JPG, PNG o WebP · Hasta 10 MB. La foto se envía a Google Gemini para el análisis.</Text>
        {photoError ? <Text style={styles.errorBannerText} accessibilityLiveRegion="polite">{photoError}</Text> : null}
        {analysisMessage ? (
          <View style={styles.analysisNotice} accessibilityLiveRegion="polite">
            {analyzing ? <ActivityIndicator color={colors.brand.primary} /> : null}
            <Text style={[styles.analysisText, analysisStatus === 'error' && styles.errorBannerText]}>{analysisMessage}</Text>
          </View>
        ) : null}
        {photo && !locked ? (
          <View style={styles.analysisActions}>
            {analyzing ? (
              <Button title="Completar manualmente" variant="ghost" onPress={stopAnalysis} />
            ) : (
              <Button title={analysisStatus === 'success' ? 'Volver a analizar' : 'Reintentar análisis'} variant="ghost" onPress={() => void analyzePhoto(photo)} disabled={picking} />
            )}
            <Button title="Quitar foto" variant="ghost" onPress={removePhoto} disabled={picking} />
          </View>
        ) : null}
      </View>

      <Field
        label="Título para catálogo"
        value={fields.catalogDescription}
        onChangeText={(value) => changeField('catalogDescription', value)}
        placeholder="Ej: Juego de tazas con diseño floral"
        editable={!locked}
      />

      <Field
        label="Descripción completa"
        required
        value={fields.fullDescription}
        onChangeText={(value) => changeField('fullDescription', value)}
        error={errors.fullDescription}
        placeholder="Describí el artículo y su estado"
        multiline
        numberOfLines={4}
        editable={!locked}
      />

      <Field
        label="Cantidad de piezas"
        value={fields.pieceCount}
        onChangeText={(value) => changeField('pieceCount', value)}
        error={errors.pieceCount}
        placeholder="1"
        keyboardType="numeric"
        editable={!locked}
      />

      <Field
        label="Precio de inicio sugerido (ARS)"
        value={fields.estimatedStartingPrice}
        onChangeText={(value) => changeField('estimatedStartingPrice', value)}
        error={errors.estimatedStartingPrice}
        placeholder="Opcional. Ej: 15.000,50"
        keyboardType="decimal-pad"
        editable={!locked}
      />
      <Text style={styles.manualNotice}>
        Importe orientativo a partir de la foto, pendiente de revisión. No es una tasación ni garantiza el precio de venta. Podés modificarlo o dejarlo vacío. Usá coma para decimales.
      </Text>

      <Text style={styles.manualNotice}>Completá autor, época y procedencia con información que conozcas. Estos datos no se deducen de la foto.</Text>

      <Field label="Artista / autor" value={artist} onChangeText={setArtist} placeholder="Opcional" editable={!locked} />
      <Field label="Época / fecha histórica" value={historicalDate} onChangeText={setHistoricalDate} placeholder="Ej: Siglo XIX, 1890" editable={!locked} />
      <Field
        label="Historia / procedencia"
        value={history}
        onChangeText={setHistory}
        placeholder="Cómo llegó a tus manos, procedencia..."
        multiline
        numberOfLines={3}
        editable={!locked}
      />

      <Button
        title={createdProductId !== null ? 'Reintentar carga de foto' : 'Continuar con las fotos'}
        onPress={() => void handleNext()}
        loading={loading}
        disabled={analyzing || picking}
        style={styles.button}
      />
      {createdProductId !== null && !loading ? (
        <Button title="Continuar y agregar fotos después" variant="ghost" onPress={() => router.replace(`/items/${createdProductId}/photos`)} />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  photoCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.background.card,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  photoTitle: { ...typography.heading3, color: colors.text.primary },
  helper: { ...typography.bodySmall, color: colors.text.secondary },
  preview: { width: '100%', height: 220, borderRadius: radius.sm, backgroundColor: colors.background.secondary },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoButton: { flex: 1, minWidth: 130 },
  analysisNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.feedback.infoBackground },
  analysisText: { ...typography.bodySmall, color: colors.text.brand, flex: 1 },
  analysisActions: { gap: spacing.md },
  manualNotice: { ...typography.bodySmall, color: colors.text.secondary, marginBottom: spacing.md },
  errorBanner: {
    backgroundColor: colors.feedback.errorBackground,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorBannerText: { ...typography.bodySmall, color: colors.feedback.error },
  button: { marginTop: spacing.lg, marginBottom: spacing.md },
});
