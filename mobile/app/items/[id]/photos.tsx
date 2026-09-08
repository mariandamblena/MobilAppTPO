import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { postMultipart } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Button } from '@/components/Button';
import { colors, typography, spacing } from '@/theme';
import type { Photo } from '@/api/types';

const MIN_PHOTOS = 6;

export default function PhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickAndUpload() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    setUploading(true);
    setError(null);

    try {
      const photo = await postMultipart<Photo>(
        `/products/${id}/photos`,
        {},
        {
          photo: {
            uri: asset.uri,
            name: `photo-${Date.now()}.jpg`,
            type: asset.mimeType ?? 'image/jpeg',
          },
        }
      );
      setPhotos((prev) => [...prev, photo]);
    } catch {
      setError('No se pudo subir la foto. Intentá de nuevo.');
    } finally {
      setUploading(false);
    }
  }

  function handleContinue() {
    router.push(`/items/${id}/declare`);
  }

  const ready = photos.length >= MIN_PHOTOS;

  return (
    <ScreenContainer header={<AppBar title="Fotos del artículo" />}>
      <View style={styles.counter}>
        <Text style={[styles.counterText, ready && styles.counterReady]}>
          {photos.length}/{MIN_PHOTOS} fotos {ready ? '✓' : 'mínimas'}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
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
          <TouchableOpacity style={styles.addBtn} onPress={pickAndUpload} disabled={uploading}>
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
        disabled={!ready}
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
