import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { get, postMultipart } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { colors, typography, spacing } from '@/theme';
import type { Photo, Product } from '@/api/types';

const MIN_PHOTOS = 6;

export default function PhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Incluye la foto adjunta al crear la ficha y las de un borrador retomado.
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoadingPhotos(true);
    setLoadError(false);
    setError(null);
    get<Product>(`/products/${id}`)
      .then((product) => { if (active) setPhotos(product.photos ?? []); })
      .catch(() => {
        if (active) {
          setLoadError(true);
          setError('No se pudieron cargar las fotos del artículo. Reintentá para continuar.');
        }
      })
      .finally(() => { if (active) setLoadingPhotos(false); });
    return () => { active = false; };
  }, [id, reloadKey]));

  async function pickAndUpload() {
    if (uploading || loadingPhotos || loadError) return;
    setUploading(true);
    setError(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        // Android compresses WebP to JPEG below quality 1 but retains its MIME.
        quality: Platform.OS === 'android' ? 1 : 0.8,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? 'image/jpeg';
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        setError('Elegí una imagen JPEG, PNG o WebP.');
        return;
      }
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
        setError('La foto debe pesar hasta 10 MB.');
        return;
      }
      const photo = await postMultipart<Photo>(
        `/products/${id}/photos`,
        {},
        {
          photo: {
            uri: asset.uri,
            name: asset.fileName ?? `photo-${Date.now()}.${mimeType.split('/')[1]}`,
            type: mimeType,
          },
        }
      );
      setPhotos((prev) => prev.some((item) => item.id === photo.id) ? prev : [...prev, photo]);
    } catch {
      setError('No se pudo subir la foto. Intentá de nuevo.');
    } finally {
      setUploading(false);
    }
  }

  function handleContinue() {
    if (loadingPhotos || loadError || uploading || photos.length < MIN_PHOTOS) return;
    router.push(`/items/${id}/declare`);
  }

  const ready = !loadingPhotos && !loadError && photos.length >= MIN_PHOTOS;

  return (
    <ScreenContainer header={<AppBar title="Fotos del artículo" />}>
      <View style={styles.counter}>
        <Text style={[styles.counterText, ready && styles.counterReady]}>
          {loadingPhotos ? 'Cargando fotos…' : `${photos.length}/${MIN_PHOTOS} fotos ${ready ? '✓' : 'mínimas'}`}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      ) : null}

      {loadError ? (
        <Button title="Reintentar carga" onPress={() => setReloadKey((value) => value + 1)} />
      ) : null}

      <FlatList
        data={photos}
        keyExtractor={(item) => String(item.id)}
        numColumns={3}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <Image source={{ uri: item.photoUrl }} style={styles.thumb} />
        )}
        ListFooterComponent={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={pickAndUpload}
            disabled={uploading || loadingPhotos || loadError}
            accessibilityRole="button"
            accessibilityLabel="Agregar foto del artículo"
          >
            {uploading ? (
              <ActivityIndicator color={colors.brand.primary} />
            ) : (
              <Text style={styles.addBtnText}>+ Agregar</Text>
            )}
          </TouchableOpacity>
        }
        style={styles.grid}
      />

      <Button
        title="Continuar"
        onPress={handleContinue}
        disabled={!ready || uploading}
        style={styles.button}
      />
    </ScreenContainer>
  );
}

const THUMB_SIZE = 100;

const styles = StyleSheet.create({
  counter: { marginBottom: spacing.md },
  counterText: { ...typography.label, color: colors.text.secondary },
  counterReady: { color: colors.feedback.success },
  errorBanner: {
    backgroundColor: colors.feedback.errorBackground,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorBannerText: { ...typography.bodySmall, color: colors.feedback.error },
  grid: { marginBottom: spacing.md },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    margin: 2,
    borderRadius: 4,
    backgroundColor: colors.background.secondary,
  },
  addBtn: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    margin: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.secondary,
  },
  addBtnText: { ...typography.bodySmall, color: colors.brand.primary },
  button: { marginTop: spacing.lg },
});
