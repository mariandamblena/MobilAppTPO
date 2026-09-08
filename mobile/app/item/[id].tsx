import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing, radius } from '@/theme';
import type { CatalogItemFull } from '@/api/types';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [item, setItem] = useState<CatalogItemFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    get<CatalogItemFull>(`/items/${id}`)
      .then(setItem)
      .catch(() => setError('No se pudo cargar el ítem.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return (
      <View style={styles.screen}>
        <AppBar title="Ítem" />
        <Loading />
      </View>
    );
  }
  if (error || !item) {
    return (
      <View style={styles.screen}>
        <AppBar title="Ítem" />
        <ErrorView message={error ?? 'Error'} onRetry={load} />
      </View>
    );
  }

  const photos = item.product?.photos ?? [];
  const isActive = item.status === 'active';

  const metaParts = [
    item.product?.artist,
    item.product?.historicalDate,
    item.product?.pieceCount && item.product.pieceCount > 1
      ? `${item.product.pieceCount} piezas`
      : null,
  ].filter(Boolean) as string[];

  return (
    <View style={styles.screen}>
      <AppBar title={`Pieza #${item.lotNumber}`} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {photos.length > 0 ? (
        <Image source={{ uri: photos[0] }} style={styles.mainPhoto} resizeMode="cover" />
      ) : (
        <View style={styles.mainPhotoPlaceholder}>
          <Text style={styles.placeholderText}>Sin foto</Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.thumbScroll}
        contentContainerStyle={styles.thumbContent}
      >
        {photos.length > 1
          ? photos.slice(1, 6).map((url) => (
              <Image key={url} source={{ uri: url }} style={styles.thumb} resizeMode="cover" />
            ))
          : [1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={styles.thumbPlaceholder}>
                <Text style={styles.thumbPlaceholderText}>{i}</Text>
              </View>
            ))}
      </ScrollView>

      <View style={styles.titleBlock}>
        {isActive && (
          <View style={styles.livePill}>
            <Text style={styles.livePillText}>● En vivo</Text>
          </View>
        )}
        <Text style={styles.title}>{item.product?.catalogDescription ?? 'Sin descripción'}</Text>
        {metaParts.length > 0 && (
          <Text style={styles.meta}>{metaParts.join(' · ')}</Text>
        )}
      </View>

      {/* Price + commission side by side */}
      <View style={styles.boxRow}>
        <View style={styles.infoBox}>
          <Text style={styles.boxLabel}>Precio base</Text>
          {item.basePrice !== null && item.basePrice !== undefined ? (
            <Text style={styles.boxValue}>${item.basePrice.toLocaleString('es-AR')}</Text>
          ) : (
            <Text style={styles.boxValueMuted}>— sesión</Text>
          )}
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.boxLabel}>Comisión</Text>
          <Text style={styles.boxValue}>{(item.commission * 100).toFixed(0)}%</Text>
        </View>
      </View>

      {/* Best bid when active */}
      {isActive && item.bestBid != null && (
        <View style={styles.bidBox}>
          <Text style={styles.bidLabel}>Mejor oferta</Text>
          <Text style={styles.bidValue}>${item.bestBid.toLocaleString('es-AR')}</Text>
          {item.minBidAllowed != null && (
            <Text style={styles.minBid}>Mínima: ${item.minBidAllowed.toLocaleString('es-AR')}</Text>
          )}
        </View>
      )}

      {/* Historia */}
      {item.product?.history && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Historia</Text>
          <Text style={styles.historyText}>{item.product.history}</Text>
        </View>
      )}

      {/* Full description */}
      {item.product?.fullDescription && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Descripción</Text>
          <Text style={styles.historyText}>{item.product.fullDescription}</Text>
        </View>
      )}

      {/* CTA — ir al remate en vivo (o ver la subasta si está programada) */}
      {item.auctionId != null && item.auctionStatus !== 'closed' && (
        <View style={styles.ctaRow}>
          {item.auctionStatus === 'open' ? (
            <Button
              title="Ir a la subasta"
              variant="accent"
              onPress={() => router.push(`/auction/${item.auctionId}`)}
            />
          ) : (
            <Button
              title="Ver subasta"
              variant="outline"
              onPress={() => router.push(`/auction-detail/${item.auctionId}`)}
            />
          )}
        </View>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.primary },
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { paddingBottom: spacing.xxl },

  mainPhoto: { width: SCREEN_WIDTH, height: 220 },
  mainPhotoPlaceholder: {
    width: SCREEN_WIDTH,
    height: 220,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: { ...typography.bodySmall, color: colors.text.tertiary },

  thumbScroll: {
    backgroundColor: colors.background.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  thumbContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: spacing.xs },
  thumb: { width: 52, height: 52, borderRadius: 6 },
  thumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 6,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: { ...typography.caption, color: colors.text.tertiary },

  titleBlock: { padding: spacing.md },
  livePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.feedback.live,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: spacing.xs,
  },
  livePillText: { fontSize: 11, color: colors.text.inverse, fontWeight: '700', letterSpacing: 0.5 },
  title: { ...typography.heading3, color: colors.text.primary, marginBottom: 4 },
  meta: { ...typography.bodySmall, color: colors.text.secondary },

  boxRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  infoBox: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  boxLabel: { ...typography.overline, color: colors.text.tertiary, marginBottom: 4 },
  boxValue: { ...typography.body, color: colors.text.primary, fontWeight: '700' },
  boxValueMuted: { ...typography.bodySmall, color: colors.text.tertiary, fontStyle: 'italic' },

  bidBox: {
    backgroundColor: colors.brand.primaryLight,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.brand.primary + '30',
  },
  bidLabel: { ...typography.overline, color: colors.brand.primary, marginBottom: 4 },
  bidValue: { ...typography.heading2, color: colors.brand.primary },
  minBid: { ...typography.caption, color: colors.brand.primary, marginTop: 4 },

  section: { paddingHorizontal: spacing.md, marginBottom: spacing.md },
  sectionLabel: { ...typography.overline, color: colors.text.tertiary, marginBottom: spacing.xs },
  historyText: { ...typography.bodySmall, color: colors.text.secondary, lineHeight: 20 },

  ctaRow: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
});
