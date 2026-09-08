import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing, radius } from '@/theme';
import type { AuctionCatalog } from '@/api/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2;

export default function AuctionCatalogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [catalog, setCatalog] = useState<AuctionCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    get<AuctionCatalog>(`/auctions/${id}/catalog`)
      .then(setCatalog)
      .catch(() => setError('No se pudo cargar el catálogo.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <AppBar title="Catálogo" />
        <Loading />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.container}>
        <AppBar title="Catálogo" />
        <ErrorView message={error} onRetry={load} />
      </View>
    );
  }

  const items = catalog?.items ?? [];

  return (
    <View style={styles.container}>
      <AppBar
        title={catalog?.description ?? 'Catálogo'}
        rightAction={<Text style={styles.headerMeta}>{items.length} piezas</Text>}
      />

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState title="Sin ítems" message="Este catálogo no tiene ítems todavía." />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, item.status === 'active' && styles.cardActive]}
            onPress={() => router.push(`/item/${item.id}`)}
            activeOpacity={0.75}
          >
            <View style={[styles.imgBox, item.status === 'active' && styles.imgBoxLive]}>
              <Text style={styles.imgLotText}>#{item.lotNumber}</Text>
              {item.status === 'active' && (
                <View style={styles.livePill}>
                  <Text style={styles.livePillText}>● En vivo</Text>
                </View>
              )}
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.lotLabel}>Lote {item.lotNumber}</Text>
              <Text style={styles.itemDesc} numberOfLines={2}>
                {item.catalogDescription ?? 'Sin descripción'}
              </Text>

              {item.basePrice !== null && item.basePrice !== undefined ? (
                <Text style={styles.price}>
                  Base {item.basePrice >= 1000
                    ? `${(item.basePrice / 1000).toFixed(0)}k`
                    : item.basePrice.toLocaleString('es-AR')}
                </Text>
              ) : (
                <Text style={styles.priceMuted}>Iniciá sesión para ver</Text>
              )}

              {item.status === 'sold' && (
                <View style={styles.soldPill}>
                  <Text style={styles.soldPillText}>Vendido</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },

  headerMeta: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },

  list: { padding: spacing.md, paddingBottom: 40 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  row: { gap: spacing.sm, marginBottom: spacing.sm },

  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  cardActive: { borderColor: colors.feedback.live, borderWidth: 2 },

  imgBox: {
    height: 88,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  imgBoxLive: { backgroundColor: '#FEF2F2' },
  imgLotText: { ...typography.caption, color: colors.text.tertiary },

  livePill: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.feedback.live,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  livePillText: { fontSize: 9, color: '#fff', fontWeight: '700' },

  cardBody: { padding: spacing.sm },
  lotLabel: { ...typography.caption, color: colors.text.tertiary, marginBottom: 2 },
  itemDesc: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '600', marginBottom: 4, lineHeight: 18 },
  price: { ...typography.caption, color: colors.brand.primary, fontWeight: '700' },
  priceMuted: { ...typography.caption, color: colors.text.tertiary, fontStyle: 'italic' },

  soldPill: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.background.secondary,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  soldPillText: { ...typography.caption, color: colors.text.secondary },
});
